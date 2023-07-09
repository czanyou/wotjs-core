#include "mqtt/mqtt-client.h"
#include "MQTTPacket.h"
#include "net-transport.h"

#include "url/uri-parser.h"
#include "util/dbuffer.h"
#include "util/log.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

#define TAG "mqtt-client"

struct mqtt_client_s {
    net_transport_t* transport;
    uv_loop_t* loop;
    uv_timer_t timer;
    dbuffer_t read_buffer;
    mqtt_client_event_handler handler;
    char* username;
    char* password;
    char* client_id;
    uint32_t closed;
    uint32_t secure;
    uint32_t keep_alive;
    uint32_t clean_session;
    uint32_t read_offset;
    uint32_t next_packet_id;
    uint32_t ready_state;
    void* data;
};

static void mqtt_client_on_message(mqtt_client_t* self, uint8_t* packet, uint32_t header_length, uint32_t payload_length);
static int mqtt_client_send(mqtt_client_t* self, uint8_t* packet, int32_t length);
static void mqtt_client_set_state(mqtt_client_t* self, int state);

mqtt_client_t* mqtt_client_create(uv_loop_t* loop)
{
    mqtt_client_t* mqtt_client = malloc(sizeof(mqtt_client_t));
    memset(mqtt_client, 0, sizeof(mqtt_client_t));

    mqtt_client->loop = loop;
    mqtt_client->keep_alive = 60;
    mqtt_client->clean_session = 1;
    mqtt_client->ready_state = 0;

    dbuffer_init(&mqtt_client->read_buffer);

    uv_timer_init(loop, &mqtt_client->timer);
    return mqtt_client;
}

static void mqtt_client_on_input(void* transport, const char* data, ssize_t nread)
{
    mqtt_client_t* self = (mqtt_client_t*)transport;
    if (self == NULL) {
        return;
    }

    if (nread <= 0) {
        // LOGT_I("input: %ld", nread);
        mqtt_client_close(self);
        return;
    }

    dbuffer_t* read_buffer = &self->read_buffer;
    dbuffer_put(read_buffer, data, nread);

    uint32_t data_length = read_buffer->size - self->read_offset;
    while (data_length >= 2) {
        uint8_t* packet = read_buffer->buf + self->read_offset;
        MQTTHeader header = { 0 };
        header.byte = packet[0];
        uint32_t type = header.bits.type;

        int payload_length = 0;
        int header_length = 1;
        int ret = MQTTPacket_decodeBuf(packet + header_length, &payload_length);
        header_length += ret;
        int packet_length = header_length + payload_length;
        if (data_length < packet_length) {
            break;
        }

        // LOGT_I("input: type=%d, ret=%d, length=%d, size=%d", type, ret, payload_length, data_length - 2);
        mqtt_client_on_message(self, packet, header_length, payload_length);

        data_length -= packet_length;
        self->read_offset += packet_length;

        if (data_length == 0) {
            read_buffer->size = 0;
            self->read_offset = 0;
        }
    }

    // LOGT_I("on-input: %ld", nread);
}

static void mqtt_client_on_connected(mqtt_client_t* self)
{
    // LOGT_I("connecetd");

    mqtt_client_connect(self);
}

static void mqtt_client_on_error(mqtt_client_t* self, int code, const char* message)
{
    // LOGT_I("error: %d/%s", code, message);

    mqtt_client_event_handler handler = self->handler;
    if (handler) {
        handler(self, MQTT_CLIENT_EVENT_ERROR, code, (void*)message, self->data);
    }
}

static void mqtt_client_on_message(mqtt_client_t* self, uint8_t* packet, uint32_t header_length, uint32_t payload_length)
{
    assert(self != NULL);

    MQTTHeader header = { 0 };
    header.byte = packet[0];
    uint32_t type = header.bits.type;
    size_t packet_length = header_length + payload_length;

    if (type == CONNACK) {
        uint8_t session_present, connack_rc;
        int ret = MQTTDeserialize_connack(&session_present, &connack_rc, packet, packet_length);
        // LOGT_I("onnack: %d:%d", session_present, connack_rc);

        mqtt_client_set_state(self, MQTT_CLIENT_STATE_OPEN);

    } else if (type == SUBACK) {
        uint16_t packet_id;
        int count;
        int granted_qos;

        MQTTDeserialize_suback(&packet_id, 1, &count, &granted_qos, packet, packet_length);
        // LOGT_I("suback: %d:%d", count, granted_qos);

    } else if (type == UNSUBACK) {

    } else if (type == PUBLISH) {
        mqtt_publish_data_t data = { 0 };
        uint16_t packet_id;

        MQTTString topic_name;
        memset(&topic_name, 0, sizeof(topic_name));

        int ret = MQTTDeserialize_publish(&data.dup, &data.qos, &data.retained, &packet_id, &topic_name,
            &data.payload, &data.payload_size, packet, packet_length);

        data.topic = strndup(topic_name.lenstring.data, topic_name.lenstring.len);
        mqtt_client_event_handler handler = self->handler;
        if (handler) {
            handler(self, MQTT_CLIENT_EVENT_PUBLISH, packet_id, (void*)&data, self->data);
        }

        free(data.topic);

    } else if (type == PINGRESP) {
    }

    mqtt_client_event_handler handler = self->handler;
    if (handler) {
        handler(self, MQTT_CLIENT_EVENT_MESSAGE, type, NULL, self->data);
    }
}

