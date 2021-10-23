#include "wotjs.h"

#include "mqtt-packet/MQTTPacket.h"

enum _mqtt_parser_event {
    MQTT_PARSER_EVENT_MESSAGE_BEGIN = 0,
    MQTT_PARSER_EVENT_MESSAGE,
    MQTT_PARSER_EVENT_MAX,
};

typedef struct _mqtt_parser {
    JSContext* ctx;
    JSValue events[MQTT_PARSER_EVENT_MAX];
    DynBuf buffer;
    size_t bufferOffset;
    size_t valueCount;
} TJSMqttParser;

static JSClassID tjs_mqtt_parser_class_id;

static void tjs_mqtt_parser_finalizer(JSRuntime* runtime, JSValue val)
{
    TJSMqttParser* mqttParser = JS_GetOpaque(val, tjs_mqtt_parser_class_id);
    if (mqttParser) {
        for (int i = 0; i < MQTT_PARSER_EVENT_MAX; i++) {
            JS_FreeValueRT(runtime, mqttParser->events[i]);
        }

        dbuf_free(&mqttParser->buffer);

        mqttParser->bufferOffset = 0;
        mqttParser->valueCount = 0;

        free(mqttParser);
    }
}

static void tjs_mqtt_parser_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSMqttParser* mqttParser = JS_GetOpaque(val, tjs_mqtt_parser_class_id);
    if (mqttParser) {
        for (int i = 0; i < MQTT_PARSER_EVENT_MAX; i++) {
            JS_MarkValue(runtime, mqttParser->events[i], mark_func);
        }
    }
}

static JSClassDef tjs_mqtt_parser_class = {
    "MQTTParser",
    .finalizer = tjs_mqtt_parser_finalizer,
    .gc_mark = tjs_mqtt_parser_mark,
};

static void tjs_mqtt_parser_emit_event(TJSMqttParser* mqttParser, int event, JSValue arg)
{
    JSContext* ctx = mqttParser->ctx;
    JSValue callback = mqttParser->events[event];
    if (!JS_IsFunction(ctx, callback)) {
        JS_FreeValue(ctx, arg);
        return;
    }

    JSValue func = JS_DupValue(ctx, callback);
    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, 1, (JSValueConst*)&arg);
    if (JS_IsException(ret)) {
        tjs_dump_error(ctx);
    }

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);
}

static TJSMqttParser* tjs_mqtt_parser_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_mqtt_parser_class_id);
}

static int tjs_mqtt_parser_on_message_begin(TJSMqttParser* mqttParser)
{
    tjs_mqtt_parser_emit_event(mqttParser, MQTT_PARSER_EVENT_MESSAGE_BEGIN, JS_UNDEFINED);
    return 0;
}

static int tjs_mqtt_parser_on_message(TJSMqttParser* mqttParser, uint8_t* packet, int offset, size_t packetLength)
{
    JSContext* ctx = mqttParser->ctx;
    MQTTHeader header = { 0 };
    header.byte = packet[0];
    uint32_t type = header.bits.type;
    size_t messageSize = offset + packetLength;

    JSValue message = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, message, "type", JS_NewInt32(ctx, type), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, message, "length", JS_NewInt32(ctx, messageSize), JS_PROP_C_W_E);

    if (type == PUBLISH) {
        unsigned char dup;
        int qos;
        unsigned char retained;
        unsigned short packetId;
        int payloadSize = 0;
        unsigned char* payloadData = NULL;

        MQTTString topicName;
        memset(&topicName, 0, sizeof(topicName));

        int ret = MQTTDeserialize_publish(&dup, &qos, &retained, &packetId, &topicName,
            &payloadData, &payloadSize, packet, messageSize);

        if (payloadSize > 0) {
            char* payload = js_malloc(ctx, payloadSize);
            memcpy(payload, payloadData, payloadSize);
            JS_DefinePropertyValueStr(ctx, message, "payload", TJS_NewArrayBuffer(ctx, (uint8_t*)payload, payloadSize), JS_PROP_C_W_E);
        }

        if (topicName.lenstring.data) {
            JS_DefinePropertyValueStr(ctx, message, "topic", JS_NewStringLen(ctx, topicName.lenstring.data, topicName.lenstring.len), JS_PROP_C_W_E);
        }

        JS_DefinePropertyValueStr(ctx, message, "dup", JS_NewInt32(ctx, dup), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, message, "qos", JS_NewInt32(ctx, qos), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, message, "packetId", JS_NewInt32(ctx, packetId), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, message, "retained", JS_NewInt32(ctx, retained), JS_PROP_C_W_E);
    }

    tjs_mqtt_parser_emit_event(mqttParser, MQTT_PARSER_EVENT_MESSAGE, message);
    return 0;
}

