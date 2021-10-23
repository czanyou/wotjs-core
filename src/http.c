#include "private.h"
#include "utils.h"

#include "../deps/http/http_parser.h"

enum tjs_http_parser_event_enum {
    HTTP_PARSER_EVENT_MESSAGE_BEGIN = 0,
    HTTP_PARSER_EVENT_URL,
    HTTP_PARSER_EVENT_STATUS,
    HTTP_PARSER_EVENT_HEADER_FIELD,
    HTTP_PARSER_EVENT_HEADER_VALUE,
    HTTP_PARSER_EVENT_HEADERS_COMPLETE,
    HTTP_PARSER_EVENT_BODY,
    HTTP_PARSER_EVENT_MESSAGE_COMPLETE,
    HTTP_PARSER_EVENT_MAX,
};

#define HTTP_HEADER_MAX 20

typedef struct tjs_http_parser_s {
    JSContext* ctx;
    JSValue events[HTTP_PARSER_EVENT_MAX];
    DynBuf url;
    DynBuf status;
    DynBuf fields[HTTP_HEADER_MAX];
    DynBuf values[HTTP_HEADER_MAX];
    size_t fieldCount;
    size_t valueCount;
    struct http_parser parser;
} TJSHttpParser;

static JSClassID tjs_http_parser_class_id;
typedef enum http_parser_type tjs_http_parser_type;

static void tjs_http_parser_finalizer(JSRuntime* runtime, JSValue val)
{
    TJSHttpParser* httpParser = JS_GetOpaque(val, tjs_http_parser_class_id);
    if (httpParser) {
        httpParser->parser.data = NULL;

        for (int i = 0; i < HTTP_PARSER_EVENT_MAX; i++) {
            JS_FreeValueRT(runtime, httpParser->events[i]);
        }

        for (int i = 0; i < HTTP_HEADER_MAX; i++) {
            dbuf_free(&httpParser->fields[i]);
            dbuf_free(&httpParser->values[i]);
        }

        dbuf_free(&httpParser->url);
        dbuf_free(&httpParser->status);

        httpParser->fieldCount = 0;
        httpParser->valueCount = 0;

        free(httpParser);
    }
}

static void tjs_http_parser_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSHttpParser* httpParser = JS_GetOpaque(val, tjs_http_parser_class_id);
    if (httpParser) {
        for (int i = 0; i < HTTP_PARSER_EVENT_MAX; i++) {
            JS_MarkValue(runtime, httpParser->events[i], mark_func);
        }
    }
}

static JSClassDef tjs_http_parser_class = {
    "HTTPParser",
    .finalizer = tjs_http_parser_finalizer,
    .gc_mark = tjs_http_parser_mark,
};

static void tjs_http_parser_emit_event(TJSHttpParser* httpParser, int event, JSValue arg)
{
    JSContext* ctx = httpParser->ctx;
    JSValue callback = httpParser->events[event];
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

static TJSHttpParser* tjs_http_parser_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_http_parser_class_id);
}

static int tjs_http_parser_on_message_begin(http_parser* parser)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_MESSAGE_BEGIN, JS_UNDEFINED);
    return 0;
}

static int tjs_http_parser_on_url(http_parser* parser, const char* at,
    size_t length)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;

    dbuf_put(&httpParser->url, at, length);
    // JSValue value = JS_NewStringLen(httpParser->ctx, at, length);
    // tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_URL, value);
    return 0;
}

static int tjs_http_parser_on_status(http_parser* parser, const char* at,
    size_t length)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;

    dbuf_put(&httpParser->status, at, length);
    // JSValue value = JS_NewStringLen(httpParser->ctx, at, length);
    // tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_STATUS, value);
    return 0;
}

static int tjs_http_parser_on_header_field(http_parser* parser,
    const char* at,
    size_t length)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;

    if (httpParser->fieldCount == httpParser->valueCount) {
        httpParser->fieldCount++;
    }

    if (httpParser->fieldCount >= HTTP_HEADER_MAX) {
        return 0;
    }

    dbuf_put(&httpParser->fields[httpParser->fieldCount], at, length);

    // JSValue value = JS_NewStringLen(httpParser->ctx, at, length);
    // tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_HEADER_FIELD, value);
    return 0;
}

static int tjs_http_parser_on_header_value(http_parser* parser,
    const char* at,
    size_t length)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    if (httpParser->fieldCount != httpParser->valueCount) {
        httpParser->valueCount++;
    }

    if (httpParser->valueCount >= HTTP_HEADER_MAX) {
        return 0;
    }

    dbuf_put(&httpParser->values[httpParser->valueCount], at, length);

    JSValue value = JS_NewStringLen(httpParser->ctx, at, length);
    tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_HEADER_VALUE, value);
    return 0;
}

