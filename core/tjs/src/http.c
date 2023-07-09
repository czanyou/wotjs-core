#include "http_parser.h"
#include "util/dbuffer.h"
#include "tjs-utils.h"

#include <string.h>

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

#define HTTP_HEADER_MAX 64

typedef struct http_header_t {
    uint32_t name;
    uint32_t value;
} http_header_t;

typedef struct tjs_http_parser_s {
    JSContext* ctx;
    JSValue events[HTTP_PARSER_EVENT_MAX];
    dbuffer_t url;
    dbuffer_t status;
    dbuffer_t header_buffer;
    http_header_t headers[HTTP_HEADER_MAX];
    uint32_t header_count;

    struct http_parser parser;
    uint32_t parser_state;
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

        dbuffer_free(&httpParser->url);
        dbuffer_free(&httpParser->status);
        dbuffer_free(&httpParser->header_buffer);

        httpParser->header_count = 0;

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
    TJS_EmitEvent(httpParser->ctx, httpParser->events[event], arg);
}

static TJSHttpParser* tjs_http_parser_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_http_parser_class_id);
}

static int tjs_http_parser_on_message_begin(http_parser* parser)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_MESSAGE_BEGIN, JS_UNDEFINED);

    httpParser->parser_state = 0;
    httpParser->header_count = 0;
    return 0;
}

static int tjs_http_parser_on_url(http_parser* parser, const char* at, size_t length)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;

    dbuffer_put(&httpParser->url, (const uint8_t*)at, length);

    httpParser->parser_state = 1;
    return 0;
}

static int tjs_http_parser_on_status(http_parser* parser, const char* at, size_t length)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;

    dbuffer_put(&httpParser->status, (const uint8_t*)at, length);

    httpParser->parser_state = 1;
    return 0;
}

static int tjs_http_parser_on_header_field(http_parser* parser, const char* at, size_t length)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;

    dbuffer_t* buffer = &httpParser->header_buffer;
    if (httpParser->parser_state != 2) {
        dbuffer_putc(buffer, 0);

        int index = httpParser->header_count;
        if (index < HTTP_HEADER_MAX) {
            httpParser->header_count++;
        }

        httpParser->headers[index].name = buffer->size;
    }

    // printf("field: %s: %d\r\n", at, length);

    dbuffer_put(buffer, at, length);

    httpParser->parser_state = 2;
    return 0;
}

static int tjs_http_parser_on_header_value(http_parser* parser, const char* at, size_t length)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    dbuffer_t* buffer = &httpParser->header_buffer;
    if (httpParser->parser_state != 3) {
        dbuffer_putc(buffer, 0);

        if (httpParser->header_count > 0) {
            int index = httpParser->header_count - 1;
            httpParser->headers[index].value = buffer->size;
        }
    }

    dbuffer_put(buffer, at, length);

    // printf("value: %s: %d\r\n", at, length);

    httpParser->parser_state = 3;
    return 0;
}

static int tjs_http_parser_on_headers_complete(http_parser* parser)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    JSContext* ctx = httpParser->ctx;

    httpParser->parser_state = 4;
    dbuffer_putc(&httpParser->header_buffer, 0x00);

    // printf("headers: %s\r\n", httpParser->header_buffer.buf);

    JSValue message = JS_NewObjectProto(ctx, JS_NULL);

    // statusText
    if (httpParser->status.size > 0) {
        dbuffer_t* buffer = &httpParser->status;
        JSValue value = JS_NewStringLen(ctx, (char*)buffer->buf, buffer->size);
        TJS_SetPropertyValue(ctx, message, "statusText", value);

        dbuffer_free(&httpParser->status);
        dbuffer_init(&httpParser->status);
    }

    // url
    if (httpParser->url.size > 0) {
        dbuffer_t* buffer = &httpParser->url;
        JSValue value = JS_NewStringLen(ctx, (char*)buffer->buf, buffer->size);
        TJS_SetPropertyValue(ctx, message, "url", value);

        dbuffer_free(&httpParser->url);
        dbuffer_init(&httpParser->url);
    }

    // headers
    // JSValue headers = JS_NewObjectProto(ctx, JS_NULL);
    JSValue headers = JS_NewArray(ctx);
    uint32_t index = 0;
    if (httpParser->header_count > 0) {
        dbuffer_t* buffer = &httpParser->header_buffer;
        char* buf = buffer->buf;

        for (int i = 0; i < httpParser->header_count; i++) {
            http_header_t* header = &httpParser->headers[i];
            // printf("%s: %s\r\n", buf + header->name, buf + header->value);

            if (header->name && header->value) {
                JSValue element = JS_NewArray(ctx);
                TJS_SetElementValue(ctx, element, 0, JS_NewString(ctx, buf + header->name));
                TJS_SetElementValue(ctx, element, 1, JS_NewString(ctx, buf + header->value));
                TJS_SetElementValue(ctx, headers, index++, element);
            }

            header->name = 0;
            header->value = 0;
        }
    }

    TJS_SetPropertyValue(ctx, message, "headers", headers);

    // method | status
    if (parser->type == HTTP_REQUEST) {
        TJS_SetPropertyValue(ctx, message, "method", JS_NewInt32(ctx, parser->method));

    } else if (parser->type == HTTP_RESPONSE) {
        TJS_SetPropertyValue(ctx, message, "status", JS_NewInt32(ctx, parser->status_code));
    }

    TJS_SetPropertyValue(ctx, message, "httpMajor", JS_NewInt32(ctx, parser->http_major));
    TJS_SetPropertyValue(ctx, message, "httpMinor", JS_NewInt32(ctx, parser->http_minor));

    tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_HEADERS_COMPLETE, message);
    return 0;
}

