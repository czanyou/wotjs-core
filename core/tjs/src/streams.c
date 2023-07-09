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

#include "streams.h"
#include "private.h"
#include "tjs-utils.h"

/* Forward declarations */

static void tjs_stream_read_alloc_callback(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
static void tjs_stream_read_callback(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf);
static int tjs_stream_read_start(JSContext* ctx, TJSStream* stream);

static int tjs_stream_total_count = 0;
static int tjs_stream_next_id = 1;

JSValue tjs_stream_accept(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    uv_stream_t* handle = &stream->h.stream;
    CHECK_NOT_NULL(handle);

    JSValue result;
    TJSStream* connection = NULL;
    switch (handle->type) {
    case UV_TCP:
        result = tjs_tcp_new(ctx, AF_UNSPEC);
        connection = tjs_tcp_get(ctx, result);
        break;

    case UV_NAMED_PIPE:
        result = tjs_pipe_new(ctx);
        connection = tjs_pipe_get(ctx, result);
        break;

    default:
        abort();
    }

    int ret = uv_accept(handle, &connection->h.stream);
    if (stream->stream_debug) {
        printf("streams: id=%d, accept: ret=%d\r\n",
            connection->stream_id, ret);
    }

    if (ret != 0) {
        JS_FreeValue(ctx, result);
        result = tjs_new_uv_error(ctx, ret);
        return JS_UNDEFINED;
    }

    return result;
}

static void tjs_stream_close_callback(uv_handle_t* handle)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    if (stream->stream_debug) {
        printf("streams: id=%d, close callback: closed=%d, finalized=%d\r\n",
            stream->stream_id, stream->closed, stream->finalized);
    }

    stream->closed = 1;
    if (stream->finalized) {
        free(stream); // 被动关闭，close 在 finalizer 后执行
    }
}

static void tjs_stream_maybe_close(TJSStream* stream)
{
    CHECK_NOT_NULL(stream);

    int is_closing = uv_is_closing(&stream->h.handle);
    if (stream->stream_debug) {
        printf("streams: id=%d, maybe close: is_closing=%d\r\n", stream->stream_id, is_closing);
    }

    if (!is_closing) {
        uv_close(&stream->h.handle, tjs_stream_close_callback);
    }
}

static void tjs_stream_clear(TJSStream* stream)
{
    CHECK_NOT_NULL(stream);
    JSContext* ctx = stream->ctx;

    if (stream->stream_debug) {
        printf("streams: id=%d, clear: closed=%d, finalized=%d, read_start=%d\r\n",
            stream->stream_id, stream->closed, stream->finalized, stream->read_start);
    }

    if (stream->read_start) {
        stream->read_start = 0;
        uv_read_stop(&stream->h.stream);
    }

    if (!stream->finalized) {
        tjs_stream_event_emit(stream->ctx, stream, STREAM_EVENT_CLOSE, JS_UNDEFINED);
    }

    // 删除所有注册的回调函数
    for (int i = 0; i < STREAM_EVENT_MAX; i++) {
        JSValue callback = stream->events[i];
        stream->events[i] = JS_UNDEFINED;
        JS_FreeValue(ctx, callback);
    }
}

JSValue tjs_stream_close(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    if (stream->stream_debug) {
        printf("streams: id=%d, close: closed=%d, finalized=%d, read_start=%d\r\n",
            stream->stream_id, stream->closed, stream->finalized, stream->read_start);
    }

    tjs_stream_clear(stream);
    tjs_stream_maybe_close(stream);

    return JS_UNDEFINED;
}

void tjs_stream_connect_callback(uv_connect_t* req, int status)
{
    CHECK_NOT_NULL(req);

    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    TJSConnectReq* request = req->data;
    JSValue arg;
    int is_reject = 0;
    if (status < 0) {
        arg = tjs_new_uv_error(ctx, status);
        is_reject = 1;

    } else {
        arg = JS_UNDEFINED;
        tjs_stream_event_emit(stream->ctx, stream, STREAM_EVENT_CONNECT, JS_UNDEFINED);

        if (stream->read_start) {
            stream->read_start = 1;

            if (stream->stream_debug) {
                printf("streams: id=%d, connected: read start\r\n", stream->stream_id);
            }

            uv_read_start(&stream->h.stream, tjs_stream_read_alloc_callback, tjs_stream_read_callback);
        }
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, request);
}

void tjs_stream_finalizer(JSRuntime* runtime, TJSStream* stream)
{
    CHECK_NOT_NULL(runtime);
    CHECK_NOT_NULL(stream);

    if (stream->stream_debug) {
        printf("streams: id=%d, finalizer: total=%d\r\n", stream->stream_id, tjs_stream_total_count);
    }

    stream->finalized = 1;
    tjs_stream_total_count--;
    tjs_stream_clear(stream);

    if (stream->closed) {
        free(stream);

    } else {
        tjs_stream_maybe_close(stream);
    }
}