static int tjs_http_parser_on_headers_complete(http_parser* parser)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    JSContext* ctx = httpParser->ctx;

    JSValue message = JS_NewObjectProto(ctx, JS_NULL);
    if (httpParser->status.size > 0) {
        DynBuf* buffer = &httpParser->status;
        JSValue value = JS_NewStringLen(ctx, buffer->buf, buffer->size);
        JS_DefinePropertyValueStr(ctx, message, "statusText", value, JS_PROP_C_W_E);

        dbuf_free(&httpParser->status);
        dbuf_init(&httpParser->status);
    }

    if (httpParser->url.size > 0) {
        DynBuf* buffer = &httpParser->url;
        JSValue value = JS_NewStringLen(ctx, buffer->buf, buffer->size);
        JS_DefinePropertyValueStr(ctx, message, "url", value, JS_PROP_C_W_E);

        dbuf_free(&httpParser->url);
        dbuf_init(&httpParser->url);
    }

    JSValue headers = JS_NewObjectProto(ctx, JS_NULL);

    for (int i = 0; i < HTTP_HEADER_MAX; i++) {
        DynBuf* field = &httpParser->fields[i];
        DynBuf* buffer = &httpParser->values[i];

        if (field->size > 0 && buffer->size > 0) {
            dbuf_putc(field, 0x00);

            char* name = (char*)field->buf;
            JSValue value = JS_NewStringLen(ctx, buffer->buf, buffer->size);
            JS_DefinePropertyValueStr(ctx, headers, name, value, JS_PROP_C_W_E);

            dbuf_free(field);
            dbuf_free(buffer);

            dbuf_init(field);
            dbuf_init(buffer);
        }
    }

    httpParser->fieldCount = 0;
    httpParser->valueCount = 0;

    JS_DefinePropertyValueStr(ctx, message, "headers", headers, JS_PROP_C_W_E);

    if (parser->type == HTTP_REQUEST) {
        JS_DefinePropertyValueStr(ctx, message, "method", JS_NewInt32(ctx, parser->method), JS_PROP_C_W_E);
    } else if (parser->type == HTTP_RESPONSE) {
        JS_DefinePropertyValueStr(ctx, message, "statusCode", JS_NewInt32(ctx, parser->status_code), JS_PROP_C_W_E);
    }

    JS_DefinePropertyValueStr(ctx, message, "httpMajor", JS_NewInt32(ctx, parser->http_major), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, message, "httpMinor", JS_NewInt32(ctx, parser->http_minor), JS_PROP_C_W_E);

    tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_HEADERS_COMPLETE, message);
    return 0;
}

static int tjs_http_parser_on_body(http_parser* parser, const char* at, size_t length)
{
    if (at == NULL || length <= 0) {
        return 0;
    }

    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;

    uint8_t* buf = js_malloc(httpParser->ctx, length);
    memcpy(buf, at, length);
    JSValue value = TJS_NewArrayBuffer(httpParser->ctx, buf, length);
    tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_BODY, value);
    return 0;
}

static int tjs_http_parser_on_message_complete(http_parser* parser)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_MESSAGE_COMPLETE, JS_UNDEFINED);
    return 0;
}

const struct http_parser_settings tjs_http_parser_settings = {
    tjs_http_parser_on_message_begin,
    tjs_http_parser_on_url,
    tjs_http_parser_on_status,
    tjs_http_parser_on_header_field,
    tjs_http_parser_on_header_value,
    tjs_http_parser_on_headers_complete,
    tjs_http_parser_on_body,
    tjs_http_parser_on_message_complete,
    NULL, /* on_chunk_header */
    NULL, /* on_chunk_complete */
};

static JSValue tjs_http_parser_execute(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    JSValue jsData = argv[0];
    bool is_string = false;
    size_t size;
    char* buf;

    if (JS_IsString(jsData)) {
        is_string = true;
        buf = (char*)JS_ToCStringLen(ctx, &size, jsData);
        if (!buf) {
            return JS_EXCEPTION;
        }

    } else {
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
    }

    http_parser* nativeParser = &httpParser->parser;
    size_t nparsed = http_parser_execute(nativeParser, &tjs_http_parser_settings, buf, size);

    if (is_string) {
        JS_FreeCString(ctx, buf);
    }

    return JS_NewInt32(ctx, nparsed);
}

static JSValue tjs_http_parser_init(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    http_parser* nativeParser = &httpParser->parser;

    int type = HTTP_BOTH;
    if (JS_ToInt32(ctx, &type, argv[0])) {
        type = HTTP_BOTH;
    }

    for (int i = 0; i < HTTP_HEADER_MAX; i++) {
        dbuf_free(&httpParser->fields[i]);
        dbuf_free(&httpParser->values[i]);

        dbuf_init(&httpParser->fields[i]);
        dbuf_init(&httpParser->values[i]);
    }

    dbuf_free(&httpParser->url);
    dbuf_free(&httpParser->status);

    dbuf_init(&httpParser->url);
    dbuf_init(&httpParser->status);

    httpParser->fieldCount = 0;
    httpParser->valueCount = 0;

    http_parser_init(nativeParser, (tjs_http_parser_type)type);

    return JS_UNDEFINED;
}

