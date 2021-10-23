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

/* Forward declarations */
static JSValue tjs_new_tcp(JSContext* ctx, int af);

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

typedef struct tjs_stream {
    JSContext* ctx;
    int readStart;
    int closed;
    int finalized;
    union {
        uv_handle_t handle;
        uv_stream_t stream;
        uv_tcp_t tcp;
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

    JSValue events[STREAM_EVENT_MAX];
} TJSStream;

typedef struct tjs_connect_req {
    uv_connect_t req;
    TJSPromise result;
} TJSConnectReq;

typedef struct tjs_shutdown_req {
    uv_shutdown_t req;
    TJSPromise result;
} TJSShutdownReq;

typedef struct tjs_write_req {
    uv_write_t req;
    TJSPromise result;
    size_t size;
    char data[];
} TJSWriteReq;

static TJSStream* tjs_tcp_get(JSContext* ctx, JSValueConst obj);
static TJSStream* tjs_pipe_get(JSContext* ctx, JSValueConst obj);

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
        uv_close(&stream->h.handle, uv__stream_close_cb);
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
    JSValue arg = JS_UNDEFINED;
    int is_reject = 0;
    if (nread < 0) {
        if (nread != UV_EOF) {
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

    JSContext* ctx = stream->ctx;
    if (nread < 0) {
        js_free(ctx, buf->base);
        tjs_stream_emit_event(ctx, stream, STREAM_EVENT_MESSAGE, JS_UNDEFINED);

        if (nread == UV_EOF) {
            tjs_stream_emit_event(ctx, stream, STREAM_EVENT_END, JS_UNDEFINED);

        } else {
            uv_read_stop(&stream->h.stream);

            JSValue error = tjs_new_error(ctx, nread);
            tjs_stream_emit_event(ctx, stream, STREAM_EVENT_ERROR, error);
        }

    } else if (nread > 0) {
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

    uint64_t size = kDefaultReadSize;
    if (argc > 0) {
        if (!JS_IsUndefined(argv[0]) && JS_ToIndex(ctx, &size, argv[0])) {
            return JS_EXCEPTION;
        }
    }

    int ret = uv_read_start(&stream->h.stream, uv__stream_alloc_cb, uv__stream_read_cb);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return TJS_InitPromise(ctx, &stream->read.result);
}

static JSValue tjs_stream_resume(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    if (stream->readStart = 0) {
        stream->readStart = 1;
        int ret = uv_read_start(&stream->h.stream, uv__stream_alloc_cb, uv__stream_read_cb2);

        // UV_EALREADY | UV_EINVAL
        return JS_NewInt32(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_stream_pause(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    stream->readStart = 0;

    // 总是会返回成功
    uv_read_stop(&stream->h.stream);
    return JS_UNDEFINED;
}

static void uv__stream_write_cb(uv_write_t* req, int status)
{
    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    TJSWriteReq* request = req->data;

    int is_reject = 0;
    JSValue arg = JS_UNDEFINED;
    if (status < 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, request);
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

    /* First try to do the write inline */
    int ret;
    uv_buf_t buffer;
    buffer = uv_buf_init(data, size);
    ret = uv_try_write(&stream->h.stream, &buffer, 1);

    if (ret == size) {
        if (is_string) {
            JS_FreeCString(ctx, data);
        }

        return TJS_NewResolvedPromise(ctx, 0, NULL);
    }

    /* Do an async write, copy the data. */
    if (ret >= 0) {
        data += ret;
        size -= ret;
    }

    TJSWriteReq* request = js_malloc(ctx, sizeof(*request) + size);
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;
    memcpy(request->data, data, size);

    if (is_string) {
        JS_FreeCString(ctx, data);
    }

    buffer = uv_buf_init(request->data, size);
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
    TJSShutdownReq* request = req->data;
    JSValue arg = JS_UNDEFINED;
    int is_reject = 0;
    if (status < 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, request);
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
    TJSConnectReq* request = req->data;
    JSValue arg;
    int is_reject = 0;
    if (status < 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;

    } else {
        arg = JS_UNDEFINED;
        tjs_stream_emit_event(stream->ctx, stream, STREAM_EVENT_CONNECT, JS_UNDEFINED);

        if (stream->readStart) {
            stream->readStart = 1;

            uv_read_start(&stream->h.stream, uv__stream_alloc_cb, uv__stream_read_cb2);
        }
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, request);
}

static void uv__stream_connection_cb(uv_stream_t* handle, int status)
{
    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    if (!TJS_IsPromisePending(stream->ctx, &stream->accept.result)) {
        // TODO - handle this.
        return;
    }

    JSContext* ctx = stream->ctx;
    JSValue arg;
    int is_reject = 0;
    if (status < 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;

    } else {
        TJSStream* t2;
        switch (handle->type) {
        case UV_TCP:
            arg = tjs_new_tcp(ctx, AF_UNSPEC);
            t2 = tjs_tcp_get(ctx, arg);
            break;

        case UV_NAMED_PIPE:
            arg = tjs_new_pipe(ctx);
            t2 = tjs_pipe_get(ctx, arg);
            break;

        default:
            abort();
        }

        int ret = uv_accept(handle, &t2->h.stream);
        if (ret != 0) {
            JS_FreeValue(ctx, arg);
            arg = tjs_new_error(ctx, ret);
            is_reject = 1;
        }
    }

    TJS_SettlePromise(ctx, &stream->accept.result, is_reject, 1, (JSValueConst*)&arg);
    TJS_ClearPromise(ctx, &stream->accept.result);
}

static void uv__stream_connection_cb2(uv_stream_t* handle, int status)
{
    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    if (status < 0) {
        JSValue error = tjs_new_error(ctx, status);
        tjs_stream_emit_event(ctx, stream, STREAM_EVENT_ERROR, error);
        return;
    }

    tjs_stream_emit_event(stream->ctx, stream, STREAM_EVENT_CONNECTION, JS_UNDEFINED);
}

static JSValue tjs_stream_listen(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
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

    int ret = uv_listen(&stream->h.stream, (int)backlog, uv__stream_connection_cb);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return JS_UNDEFINED;
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

static JSValue tjs_stream_accept(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    if (TJS_IsPromisePending(ctx, &stream->accept.result)) {
        return tjs_throw_errno(ctx, UV_EBUSY);
    }

    return TJS_InitPromise(ctx, &stream->accept.result);
}

static JSValue tjs_stream_accept2(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    if (!stream) {
        return JS_EXCEPTION;
    }

    uv_stream_t* handle = &stream->h.stream;

    JSValue arg;
    TJSStream* t2;
    switch (handle->type) {
    case UV_TCP:
        arg = tjs_new_tcp(ctx, AF_UNSPEC);
        t2 = tjs_tcp_get(ctx, arg);
        break;

    case UV_NAMED_PIPE:
        arg = tjs_new_pipe(ctx);
        t2 = tjs_pipe_get(ctx, arg);
        break;

    default:
        abort();
    }

    int ret = uv_accept(handle, &t2->h.stream);
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

        uv_read_start(&stream->h.stream, uv__stream_alloc_cb, uv__stream_read_cb2);
    }

    JS_FreeValue(ctx, stream->events[magic]);
    stream->events[magic] = JS_DupValue(ctx, value);

    return JS_UNDEFINED;
}

static JSValue tjs_stream_init(JSContext* ctx, JSValue obj, TJSStream* stream)
{
    stream->ctx = ctx;
    stream->closed = 0;
    stream->finalized = 0;
    stream->readStart = 0;

    stream->h.handle.data = stream;

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
    }
}

/* TCP object  */

static JSClassID tjs_tcp_class_id;

static void tjs_tcp_finalizer(JSRuntime* runtime, JSValue val)
{
    TJSStream* stream = JS_GetOpaque(val, tjs_tcp_class_id);

    // printf("tjs_tcp_finalizer\r\n");
    tjs_stream_finalizer(runtime, stream);
}

static void tjs_tcp_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSStream* stream = JS_GetOpaque(val, tjs_tcp_class_id);
    tjs_stream_mark(runtime, stream, mark_func);
}

static JSClassDef tjs_tcp_class = {
    "TCP",
    .finalizer = tjs_tcp_finalizer,
    .gc_mark = tjs_tcp_mark,
};

static JSValue tjs_new_tcp(JSContext* ctx, int af)
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

    ret = uv_tcp_init_ex(tjs_get_loop(ctx), &stream->h.tcp, af);
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

    return tjs_new_tcp(ctx, af);
}

static TJSStream* tjs_tcp_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_tcp_class_id);
}

static JSValue tjs_tcp_accept(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_accept2(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    if (!stream) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int ret;
    ret = tjs_obj2addr(ctx, argv[0], &ss);
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
        return tjs_throw_errno(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tcp_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tcp_get(ctx, this_val);
    return tjs_stream_close(ctx, t, argc, argv);
}

static JSValue tjs_tcp_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    if (!stream) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int ret;
    ret = tjs_obj2addr(ctx, argv[0], &ss);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    TJSConnectReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;

    ret = uv_tcp_connect(&request->req, &stream->h.tcp, (struct sockaddr*)&ss, uv__stream_connect_cb);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
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
        return tjs_throw_errno(ctx, ret);
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

static JSValue tjs_tcp_pause(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_pause(ctx, stream, argc, argv);
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

static JSValue tjs_tcp_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_read(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_resume(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_resume(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_shutdown(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_shutdown(ctx, stream, argc, argv);
}

static JSValue tjs_tcp_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tcp_get(ctx, this_val);
    return tjs_stream_write(ctx, stream, argc, argv);
}

/* TTY */

static JSClassID tjs_tty_class_id;

static void tjs_tty_finalizer(JSRuntime* rt, JSValue val)
{
    TJSStream* t = JS_GetOpaque(val, tjs_tty_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_tty_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSStream* t = JS_GetOpaque(val, tjs_tty_class_id);
    tjs_stream_mark(rt, t, mark_func);
}

static JSClassDef tjs_tty_class = {
    "TTY",
    .finalizer = tjs_tty_finalizer,
    .gc_mark = tjs_tty_mark,
};

static JSValue tjs_tty_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    TJSStream* s;
    JSValue obj;
    int fd, r, readable;

    if (JS_ToInt32(ctx, &fd, argv[0])) {
        return JS_EXCEPTION;
    }

    if ((readable = JS_ToBool(ctx, argv[1])) == -1) {
        return JS_EXCEPTION;
    }

    obj = JS_NewObjectClass(ctx, tjs_tty_class_id);
    if (JS_IsException(obj))
        return obj;

    s = calloc(1, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_tty_init(tjs_get_loop(ctx), &s->h.tty, fd, readable);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize TTY handle");
    }

    return tjs_stream_init(ctx, obj, s);
}

static TJSStream* tjs_tty_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_tty_class_id);
}

static JSValue tjs_tty_set_mode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* s = tjs_tty_get(ctx, this_val);
    if (!s)
        return JS_EXCEPTION;

    int mode;
    if (JS_ToInt32(ctx, &mode, argv[0]))
        return JS_EXCEPTION;

    int r = uv_tty_set_mode(&s->h.tty, mode);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    return JS_UNDEFINED;
}

static JSValue tjs_tty_get_window_size(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* s = tjs_tty_get(ctx, this_val);
    if (!s)
        return JS_EXCEPTION;

    int r, width, height;
    r = uv_tty_get_winsize(&s->h.tty, &width, &height);
    if (r != 0)
        return tjs_throw_errno(ctx, r);

    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, obj, "width", JS_NewInt32(ctx, width), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, obj, "height", JS_NewInt32(ctx, height), JS_PROP_C_W_E);
    return obj;
}

static JSValue tjs_tty_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tty_get(ctx, this_val);
    return tjs_stream_close(ctx, t, argc, argv);
}

static JSValue tjs_tty_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tty_get(ctx, this_val);
    return tjs_stream_read(ctx, t, argc, argv);
}

