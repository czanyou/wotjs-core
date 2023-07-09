#include "private.h"
#include "tjs-utils.h"

#include "tls/tls-context.h"
#include "tls/uv-tls.h"

#include "streams_tls.h"

/* TLS object  */
static void tjs_tls_read_callback(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf);

static JSClassID tjs_tls_class_id;

static void tjs_tls_finalizer(JSRuntime* rt, JSValue val)
{
    CHECK_NOT_NULL(rt);
    TJSStream* stream = JS_GetOpaque(val, tjs_tls_class_id);
    CHECK_NOT_NULL(stream);

    tls_stream_finalizer(rt, stream);
}

static void tjs_tls_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    CHECK_NOT_NULL(rt);

    TJSStream* stream = JS_GetOpaque(val, tjs_tls_class_id);
    CHECK_NOT_NULL(stream);

    tls_stream_mark(rt, stream, mark_func);
}

static JSClassDef tjs_tls_class = {
    "TLS",
    .finalizer = tjs_tls_finalizer,
    .gc_mark = tjs_tls_mark,
};

/**
 * TLS 构建方法
 */
JSValue tjs_tls_new_tcp(JSContext* ctx, JSValueConst options)
{
    CHECK_NOT_NULL(ctx);

    TJSStream* stream;
    JSValue obj;
    int ret;

    obj = JS_NewObjectClass(ctx, tjs_tls_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    stream = calloc(1, sizeof(*stream));
    if (!stream) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    int af = AF_UNSPEC;
    ret = uv_tcp_init_ex(TJS_GetLoop(ctx), &stream->h.tcp, af);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(stream);

        return JS_ThrowInternalError(ctx, "couldn't initialize TCP handle");
    }

    ret = uv_tls_init(&stream->h.tls);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(stream);

        return JS_ThrowInternalError(ctx, "couldn't initialize TLS handle");
    }

    JSValue result = tls_stream_init(ctx, obj, stream);

    if (JS_IsUndefined(options)) {
        return result;
    }

    // ca root cacert
    stream->cacert = JS_GetPropertyStr(ctx, options, "cacert");

    // server certificate
    stream->cert = JS_GetPropertyStr(ctx, options, "cert");

    // server key
    stream->key = JS_GetPropertyStr(ctx, options, "key");

    // server name
    stream->hostname = JS_GetPropertyStr(ctx, options, "hostname");

    const char* cacert = JS_ToCString(ctx, stream->cacert);
    if (cacert) {
        // printf("%ld:\r\n%s\r\n", strlen(cacert), cacert);
        uv_tls_set_cacerts(&stream->h.tls, cacert);
        JS_FreeCString(ctx, cacert);
    }

    return result;
}

/**
 * TLS 构建方法
 */
static JSValue tjs_tls_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);

    JSValue options = JS_UNDEFINED;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0])) {
            options = argv[0];
        }
    }

    return tjs_tls_new_tcp(ctx, options);
}

TJSStream* tjs_tls_get(JSContext* ctx, JSValueConst obj)
{
    CHECK_NOT_NULL(ctx);

    return JS_GetOpaque2(ctx, obj, tjs_tls_class_id);
}

static JSValue tjs_tls_accept(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_accept2(ctx, stream, argc, argv);
}

static JSValue tjs_tls_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);

    TJSStream* stream = tjs_tls_get(ctx, this_val);
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

static JSValue tjs_tls_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_close(ctx, stream, argc, argv);
}

/**
 * 当 TCP 连接成功
 */
