/*
 * txiki.js
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé <s@saghul.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#include "private.h"
#include "utils.h"

#include "tls/uv-tls.h"

/* Forward declarations */
static JSValue tjs_new_tcp(JSContext* ctx, JSValue options);
static void uv__stream_connect_cb(uv_connect_t* req, int status);

/* Stream */
enum tjs_stream_event {
    STREAM_EVENT_CLOSE = 0,
    STREAM_EVENT_OPEN,
    STREAM_EVENT_CONNECT,
    STREAM_EVENT_CONNECTION,
    STREAM_EVENT_END,
    STREAM_EVENT_ERROR,
    STREAM_EVENT_MESSAGE,
    STREAM_EVENT_MAX,
};

typedef struct tjs_connect_req {
    uv_connect_t req;
    TJSPromise result;
} TJSConnectReq;

typedef struct tjs_stream {
    JSContext* ctx;

    int readStart;
    int closed;
    int ended;
    int finalized;
    int rejectUnauthorized;

    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_tcp_t tcp;
        uv_tls_t uvtls;
        uv_tty_t tty;
        uv_pipe_t pipe;
    } h;

    struct {
        size_t size;
        TJSPromise result;
    } read;

    struct {
        TJSPromise result;
    } accept;

    TJSConnectReq* connect;

    JSValue events[STREAM_EVENT_MAX];
    JSValue cacert;
    JSValue cert;
    JSValue key;
    JSValue serverName;
} TJSStream;

typedef struct tjs_shutdown_req {
    uv_shutdown_t req;
    TJSPromise result;
} TJSShutdownReq;

typedef struct tjs_write_req {
    uv_write_t req;
    TJSPromise result;
    DynBuf buffer;
    size_t size;
    char data[];
} TJSWriteReq;

static TJSStream* tjs_tcp_get(JSContext* ctx, JSValueConst obj);

static void uv__stream_close_cb(uv_handle_t* handle)
{
    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);
    if (stream->closed == 0) {
        stream->closed = 1;
    }

    if (stream->finalized) {
        free(stream);
    }
}

static void tjs_stream_emit_event(JSContext* ctx, TJSStream* stream, int event, JSValue arg)
{
    JSValue callback = stream->events[event];
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

static void tjs_stream_maybe_close(TJSStream* stream)
{
    if (!uv_is_closing(&stream->h.handle)) {
        uv_tls_close(&stream->h.uvtls);
        uv_close(&stream->h.handle, uv__stream_close_cb);
        tjs_stream_emit_event(stream->ctx, stream, STREAM_EVENT_CLOSE, JS_UNDEFINED);
    }
}

static JSValue tjs_stream_close(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    JSValue arg = JS_UNDEFINED;
    if (TJS_IsPromisePending(ctx, &stream->read.result)) {
        TJS_SettlePromise(ctx, &stream->read.result, 0, 1, (JSValueConst*)&arg);
        TJS_ClearPromise(ctx, &stream->read.result);
    }

    if (TJS_IsPromisePending(ctx, &stream->accept.result)) {
        TJS_SettlePromise(ctx, &stream->accept.result, 0, 1, (JSValueConst*)&arg);
        TJS_ClearPromise(ctx, &stream->accept.result);
    }

    // cancel connect
    TJSConnectReq* connect = stream->connect;
    if (connect) {
        stream->connect = NULL;
        uv__stream_connect_cb(&connect->req, -ECANCELED);
    }

    tjs_stream_maybe_close(stream);
    return JS_UNDEFINED;
}

static void uv__stream_alloc_cb(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);
    buf->base = js_malloc(stream->ctx, suggested_size);
    buf->len = suggested_size;
}

static void uv__stream_read_cb(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf)
{
    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    uv_read_stop(handle);

    JSContext* ctx = stream->ctx;
    JSValue arg;
    int is_reject = 0;
    if (nread < 0) {
        if (nread == UV_EOF) {
            arg = JS_UNDEFINED;

        } else {
            arg = tjs_new_error(ctx, nread);
            is_reject = 1;
        }

        js_free(ctx, buf->base);

    } else {
        arg = TJS_NewArrayBuffer(ctx, (uint8_t*)buf->base, nread);
    }

    TJS_SettlePromise(ctx, &stream->read.result, is_reject, 1, (JSValueConst*)&arg);
    TJS_ClearPromise(ctx, &stream->read.result);
}