static JSValue tjs_mqtt_encode_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
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
    int buflen = 200;
    unsigned char* buf = js_malloc(ctx, buflen);
    int len = 0;

    len = MQTTSerialize_connect(buf, buflen, &data);

    if (username) {
        JS_FreeCString(ctx, username);
    }

    if (password) {
        JS_FreeCString(ctx, password);
    }

    if (clientId) {
        JS_FreeCString(ctx, clientId);
    }

    return TJS_NewArrayBuffer(ctx, (uint8_t*)buf, len);
}

static JSValue tjs_mqtt_encode_ping(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int buflen = 200;
    unsigned char* buf = js_malloc(ctx, buflen);
    int len = MQTTSerialize_pingreq(buf, buflen);
    return TJS_NewArrayBuffer(ctx, (uint8_t*)buf, len);
}

static JSValue tjs_mqtt_encode_disconnect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int buflen = 200;
    unsigned char* buf = js_malloc(ctx, buflen);
    int len = MQTTSerialize_disconnect(buf, buflen);
    return TJS_NewArrayBuffer(ctx, (uint8_t*)buf, len);
}

static JSValue tjs_mqtt_encode_subscribe(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue jsData = argv[0];
    if (!JS_IsString(jsData)) {
        return JS_UNDEFINED;
    }

    size_t topicSize;
    char* topic = (char*)JS_ToCStringLen(ctx, &topicSize, jsData);
    if (!topic) {
        return JS_EXCEPTION;
    }

    int buflen = topicSize + 100;
    unsigned char* buf = js_malloc(ctx, buflen);
    int packetId = 1;
    int req_qos = 0;
    int dup = 0;

    JS_ToInt32(ctx, &dup, argv[1]);
    JS_ToInt32(ctx, &packetId, argv[2]);

    MQTTString topicString = MQTTString_initializer;
    topicString.cstring = topic;
    int len = MQTTSerialize_subscribe(buf, buflen, dup, packetId, 1, &topicString, &req_qos);

    JS_FreeCString(ctx, topic);
    return TJS_NewArrayBuffer(ctx, (uint8_t*)buf, len);
}

static JSValue tjs_mqtt_encode_unsubscribe(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue jsData = argv[0];
    if (!JS_IsString(jsData)) {
        return JS_UNDEFINED;
    }

    size_t topicSize;
    char* topic = (char*)JS_ToCStringLen(ctx, &topicSize, jsData);
    if (!topic) {
        return JS_EXCEPTION;
    }

    int buflen = topicSize + 100;
    unsigned char* buf = js_malloc(ctx, buflen);
    int packetId = 1;
    int req_qos = 0;
    int dup = 0;

    JS_ToInt32(ctx, &dup, argv[1]);
    JS_ToInt32(ctx, &packetId, argv[2]);

    MQTTString topicString = MQTTString_initializer;
    topicString.cstring = topic;
    int len = MQTTSerialize_unsubscribe(buf, buflen, dup, packetId, 1, &topicString);

    JS_FreeCString(ctx, topic);
    return TJS_NewArrayBuffer(ctx, (uint8_t*)buf, len);
}

