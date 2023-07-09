#include "mqtt/mqtt-client.h"
#include "util/log.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

#define TAG "mqtt-test"

static mqtt_client_t* mqtt_client = NULL;

static void mqtt_client_on_message(mqtt_client_t* client, int event, int type, const void* data, void* param)
{
    if (event == MQTT_CLIENT_EVENT_ERROR) {
        LOGT_I("error.");
        mqtt_client_close(mqtt_client);

    } else if (event == MQTT_CLIENT_EVENT_STATE_CHANGE) {
        LOGT_I("state change (%d).", type);

    } else if (event == MQTT_CLIENT_EVENT_PUBLISH) {
        const mqtt_publish_data_t* publish = (mqtt_publish_data_t*)data;
        LOGT_I("publish: (topic=%s) size=%d: payload=%s", publish->topic, publish->payload_size, publish->payload);

    } else if (event == MQTT_CLIENT_EVENT_MESSAGE) {
        // LOGT_I("message: %d", type);

        if (type == 2) { // CONNACK
            LOGT_I("subscribe 'test'.");
            mqtt_client_subscribe(mqtt_client, "test", 0, 0);

        } else if (type == 3) { // PUBLISH
            LOGT_I("unsubscribe 'test'.");
            mqtt_client_unsubscribe(mqtt_client, "test", 0);

        } else if (type == 9) { // SUBACK
            const char* data = "test";
            size_t length = strlen(data);
            LOGT_I("publish data to 'test'.");
            mqtt_client_publish(mqtt_client, "test", data, length, 0, 0, 0);

        } else if (type == 11) { // UNSUBACK
            LOGT_I("ping.");
            mqtt_client_ping(mqtt_client);

        } else if (type == 13) { // PONG
            LOGT_I("disconnect.");
            mqtt_client_disconnect(mqtt_client);
        }
    }
}

static mqtt_client_settings_t settings = { 0 };

static int mqtt_client_start(uv_loop_t* loop)
{
    mqtt_client = mqtt_client_create(loop);
    mqtt_client_set_handler(mqtt_client, mqtt_client_on_message, NULL);

    const char* url_string = "mqtts://localhost/";
    mqtt_client_open(mqtt_client, url_string, &settings);

    return 0;
}

int main(int argc, char** argv)
{
    setenv("MALLOC_TRACE", "./output/dump.log", 1);
    // mtrace();

    int c = 0;
    uv_loop_t* loop = uv_default_loop();
    mqtt_client_start(loop);

    uv_run(loop, UV_RUN_DEFAULT);

    mqtt_client_close(mqtt_client);
    free(mqtt_client);
    mqtt_client = NULL;

    uv_loop_close(loop);
    loop = NULL;

    // mtrace ./output/dump.log $MALLOC_TRACE
    // muntrace();

    // system("mtrace ./build/local/mqttc ./output/dump.log");
    return 0;
}
