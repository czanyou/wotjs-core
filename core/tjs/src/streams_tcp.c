/* TCP object  */
#include "private.h"
#include "tjs-utils.h"
#include "streams.h"

static JSClassID tjs_tcp_class_id;

static void tjs_tcp_finalizer(JSRuntime* runtime, JSValue val)
{
    CHECK_NOT_NULL(runtime);

    TJSStream* stream = JS_GetOpaque(val, tjs_tcp_class_id);
    CHECK_NOT_NULL(stream);

    if (stream->stream_debug) {
        printf("streams: id=%d, tcp: finalizer\r\n", stream->stream_id);
    }

    tjs_stream_finalizer(runtime, stream);
}

static void tjs_tcp_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    CHECK_NOT_NULL(runtime);

    TJSStream* stream = JS_GetOpaque(val, tjs_tcp_class_id);
    CHECK_NOT_NULL(stream);

    if (stream->stream_debug) {
        printf("streams: id=%d, tcp: mark\r\n", stream->stream_id);
    }

    tjs_stream_mark(runtime, stream, mark_func);
}

static JSClassDef tjs_tcp_class = {
    "TCP",
    .finalizer = tjs_tcp_finalizer,
    .gc_mark = tjs_tcp_mark,
};

JSValue tjs_tcp_new(JSContext* ctx, int af)
{
    CHECK_NOT_NULL(ctx);

    TJSStream* stream;
    JSValue obj;
    int ret;

    obj = JS_NewObjectClass(ctx, tjs_tcp_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    stream = calloc(1, sizeof(*stream));
    if (!stream) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    ret = uv_tcp_init_ex(TJS_GetLoop(ctx), &stream->h.tcp, af);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(stream);

        return JS_ThrowInternalError(ctx, "couldn't initialize TCP handle");
    }

    return tjs_stream_init(ctx, obj, stream);
}

static JSValue tjs_tcp_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    int af = AF_UNSPEC;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &af, argv[0])) {
            return JS_EXCEPTION;
        }
    }

    return tjs_tcp_new(ctx, af);
}

static JSValue tjs_tcp_accept(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_accept(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    struct sockaddr_storage ss;
    int ret;
    ret = TJS_ToSocketAddress(ctx, argv[0], &ss);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    int flags = 0;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1]) && JS_ToInt32(ctx, &flags, argv[1])) {
            return JS_EXCEPTION;
        }
    }

    ret = uv_tcp_bind(&stream->h.tcp, (struct sockaddr*)&ss, flags);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tcp_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_close(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    struct sockaddr_storage ss;
    int ret;
    ret = TJS_ToSocketAddress(ctx, argv[0], &ss);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    TJSConnectReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;

    ret = uv_tcp_connect(&request->req, &stream->h.tcp, (struct sockaddr*)&ss, tjs_stream_connect_callback);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

static JSValue tjs_tcp_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_event_get(ctx, stream, this_val, magic);
}

static JSValue tjs_tcp_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_event_set(ctx, stream, this_val, value, magic);
}

static JSValue tjs_tcp_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_fileno(ctx, stream, argc, argv);
}

TJSStream* tjs_tcp_get(JSContext* ctx, JSValueConst obj)
{
    CHECK_NOT_NULL(ctx);
    return JS_GetOpaque2(ctx, obj, tjs_tcp_class_id);
}

static JSValue tjs_tcp_get_queue_size(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    size_t size = uv_stream_get_write_queue_size(&stream->h.stream);
    return JS_NewInt32(ctx, size);
}

static JSValue tjs_tcp_get_id(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return JS_NewInt32(ctx, stream->stream_id);
}

static JSValue tjs_tcp_get_socket_name(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int ret;
    int namelen;
    struct sockaddr_storage addr;
    namelen = sizeof(addr);
    if (magic == 0) {
        ret = uv_tcp_getsockname(&stream->h.tcp, (struct sockaddr*)&addr, &namelen);
    } else {
        ret = uv_tcp_getpeername(&stream->h.tcp, (struct sockaddr*)&addr, &namelen);
    }

    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_NewSocketAddress(ctx, (struct sockaddr*)&addr);
}

static JSValue tjs_tcp_has_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);
    
    int result = tjs_stream_has_ref(stream);
    return JS_NewInt32(ctx, result);
}