static JSValue tjs_mqtt_encode_publish(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    // topic
    JSValue jsData = argv[0];
    if (!JS_IsString(jsData)) {
        return JS_UNDEFINED;
    }

    size_t topicSize;
    char* topic = (char*)JS_ToCStringLen(ctx, &topicSize, jsData);
    if (!topic) {
        return JS_EXCEPTION;
    }

    // payload
    JSValue jsPayloadData = argv[1];
    bool isString = false;
    size_t payloadSize;
    char* payload;

    if (JS_IsString(jsPayloadData)) {
        isString = true;
        payload = (char*)JS_ToCStringLen(ctx, &payloadSize, jsPayloadData);
        if (!payload) {
            JS_FreeCString(ctx, topic);
            return JS_EXCEPTION;
        }

    } else {
        payload = JS_GetArrayBuffer(ctx, &payloadSize, jsPayloadData);
        if (payload == NULL) {
            size_t aoffset, asize;
            JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsPayloadData, &aoffset, &asize, NULL);
            if (JS_IsException(abuf)) {
                JS_FreeCString(ctx, topic);
                return abuf;
            }

            payload = (char*)JS_GetArrayBuffer(ctx, &payloadSize, abuf);
            JS_FreeValue(ctx, abuf);
            if (!payload) {
                JS_FreeCString(ctx, topic);
                return JS_EXCEPTION;
            }

            payload += aoffset;
            payloadSize = asize;
        }
    }

    int buflen = payloadSize + topicSize + 256;
    unsigned char* buf = js_malloc(ctx, buflen);
    int msgid = 1;
    int dup = 0;
    int qos = 0;
    int retained = 0;
    int packetId = 0;

    JS_ToInt32(ctx, &dup, argv[2]);
    JS_ToInt32(ctx, &qos, argv[3]);
    JS_ToInt32(ctx, &retained, argv[4]);
    JS_ToInt32(ctx, &packetId, argv[5]);

    MQTTString topicString = MQTTString_initializer;
    topicString.cstring = topic;
    int len = MQTTSerialize_publish(buf, buflen, dup, qos, retained, packetId, topicString, (unsigned char*)payload, payloadSize);

    if (isString) {
        JS_FreeCString(ctx, payload);
    }

    JS_FreeCString(ctx, topic);
    return TJS_NewArrayBuffer(ctx, (uint8_t*)buf, len);
}

static JSValue tjs_mqtt_parse_connack(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    unsigned char sessionPresent, connack_rc;

    JSValue jsData = argv[0];
    size_t size;
    char* buf;

    buf = JS_GetArrayBuffer(ctx, &size, jsData);
    if (buf == NULL) {
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
        if (JS_IsException(abuf)) {
            return abuf;
        }

        buf = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf) {
            return JS_EXCEPTION;
        }

        buf += aoffset;
        size = asize;
    }

    if (MQTTDeserialize_connack(&sessionPresent, &connack_rc, buf, size) != 1 || connack_rc != 0) {
        return JS_UNDEFINED;
    }

    return JS_NewInt32(ctx, connack_rc);
}

static JSValue tjs_mqtt_parse_ack(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue jsData = argv[0];
    size_t size;
    char* buf;

    buf = JS_GetArrayBuffer(ctx, &size, jsData);
    if (buf == NULL) {
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
        if (JS_IsException(abuf)) {
            return abuf;
        }

        buf = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf) {
            return JS_EXCEPTION;
        }

        buf += aoffset;
        size = asize;
    }

    unsigned short packetId;
    unsigned char packetType;
    unsigned char dup;

    if (MQTTDeserialize_ack(&packetType, &dup, &packetId, buf, size) != 1) {
        return JS_UNDEFINED;
    }

    return JS_NewInt32(ctx, packetId);
}

static JSValue tjs_mqtt_parse_suback(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue jsData = argv[0];
    size_t size;
    char* buf;

    buf = JS_GetArrayBuffer(ctx, &size, jsData);
    if (buf == NULL) {
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
        if (JS_IsException(abuf)) {
            return abuf;
        }

        buf = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf) {
            return JS_EXCEPTION;
        }

        buf += aoffset;
        size = asize;
    }

    unsigned short packetId;
    int count;
    int grantedQoS;

    if (MQTTDeserialize_suback(&packetId, 1, &count, &grantedQoS, buf, size) != 1) {
        return JS_UNDEFINED;
    }

    return JS_NewInt32(ctx, grantedQoS);
}

