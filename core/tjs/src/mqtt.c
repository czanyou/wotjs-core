#include "quickjs.h"
#include "tjs.h"
#include "util/dbuffer.h"

#include "MQTTPacket.h"

#include <string.h>

enum _mqtt_parser_event {
    MQTT_PARSER_EVENT_MESSAGE_BEGIN = 0,
    MQTT_PARSER_EVENT_MESSAGE,
    MQTT_PARSER_EVENT_MAX,
};

typedef struct _mqtt_parser {
    JSContext* ctx;
    JSValue events[MQTT_PARSER_EVENT_MAX];
    dbuffer_t buffer;
    size_t buffer_offset;
    size_t value_count;
} mqtt_parser_t;

static JSClassID mqtt_parser_class_id;
static mqtt_parser_t* mqtt_parser_get(JSContext* ctx, JSValueConst obj);
static void mqtt_parser_event_emit(mqtt_parser_t* parser, int event, JSValue arg);

static void mqtt_parser_finalizer(JSRuntime* runtime, JSValue value)
{
    CHECK_NOT_NULL(runtime);

    mqtt_parser_t* parser = JS_GetOpaque(value, mqtt_parser_class_id);
    if (parser) {
        for (int i = 0; i < MQTT_PARSER_EVENT_MAX; i++) {
            JSValue event = parser->events[i];
            parser->events[i] = JS_UNDEFINED;
            JS_FreeValueRT(runtime, event);
        }

        dbuffer_free(&parser->buffer);

        parser->buffer_offset = 0;
        parser->value_count = 0;

        free(parser);
    }
}

static void mqtt_parser_mark(JSRuntime* runtime, JSValueConst value, JS_MarkFunc* mark_func)
{
    CHECK_NOT_NULL(runtime);

    mqtt_parser_t* parser = JS_GetOpaque(value, mqtt_parser_class_id);
    if (parser) {
        for (int i = 0; i < MQTT_PARSER_EVENT_MAX; i++) {
            JS_MarkValue(runtime, parser->events[i], mark_func);
        }
    }
}

static JSClassDef mqtt_parser_class = {
    "MQTTParser",
    .finalizer = mqtt_parser_finalizer,
    .gc_mark = mqtt_parser_mark,
};

static JSValue mqtt_parser_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);

    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    CHECK_NOT_NULL(parser);

    for (int i = 0; i < MQTT_PARSER_EVENT_MAX; i++) {
        JSValue event = parser->events[i];
        parser->events[i] = JS_UNDEFINED;
        JS_FreeValue(ctx, event);
    }

    dbuffer_free(&parser->buffer);

    parser->buffer_offset = 0;
    parser->value_count = 0;

    return JS_UNDEFINED;
}

static JSValue mqtt_parser_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);

    int r;

    JSValue result = JS_NewObjectClass(ctx, mqtt_parser_class_id);
    if (JS_IsException(result)) {
        return result;
    }

    mqtt_parser_t* parser = calloc(1, sizeof(*parser));
    if (!parser) {
        JS_FreeValue(ctx, result);
        return JS_EXCEPTION;
    }

    dbuffer_init(&parser->buffer);
    parser->ctx = ctx;
    parser->buffer_offset = 0;
    parser->value_count = 0;

    for (int i = 0; i < MQTT_PARSER_EVENT_MAX; i++) {
        parser->events[i] = JS_UNDEFINED;
    }

    JS_SetOpaque(result, parser);
    return result;
}

static mqtt_parser_t* mqtt_parser_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, mqtt_parser_class_id);
}