static void uv__stream_read_cb2(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf)
{
    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    // printf("uv__stream_read_cb2: nread=%ld, size=%ld\r\n", nread, buf->len);

    JSContext* ctx = stream->ctx;
    if (nread < 0) {
        js_free(ctx, buf->base);

        tjs_stream_emit_event(ctx, stream, STREAM_EVENT_MESSAGE, JS_UNDEFINED);

        if (nread == UV_EOF) {
            if (stream->ended == 0) {
                stream->ended = 1;
                tjs_stream_emit_event(ctx, stream, STREAM_EVENT_END, JS_UNDEFINED);
            }

        } else {
            JSValue error = tjs_new_error(ctx, nread);
            tjs_stream_emit_event(ctx, stream, STREAM_EVENT_ERROR, error);
        }

    } else if (nread == 0) {
        js_free(ctx, buf->base);

    } else {
        JSValue message = TJS_NewArrayBuffer(ctx, (uint8_t*)buf->base, nread);
        tjs_stream_emit_event(ctx, stream, STREAM_EVENT_MESSAGE, message);
    }
}

static JSValue tjs_stream_read(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    if (TJS_IsPromisePending(ctx, &stream->read.result)) {
        return tjs_throw_errno(ctx, UV_EBUSY);
    }

    return TJS_InitPromise(ctx, &stream->read.result);
}