void tjs_stream_event_emit(JSContext* ctx, TJSStream* stream, int event, JSValue arg)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    JSValue callback = stream->events[event];
    if (!JS_IsFunction(ctx, callback)) {
        if (stream->stream_debug) {
            printf("streams: id=%d, emit: skiped, event=%d\r\n", stream->stream_id, event);
        }

        JS_FreeValue(ctx, arg);
        return;
    }

    if (stream->stream_debug) {
        printf("streams: id=%d, emit: event=%d\r\n", stream->stream_id, event);
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

JSValue tjs_stream_event_get(JSContext* ctx, TJSStream* stream, JSValueConst this_val, int magic)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    return JS_DupValue(ctx, stream->events[magic]);
}

JSValue tjs_stream_event_set(JSContext* ctx, TJSStream* stream, JSValueConst this_val, JSValueConst value, int magic)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    if (JS_IsUndefined(value) || JS_IsNull(value)) {
        JSValue callback = stream->events[magic];
        JS_FreeValue(ctx, callback);
        stream->events[magic] = JS_UNDEFINED;

    } else if (JS_IsFunction(ctx, value)) {
        if (magic == STREAM_EVENT_MESSAGE) {
            tjs_stream_read_start(ctx, stream);
        }

        JSValue callback = stream->events[magic];
        JS_FreeValue(ctx, callback);
        stream->events[magic] = JS_DupValue(ctx, value);
    }
    return JS_UNDEFINED;
}

JSValue tjs_stream_fileno(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    int ret;
    uv_os_fd_t fd;
    ret = uv_fileno(&stream->h.handle, &fd);
    if (ret != 0) {
        return JS_UNDEFINED;
    }

    int32_t rfd;
#if defined(_WIN32)
    rfd = (int32_t)(intptr_t)fd;
#else
    rfd = fd;
#endif

    return JS_NewInt32(ctx, rfd);
}

int tjs_stream_has_ref(TJSStream* stream)
{
    CHECK_NOT_NULL(stream);
    return uv_has_ref(&stream->h.handle);
}

JSValue tjs_stream_init(JSContext* ctx, JSValue obj, TJSStream* stream)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    stream->ctx = ctx;
    stream->closed = 0;
    stream->finalized = 0;
    stream->read_start = 0;
    stream->stream_type = 0;
    stream->stream_debug = 0;
    stream->stream_id = tjs_stream_next_id++;

    tjs_stream_total_count++;

    stream->h.handle.data = stream;

    for (int i = 0; i < STREAM_EVENT_MAX; i++) {
        stream->events[i] = JS_UNDEFINED;
    }

    JS_SetOpaque(obj, stream);

    // if (stream->stream_debug) {
    // printf("streams: id=%d, init: total=%d\r\n", stream->stream_id, tjs_stream_total_count);
    // }

    return obj;
}

static void tjs_stream_listen_on_connection(uv_stream_t* handle, int status)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    if (status < 0) {
        JSValue error = tjs_new_uv_error(ctx, status);
        tjs_stream_event_emit(ctx, stream, STREAM_EVENT_ERROR, error);
        return;
    }

    tjs_stream_event_emit(stream->ctx, stream, STREAM_EVENT_CONNECTION, JS_UNDEFINED);
}

JSValue tjs_stream_listen(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
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

    int ret = uv_listen(&stream->h.stream, (int)backlog, tjs_stream_listen_on_connection);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return JS_UNDEFINED;
}

void tjs_stream_mark(JSRuntime* rt, TJSStream* stream, JS_MarkFunc* mark_func)
{
    CHECK_NOT_NULL(rt);
    CHECK_NOT_NULL(stream);

    if (stream->stream_debug) {
        // printf("streams: id=%d, mark\r\n", stream->stream_id);
    }

    for (int i = 0; i < STREAM_EVENT_MAX; i++) {
        JS_MarkValue(rt, stream->events[i], mark_func);
    }
}

JSValue tjs_stream_pause(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    stream->read_start = 0;

    // 总是会返回成功
    uv_read_stop(&stream->h.stream);
    return JS_UNDEFINED;
}

static void tjs_stream_read_alloc_callback(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    CHECK_NOT_NULL(ctx);

    char* buffer = malloc(suggested_size);
    *buf = uv_buf_init(buffer, suggested_size);

    if (stream->stream_debug) {
        printf("streams: id=%d, read alloc: nread=%ld\r\n", stream->stream_id, suggested_size);
    }
}