static int mqtt_parser_on_message(mqtt_parser_t* parser, uint8_t* packet, int offset, size_t packet_length)
{
    CHECK_NOT_NULL(parser);
    JSContext* ctx = parser->ctx;
    CHECK_NOT_NULL(ctx);

    MQTTHeader header = { 0 };
    header.byte = packet[0];
    uint32_t type = header.bits.type;
    size_t message_size = offset + packet_length;

    JSValue message = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, message, "type", JS_NewInt32(ctx, type), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, message, "length", JS_NewInt32(ctx, message_size), JS_PROP_C_W_E);

    if (type == PUBLISH) {
        unsigned char dup;
        int qos;
        unsigned char retained;
        unsigned short packet_id;
        int payload_size = 0;
        unsigned char* payload_data = NULL;

        MQTTString topic_name;
        memset(&topic_name, 0, sizeof(topic_name));

        int ret = MQTTDeserialize_publish(&dup, &qos, &retained, &packet_id, &topic_name,
            &payload_data, &payload_size, packet, message_size);
        if (ret == 1) {
            if (payload_size > 0) {
                uint8_t* payload = js_malloc(ctx, payload_size);
                memcpy(payload, payload_data, payload_size);
                JS_DefinePropertyValueStr(ctx, message, "payload", TJS_NewArrayBuffer(ctx, payload, payload_size), JS_PROP_C_W_E);
            }

            if (topic_name.lenstring.data) {
                JS_DefinePropertyValueStr(ctx, message, "topic", JS_NewStringLen(ctx, topic_name.lenstring.data, topic_name.lenstring.len), JS_PROP_C_W_E);
            }

            JS_DefinePropertyValueStr(ctx, message, "dup", JS_NewInt32(ctx, dup), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, message, "qos", JS_NewInt32(ctx, qos), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, message, "packetId", JS_NewInt32(ctx, packet_id), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, message, "retained", JS_NewInt32(ctx, retained), JS_PROP_C_W_E);
        }

    } else if (type == SUBACK) {
        int count = 0;
        unsigned short packet_id;
        int granted_qos = 0; // QOS0;
        int ret = MQTTDeserialize_suback(&packet_id, 1, &count, &granted_qos, packet, message_size);
        if (ret == 1) {
            JS_DefinePropertyValueStr(ctx, message, "count", JS_NewInt32(ctx, count), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, message, "qos", JS_NewInt32(ctx, granted_qos), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, message, "packetId", JS_NewInt32(ctx, packet_id), JS_PROP_C_W_E);
        }

    } else if (type == UNSUBACK) {
        unsigned short packet_id;
        int ret = MQTTDeserialize_unsuback(&packet_id, packet, message_size);
        if (ret == 1) {
            JS_DefinePropertyValueStr(ctx, message, "packetId", JS_NewInt32(ctx, packet_id), JS_PROP_C_W_E);
        }

    } else if (type == PUBACK) {
        unsigned char packet_type, dup;
        unsigned short packet_id;
        int ret = MQTTDeserialize_ack(&packet_type, &dup, &packet_id, packet, message_size);
        if (ret == 1) {
            JS_DefinePropertyValueStr(ctx, message, "dup", JS_NewInt32(ctx, dup), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, message, "packetId", JS_NewInt32(ctx, packet_id), JS_PROP_C_W_E);
        }

    } else if (type == CONNACK) {
        unsigned char session_present = 0;
        unsigned char return_code = 0;
        int ret = MQTTDeserialize_connack(&session_present, &return_code, packet, message_size);
        if (ret == 1) {
            JS_DefinePropertyValueStr(ctx, message, "returnCode", JS_NewInt32(ctx, return_code), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, message, "sessionPresent", JS_NewInt32(ctx, session_present), JS_PROP_C_W_E);
        }
    }

    mqtt_parser_event_emit(parser, MQTT_PARSER_EVENT_MESSAGE, message);
    return 0;
}