static JSValue tjs_http_parser_finish(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    http_parser* nativeParser = &httpParser->parser;
    size_t result = http_parser_execute(nativeParser, &tjs_http_parser_settings, NULL, 0);
    if (result != 0) {
        return JS_NewInt32(ctx, result);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_http_parser_pause(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    http_parser* nativeParser = &httpParser->parser;
    int paused = 1;
    http_parser_pause(nativeParser, paused);

    return JS_UNDEFINED;
}

static JSValue tjs_http_parser_resume(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    http_parser* nativeParser = &httpParser->parser;
    int paused = 0;
    http_parser_pause(nativeParser, paused);

    return JS_UNDEFINED;
}

static JSValue tjs_new_http_parser(JSContext* ctx, int type)
{
    TJSHttpParser* httpParser;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_http_parser_class_id);
    if (JS_IsException(obj))
        return obj;

    httpParser = calloc(1, sizeof(*httpParser));
    if (!httpParser) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    httpParser->ctx = ctx;

    http_parser_init(&httpParser->parser, type);
    httpParser->parser.data = httpParser;

    for (int i = 0; i < HTTP_HEADER_MAX; i++) {
        dbuf_init(&httpParser->fields[i]);
        dbuf_init(&httpParser->values[i]);
    }

    dbuf_init(&httpParser->url);
    dbuf_init(&httpParser->status);
    httpParser->fieldCount = 0;
    httpParser->valueCount = 0;

    JS_SetOpaque(obj, httpParser);
    return obj;
}

static JSValue tjs_http_parser_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    int type = HTTP_BOTH;
    if (JS_ToInt32(ctx, &type, argv[0])) {
        type = HTTP_BOTH;
    }

    return tjs_new_http_parser(ctx, type);
}

static JSValue tjs_http_parser_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, httpParser->events[magic]);
}

static JSValue tjs_http_parser_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, httpParser->events[magic]);
        httpParser->events[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_http_parser_proto_funcs[] = {
    JS_CGETSET_MAGIC_DEF("onmessagebegin", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_MESSAGE_BEGIN),
    JS_CGETSET_MAGIC_DEF("onurl", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_URL),
    JS_CGETSET_MAGIC_DEF("onstatus", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_STATUS),
    JS_CGETSET_MAGIC_DEF("onheaderfield", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_HEADER_FIELD),
    JS_CGETSET_MAGIC_DEF("onheadervalue", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_HEADER_VALUE),
    JS_CGETSET_MAGIC_DEF("onheaderscomplete", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_HEADERS_COMPLETE),
    JS_CGETSET_MAGIC_DEF("onbody", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_BODY),
    JS_CGETSET_MAGIC_DEF("onmessagecomplete", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_MESSAGE_COMPLETE),
    JS_CFUNC_MAGIC_DEF("execute", 1, tjs_http_parser_execute, 0),
    JS_CFUNC_MAGIC_DEF("finish", 0, tjs_http_parser_finish, 1),
    JS_CFUNC_MAGIC_DEF("init", 1, tjs_http_parser_init, 2),
    JS_CFUNC_MAGIC_DEF("pause", 0, tjs_http_parser_pause, 3),
    JS_CFUNC_MAGIC_DEF("resume", 0, tjs_http_parser_resume, 4)
};

void tjs_mod_http_init(JSContext* ctx, JSModuleDef* module)
{
    JSValue proto;

    /* class */
    JS_NewClassID(&tjs_http_parser_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_http_parser_class_id, &tjs_http_parser_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_http_parser_proto_funcs, countof(tjs_http_parser_proto_funcs));
    JS_SetClassProto(ctx, tjs_http_parser_class_id, proto);

    /* object */
    JSValue parserClass = JS_NewCFunction2(ctx, tjs_http_parser_constructor, "HTTPParser", 1, JS_CFUNC_constructor, 0);

    JSValue methods = JS_NewObjectProto(ctx, JS_NULL);

    uint32_t idx = 0;
#define V(num, name, string) \
    JS_DefinePropertyValueStr(ctx, methods, #num, JS_NewString(ctx, #name), JS_PROP_C_W_E);
    // JS_DefinePropertyValueStr(ctx, methods, #name, JS_NewUint32(ctx, num), JS_PROP_C_W_E); \

    HTTP_METHOD_MAP(V);
#undef V

    JSValue http = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, http, "methods", methods, JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, http, "REQUEST", JS_NewUint32(ctx, HTTP_REQUEST), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, http, "RESPONSE", JS_NewUint32(ctx, HTTP_RESPONSE), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, http, "BOTH", JS_NewUint32(ctx, HTTP_BOTH), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, http, "Parser", parserClass, JS_PROP_C_W_E);

    JS_SetModuleExport(ctx, module, "http", http);
}

void tjs_mod_http_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "http");
}