static void tjs_tls_connect_callback(uv_connect_t* req, int status)
{
    CHECK_NOT_NULL(req);

    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    CHECK_NOT_NULL(ctx);

    if (status == 0) {
        tls_stream_event_emit(ctx, stream, STREAM_EVENT_CONNECT, JS_NewInt32(ctx, status));

        // 开始 TLS 握手
        if (!stream->read_start) {
            stream->read_start = 1;
        }

        uv_tls_handshake(&stream->h.tls);
        uv_read_start(&stream->h.stream, tls_stream_read_alloc_callback, tjs_tls_read_callback);

    } else {
        stream->connect = NULL;

        TJSConnectReq* request = req->data;
        JSValue arg = tjs_new_uv_error(ctx, status);
        int is_reject = 1;

        TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
        js_free(ctx, request);
    }
}

static JSValue tjs_tls_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    if (stream->connect) {
        return JS_UNDEFINED;
    }

    int ret;

    // address
    struct sockaddr_storage ss;
    ret = TJS_ToSocketAddress(ctx, argv[0], &ss);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    // host, address or ip
    JSValue js_host;
    const char* hostname;
    js_host = JS_GetPropertyStr(ctx, argv[0], "host");
    hostname = JS_ToCString(ctx, js_host);
    JS_FreeValue(ctx, js_host);
    if (!hostname) {
        return JS_EXCEPTION;
    }

    ret = uv_tls_setup_client(&stream->h.tls, hostname);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    JS_FreeCString(ctx, hostname);

    // request
    TJSConnectReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;

    // connect
    ret = uv_tcp_connect(&request->req, &stream->h.tcp, (struct sockaddr*)&ss, tjs_tls_connect_callback);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    stream->connect = request;

    return TJS_InitPromise(ctx, &request->result);
}

static JSValue tjs_tls_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_event_get(ctx, stream, this_val, magic);
}

static JSValue tjs_tls_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_event_set(ctx, stream, this_val, value, magic);
}

static JSValue tjs_tls_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_fileno(ctx, stream, argc, argv);
}

static JSValue tjs_tls_get_queue_size(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    size_t size = uv_stream_get_write_queue_size(&stream->h.stream);
    return JS_NewInt32(ctx, size);
}

static JSValue tjs_tls_get_socket_name(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int r;
    int namelen;
    struct sockaddr_storage addr;
    namelen = sizeof(addr);
    if (magic == 0) {
        r = uv_tcp_getsockname(&stream->h.tcp, (struct sockaddr*)&addr, &namelen);
    } else {
        r = uv_tcp_getpeername(&stream->h.tcp, (struct sockaddr*)&addr, &namelen);
    }

    if (r != 0) {
        return tjs_throw_uv_error(ctx, r);
    }

    return TJS_NewSocketAddress(ctx, (struct sockaddr*)&addr);
}

static JSValue tjs_tls_has_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);
    
    int result = uv_has_ref(&stream->h.handle);
    return JS_NewInt32(ctx, result);
}

static JSValue tjs_tls_listen(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_listen2(ctx, stream, argc, argv);
}

static JSValue tjs_tls_pause(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_pause(ctx, stream, argc, argv);
}

static void tjs_tls_read_callback(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    CHECK_NOT_NULL(ctx);

    uv_tls_t* uvtls = &stream->h.tls;
    CHECK_NOT_NULL(uvtls);

    // 发生网络错误，握手失败，cancel connect
    if (nread <= 0) {
        TJSConnectReq* connect = stream->connect;
        if (connect) {
            stream->connect = NULL;
            tls_stream_connect_callback(&connect->req, nread);
        }

        // tls_stream_read_callback(handle, nread, buf);
        return;
    }

    uv_tls_push(uvtls, buf->base, nread);
    js_free(ctx, buf->base);

    // handshake 
    if (uvtls->ready_state != STATE_IO) {
        // recheck if handshake is complete now
        return;
    }

    // 握手成功
    TJSConnectReq* connect = stream->connect;
    if (connect) {
        stream->connect = NULL;
        tls_stream_connect_callback(&connect->req, 0);
    }

    // 读取并解密缓存区中的数据
    uv_tls_read(uvtls, tls_stream_read_alloc_callback, tls_stream_read_on_message);
}