static JSValue tjs_stream_resume(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    stream->readStart = 1;

    int ret = uv_read_start(&stream->h.stream, uv__stream_alloc_cb, uv__stream_read_cb2);
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_stream_pause(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    stream->readStart = 0;
    uv_read_stop(&stream->h.stream);
    return JS_UNDEFINED;
}

static void uv__stream_write_cb(uv_write_t* req, int status)
{
    TJSStream* s = req->handle->data;
    CHECK_NOT_NULL(s);

    JSContext* ctx = s->ctx;
    TJSWriteReq* wr = req->data;

    int is_reject = 0;
    JSValue arg;
        if (status < 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    } else {
        arg = JS_UNDEFINED;
    }

    TJS_SettlePromise(ctx, &wr->result, is_reject, 1, (JSValueConst*)&arg);

    dbuf_free(&wr->buffer);
    js_free(ctx, wr);
}

static JSValue tjs_stream_write(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    JSValue js_data = argv[0];
    bool is_string = false;
    size_t size;
    char* data;

    if (JS_IsString(js_data)) {
        is_string = true;
        data = (char*)JS_ToCStringLen(ctx, &size, js_data);
        if (!data) {
            return JS_EXCEPTION;
        }

    } else {
        data = JS_GetArrayBuffer(ctx, &size, js_data);
        if (data == NULL) {
            size_t aoffset, asize;
            JSValue abuf = JS_GetTypedArrayBuffer(ctx, js_data, &aoffset, &asize, NULL);
            if (JS_IsException(abuf)) {
                return abuf;
            }

            data = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
            JS_FreeValue(ctx, abuf);
            if (!data) {
                return JS_EXCEPTION;
            }

            data += aoffset;
            size = asize;
        }
    }

    int ret;
    uv_tls_t* uvtls = &stream->h.uvtls;

    TJSWriteReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;

    // encode
    dbuf_init(&request->buffer);
    ret = uv_tls_encode(uvtls, data, size, &request->buffer);
    if (is_string) {
        JS_FreeCString(ctx, data);
    }

    // write
    uv_buf_t buffer = uv_buf_init(request->buffer.buf, request->buffer.size);
    ret = uv_write(&request->req, &stream->h.stream, &buffer, 1, uv__stream_write_cb);
    if (ret != 0) {
        js_free(ctx, request);
        return tjs_throw_errno(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

static void uv__stream_shutdown_cb(uv_shutdown_t* req, int status)
{
    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    TJSShutdownReq* sr = req->data;
    JSValue arg;
    int is_reject = 0;
    if (status == 0) {
        arg = JS_UNDEFINED;

    } else {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &sr->result, is_reject, 1, (JSValueConst*)&arg);

    js_free(ctx, sr);
}

static JSValue tjs_stream_shutdown(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    TJSShutdownReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;

    int ret = uv_shutdown(&request->req, &stream->h.stream, uv__stream_shutdown_cb);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

static JSValue tjs_stream_fileno(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    int ret;
    uv_os_fd_t fd;
    ret = uv_fileno(&stream->h.handle, &fd);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    int32_t rfd;
#if defined(_WIN32)
    rfd = (int32_t)(intptr_t)fd;
#else
    rfd = fd;
#endif

    return JS_NewInt32(ctx, rfd);
}

static void uv__stream_connect_cb(uv_connect_t* req, int status)
{
    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);
    JSContext* ctx = stream->ctx;

    stream->connect = NULL;

    if (status == 0) {
        JSValue event = JS_UNDEFINED;
        char message[512] = { 0 };
        int result = uv_tls_get_verify_result(&stream->h.uvtls, message, sizeof(message));
        if (result != 0) {
            event = JS_NewObjectProto(ctx, JS_NULL);
            JS_DefinePropertyValueStr(ctx, event, "result", JS_NewInt32(ctx, result), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, event, "error", JS_NewString(ctx, message), JS_PROP_C_W_E);
        }

        tjs_stream_emit_event(stream->ctx, stream, STREAM_EVENT_OPEN, event);
    }

    TJSConnectReq* cr = req->data;
    JSValue arg;
    int is_reject = 0;
    if (status == 0) {
        arg = JS_UNDEFINED;

    } else {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &cr->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, cr);
}

static void uv__stream_connection_cb2(uv_stream_t* handle, int status)
{
    TJSStream* s = handle->data;
    CHECK_NOT_NULL(s);

    tjs_stream_emit_event(s->ctx, s, STREAM_EVENT_CONNECTION, JS_UNDEFINED);
}

static JSValue tjs_stream_listen2(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    uint32_t backlog = 511;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0])) {
            if (JS_ToUint32(ctx, &backlog, argv[0])) {
                return JS_EXCEPTION;
            }
        }
    }

    int ret = uv_listen(&stream->h.stream, (int)backlog, uv__stream_connection_cb2);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_stream_accept2(JSContext* ctx, TJSStream* s, int argc, JSValueConst* argv)
{
    if (!s) {
        return JS_EXCEPTION;
    }

    uv_stream_t* handle = &s->h.stream;

    JSValue arg;
    TJSStream* t2;
    switch (handle->type) {
    case UV_TCP:
        arg = tjs_new_tcp(ctx, JS_UNDEFINED);
        t2 = tjs_tcp_get(ctx, arg);
        break;

    default:
        abort();
    }

    int ret = 0;
    ret = uv_tls_setup_server(&t2->h.uvtls);

    ret = uv_accept(handle, &t2->h.stream);
    if (ret != 0) {
        JS_FreeValue(ctx, arg);
        arg = tjs_new_error(ctx, ret);
        return JS_UNDEFINED;
    }

    return arg;
}

static JSValue tjs_stream_event_get(JSContext* ctx, TJSStream* stream, JSValueConst this_val, int magic)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, stream->events[magic]);
}

static JSValue tjs_stream_event_set(JSContext* ctx, TJSStream* stream, JSValueConst this_val, JSValueConst value, int magic)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    if (!(JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value))) {
        return JS_UNDEFINED;
    }

    if (!stream->readStart && magic == STREAM_EVENT_MESSAGE && JS_IsFunction(ctx, value)) {
        stream->readStart = 1;
    }

    JS_FreeValue(ctx, stream->events[magic]);
    stream->events[magic] = JS_DupValue(ctx, value);

    return JS_UNDEFINED;
}