static JSValue tjs_tty_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tty_get(ctx, this_val);
    return tjs_stream_write(ctx, t, argc, argv);
}

static JSValue tjs_tty_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_tty_get(ctx, this_val);
    return tjs_stream_fileno(ctx, t, argc, argv);
}

static JSValue tjs_tty_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    return tjs_stream_event_get(ctx, stream, this_val, magic);
}

static JSValue tjs_tty_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    return tjs_stream_event_set(ctx, stream, this_val, value, magic);
}

/* Pipe */

static JSClassID tjs_pipe_class_id;

static void tjs_pipe_finalizer(JSRuntime* rt, JSValue val)
{
    // printf("tjs_pipe_finalizer\r\n");
    TJSStream* t = JS_GetOpaque(val, tjs_pipe_class_id);
    tjs_stream_finalizer(rt, t);
}

static void tjs_pipe_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSStream* t = JS_GetOpaque(val, tjs_pipe_class_id);
    tjs_stream_mark(rt, t, mark_func);
}

static JSClassDef tjs_pipe_class = {
    "Pipe",
    .finalizer = tjs_pipe_finalizer,
    .gc_mark = tjs_pipe_mark,
};

JSValue tjs_new_pipe(JSContext* ctx)
{
    TJSStream* s;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_pipe_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    s = calloc(1, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_pipe_init(tjs_get_loop(ctx), &s->h.pipe, 0);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(s);
        return JS_ThrowInternalError(ctx, "couldn't initialize Pipe handle");
    }

    return tjs_stream_init(ctx, obj, s);
}