static JSValue tjs_tls_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    uv_ref(&stream->h.handle);
    return JS_UNDEFINED;
}

static JSValue tjs_tls_resume(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_resume(ctx, stream, argc, argv);
}

static JSValue tjs_tls_set_keep_alive(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
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

static JSValue tjs_tls_set_no_delay(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
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

static JSValue tjs_tls_shutdown(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_shutdown(ctx, stream, argc, argv);
}

static JSValue tjs_tls_unref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    uv_unref(&stream->h.handle);
    return JS_UNDEFINED;
}

static JSValue tjs_tls_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tls_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tls_stream_write(ctx, stream, argc, argv);
}

static const JSCFunctionListEntry tjs_tls_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("accept", 0, tjs_tls_accept),
    TJS_CFUNC_DEF("close", 0, tjs_tls_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_tls_fileno),
    TJS_CFUNC_DEF("hasRef", 0, tjs_tls_has_ref),
    TJS_CFUNC_DEF("listen", 1, tjs_tls_listen),
    TJS_CFUNC_DEF("pause", 0, tjs_tls_pause),
    TJS_CFUNC_DEF("ref", 0, tjs_tls_ref),
    TJS_CFUNC_DEF("resume", 0, tjs_tls_resume),
    TJS_CFUNC_DEF("shutdown", 0, tjs_tls_shutdown),
    TJS_CFUNC_DEF("unref", 0, tjs_tls_unref),
    TJS_CFUNC_DEF("write", 1, tjs_tls_write),

    /* TLS functions */
    TJS_CFUNC_DEF("bind", 1, tjs_tls_bind),
    TJS_CFUNC_DEF("connect", 1, tjs_tls_connect),
    TJS_CFUNC_DEF("bufferedAmount", 2, tjs_tls_get_queue_size),
    TJS_CFUNC_DEF("setKeepAlive", 2, tjs_tls_set_keep_alive),
    TJS_CFUNC_DEF("setNoDelay", 1, tjs_tls_set_no_delay),
    TJS_CFUNC_MAGIC_DEF("address", 0, tjs_tls_get_socket_name, 0),
    TJS_CFUNC_MAGIC_DEF("remoteAddress", 0, tjs_tls_get_socket_name, 1),

    TJS_CGETSET_MAGIC_DEF("onclose", tjs_tls_event_get, tjs_tls_event_set, STREAM_EVENT_CLOSE),
    TJS_CGETSET_MAGIC_DEF("onconnect", tjs_tls_event_get, tjs_tls_event_set, STREAM_EVENT_CONNECT),
    TJS_CGETSET_MAGIC_DEF("onconnection", tjs_tls_event_get, tjs_tls_event_set, STREAM_EVENT_CONNECTION),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_tls_event_get, tjs_tls_event_set, STREAM_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_tls_event_get, tjs_tls_event_set, STREAM_EVENT_MESSAGE),
    TJS_CGETSET_MAGIC_DEF("onopen", tjs_tls_event_get, tjs_tls_event_set, STREAM_EVENT_OPEN),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "TLS", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_tls_class_funcs[] = {
    JS_PROP_INT32_DEF("IPV6ONLY", UV_TCP_IPV6ONLY, 0),
};

void tjs_mod_tls_init(JSContext* ctx, JSModuleDef* module)
{
    /* TLS class */
    JS_NewClassID(&tjs_tls_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_tls_class_id, &tjs_tls_class);
    JSValue prototype = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, prototype, tjs_tls_proto_funcs, countof(tjs_tls_proto_funcs));
    JS_SetClassProto(ctx, tjs_tls_class_id, prototype);

    /* TLS object */
    JSValue constructor = JS_NewCFunction2(ctx, tjs_tls_constructor, "TLS", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, constructor, tjs_tls_class_funcs, countof(tjs_tls_class_funcs));
    JS_SetModuleExport(ctx, module, "TLS", constructor);
}

void tjs_mod_tls_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "TLS");
}
