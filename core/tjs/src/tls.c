#include "private.h"
#include "tjs-utils.h"

#include "tls/tls-context.h"
#include "tls/uv-tls.h"

#include "streams_tls.h"

/* Forward declarations */

JSValue tls_stream_accept2(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    uv_stream_t* handle = &stream->h.stream;

    JSValue arg;
    TJSStream* t2;
    switch (handle->type) {
    case UV_TCP:
        arg = tjs_tls_new_tcp(ctx, JS_UNDEFINED);
        t2 = tjs_tls_get(ctx, arg);
        break;

    default:
        abort();
    }

    // TLS
    uv_tls_setup_server(&t2->h.tls);

    int ret = uv_accept(handle, &t2->h.stream);
    if (ret != 0) {
        JS_FreeValue(ctx, arg);
        arg = tjs_new_uv_error(ctx, ret);
        return JS_UNDEFINED;
    }

    return arg;
}

static void tls_stream_close_callback(uv_handle_t* handle)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);
    if (stream->closed == 0) {
        stream->closed = 1;
    }

    if (stream->finalized) {
        free(stream);
    }
}

static void tls_stream_maybe_close(TJSStream* stream)
{
    CHECK_NOT_NULL(stream);
    // printf("tls_stream_maybe_close\r\n");

    if (!uv_is_closing(&stream->h.handle)) {
        uv_tls_destroy(&stream->h.tls);
        uv_close(&stream->h.handle, tls_stream_close_callback);
    }
}

static void tls_stream_clear(TJSStream* stream)
{
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    CHECK_NOT_NULL(ctx);

    // cancel connect
    TJSConnectReq* connect = stream->connect;
    if (connect) {
        stream->connect = NULL;
        tls_stream_connect_callback(&connect->req, -ECANCELED);
    }

    for (int i = 0; i < STREAM_EVENT_MAX; i++) {
        JSValue callback = stream->events[i];
        stream->events[i] = JS_UNDEFINED;
        JS_FreeValue(ctx, stream->events[i]);
    }

    // TLS
    JS_FreeValue(ctx, stream->cacert);
    JS_FreeValue(ctx, stream->cert);
    JS_FreeValue(ctx, stream->hostname);
    JS_FreeValue(ctx, stream->key);

    stream->cacert = JS_UNDEFINED;
    stream->cert = JS_UNDEFINED;
    stream->hostname = JS_UNDEFINED;
    stream->key = JS_UNDEFINED;
}

JSValue tls_stream_close(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    // printf("tls_stream_close\r\n");
    tls_stream_clear(stream);

    tls_stream_maybe_close(stream);
    return JS_UNDEFINED;
}

void tls_stream_connect_callback(uv_connect_t* req, int status)
{
    CHECK_NOT_NULL(req);

    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;

    // TLS
    stream->connect = NULL;

    if (status == 0) {
        JSValue event = JS_UNDEFINED;
        char message[512] = { 0 };
        int result = uv_tls_get_verify_result(&stream->h.tls, message, sizeof(message));
        if (result != 0) {
            event = JS_NewObjectProto(ctx, JS_NULL);
            JS_DefinePropertyValueStr(ctx, event, "result", JS_NewInt32(ctx, result), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, event, "error", JS_NewString(ctx, message), JS_PROP_C_W_E);
        }

        tls_stream_event_emit(stream->ctx, stream, STREAM_EVENT_OPEN, event);
    }

    TJSConnectReq* request = req->data;
    JSValue arg;
    int is_reject = 0;
    if (status == 0) {
        arg = JS_UNDEFINED;

    } else {
        arg = tjs_new_uv_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, request);
}

void tls_stream_event_emit(JSContext* ctx, TJSStream* stream, int event, JSValue arg)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    JSValue callback = stream->events[event];
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

JSValue tls_stream_event_get(JSContext* ctx, TJSStream* stream, JSValueConst this_val, int magic)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    return JS_DupValue(ctx, stream->events[magic]);
}

JSValue tls_stream_event_set(JSContext* ctx, TJSStream* stream, JSValueConst this_val, JSValueConst value, int magic)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    if (!(JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value))) {
        return JS_UNDEFINED;
    }

    if (!stream->read_start && magic == STREAM_EVENT_MESSAGE && JS_IsFunction(ctx, value)) {
        stream->read_start = 1;
    }

    JS_FreeValue(ctx, stream->events[magic]);
    stream->events[magic] = JS_DupValue(ctx, value);

    return JS_UNDEFINED;
}

JSValue tls_stream_fileno(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    int ret;
    uv_os_fd_t fd;
    ret = uv_fileno(&stream->h.handle, &fd);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    int32_t rfd;
#if defined(_WIN32)
    rfd = (int32_t)(intptr_t)fd;
#else
    rfd = fd;
#endif

    return JS_NewInt32(ctx, rfd);
}

void tls_stream_finalizer(JSRuntime* runtime, TJSStream* stream)
{
    CHECK_NOT_NULL(runtime);
    CHECK_NOT_NULL(stream);
    // printf("tls_stream_finalizer\r\n");

    tls_stream_clear(stream);

    stream->finalized = 1;
    if (stream->closed) {
        free(stream);

    } else {
        tls_stream_maybe_close(stream);
    }
}