static JSValue tjs_stream_init(JSContext* ctx, JSValue obj, TJSStream* stream)
{
    stream->ctx = ctx;
    stream->closed = 0;
    stream->ended = 0;
    stream->finalized = 0;
    stream->readStart = 0;
    stream->connect = NULL;

    stream->h.handle.data = stream;

    stream->cacert = JS_UNDEFINED;
    stream->cert = JS_UNDEFINED;
    stream->key = JS_UNDEFINED;
    stream->serverName = JS_UNDEFINED;

    TJS_ClearPromise(ctx, &stream->read.result);
    TJS_ClearPromise(ctx, &stream->accept.result);

    JS_SetOpaque(obj, stream);
    return obj;
}

static void tjs_stream_finalizer(JSRuntime* runtime, TJSStream* stream)
{
    if (stream) {
        for (int i = 0; i < STREAM_EVENT_MAX; i++) {
            JS_FreeValueRT(runtime, stream->events[i]);
        }

        TJS_FreePromiseRT(runtime, &stream->accept.result);
        TJS_FreePromiseRT(runtime, &stream->read.result);

        JS_FreeValueRT(runtime, stream->cacert);
        JS_FreeValueRT(runtime, stream->cert);
        JS_FreeValueRT(runtime, stream->key);
        JS_FreeValueRT(runtime, stream->serverName);

        stream->finalized = 1;
        if (stream->closed) {
            free(stream);

        } else {
            tjs_stream_maybe_close(stream);
        }
    }
}

static void tjs_stream_mark(JSRuntime* rt, TJSStream* stream, JS_MarkFunc* mark_func)
{
    if (stream) {
        TJS_MarkPromise(rt, &stream->read.result, mark_func);
        TJS_MarkPromise(rt, &stream->accept.result, mark_func);

        for (int i = 0; i < STREAM_EVENT_MAX; i++) {
            JS_MarkValue(rt, stream->events[i], mark_func);
        }

        JS_MarkValue(rt, stream->cacert, mark_func);
        JS_MarkValue(rt, stream->cert, mark_func);
        JS_MarkValue(rt, stream->key, mark_func);
        JS_MarkValue(rt, stream->serverName, mark_func);
    }
}

/* TLS object  */

static JSClassID tjs_tcp_class_id;

static void tjs_tcp_finalizer(JSRuntime* rt, JSValue val)
{
    TJSStream* t = JS_GetOpaque(val, tjs_tcp_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_tcp_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSStream* t = JS_GetOpaque(val, tjs_tcp_class_id);
    tjs_stream_mark(rt, t, mark_func);
}

static JSClassDef tjs_tcp_class = {
    "TLS",
    .finalizer = tjs_tcp_finalizer,
    .gc_mark = tjs_tcp_mark,
};

static JSValue tjs_new_tcp(JSContext* ctx, JSValueConst options)
{
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

    int af = AF_UNSPEC;
    ret = uv_tcp_init_ex(tjs_get_loop(ctx), &stream->h.tcp, af);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(stream);

        return JS_ThrowInternalError(ctx, "couldn't initialize TCP handle");
    }

    ret = uv_tls_init(&stream->h.uvtls);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(stream);

        return JS_ThrowInternalError(ctx, "couldn't initialize TLS handle");
    }

    JSValue result = tjs_stream_init(ctx, obj, stream);

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
    stream->serverName = JS_GetPropertyStr(ctx, options, "serverName");

    const char* cacert = JS_ToCString(ctx, stream->cacert);
    if (cacert) {
        // printf("%ld:\r\n%s\r\n", strlen(cacert), cacert);
        uv_tls_port_set_cacerts(&stream->h.uvtls.tls_engine, cacert, strlen(cacert) + 1); // 证书必须包含结尾 `\0`
        JS_FreeCString(ctx, cacert);
    }

    return result;
}

static JSValue tjs_tcp_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    JSValue options = JS_UNDEFINED;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0])) {
            options = argv[0];
        }
    }

    return tjs_new_tcp(ctx, options);
}

static TJSStream* tjs_tcp_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_tcp_class_id);
}

static JSValue tjs_tcp_accept(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_accept2(ctx, t, argc, argv);
}