static void mqtt_parser_event_emit(mqtt_parser_t* parser, int event, JSValue arg)
{
    CHECK_NOT_NULL(parser);

    JSContext* ctx = parser->ctx;
    CHECK_NOT_NULL(ctx);

    JSValue callback = parser->events[event];
    if (!JS_IsFunction(ctx, callback)) {
        JS_FreeValue(ctx, arg);
        return;
    }

    JSValue func = JS_DupValue(ctx, callback);
    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, 1, (JSValueConst*)&arg);
    if (JS_IsException(ret)) {
        TJS_DumpError(ctx);
    }

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);
}

static JSValue mqtt_parser_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    CHECK_NOT_NULL(ctx);

    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    if (!parser) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, parser->events[magic]);
}

static JSValue mqtt_parser_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    CHECK_NOT_NULL(ctx);

    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    CHECK_NOT_NULL(parser);

    if (JS_IsUndefined(value) || JS_IsNull(value)) {
        JSValue callback = parser->events[magic];
        parser->events[magic] = JS_UNDEFINED;
        JS_FreeValue(ctx, callback);

    } else if (JS_IsFunction(ctx, value)) {
        JSValue callback = parser->events[magic];
        parser->events[magic] = JS_DupValue(ctx, value);
        JS_FreeValue(ctx, callback);
    }

    return JS_UNDEFINED;
}

static JSValue mqtt_parser_execute(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    CHECK_NOT_NULL(parser);

    tjs_buffer_t data = TJS_GetArrayBuffer(ctx, argv[0]);
    if (JS_IsException(data.error)) {
        return data.error;
    }

    dbuffer_t* buffer = &parser->buffer;
    dbuffer_put(buffer, data.data, data.length);

    size_t data_size = buffer->size - parser->buffer_offset;
    while (data_size >= 2) {
        uint8_t* buffer_data = buffer->buf + parser->buffer_offset;
        MQTTHeader header = { 0 };
        header.byte = buffer_data[0];
        uint32_t type = header.bits.type;

        int packet_length = 0;
        int offset = 1;
        int ret = MQTTPacket_decodeBuf(buffer_data + offset, &packet_length);
        offset += ret;
        int total_length = packet_length + offset;
        if (data_size < total_length) {
            break;
        }

        // printf("%d: %d: %d, %d\r\n", type, ret, packet_length, data_size - 2);
        mqtt_parser_on_message(parser, buffer_data, offset, packet_length);

        data_size -= total_length;
        buffer_data += total_length;
        parser->buffer_offset += total_length;

        if (data_size == 0) {
            buffer->size = 0;
            parser->buffer_offset = 0;
        }
    }

    if (data.is_string) {
        JS_FreeCString(ctx, data.data);
    }

    return JS_UNDEFINED;
}

static JSValue mqtt_parser_reset(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);

    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    CHECK_NOT_NULL(parser);

    dbuffer_free(&parser->buffer);
    dbuffer_init(&parser->buffer);

    parser->buffer_offset = 0;

    return JS_UNDEFINED;
}

static JSValue mqtt_parser_compact(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    CHECK_NOT_NULL(parser);

    dbuffer_t* buffer = &parser->buffer;
    if (parser->buffer_offset > 0) {
        size_t size = buffer->size - parser->buffer_offset;
        uint8_t* source = buffer->buf + size;
        memmove(buffer->buf, source, size);

        buffer->size -= parser->buffer_offset;
        parser->buffer_offset = 0;
    }

    return JS_UNDEFINED;
}

static JSValue mqtt_parser_capacity(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    CHECK_NOT_NULL(parser);

    return JS_NewUint32(ctx, parser->buffer.allocated_size);
}

static JSValue mqtt_parser_size(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    CHECK_NOT_NULL(parser);

    return JS_NewUint32(ctx, parser->buffer.size);
}

static JSValue mqtt_parser_offset(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    mqtt_parser_t* parser = mqtt_parser_get(ctx, this_val);
    CHECK_NOT_NULL(parser);

    return JS_NewUint32(ctx, parser->buffer_offset);
}