JSValue tls_stream_init(JSContext* ctx, JSValue obj, TJSStream* stream)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    // printf("tls_stream_init\r\n");

    stream->ctx = ctx;
    stream->closed = 0;
    stream->finalized = 0;
    stream->read_start = 0;

    stream->h.handle.data = stream;

    // TLS
    stream->cacert = JS_UNDEFINED;
    stream->cert = JS_UNDEFINED;
    stream->connect = NULL;
    stream->hostname = JS_UNDEFINED;
    stream->key = JS_UNDEFINED;

    for (int i = 0; i < STREAM_EVENT_MAX; i++) {
        stream->events[i] = JS_UNDEFINED;
    }

    JS_SetOpaque(obj, stream);
    return obj;
}

static void tls_stream_listen_callback(uv_stream_t* handle, int status)
{
}

static void tls_stream_listen_on_connection(uv_stream_t* handle, int status)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    tls_stream_event_emit(stream->ctx, stream, STREAM_EVENT_CONNECTION, JS_UNDEFINED);
}

static JSValue tls_stream_listen(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    uint32_t backlog = 511;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0])) {
            if (JS_ToUint32(ctx, &backlog, argv[0])) {
                return JS_EXCEPTION;
            }
        }
    }

    int ret = uv_listen(&stream->h.stream, (int)backlog, tls_stream_listen_callback);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return JS_UNDEFINED;
}

JSValue tls_stream_listen2(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    uint32_t backlog = 511;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0])) {
            if (JS_ToUint32(ctx, &backlog, argv[0])) {
                return JS_EXCEPTION;
            }
        }
    }

    int ret = uv_listen(&stream->h.stream, (int)backlog, tls_stream_listen_on_connection);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return JS_UNDEFINED;
}

void tls_stream_mark(JSRuntime* rt, TJSStream* stream, JS_MarkFunc* mark_func)
{
    CHECK_NOT_NULL(rt);
    CHECK_NOT_NULL(stream);

    // printf("tls_stream_mark\r\n");
    for (int i = 0; i < STREAM_EVENT_MAX; i++) {
        JS_MarkValue(rt, stream->events[i], mark_func);
    }

    // TLS
    JS_MarkValue(rt, stream->cacert, mark_func);
    JS_MarkValue(rt, stream->cert, mark_func);
    JS_MarkValue(rt, stream->hostname, mark_func);
    JS_MarkValue(rt, stream->key, mark_func);
}

JSValue tls_stream_pause(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    stream->read_start = 0;

    // 总是会返回成功
    uv_read_stop(&stream->h.stream);
    return JS_UNDEFINED;
}

void tls_stream_read_alloc_callback(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    buf->base = js_malloc(stream->ctx, suggested_size);
    buf->len = suggested_size;
}

void tls_stream_read_on_message(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    CHECK_NOT_NULL(ctx);

    if (nread < 0) {
        js_free(ctx, buf->base);
        tls_stream_event_emit(ctx, stream, STREAM_EVENT_MESSAGE, JS_UNDEFINED);

        if (nread = UV_EOF) {
            tls_stream_event_emit(ctx, stream, STREAM_EVENT_CLOSE, JS_UNDEFINED);

        } else {
            JSValue error = tjs_new_uv_error(ctx, nread);
            tls_stream_event_emit(ctx, stream, STREAM_EVENT_ERROR, error);
        }

        tls_stream_clear(stream);

    } else if (nread == 0) {
        js_free(ctx, buf->base);

    } else {
        JSValue message = TJS_NewArrayBuffer(ctx, (uint8_t*)buf->base, nread);
        tls_stream_event_emit(ctx, stream, STREAM_EVENT_MESSAGE, message);
    }
}

JSValue tls_stream_resume(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    stream->read_start = 1;

    int ret = uv_read_start(&stream->h.stream, tls_stream_read_alloc_callback, tls_stream_read_on_message);
    return JS_NewInt32(ctx, ret);
}

static void tls_stream_shutdown_callback(uv_shutdown_t* req, int status)
{
    CHECK_NOT_NULL(req);

    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    TJSShutdownReq* request = req->data;
    JSValue arg = JS_UNDEFINED;
    int is_reject = 0;
    if (status == 0) {
        arg = JS_UNDEFINED;

    } else {
        arg = tjs_new_uv_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, request);
}

JSValue tls_stream_shutdown(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    TJSShutdownReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;

    int ret = uv_shutdown(&request->req, &stream->h.stream, tls_stream_shutdown_callback);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

static void tls_stream_write_callback(uv_write_t* req, int status)
{
    CHECK_NOT_NULL(req);

    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    TJSWriteReq* request = req->data;

    int is_reject = 0;
    JSValue arg = JS_UNDEFINED;
    if (status < 0) {
        arg = tjs_new_uv_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);

    dbuffer_free(&request->buffer);
    js_free(ctx, request);
}

JSValue tls_stream_write(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    tjs_buffer_t buffer = TJS_ToArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    int ret;
    uv_tls_t* uvtls = &stream->h.tls;

    TJSWriteReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;

    // encode
    dbuffer_init(&request->buffer);
    ret = uv_tls_encode(uvtls, buffer.data, buffer.length, &request->buffer);
    if (buffer.is_string) {
        JS_FreeCString(ctx, buffer.data);
    }

    // write
    uv_buf_t uv_buffer = uv_buf_init(request->buffer.buf, request->buffer.size);
    ret = uv_write(&request->req, &stream->h.stream, &uv_buffer, 1, tls_stream_write_callback);
    if (ret != 0) {
        js_free(ctx, request);
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}