static JSValue tjs_pipe_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    return tjs_new_pipe(ctx);
}

static TJSStream* tjs_pipe_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_pipe_class_id);
}

uv_stream_t* tjs_pipe_get_stream(JSContext* ctx, JSValueConst obj)
{
    TJSStream* s = tjs_pipe_get(ctx, obj);
    if (s)
        return &s->h.stream;
    return NULL;
}

static JSValue tjs_pipe_get_address(JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    char buf[1024];
    size_t len = sizeof(buf);
    int r;

    if (magic == 0) {
        r = uv_pipe_getsockname(&t->h.pipe, buf, &len);
    } else {
        r = uv_pipe_getpeername(&t->h.pipe, buf, &len);
    }

    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_NewStringLen(ctx, buf, len);
}

static JSValue tjs_pipe_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    const char* name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_EXCEPTION;
    }

    TJSConnectReq* cr = js_malloc(ctx, sizeof(*cr));
    if (!cr) {
        JS_FreeCString(ctx, name);
        return JS_EXCEPTION;
    }

    cr->req.data = cr;

    uv_pipe_connect(&cr->req, &t->h.pipe, name, uv__stream_connect_cb);

    JS_FreeCString(ctx, name);

    return TJS_InitPromise(ctx, &cr->result);
}

static JSValue tjs_pipe_open(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    if (!stream) {
        return JS_EXCEPTION;
    }

    int fd = -1;
    if (argc > 0) {
        JS_ToInt32(ctx, &fd, argv[0]);
    }
    
    if (fd < 0) {
        return JS_UNDEFINED;
    }

    int r = uv_pipe_open(&stream->h.pipe, fd);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_pipe_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    if (!t) {
        return JS_EXCEPTION;
    }

    const char* name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_EXCEPTION;
    }

    int r = uv_pipe_bind(&t->h.pipe, name);
    JS_FreeCString(ctx, name);

    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_pipe_shutdown(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    return tjs_stream_shutdown(ctx, stream, argc, argv);
}