static JSValue tjs_mqtt_parse_publish(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue jsData = argv[0];
    size_t messageSize;
    char* message;

    message = JS_GetArrayBuffer(ctx, &messageSize, jsData);
    if (message == NULL) {
        size_t aoffset, asize;
        JSValue arrayBuffer = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
        if (JS_IsException(arrayBuffer)) {
            return arrayBuffer;
        }

        message = (char*)JS_GetArrayBuffer(ctx, &messageSize, arrayBuffer);
        JS_FreeValue(ctx, arrayBuffer);
        if (!message) {
            return JS_EXCEPTION;
        }

        message += aoffset;
        messageSize = asize;
    }

    unsigned char dup;
    int qos;
    unsigned char retained;
    unsigned short packetId;
    int payloadSize = 0;
    unsigned char* payloadData = NULL;

    MQTTString topicName;
    memset(&topicName, 0, sizeof(topicName));

    int ret = MQTTDeserialize_publish(&dup, &qos, &retained, &packetId, &topicName,
        &payloadData, &payloadSize, message, messageSize);

    JSValue result = JS_NewObjectProto(ctx, JS_NULL);

    if (payloadSize > 0) {
        char* payload = js_malloc(ctx, payloadSize);
        memcpy(payload, payloadData, payloadSize);
        JS_DefinePropertyValueStr(ctx, result, "message", TJS_NewArrayBuffer(ctx, (uint8_t*)payload, payloadSize), JS_PROP_C_W_E);
    }

    if (topicName.lenstring.data) {
        JS_DefinePropertyValueStr(ctx, result, "topic", JS_NewStringLen(ctx, topicName.lenstring.data, topicName.lenstring.len), JS_PROP_C_W_E);
    }

    JS_DefinePropertyValueStr(ctx, result, "ret", JS_NewInt32(ctx, ret), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "mid", JS_NewInt32(ctx, packetId), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "length", JS_NewInt32(ctx, topicName.lenstring.len), JS_PROP_C_W_E);

    return result;
}

static JSValue tjs_mqtt_parse_header(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue jsData = argv[0];
    size_t size;
    char* buf;

    buf = JS_GetArrayBuffer(ctx, &size, jsData);
    if (buf == NULL) {
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
        if (JS_IsException(abuf)) {
            return abuf;
        }

        buf = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf) {
            return JS_EXCEPTION;
        }

        buf += aoffset;
        size = asize;
    }

    MQTTHeader header = { 0 };
    header.byte = buf[0];
    uint32_t type = header.bits.type;

    return JS_NewUint32(ctx, type);
}

static JSValue tjs_mqtt_parse(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue jsData = argv[0];
    size_t size;
    char* buf;

    buf = JS_GetArrayBuffer(ctx, &size, jsData);
    if (buf == NULL) {
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
        if (JS_IsException(abuf)) {
            return abuf;
        }

        buf = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf) {
            return JS_EXCEPTION;
        }

        buf += aoffset;
        size = asize;
    }

    MQTTHeader header = { 0 };
    header.byte = buf[0];
    uint32_t type = header.bits.type;

    return JS_NewUint32(ctx, type);
}

static JSValue tjs_new_mqtt_parser(JSContext* ctx)
{
    TJSMqttParser* mqttParser;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_mqtt_parser_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    mqttParser = calloc(1, sizeof(*mqttParser));
    if (!mqttParser) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    mqttParser->ctx = ctx;

    dbuf_init(&mqttParser->buffer);

    mqttParser->bufferOffset = 0;
    mqttParser->valueCount = 0;

    JS_SetOpaque(obj, mqttParser);
    return obj;
}

static JSValue tjs_mqtt_parser_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    return tjs_new_mqtt_parser(ctx);
}

static JSValue tjs_mqtt_parser_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSMqttParser* mqttParser = tjs_mqtt_parser_get(ctx, this_val);
    if (!mqttParser) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, mqttParser->events[magic]);
}