static void mqtt_client_on_transport_event(void* transport, int event, int status, void* data)
{
    mqtt_client_t* self = (mqtt_client_t*)transport;

    // LOGT_I("event: %d", event);

    if (event == NET_TRANSPORT_EVENT_CONNECTED) {
        mqtt_client_on_connected(self);

    } else if (event == NET_TRANSPORT_EVENT_ERROR) {
        mqtt_client_on_error(self, status, data);

    } else if (event == NET_TRANSPORT_EVENT_READY) {
        mqtt_client_event_handler handler = self->handler;
        if (handler) {
            handler(self, MQTT_CLIENT_EVENT_READY, status, data, self->data);
        }
    }
}

static void mqtt_client_on_timer(uv_timer_t* handle)
{
    assert(handle != NULL);
    mqtt_client_t* self = (mqtt_client_t*)handle->data;
}

int mqtt_client_close(mqtt_client_t* self)
{
    if (self == NULL) {
        return 0;
    }

    // LOGT_I("close");

    net_transport_t* transport = self->transport;
    if (transport) {
        mqtt_client_set_state(self, MQTT_CLIENT_STATE_CLOSING);
        self->transport = NULL;

        net_transport_destroy(transport);

        // LOGT_I("close");
        free(transport);
    }

    if (self->closed) {
        return 0;
    }

    mqtt_client_set_state(self, MQTT_CLIENT_STATE_CLOSED);
    self->closed = 1;

    dbuffer_free(&self->read_buffer);

    if (self->username) {
        free(self->username);
        self->username = NULL;
    }

    if (self->password) {
        free(self->password);
        self->password = NULL;
    }

    if (self->client_id) {
        free(self->client_id);
        self->username = NULL;
    }

    uv_timer_stop(&self->timer);
    return 0;
}

int mqtt_client_connect(mqtt_client_t* self)
{
    if (self == NULL) {
        return -1;
    }

    MQTTPacket_connectData options = MQTTPacket_connectData_initializer;
    options.clientID.cstring = self->client_id;
    options.keepAliveInterval = self->keep_alive;
    options.cleansession = self->clean_session;
    options.username.cstring = self->username;
    options.password.cstring = self->password;

    if (!options.clientID.cstring) {
        options.clientID.cstring = "mqttc";
    }

    uint32_t buffer_size = 1024;
    uint8_t* buffer = malloc(buffer_size);
    int ret = MQTTSerialize_connect(buffer, buffer_size, &options);
    return mqtt_client_send(self, buffer, ret);
}

int mqtt_client_disconnect(mqtt_client_t* self)
{
    int buffer_length = 64;
    uint8_t* buffer = malloc(buffer_length);
    int ret = MQTTSerialize_disconnect(buffer, buffer_length);
    return mqtt_client_send(self, buffer, ret);
}

int mqtt_client_open(mqtt_client_t* self, const char* url, mqtt_client_settings_t* settings)
{
    assert(self != NULL);
    if (self->transport != NULL) {
        return -1; // Invalid state

    } else if (url == NULL) {
        return -1;
    }

    struct uri_t* uri = uri_parse(url, strlen(url));
    if (uri == NULL) {
        return 0;
    }

    const char* host = uri->host;
    int port = uri->port;

    if (host == NULL) {
        uri_free(uri);
        return 0;
    }

    // LOGT_D("scheme=%s", uri->scheme);
    if (uri->scheme && strcmp(uri->scheme, "mqtts") == 0) {
        self->secure = 1;
    }

    if (port <= 0) {
        port = self->secure ? 8883 : 1883;
    }

    if (settings) {
        if (settings->clean_session) {
            self->clean_session = settings->clean_session;
        }

        if (settings->keep_alive) {
            self->keep_alive = settings->keep_alive;
        }

        if (settings->username) {
            self->username = strdup(settings->username);
        }

        if (settings->password) {
            self->password = strdup(settings->password);
        }

        if (settings->client_id) {
            self->client_id = strdup(settings->client_id);
        }
    }

    net_transport_t* transport = net_transport_create(self->secure);
    net_transport_init(transport, self->loop, self, mqtt_client_on_transport_event, mqtt_client_on_input);

    // transport->loop = self->loop;
    // transport->data = self;
    // transport->on_input = mqtt_client_on_input;
    // transport->on_event = mqtt_client_on_transport_event;

    mqtt_client_set_state(self, MQTT_CLIENT_STATE_OPENDING);

    LOGT_I("connect: %s:%d", host, port);
    net_transport_connect(transport, host, port);

    self->transport = transport;

    self->timer.data = self;
    uv_timer_start(&self->timer, mqtt_client_on_timer, 1000, 1000);

    uri_free(uri);
    return 0;
}