static const JSCFunctionListEntry mqtt_parser_proto_funcs[] = {
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "MQTTParser", JS_PROP_CONFIGURABLE),
    JS_CGETSET_MAGIC_DEF("onmessagebegin", mqtt_parser_event_get, mqtt_parser_event_set, MQTT_PARSER_EVENT_MESSAGE_BEGIN),
    JS_CGETSET_MAGIC_DEF("onmessage", mqtt_parser_event_get, mqtt_parser_event_set, MQTT_PARSER_EVENT_MESSAGE),
    JS_CFUNC_DEF("capacity", 0, mqtt_parser_capacity),
    JS_CFUNC_DEF("close", 0, mqtt_parser_close),
    JS_CFUNC_DEF("compact", 0, mqtt_parser_compact),
    JS_CFUNC_DEF("execute", 1, mqtt_parser_execute),
    JS_CFUNC_DEF("offset", 0, mqtt_parser_offset),
    JS_CFUNC_DEF("reset", 0, mqtt_parser_reset),
    JS_CFUNC_DEF("size", 0, mqtt_parser_size)
};

///////////////////////////////////////////////////////////////////////////////
// mqtt parser

/**
 * 消息类型
 */
static JSValue mqtt_parse(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    tjs_buffer_t buffer = TJS_GetArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    MQTTHeader header = { 0 };
    header.byte = buffer.data[0];
    uint32_t type = header.bits.type;

    if (buffer.is_string) {
        JS_FreeCString(ctx, buffer.data);
    }

    return JS_NewUint32(ctx, type);
}

///////////////////////////////////////////////////////////////////////////////
// mqtt encoder

static JSValue mqtt_encode_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    JSValue options = argv[0];
    if (!JS_IsObject(options)) {
        return JS_UNDEFINED;
    }

    MQTTPacket_connectData data = MQTTPacket_connectData_initializer;
    data.clientID.cstring = NULL;
    data.keepAliveInterval = 60;
    data.cleansession = 1;
    data.username.cstring = NULL;
    data.password.cstring = NULL;

    // username
    JSValue usernameString = JS_GetPropertyStr(ctx, options, "username");
    const char* username = JS_ToCString(ctx, usernameString);
    JS_FreeValue(ctx, usernameString);
    if (username) {
        data.username.cstring = (char*)username;
    }

    // password
    JSValue passwordString = JS_GetPropertyStr(ctx, options, "password");
    const char* password = JS_ToCString(ctx, passwordString);
    JS_FreeValue(ctx, passwordString);
    if (password) {
        data.password.cstring = (char*)password;
    }

    // clientId
    JSValue clientIdString = JS_GetPropertyStr(ctx, options, "clientId");
    const char* clientId = JS_ToCString(ctx, clientIdString);
    JS_FreeValue(ctx, clientIdString);
    if (clientId) {
        data.clientID.cstring = (char*)clientId;
    }

    // keepAliveInterval
    JSValue keepaliveString = JS_GetPropertyStr(ctx, options, "keepalive");
    uint32_t keepAliveInterval = 60;
    int ret = JS_ToUint32(ctx, &keepAliveInterval, keepaliveString);
    JS_FreeValue(ctx, keepaliveString);
    if (ret == 0) {
        data.keepAliveInterval = keepAliveInterval;
    }

    // keepAliveInterval
    {
        JSValue valueString = JS_GetPropertyStr(ctx, options, "clean");
        if (!JS_IsUndefined(valueString)) {
            uint32_t cleansession = 1;
            int ret = JS_ToUint32(ctx, &cleansession, valueString);
            JS_FreeValue(ctx, valueString);
            if (ret == 0) {
                data.cleansession = cleansession;
            }
        }
    }

    // encode
    int buffer_length = 200;
    uint8_t* buffer = js_malloc(ctx, buffer_length);
    int len = MQTTSerialize_connect(buffer, buffer_length, &data);

    if (username) {
        JS_FreeCString(ctx, username);
    }

    if (password) {
        JS_FreeCString(ctx, password);
    }

    if (clientId) {
        JS_FreeCString(ctx, clientId);
    }

    return TJS_NewArrayBuffer(ctx, buffer, len);
}