static JSValue tjs_pipe_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_close(ctx, t, argc, argv);
}

static JSValue tjs_pipe_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_read(ctx, t, argc, argv);
}

static JSValue tjs_pipe_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_write(ctx, t, argc, argv);
}

static JSValue tjs_pipe_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_fileno(ctx, t, argc, argv);
}

static JSValue tjs_pipe_listen(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_listen2(ctx, t, argc, argv);
}

static JSValue tjs_pipe_accept(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_accept2(ctx, t, argc, argv);
}

static JSValue tjs_pipe_resume(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_resume(ctx, t, argc, argv);
}

static JSValue tjs_pipe_pause(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* t = tjs_pipe_get(ctx, this_val);
    return tjs_stream_pause(ctx, t, argc, argv);
}

static JSValue tjs_pipe_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    return tjs_stream_event_get(ctx, stream, this_val, magic);
}

static JSValue tjs_pipe_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    return tjs_stream_event_set(ctx, stream, this_val, value, magic);
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

    /* TCP functions */
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
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "TCP", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_tcp_class_funcs[] = {
    JS_PROP_INT32_DEF("IPV6ONLY", UV_TCP_IPV6ONLY, 0),
};

static const JSCFunctionListEntry tjs_tty_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("close", 0, tjs_tty_close),
    TJS_CFUNC_DEF("read", 1, tjs_tty_read),
    TJS_CFUNC_DEF("write", 1, tjs_tty_write),
    TJS_CFUNC_DEF("fileno", 0, tjs_tty_fileno),
    /* TTY functions */
    TJS_CFUNC_DEF("setMode", 1, tjs_tty_set_mode),
    TJS_CFUNC_DEF("getWinSize", 0, tjs_tty_get_window_size),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_tty_event_get, tjs_tty_event_set, STREAM_EVENT_MESSAGE),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_tty_event_get, tjs_tty_event_set, STREAM_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("onend", tjs_tty_event_get, tjs_tty_event_set, STREAM_EVENT_END),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "TTY", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_tty_class_funcs[] = {
    JS_PROP_INT32_DEF("MODE_NORMAL", UV_TTY_MODE_NORMAL, 0),
    JS_PROP_INT32_DEF("MODE_RAW", UV_TTY_MODE_RAW, 0),
    JS_PROP_INT32_DEF("MODE_IO", UV_TTY_MODE_IO, 0),
};