int mqtt_client_is_ready(mqtt_client_t* self)
{
    net_transport_t* transport = self->transport;
    if (transport == NULL) {
        return 0;
    }

    return net_transport_is_ready(transport);
}

int mqtt_client_ping(mqtt_client_t* self)
{
    int buffer_length = 64;
    uint8_t* buffer = malloc(buffer_length);
    int ret = MQTTSerialize_pingreq(buffer, buffer_length);
    return mqtt_client_send(self, buffer, ret);
}

int mqtt_client_publish(mqtt_client_t* self, const char* topic, const uint8_t* data, uint32_t length, uint32_t qos, uint32_t dup, uint32_t retained)
{
    assert(self != NULL);
    if (topic == NULL) {
        return -1;

    } else if (data == NULL || length <= 0) {
        return -1;
    }

    int topic_size = strlen(topic);
    int buffer_length = length + topic_size + 256;
    uint8_t* buffer = malloc(buffer_length);
    // int dup = 0;
    // int qos = 0;
    // int retained = 0;
    int packet_id = self->next_packet_id++;

    MQTTString topic_string = MQTTString_initializer;
    topic_string.cstring = (char*)topic;

    int ret = MQTTSerialize_publish(buffer, buffer_length, dup, qos, retained, packet_id, topic_string, (uint8_t*)data, length);
    return mqtt_client_send(self, buffer, ret);
}

static int mqtt_client_send(mqtt_client_t* self, uint8_t* packet, int32_t length)
{
    if (self == NULL) {
        return -1;
    }

    int ret = -1;
    if (length > 0) {
        ret = net_transport_write(self->transport, packet, length);

    } else {
        LOGT_W("send=%d", length);
    }

    free(packet);
    return ret;
}

int mqtt_client_set_handler(mqtt_client_t* self, mqtt_client_event_handler handler, void* data)
{
    assert(self != NULL);

    self->handler = handler;
    self->data = data;
}

static void mqtt_client_set_state(mqtt_client_t* self, int state)
{
    // LOGT_I("error: %d/%s", code, message);
    if (self == NULL) {
        return;
    }

    if (self->ready_state == state) {
        return;
    }

    self->ready_state == state;

    mqtt_client_event_handler handler = self->handler;
    if (handler) {
        handler(self, MQTT_CLIENT_EVENT_STATE_CHANGE, state, NULL, self->data);
    }
}

int mqtt_client_subscribe(mqtt_client_t* self, const char* topic, uint32_t qos, uint32_t dup)
{
    assert(self != NULL);
    if (topic == NULL) {
        return -1;
    }

    int topic_length = strlen(topic);
    int buffer_length = topic_length + 100;
    uint8_t* buffer = malloc(buffer_length);

    int packet_id = self->next_packet_id++;
    // int req_qos = qos;
    // int dup = 0;

    MQTTString topic_string = MQTTString_initializer;
    topic_string.cstring = (char*)topic;

    int ret = MQTTSerialize_subscribe(buffer, buffer_length, dup, packet_id, 1, &topic_string, &qos);
    return mqtt_client_send(self, buffer, ret);
}

int mqtt_client_unsubscribe(mqtt_client_t* self, const char* topic, uint32_t dup)
{
    assert(self != NULL);
    if (topic == NULL) {
        return -1;
    }

    int topic_length = strlen(topic);
    int buffer_length = topic_length + 100;
    uint8_t* buffer = malloc(buffer_length);

    int packet_id = self->next_packet_id++;
    // int dup = 0;

    MQTTString topic_string = MQTTString_initializer;
    topic_string.cstring = (char*)topic;

    int ret = MQTTSerialize_unsubscribe(buffer, buffer_length, dup, packet_id, 1, &topic_string);
    return mqtt_client_send(self, buffer, ret);
}