static JSValue mqtt_encode_ping(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    int buffer_length = 200;
    uint8_t* buffer = js_malloc(ctx, buffer_length);
    int len = MQTTSerialize_pingreq(buffer, buffer_length);
    return TJS_NewArrayBuffer(ctx, buffer, len);
}

static JSValue mqtt_encode_disconnect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    int buffer_length = 200;
    uint8_t* buffer = js_malloc(ctx, buffer_length);
    int len = MQTTSerialize_disconnect(buffer, buffer_length);
    return TJS_NewArrayBuffer(ctx, buffer, len);
}

static JSValue mqtt_encode_subscribe(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    if (argc < 3) {
        return JS_UNDEFINED;
    }

    size_t topic_length;
    const char* topic = JS_ToCStringLen(ctx, &topic_length, argv[0]);
    if (!topic) {
        return JS_EXCEPTION;
    }

    int packet_id = 1;
    int dup = 0;

    JS_ToInt32(ctx, &dup, argv[1]);
    JS_ToInt32(ctx, &packet_id, argv[2]);

    JSValue result = JS_UNDEFINED;
    int buffer_length = topic_length + 100;
    uint8_t* buffer = js_malloc(ctx, buffer_length);

    MQTTString topic_string = MQTTString_initializer;
    topic_string.cstring = (char*)topic;

    int req_qos = 0;
    int len = MQTTSerialize_subscribe(buffer, buffer_length, dup, packet_id, 1, &topic_string, &req_qos);
    if (len <= 0) {
        js_free(ctx, buffer);
        goto exit;
    }

    result = TJS_NewArrayBuffer(ctx, buffer, len);

exit:
    if (topic) {
        JS_FreeCString(ctx, topic);
    }

    return result;
}

static JSValue mqtt_encode_unsubscribe(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    if (argc < 3) {
        return JS_UNDEFINED;
    }

    size_t topic_length;
    const char* topic = JS_ToCStringLen(ctx, &topic_length, argv[0]);
    if (!topic) {
        return JS_EXCEPTION;
    }

    int dup = 0;
    int packet_id = 0;

    JS_ToInt32(ctx, &dup, argv[1]);
    JS_ToInt32(ctx, &packet_id, argv[2]);

    JSValue result = JS_UNDEFINED;
    int buffer_length = topic_length + 100;
    uint8_t* buffer = js_malloc(ctx, buffer_length);

    MQTTString topic_string = MQTTString_initializer;
    topic_string.cstring = (char*)topic;
    int len = MQTTSerialize_unsubscribe(buffer, buffer_length, dup, packet_id, 1, &topic_string);
    if (len <= 0) {
        js_free(ctx, buffer);
        goto exit;
    }

    result = TJS_NewArrayBuffer(ctx, buffer, len);

exit:
    if (topic) {
        JS_FreeCString(ctx, topic);
    }

    return result;
}