static const JSCFunctionListEntry tjs_pipe_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("accept", 0, tjs_pipe_accept),
    TJS_CFUNC_DEF("close", 0, tjs_pipe_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_pipe_fileno),
    TJS_CFUNC_DEF("listen", 1, tjs_pipe_listen),
    TJS_CFUNC_DEF("pause", 0, tjs_pipe_pause),
    TJS_CFUNC_DEF("read", 1, tjs_pipe_read),
    TJS_CFUNC_DEF("resume", 0, tjs_pipe_resume),
    TJS_CFUNC_DEF("shutdown", 0, tjs_pipe_shutdown),
    TJS_CFUNC_DEF("write", 1, tjs_pipe_write),
    TJS_CFUNC_DEF("open", 1, tjs_pipe_open),

    /* Pipe functions */
    TJS_CFUNC_MAGIC_DEF("address", 0, tjs_pipe_get_address, 0),
    TJS_CFUNC_MAGIC_DEF("remoteAddress", 0, tjs_pipe_get_address, 1),
    TJS_CFUNC_DEF("connect", 1, tjs_pipe_connect),
    TJS_CFUNC_DEF("bind", 1, tjs_pipe_bind),
    TJS_CGETSET_MAGIC_DEF("onconnection", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_CONNECTION),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_MESSAGE),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("onend", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_END),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Pipe", JS_PROP_CONFIGURABLE),
};

void tjs_mod_streams_init(JSContext* ctx, JSModuleDef* module)
{
    JSValue proto, obj;

    /* TCP class */
    JS_NewClassID(&tjs_tcp_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_tcp_class_id, &tjs_tcp_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_tcp_proto_funcs, countof(tjs_tcp_proto_funcs));
    JS_SetClassProto(ctx, tjs_tcp_class_id, proto);

    /* TCP object */
    obj = JS_NewCFunction2(ctx, tjs_tcp_constructor, "TCP", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_tcp_class_funcs, countof(tjs_tcp_class_funcs));
    JS_SetModuleExport(ctx, module, "TCP", obj);

    /* TTY class */
    JS_NewClassID(&tjs_tty_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_tty_class_id, &tjs_tty_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_tty_proto_funcs, countof(tjs_tty_proto_funcs));
    JS_SetClassProto(ctx, tjs_tty_class_id, proto);

    /* TTY object */
    obj = JS_NewCFunction2(ctx, tjs_tty_constructor, "TTY", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_tty_class_funcs, countof(tjs_tty_class_funcs));
    JS_SetModuleExport(ctx, module, "TTY", obj);

    /* Pipe class */
    JS_NewClassID(&tjs_pipe_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_pipe_class_id, &tjs_pipe_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_pipe_proto_funcs, countof(tjs_pipe_proto_funcs));
    JS_SetClassProto(ctx, tjs_pipe_class_id, proto);

    /* Pipe object */
    obj = JS_NewCFunction2(ctx, tjs_pipe_constructor, "Pipe", 1, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, module, "Pipe", obj);
}

void tjs_mod_streams_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "TCP");
    JS_AddModuleExport(ctx, module, "TTY");
    JS_AddModuleExport(ctx, module, "Pipe");
}