static JSValue tjs_tcp_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int r;
    r = tjs_obj2addr(ctx, argv[0], &ss);
    if (r != 0) {
        return JS_EXCEPTION;
    }

    int flags = 0;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1]) && JS_ToInt32(ctx, &flags, argv[1])) {
            return JS_EXCEPTION;
        }
    }

    r = uv_tcp_bind(&t->h.tcp, (struct sockaddr*)&ss, flags);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tcp_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_close(ctx, t, argc, argv);
}

static void uv__tcp_read_callback(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf)
{
    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);
    JSContext* ctx = stream->ctx;

    uv_tls_t* uvtls = &stream->h.uvtls;
    assert(uvtls != NULL);
    if (nread <= 0) {
        // cancel connect
        TJSConnectReq* connect = stream->connect;
        if (connect) {
            stream->connect = NULL;
            uv__stream_connect_cb(&connect->req, nread);
        }

        uv__stream_read_cb2(handle, nread, buf);
        return;
    }

    // mbedtls_printf("uv__tcp_read_callback: %ld (%ld)\r\n", nread, buf->len);
    uv_tls_push(uvtls, nread, buf);
    js_free(ctx, buf->base);

    // handshake
    if (uvtls->ready_state != STATE_IO) {
        int is_handshake = uv_tls_handshake(uvtls);
        if (is_handshake != 1) {
            // recheck if handshake is complete now
            return;
        }
    }

    TJSConnectReq* connect = stream->connect;
    if (connect) {
        stream->connect = NULL;
        uv__stream_connect_cb(&connect->req, 0);
    }

    uv_tls_read(uvtls, uv__stream_alloc_cb, uv__stream_read_cb2);
}

static void uv__tcp_connect_cb(uv_connect_t* req, int status)
{
    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);
    JSContext* ctx = stream->ctx;

    if (status == 0) {
        tjs_stream_emit_event(ctx, stream, STREAM_EVENT_CONNECT, JS_NewInt32(ctx, status));

        if (!stream->readStart) {
            stream->readStart = 1;
        }

        uv_tls_handshake(&stream->h.uvtls);
        uv_read_start(&stream->h.stream, uv__stream_alloc_cb, uv__tcp_read_callback);

    } else {
        stream->connect = NULL;

        TJSConnectReq* cr = req->data;
        JSValue arg = tjs_new_error(ctx, status);
        int is_reject = 1;

        TJS_SettlePromise(ctx, &cr->result, is_reject, 1, (JSValueConst*)&arg);
        js_free(ctx, cr);
    }
}

static JSValue tjs_tcp_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_EXCEPTION;
    }

    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    if (!stream) {
        return JS_EXCEPTION;
        
    } else if (stream->connect) {
        return JS_EXCEPTION;
    }

    int ret;

    // address
    struct sockaddr_storage ss;
    ret = tjs_obj2addr(ctx, argv[0], &ss);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    // host, address or ip
    JSValue js_host;
    const char* host;
    js_host = JS_GetPropertyStr(ctx, argv[0], "host");
    host = JS_ToCString(ctx, js_host);
    JS_FreeValue(ctx, js_host);
    if (!host) {
        return JS_EXCEPTION;
    }

    ret = uv_tls_setup_client(&stream->h.uvtls, host);
    JS_FreeCString(ctx, host);

    // request
    TJSConnectReq* cr = js_malloc(ctx, sizeof(*cr));
    if (!cr) {
        return JS_EXCEPTION;
    }

    cr->req.data = cr;

    // connect
    ret = uv_tcp_connect(&cr->req, &stream->h.tcp, (struct sockaddr*)&ss, uv__tcp_connect_cb);

    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    stream->connect = cr;

    return TJS_InitPromise(ctx, &cr->result);
}

static JSValue tjs_tcp_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_event_get(ctx, stream, this_val, magic);
}

static JSValue tjs_tcp_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_event_set(ctx, stream, this_val, value, magic);
}

static JSValue tjs_tcp_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_fileno(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_getsockpeername(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    if (!stream) {
        return JS_EXCEPTION;
    }

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
        return tjs_throw_errno(ctx, r);
    }

    return tjs_addr2obj(ctx, (struct sockaddr*)&addr);
}