static JSValue tjs_tcp_listen(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_listen(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_pause(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_pause(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);
    tjs_stream_ref(stream);
    
    return JS_UNDEFINED;
}

static JSValue tjs_tcp_unref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);
    tjs_stream_unref(stream);
    
    return JS_UNDEFINED;
}

static JSValue tjs_tcp_resume(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_resume(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_set_debug(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int32_t enabled = -1;
    if (argc > 0 && JS_IsBool(argv[0])) {
        enabled = JS_ToBool(ctx, argv[0]);
        stream->stream_debug = enabled;
    }

    return JS_NewBool(ctx, stream->stream_debug);
}

static JSValue tjs_tcp_set_keep_alive(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int32_t enable = 1;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0])) {
            JS_ToInt32(ctx, &enable, argv[0]);
        }
    }

    int32_t delay = 0;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1])) {
            JS_ToInt32(ctx, &delay, argv[1]);
        }
    }

    int32_t ret = uv_tcp_keepalive(&stream->h.tcp, enable, delay);
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_tcp_set_no_delay(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int32_t enable = 1;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0])) {
            JS_ToInt32(ctx, &enable, argv[0]);
        }
    }

    int32_t ret = uv_tcp_nodelay(&stream->h.tcp, enable);
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_tcp_shutdown(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_shutdown(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_write(ctx, stream, argc, argv);
}

static const JSCFunctionListEntry tjs_tcp_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("accept", 0, tjs_tcp_accept),
    TJS_CFUNC_DEF("close", 0, tjs_tcp_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_tcp_fileno),
    TJS_CFUNC_DEF("hasRef", 0, tjs_tcp_has_ref),
    TJS_CFUNC_DEF("listen", 1, tjs_tcp_listen),
    TJS_CFUNC_DEF("pause", 0, tjs_tcp_pause),
    TJS_CFUNC_DEF("ref", 0, tjs_tcp_ref),
    TJS_CFUNC_DEF("resume", 0, tjs_tcp_resume),
    TJS_CFUNC_DEF("shutdown", 0, tjs_tcp_shutdown),
    TJS_CFUNC_DEF("unref", 0, tjs_tcp_unref),
    TJS_CFUNC_DEF("write", 1, tjs_tcp_write),

    /* TCP functions */
    TJS_CFUNC_DEF("bind", 1, tjs_tcp_bind),
    TJS_CFUNC_DEF("connect", 1, tjs_tcp_connect),
    TJS_CFUNC_DEF("bufferedAmount", 0, tjs_tcp_get_queue_size),
    TJS_CFUNC_DEF("id", 0, tjs_tcp_get_id),
    TJS_CFUNC_DEF("setKeepAlive", 2, tjs_tcp_set_keep_alive),
    TJS_CFUNC_DEF("setNoDelay", 1, tjs_tcp_set_no_delay),
    TJS_CFUNC_DEF("setDebug", 1, tjs_tcp_set_debug),
    TJS_CFUNC_MAGIC_DEF("address", 0, tjs_tcp_get_socket_name, 0),
    TJS_CFUNC_MAGIC_DEF("remoteAddress", 0, tjs_tcp_get_socket_name, 1),

    TJS_CGETSET_MAGIC_DEF("onclose", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_CLOSE),
    TJS_CGETSET_MAGIC_DEF("onconnect", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_CONNECT),
    TJS_CGETSET_MAGIC_DEF("onconnection", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_CONNECTION),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_MESSAGE),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "TCP", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_tcp_class_funcs[] = {
    JS_PROP_INT32_DEF("IPV6ONLY", UV_TCP_IPV6ONLY, 0),
};

void tjs_mod_tcp_init(JSContext* ctx, JSModuleDef* module)
{
    /* TCP class */
    JS_NewClassID(&tjs_tcp_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_tcp_class_id, &tjs_tcp_class);
    JSValue prototype = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, prototype, tjs_tcp_proto_funcs, countof(tjs_tcp_proto_funcs));
    JS_SetClassProto(ctx, tjs_tcp_class_id, prototype);

    /* TCP object */
    JSValue constructor = JS_NewCFunction2(ctx, tjs_tcp_constructor, "TCP", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, constructor, tjs_tcp_class_funcs, countof(tjs_tcp_class_funcs));
    JS_SetModuleExport(ctx, module, "TCP", constructor);
}