static JSValue tjs_mqtt_parser_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSMqttParser* mqttParser = tjs_mqtt_parser_get(ctx, this_val);
    if (!mqttParser) {
        return JS_EXCEPTION;
    }

    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, mqttParser->events[magic]);
        mqttParser->events[magic] = JS_DupValue(ctx, value);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_mqtt_parser_execute(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSMqttParser* mqttParser = tjs_mqtt_parser_get(ctx, this_val);
    if (!mqttParser) {
        return JS_EXCEPTION;
    }

    JSValue jsData = argv[0];
    size_t size;
    char* buf;

    buf = JS_GetArrayBuffer(ctx, &size, jsData);
    if (buf == NULL) {
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
        if (JS_IsException(abuf)) {
            return abuf;
        }

        buf = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
        JS_FreeValue(ctx, abuf);
        if (!buf) {
            return JS_EXCEPTION;
        }

        buf += aoffset;
        size = asize;
    }

    DynBuf* buffer = &mqttParser->buffer;
    dbuf_put(buffer, buf, size);

    size_t dataSize = buffer->size - mqttParser->bufferOffset;

    while (dataSize >= 2) {
        uint8_t* data = buffer->buf + mqttParser->bufferOffset;
        MQTTHeader header = { 0 };
        header.byte = data[0];
        uint32_t type = header.bits.type;

        int packetLength = 0;
        int offset = 1;
        int ret = MQTTPacket_decodeBuf(data + offset, &packetLength);
        offset += ret;
        int totalLength = packetLength + offset;
        if (dataSize < totalLength) {
            break;
        }

        // printf("%d: %d: %d, %d\r\n", type, ret, packetLength, dataSize - 2);
        tjs_mqtt_parser_on_message(mqttParser, data, offset, packetLength);

        dataSize -= totalLength;
        data += totalLength;
        mqttParser->bufferOffset += totalLength;

        if (dataSize == 0) {
            buffer->size = 0;
            mqttParser->bufferOffset = 0;
        }
    }

    return JS_UNDEFINED;
}

static JSValue tjs_mqtt_parser_reset(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSMqttParser* mqttParser = tjs_mqtt_parser_get(ctx, this_val);
    if (!mqttParser) {
        return JS_EXCEPTION;
    }

    dbuf_free(&mqttParser->buffer);
    dbuf_init(&mqttParser->buffer);

    mqttParser->bufferOffset = 0;

    return JS_UNDEFINED;
}

static JSValue tjs_mqtt_parser_compact(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSMqttParser* mqttParser = tjs_mqtt_parser_get(ctx, this_val);
    if (!mqttParser) {
        return JS_EXCEPTION;
    }

    DynBuf* buffer = &mqttParser->buffer;
    if (mqttParser->bufferOffset > 0) {
        size_t size = buffer->size - mqttParser->bufferOffset;
        uint8_t* source = buffer->buf + size;
        memmove(buffer->buf, source, size);

        buffer->size -= mqttParser->bufferOffset;
        mqttParser->bufferOffset = 0;
    }

    return JS_UNDEFINED;
}

static JSValue tjs_mqtt_parser_capacity(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSMqttParser* mqttParser = tjs_mqtt_parser_get(ctx, this_val);
    if (!mqttParser) {
        return JS_EXCEPTION;
    }

    return JS_NewUint32(ctx, mqttParser->buffer.allocated_size);
}

static JSValue tjs_mqtt_parser_size(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSMqttParser* mqttParser = tjs_mqtt_parser_get(ctx, this_val);
    if (!mqttParser) {
        return JS_EXCEPTION;
    }

    return JS_NewUint32(ctx, mqttParser->buffer.size);
}

static JSValue tjs_mqtt_parser_offset(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSMqttParser* mqttParser = tjs_mqtt_parser_get(ctx, this_val);
    if (!mqttParser) {
        return JS_EXCEPTION;
    }

    return JS_NewUint32(ctx, mqttParser->bufferOffset);
}

static const JSCFunctionListEntry tjs_mqtt_parser_proto_funcs[] = {
    JS_CGETSET_MAGIC_DEF("onmessagebegin", tjs_mqtt_parser_event_get, tjs_mqtt_parser_event_set, MQTT_PARSER_EVENT_MESSAGE_BEGIN),
    JS_CGETSET_MAGIC_DEF("onMessage", tjs_mqtt_parser_event_get, tjs_mqtt_parser_event_set, MQTT_PARSER_EVENT_MESSAGE),
    JS_CFUNC_MAGIC_DEF("capacity", 0, tjs_mqtt_parser_capacity, 1),
    JS_CFUNC_MAGIC_DEF("compact", 0, tjs_mqtt_parser_compact, 1),
    JS_CFUNC_MAGIC_DEF("execute", 1, tjs_mqtt_parser_execute, 2),
    JS_CFUNC_MAGIC_DEF("offset", 0, tjs_mqtt_parser_offset, 3),
    JS_CFUNC_MAGIC_DEF("reset", 0, tjs_mqtt_parser_reset, 4),
    JS_CFUNC_MAGIC_DEF("size", 0, tjs_mqtt_parser_size, 5)
};