static JSValue tjs_tcp_keep_alive(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    if (!stream) {
        return JS_EXCEPTION;
    }

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

static JSValue tjs_tcp_listen(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_listen2(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_nodelay(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    if (!stream) {
        return JS_EXCEPTION;
    }

    int32_t enable = 1;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0])) {
            JS_ToInt32(ctx, &enable, argv[0]);
        }
    }

    int32_t ret = uv_tcp_nodelay(&stream->h.tcp, enable);
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_tcp_queue_size(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    if (!stream) {
        return JS_EXCEPTION;
    }

    size_t size = uv_stream_get_write_queue_size(&stream->h.stream);
    return JS_NewInt32(ctx, size);
}

static JSValue tjs_tcp_pause(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_pause(ctx, t, argc, argv);
}

static JSValue tjs_tcp_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_read(ctx, t, argc, argv);
}

static JSValue tjs_tcp_resume(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_resume(ctx, t, argc, argv);
}

static JSValue tjs_tcp_shutdown(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_shutdown(ctx, t, argc, argv);
}

static JSValue tjs_tcp_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_write(ctx, t, argc, argv);
}

static const JSCFunctionListEntry tjs_tcp_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("accept", 0, tjs_tcp_accept),
    TJS_CFUNC_DEF("close", 0, tjs_tcp_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_tcp_fileno),
    TJS_CFUNC_DEF("listen", 1, tjs_tcp_listen),
    TJS_CFUNC_DEF("pause", 0, tjs_tcp_pause),
    TJS_CFUNC_DEF("read", 1, tjs_tcp_read),
    TJS_CFUNC_DEF("resume", 0, tjs_tcp_resume),
    TJS_CFUNC_DEF("shutdown", 0, tjs_tcp_shutdown),
    TJS_CFUNC_DEF("write", 1, tjs_tcp_write),

    /* TLS functions */
    TJS_CFUNC_DEF("bind", 1, tjs_tcp_bind),
    TJS_CFUNC_DEF("connect", 1, tjs_tcp_connect),
    TJS_CFUNC_DEF("bufferedAmount", 2, tjs_tcp_queue_size),
    TJS_CFUNC_DEF("setKeepAlive", 2, tjs_tcp_keep_alive),
    TJS_CFUNC_DEF("setNoDelay", 1, tjs_tcp_nodelay),
    TJS_CFUNC_MAGIC_DEF("address", 0, tjs_tcp_getsockpeername, 0),
    TJS_CFUNC_MAGIC_DEF("remoteAddress", 0, tjs_tcp_getsockpeername, 1),

    TJS_CGETSET_MAGIC_DEF("onclose", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_CLOSE),
    TJS_CGETSET_MAGIC_DEF("onconnect", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_CONNECT),
    TJS_CGETSET_MAGIC_DEF("onconnection", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_CONNECTION),
    TJS_CGETSET_MAGIC_DEF("onend", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_END),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_MESSAGE),
    TJS_CGETSET_MAGIC_DEF("onopen", tjs_tcp_event_get, tjs_tcp_event_set, STREAM_EVENT_OPEN),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "TLS", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_tcp_class_funcs[] = {
    JS_PROP_INT32_DEF("IPV6ONLY", UV_TCP_IPV6ONLY, 0),
};

void tjs_mod_tls_init(JSContext* ctx, JSModuleDef* module)
{
    JSValue proto, obj;

    /* TLS class */
    JS_NewClassID(&tjs_tcp_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_tcp_class_id, &tjs_tcp_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_tcp_proto_funcs, countof(tjs_tcp_proto_funcs));
    JS_SetClassProto(ctx, tjs_tcp_class_id, proto);

    /* TLS object */
    obj = JS_NewCFunction2(ctx, tjs_tcp_constructor, "TLS", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_tcp_class_funcs, countof(tjs_tcp_class_funcs));
    JS_SetModuleExport(ctx, module, "TLS", obj);
}

void tjs_mod_tls_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "TLS");
}