static int tjs_http_parser_on_body(http_parser* parser, const char* at, size_t length)
{
    if (at == NULL || length <= 0) {
        return 0;
    }

    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    httpParser->parser_state = 5;

    uint8_t* buf = js_malloc(httpParser->ctx, length);
    memcpy(buf, at, length);
    JSValue value = TJS_NewArrayBuffer(httpParser->ctx, buf, length);
    tjs_http_parser_emit_event(httpParser, HTTP_PARSER_EVENT_BODY, value);
    return 0;
}

static int tjs_http_parser_on_message_complete(http_parser* parser)
{
    TJSHttpParser* httpParser = (TJSHttpParser*)parser->data;
    httpParser->parser_state = 6;

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

    tjs_buffer_t buffer = TJS_ToArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    size_t nparsed = http_parser_execute(&httpParser->parser, &tjs_http_parser_settings, (char*)buffer.data, buffer.length);

    if (buffer.is_string) {
        JS_FreeCString(ctx, (char*)buffer.data);
    }

    return JS_NewInt32(ctx, nparsed);
}

static JSValue tjs_http_parser_init(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    http_parser* native_parser = &httpParser->parser;

    int type = HTTP_BOTH;
    if (JS_ToInt32(ctx, &type, argv[0])) {
        type = HTTP_BOTH;
    }

    dbuffer_free(&httpParser->url);
    dbuffer_free(&httpParser->status);
    dbuffer_free(&httpParser->header_buffer);

    dbuffer_init(&httpParser->url);
    dbuffer_init(&httpParser->status);
    dbuffer_init(&httpParser->header_buffer);

    httpParser->header_count = 0;

    http_parser_init(native_parser, (tjs_http_parser_type)type);

    return JS_UNDEFINED;
}

static JSValue tjs_http_parser_finish(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    size_t result = http_parser_execute(&httpParser->parser, &tjs_http_parser_settings, NULL, 0);
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

    int paused = 1;
    http_parser_pause(&httpParser->parser, paused);
    return JS_UNDEFINED;
}

static JSValue tjs_http_parser_resume(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSHttpParser* httpParser = tjs_http_parser_get(ctx, this_val);
    if (!httpParser) {
        return JS_EXCEPTION;
    }

    int paused = 0;
    http_parser_pause(&httpParser->parser, paused);
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

    dbuffer_init(&httpParser->url);
    dbuffer_init(&httpParser->status);
    dbuffer_init(&httpParser->header_buffer);

    httpParser->header_count = 0;

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
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "HTTPParser", JS_PROP_CONFIGURABLE),
    JS_CGETSET_MAGIC_DEF("onbody", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_BODY),
    JS_CGETSET_MAGIC_DEF("onheaderfield", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_HEADER_FIELD),
    JS_CGETSET_MAGIC_DEF("onheaderscomplete", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_HEADERS_COMPLETE),
    JS_CGETSET_MAGIC_DEF("onheadervalue", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_HEADER_VALUE),
    JS_CGETSET_MAGIC_DEF("onmessagebegin", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_MESSAGE_BEGIN),
    JS_CGETSET_MAGIC_DEF("onmessagecomplete", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_MESSAGE_COMPLETE),
    JS_CGETSET_MAGIC_DEF("onstatus", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_STATUS),
    JS_CGETSET_MAGIC_DEF("onurl", tjs_http_parser_event_get, tjs_http_parser_event_set, HTTP_PARSER_EVENT_URL),
    JS_CFUNC_MAGIC_DEF("execute", 1, tjs_http_parser_execute, 0),
    JS_CFUNC_MAGIC_DEF("finish", 0, tjs_http_parser_finish, 1),
    JS_CFUNC_MAGIC_DEF("init", 1, tjs_http_parser_init, 2),
    JS_CFUNC_MAGIC_DEF("pause", 0, tjs_http_parser_pause, 3),
    JS_CFUNC_MAGIC_DEF("resume", 0, tjs_http_parser_resume, 4)
};

void tjs_mod_http_init(JSContext* ctx, JSModuleDef* module)
{
    /* class */
    JS_NewClassID(&tjs_http_parser_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_http_parser_class_id, &tjs_http_parser_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_http_parser_proto_funcs, countof(tjs_http_parser_proto_funcs));
    JS_SetClassProto(ctx, tjs_http_parser_class_id, proto);

    /* object */
    JSValue parserClass = JS_NewCFunction2(ctx, tjs_http_parser_constructor, "HTTPParser", 1, JS_CFUNC_constructor, 0);

    // methods
    // JSValue methods = JS_NewObjectProto(ctx, JS_NULL);
    JSValue methods = JS_NewArray(ctx);
    uint32_t idx = 0;
#define V(num, name, string) \
    TJS_SetElementValue(ctx, methods, num, JS_NewString(ctx, #name));
    // TJS_SetPropertyValue(ctx, methods, #num, JS_NewString(ctx, #name));
    // JS_DefinePropertyValueStr(ctx, methods, #name, JS_NewUint32(ctx, num), JS_PROP_C_W_E);

    HTTP_METHOD_MAP(V);
#undef V

    // http
    JSValue http = JS_NewObject(ctx);
    TJS_SetPropertyValue(ctx, http, "methods", methods);
    TJS_SetPropertyValue(ctx, http, "REQUEST", JS_NewUint32(ctx, HTTP_REQUEST));
    TJS_SetPropertyValue(ctx, http, "RESPONSE", JS_NewUint32(ctx, HTTP_RESPONSE));
    TJS_SetPropertyValue(ctx, http, "BOTH", JS_NewUint32(ctx, HTTP_BOTH));
    TJS_SetPropertyValue(ctx, http, "Parser", parserClass);
    JS_SetModuleExport(ctx, module, "http", http);
}

void tjs_mod_http_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "http");
}