static void tjs_stream_read_callback(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf)
{
    CHECK_NOT_NULL(handle);

    TJSStream* stream = handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    CHECK_NOT_NULL(ctx);

    if (stream->stream_debug) {
        printf("streams: id=%d, message: nread=%ld\r\n", stream->stream_id, nread);
    }

    if (nread < 0) {
        tjs_stream_event_emit(ctx, stream, STREAM_EVENT_MESSAGE, JS_UNDEFINED);

        if (nread == UV_EOF) {
            tjs_stream_event_emit(ctx, stream, STREAM_EVENT_CLOSE, JS_UNDEFINED);

        } else {
            uv_read_stop(&stream->h.stream);
            JSValue error = tjs_new_uv_error(ctx, nread);
            tjs_stream_event_emit(ctx, stream, STREAM_EVENT_ERROR, error);
        }

        tjs_stream_clear(stream);

    } else if (nread > 0) {
        if (stream->stream_debug) {
            printf("streams: id=%d, emit: STREAM_EVENT_MESSAGE\r\n", stream->stream_id);
        }

        uint8_t* data = js_malloc(ctx, nread + 16);
        memcpy(data, buf->base, nread);
        JSValue message = TJS_NewArrayBuffer(ctx, data, nread);
        tjs_stream_event_emit(ctx, stream, STREAM_EVENT_MESSAGE, message);
    }

    free(buf->base);
}

static int tjs_stream_read_start(JSContext* ctx, TJSStream* stream)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    if (stream->read_start) {
        return 0;
    }

    stream->read_start = 1;

    if (stream->stream_debug) {
        printf("streams: id=%d, event set: read start \r\n", stream->stream_id);
    }

    uv_read_start(&stream->h.stream, tjs_stream_read_alloc_callback, tjs_stream_read_callback);
    return 0;
}

void tjs_stream_ref(TJSStream* stream)
{
    CHECK_NOT_NULL(stream);
    uv_ref(&stream->h.handle);
}

JSValue tjs_stream_resume(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    int ret = tjs_stream_read_start(ctx, stream);

    // UV_EALREADY | UV_EINVAL
    return JS_NewInt32(ctx, ret);
}

static void tjs_stream_shutdown_callback(uv_shutdown_t* req, int status)
{
    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    TJSShutdownReq* request = req->data;
    JSValue arg = JS_UNDEFINED;
    int is_reject = 0;
    if (status < 0) {
        arg = tjs_new_uv_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, request);
}

JSValue tjs_stream_shutdown(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    TJSShutdownReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    request->req.data = request;

    int ret = uv_shutdown(&request->req, &stream->h.stream, tjs_stream_shutdown_callback);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

void tjs_stream_unref(TJSStream* stream)
{
    CHECK_NOT_NULL(stream);
    uv_unref(&stream->h.handle);
}

static void tjs_stream_write_callback(uv_write_t* req, int status)
{
    TJSStream* stream = req->handle->data;
    CHECK_NOT_NULL(stream);

    JSContext* ctx = stream->ctx;
    CHECK_NOT_NULL(ctx);

    TJSWriteReq* request = req->data;

    int is_reject = 0;
    JSValue arg = JS_UNDEFINED;
    if (status < 0) {
        arg = tjs_new_uv_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, request);
}

JSValue tjs_stream_write(JSContext* ctx, TJSStream* stream, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);
    CHECK_NOT_NULL(stream);

    if (argc < 1) {
        return JS_UNDEFINED;
    }

    tjs_buffer_t buffer = TJS_ToArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    /* First try to do the write inline */
    int ret;
    uv_buf_t uv_buffer;
    uv_buffer = uv_buf_init((char*)buffer.data, buffer.length);
    ret = uv_try_write(&stream->h.stream, &uv_buffer, 1);

    if (ret == buffer.length) {
        if (buffer.is_string) {
            JS_FreeCString(ctx, (char*)buffer.data);
        }

        return TJS_NewResolvedPromise(ctx, 0, NULL);
    }

    /* Do an async write, copy the data. */
    if (ret >= 0) {
        buffer.data += ret;
        buffer.length -= ret;
    }

    TJSWriteReq* request = js_malloc(ctx, sizeof(*request) + buffer.length);
    if (!request) {
        if (buffer.is_string) {
            JS_FreeCString(ctx, (char*)buffer.data);
        }

        return JS_EXCEPTION;
    }

    request->req.data = request;
    memcpy(request->data, buffer.data, buffer.length);

    if (buffer.is_string) {
        JS_FreeCString(ctx, buffer.data);
    }

    uv_buffer = uv_buf_init(request->data, buffer.length);
    ret = uv_write(&request->req, &stream->h.stream, &uv_buffer, 1, tjs_stream_write_callback);
    if (ret != 0) {
        js_free(ctx, request);
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

void tjs_mod_streams_init(JSContext* ctx, JSModuleDef* module)
{
    tjs_mod_tcp_init(ctx, module);
    tjs_mod_tty_init(ctx, module);
    tjs_mod_pipe_init(ctx, module);
}

void tjs_mod_streams_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "TCP");
    JS_AddModuleExport(ctx, module, "TTY");
    JS_AddModuleExport(ctx, module, "Pipe");
}