static const JSCFunctionListEntry tjs_mqtt_class_funcs[] = {
    JS_PROP_INT32_DEF("CONNECT", CONNECT, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("CONNACK", CONNACK, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("PUBLISH", PUBLISH, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("PUBACK", PUBACK, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("PUBREC", PUBREC, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("PUBREL", PUBREL, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("PUBCOMP", PUBCOMP, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("SUBSCRIBE", SUBSCRIBE, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("SUBACK", SUBACK, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("UNSUBSCRIBE", UNSUBSCRIBE, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("UNSUBACK", UNSUBACK, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("PINGREQ", PINGREQ, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("PINGRESP", PINGRESP, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("DISCONNECT", DISCONNECT, JS_PROP_ENUMERABLE),

    JS_PROP_INT32_DEF("MQTT_CONNECTION_ACCEPTED", MQTT_CONNECTION_ACCEPTED, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MQTT_UNNACCEPTABLE_PROTOCOL", MQTT_UNNACCEPTABLE_PROTOCOL, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MQTT_CLIENTID_REJECTED", MQTT_CLIENTID_REJECTED, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MQTT_SERVER_UNAVAILABLE", MQTT_SERVER_UNAVAILABLE, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MQTT_BAD_USERNAME_OR_PASSWORD", MQTT_BAD_USERNAME_OR_PASSWORD, JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MQTT_NOT_AUTHORIZED", MQTT_NOT_AUTHORIZED, JS_PROP_ENUMERABLE),

    TJS_CFUNC_DEF("encodeConnect", 1, tjs_mqtt_encode_connect),
    TJS_CFUNC_DEF("encodeDisconnect", 0, tjs_mqtt_encode_disconnect),
    TJS_CFUNC_DEF("encodePing", 0, tjs_mqtt_encode_ping),
    TJS_CFUNC_DEF("encodePublish", 3, tjs_mqtt_encode_publish),
    TJS_CFUNC_DEF("encodeSubscribe", 2, tjs_mqtt_encode_subscribe),
    TJS_CFUNC_DEF("encodeUnsubscribe", 1, tjs_mqtt_encode_unsubscribe),
    TJS_CFUNC_DEF("parseHeader", 1, tjs_mqtt_parse_header),
    TJS_CFUNC_DEF("parseConnack", 1, tjs_mqtt_parse_connack),
    TJS_CFUNC_DEF("parsePublish", 1, tjs_mqtt_parse_publish),
    TJS_CFUNC_DEF("parseSuback", 1, tjs_mqtt_parse_suback),
    TJS_CFUNC_DEF("parseAck", 1, tjs_mqtt_parse_ack),
    TJS_CFUNC_DEF("parse", 1, tjs_mqtt_parse),
};

void tjs_mod_mqtt_init(JSContext* ctx, JSModuleDef* module)
{
    /* class */
    JS_NewClassID(&tjs_mqtt_parser_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_mqtt_parser_class_id, &tjs_mqtt_parser_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_mqtt_parser_proto_funcs, countof(tjs_mqtt_parser_proto_funcs));
    JS_SetClassProto(ctx, tjs_mqtt_parser_class_id, proto);

    /* object */
    JSValue parserClass = JS_NewCFunction2(ctx, tjs_mqtt_parser_constructor, "MQTTParser", 1, JS_CFUNC_constructor, 0);

    JSValue mqtt = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, mqtt, "Parser", parserClass, JS_PROP_C_W_E);
    JS_SetPropertyFunctionList(ctx, mqtt, tjs_mqtt_class_funcs, countof(tjs_mqtt_class_funcs));
    JS_SetModuleExport(ctx, module, "mqtt", mqtt);
}

void tjs_mod_mqtt_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "mqtt");
}