static JSValue mqtt_encode_publish(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    if (argc < 6) {
        return JS_UNDEFINED;
    }

    // topic
    size_t topic_length;
    const char* topic = JS_ToCStringLen(ctx, &topic_length, argv[0]);
    if (!topic) {
        return JS_EXCEPTION;
    }

    // payload
    tjs_buffer_t payload = TJS_ToArrayBuffer(ctx, argv[1]);
    if (JS_IsException(payload.error)) {
        if (topic) {
            JS_FreeCString(ctx, topic);
        }

        return payload.error;
    }

    int dup = 0;
    int qos = 0;
    int retained = 0;
    int packet_id = 0;

    JS_ToInt32(ctx, &dup, argv[2]);
    JS_ToInt32(ctx, &qos, argv[3]);
    JS_ToInt32(ctx, &retained, argv[4]);
    JS_ToInt32(ctx, &packet_id, argv[5]);

    JSValue result = JS_UNDEFINED;
    int buffer_length = payload.length + topic_length + 256;
    uint8_t* buffer = js_malloc(ctx, buffer_length);

    MQTTString topic_string = MQTTString_initializer;
    topic_string.cstring = (char*)topic;
    int len = MQTTSerialize_publish(buffer, buffer_length, dup, qos, retained, packet_id, topic_string, payload.data, payload.length);
    if (len <= 0) {
        js_free(ctx, buffer);
        goto exit;
    }

    result = TJS_NewArrayBuffer(ctx, buffer, len);

exit:
    if (payload.is_string) {
        JS_FreeCString(ctx, payload.data);
    }

    if (topic) {
        JS_FreeCString(ctx, topic);
    }

    return result;
}

///////////////////////////////////////////////////////////////////////////////
// mqtt

static const JSCFunctionListEntry mqtt_module_funcs[] = {
    TJS_CONST(CONNACK),
    TJS_CONST(CONNECT),
    TJS_CONST(DISCONNECT),
    TJS_CONST(PINGREQ),
    TJS_CONST(PINGRESP),
    TJS_CONST(PUBACK),
    TJS_CONST(PUBCOMP),
    TJS_CONST(PUBLISH),
    TJS_CONST(PUBREC),
    TJS_CONST(PUBREL),
    TJS_CONST(SUBACK),
    TJS_CONST(SUBSCRIBE),
    TJS_CONST(UNSUBACK),
    TJS_CONST(UNSUBSCRIBE),

    TJS_CONST(MQTT_BAD_USERNAME_OR_PASSWORD),
    TJS_CONST(MQTT_CLIENTID_REJECTED),
    TJS_CONST(MQTT_CONNECTION_ACCEPTED),
    TJS_CONST(MQTT_NOT_AUTHORIZED),
    TJS_CONST(MQTT_SERVER_UNAVAILABLE),
    TJS_CONST(MQTT_UNNACCEPTABLE_PROTOCOL),

    TJS_CFUNC_DEF("encodeConnect", 1, mqtt_encode_connect),
    TJS_CFUNC_DEF("encodeDisconnect", 0, mqtt_encode_disconnect),
    TJS_CFUNC_DEF("encodePing", 0, mqtt_encode_ping),
    TJS_CFUNC_DEF("encodePublish", 3, mqtt_encode_publish),
    TJS_CFUNC_DEF("encodeSubscribe", 2, mqtt_encode_subscribe),
    TJS_CFUNC_DEF("encodeUnsubscribe", 1, mqtt_encode_unsubscribe),
    TJS_CFUNC_DEF("parse", 1, mqtt_parse)
};

void tjs_mod_mqtt_init(JSContext* ctx, JSModuleDef* module)
{
    JSValue mqtt = JS_NewObject(ctx);

    /* class */
    JS_NewClassID(&mqtt_parser_class_id);
    JS_NewClass(JS_GetRuntime(ctx), mqtt_parser_class_id, &mqtt_parser_class);
    JSValue prototype = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, prototype, mqtt_parser_proto_funcs, countof(mqtt_parser_proto_funcs));
    JS_SetClassProto(ctx, mqtt_parser_class_id, prototype);

    /* object */
    JSValue parserClass = JS_NewCFunction2(ctx, mqtt_parser_constructor, "MQTTParser", 1, JS_CFUNC_constructor, 0);
    JS_DefinePropertyValueStr(ctx, mqtt, "Parser", parserClass, JS_PROP_C_W_E);

    JS_SetPropertyFunctionList(ctx, mqtt, mqtt_module_funcs, countof(mqtt_module_funcs));
    JS_SetModuleExport(ctx, module, "mqtt", mqtt);
}

void tjs_mod_mqtt_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "mqtt");
}
