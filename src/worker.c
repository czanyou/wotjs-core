/*
 * QuickJS libuv bindings
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
#include "tjs.h"

#include <unistd.h>

extern const uint8_t mjs_worker_bootstrap[];
extern const uint32_t mjs_worker_bootstrap_size;

enum tjs_worker_events_e {
    WORKER_EVENT_MESSAGE = 0,
    WORKER_EVENT_MESSAGE_ERROR,
    WORKER_EVENT_ERROR,
    WORKER_EVENT_MAX,
};

static JSValue tjs_new_worker(JSContext* ctx, uv_os_sock_t channel_fd, bool is_main);

static JSClassID tjs_worker_class_id;

typedef struct tjs_worker_data_s {
    const char* path;
    uv_os_sock_t channel_fd;
    uv_sem_t* sem;
    TJSRuntime* wrt;
} worker_data_t;

typedef struct tjs_worker_s {
    JSContext* ctx;
    union {
        uv_handle_t handle;
        uv_stream_t stream;
#if defined(_WIN32)
        uv_tcp_t tcp;
#else
        uv_pipe_t pipe;
#endif
    } h;
    JSValue events[WORKER_EVENT_MAX];
    uv_thread_t tid;
    TJSRuntime* wrt;
    bool is_main;
} TJSWorker;

typedef struct tjs_worker_write_req_s {
    uv_write_t req;
    uint8_t* data;
} TJSWorkerWriteReq;

static JSValue worker_eval(JSContext* ctx, int argc, JSValueConst* argv)
{
    const char* filename;
    JSValue ret;

    filename = JS_ToCString(ctx, argv[0]);
    if (!filename) {
        tjs_dump_error(ctx);
        goto error;
    }

    ret = TJS_EvalFile(ctx, filename, JS_EVAL_TYPE_MODULE, false, NULL);
    JS_FreeCString(ctx, filename);

    if (JS_IsException(ret)) {
        tjs_dump_error(ctx);
        JS_FreeValue(ctx, ret);
        goto error;
    }

    JS_FreeValue(ctx, ret);
    return JS_UNDEFINED;

error:;
    TJSRuntime* qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    TJS_Stop(qrt);

    return JS_UNDEFINED;
}

/* This is what the worker runs */
static void worker_entry(void* arg)
{
    worker_data_t* wd = arg;

    TJSRuntime* wrt = TJS_NewRuntimeWorker();
    CHECK_NOT_NULL(wrt);
    JSContext* ctx = TJS_GetJSContext(wrt);

    /* Start the worker bootstrap. */
    wrt->in_bootstrap = true;

    /* Bootstrap the worker scope. */
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JSValue worker_obj = tjs_new_worker(ctx, wd->channel_fd, false);
    JS_SetPropertyStr(ctx, global_obj, "workerThis", worker_obj);
    JS_FreeValue(ctx, global_obj);

#ifdef ENABLE_BOOTSTRAP
    CHECK_EQ(0, tjs__eval_binary(ctx, mjs_worker_bootstrap, mjs_worker_bootstrap_size));
#endif

    /* End the worker bootstrap. */
    wrt->in_bootstrap = false;

    /* Load the file and eval the file when the loop runs. */
    JSValue filename = JS_NewString(ctx, wd->path);
    CHECK_EQ(JS_EnqueueJob(ctx, worker_eval, 1, (JSValueConst*)&filename), 0);
    JS_FreeValue(ctx, filename);

    /* Notify the caller we are setup.  */
    wd->wrt = wrt;
    uv_sem_post(wd->sem);
    wd = NULL;

    TJS_Run(wrt);

    TJS_FreeRuntime(wrt);
}

static void uv__close_cb(uv_handle_t* handle)
{
    TJSWorker* worker = handle->data;
    CHECK_NOT_NULL(worker);
    free(worker);
}

static void tjs_worker_finalizer(JSRuntime* rt, JSValue val)
{
    TJSWorker* worker = JS_GetOpaque(val, tjs_worker_class_id);
    if (worker) {
        for (int i = 0; i < WORKER_EVENT_MAX; i++) {
            JS_FreeValueRT(rt, worker->events[i]);
        }
        
        uv_close(&worker->h.handle, uv__close_cb);
    }
}

static void tjs_worker_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSWorker* worker = JS_GetOpaque(val, tjs_worker_class_id);
    if (worker) {
        for (int i = 0; i < WORKER_EVENT_MAX; i++)
            JS_MarkValue(rt, worker->events[i], mark_func);
    }
}

static JSClassDef tjs_worker_class = {
    "Worker",
    .finalizer = tjs_worker_finalizer,
    .gc_mark = tjs_worker_mark,
};

static TJSWorker* tjs_worker_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_worker_class_id);
}

static JSValue emit_event(JSContext* ctx, int argc, JSValueConst* argv)
{
    CHECK_EQ(argc, 2);

    JSValue func = argv[0];
    JSValue arg = argv[1];

    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, 1, (JSValueConst*)&arg);
    if (JS_IsException(ret)) {
        tjs_dump_error(ctx);
    }

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);

    return JS_UNDEFINED;
}

static void maybe_emit_event(TJSWorker* worker, int event, JSValue arg)
{
    JSContext* ctx = worker->ctx;
    JSValue event_func = worker->events[event];
    if (!JS_IsFunction(ctx, event_func)) {
        return;
    }

    JSValue args[2];
    args[0] = JS_DupValue(ctx, event_func);
    args[1] = JS_DupValue(ctx, arg);
    CHECK_EQ(JS_EnqueueJob(ctx, emit_event, 2, (JSValueConst*)&args), 0);
}

static void uv__alloc_cb(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    TJSWorker* worker = handle->data;
    CHECK_NOT_NULL(worker);

    buf->base = js_malloc(worker->ctx, suggested_size);
    buf->len = suggested_size;
}

static void uv__read_cb(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf)
{
    TJSWorker* worker = handle->data;
    CHECK_NOT_NULL(worker);

    JSContext* ctx = worker->ctx;

    if (nread < 0) {
        uv_read_stop(&worker->h.stream);
        js_free(ctx, buf->base);
        if (nread != UV_EOF) {
            JSValue error = tjs_new_error(ctx, nread);
            maybe_emit_event(worker, WORKER_EVENT_ERROR, error);
            JS_FreeValue(ctx, error);
        }
        return;
    }

    // TODO: the entire object might not have come in a single packet. Use netstrings.
    JSValue obj = JS_ReadObject(ctx, (const uint8_t*)buf->base, buf->len, 0);
    maybe_emit_event(worker, WORKER_EVENT_MESSAGE, obj);
    JS_FreeValue(ctx, obj);
    js_free(ctx, buf->base);
}

static JSValue tjs_new_worker(JSContext* ctx, uv_os_sock_t channel_fd, bool is_main)
{
    JSValue obj = JS_NewObjectClass(ctx, tjs_worker_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSWorker* worker = calloc(1, sizeof(*worker));
    if (!worker) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    worker->ctx = ctx;
    worker->is_main = is_main;
    worker->h.handle.data = worker;

#if defined(_WIN32)
    CHECK_EQ(uv_tcp_init(tjs_get_loop(ctx), &worker->h.tcp), 0);
    CHECK_EQ(uv_tcp_open(&worker->h.tcp, channel_fd), 0);
#else
    CHECK_EQ(uv_pipe_init(tjs_get_loop(ctx), &worker->h.pipe, 0), 0);
    CHECK_EQ(uv_pipe_open(&worker->h.pipe, channel_fd), 0);
#endif
    CHECK_EQ(uv_read_start(&worker->h.stream, uv__alloc_cb, uv__read_cb), 0);

    worker->events[0] = JS_UNDEFINED;
    worker->events[1] = JS_UNDEFINED;
    worker->events[2] = JS_UNDEFINED;

    JS_SetOpaque(obj, worker);
    return obj;
}

static int tjs__worker_channel(uv_os_sock_t fds[2])
{
#if defined(_WIN32)
    union {
        struct sockaddr_in inaddr;
        struct sockaddr addr;
    } a;
    socklen_t addrlen = sizeof(a.inaddr);
    SOCKET listener;

    listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listener == INVALID_SOCKET)
        return -1;

    memset(&a, 0, sizeof(a));
    a.inaddr.sin_family = AF_INET;
    a.inaddr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    a.inaddr.sin_port = 0;

    fds[0] = fds[1] = INVALID_SOCKET;

    if (bind(listener, &a.addr, sizeof(a.inaddr)) == SOCKET_ERROR)
        goto error;
    if (getsockname(listener, &a.addr, &addrlen) == SOCKET_ERROR)
        goto error;
    if (listen(listener, 1) == SOCKET_ERROR)
        goto error;

    fds[0] = WSASocket(AF_INET, SOCK_STREAM, 0, NULL, 0, WSA_FLAG_OVERLAPPED);
    if (fds[0] == INVALID_SOCKET)
        goto error;
    if (connect(fds[0], &a.addr, sizeof(a.inaddr)) == SOCKET_ERROR)
        goto error;
    fds[1] = accept(listener, NULL, NULL);
    if (fds[1] == INVALID_SOCKET)
        goto error;

    closesocket(listener);
    return 0;

error:
    closesocket(listener);
    closesocket(fds[0]);
    closesocket(fds[1]);
    return -1;
#else
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, fds) != 0) {
        return -errno;
    }

    return 0;
#endif
}

static JSValue tjs_worker_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    uv_os_sock_t fds[2];
    int r = tjs__worker_channel(fds);
    if (r != 0) {
        JS_FreeCString(ctx, path);
        return tjs_throw_errno(ctx, r);
    }

    JSValue obj = tjs_new_worker(ctx, fds[0], true);
    if (JS_IsException(obj)) {
        close(fds[0]);
        close(fds[1]);
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    TJSWorker* w = tjs_worker_get(ctx, obj);

    /* We will wait for the worker to complete the creation of the VM. */
    uv_sem_t sem;
    CHECK_EQ(uv_sem_init(&sem, 0), 0);

    worker_data_t worker_data = { .channel_fd = fds[1], .path = path, .sem = &sem, .wrt = NULL };

    CHECK_EQ(uv_thread_create(&w->tid, worker_entry, (void*)&worker_data), 0);

    /* Wait for the worker to initialize. */
    uv_sem_wait(&sem);
    uv_sem_destroy(&sem);

    JS_FreeCString(ctx, path);

    uv_update_time(tjs_get_loop(ctx));

    worker_data.sem = NULL;
    w->wrt = worker_data.wrt;
    CHECK_NOT_NULL(w->wrt);

    return obj;
}

static void uv__write_cb(uv_write_t* req, int status)
{
    TJSWorkerWriteReq* request = req->data;
    CHECK_NOT_NULL(request);

    TJSWorker* workers = req->handle->data;
    CHECK_NOT_NULL(workers);

    JSContext* ctx = workers->ctx;

    if (status < 0) {
        JSValue error = tjs_new_error(ctx, status);
        maybe_emit_event(workers, WORKER_EVENT_MESSAGE_ERROR, error);
        JS_FreeValue(ctx, error);
    }

    js_free(ctx, request->data);
    js_free(ctx, request);
}

static JSValue tjs_worker_postmessage(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSWorker* worker = tjs_worker_get(ctx, this_val);
    if (!worker) {
        return JS_EXCEPTION;
    }

    TJSWorkerWriteReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    size_t length;
    uint8_t* buffer = JS_WriteObject(ctx, &length, argv[0], 0);
    if (!buffer) {
        js_free(ctx, request);
        return JS_EXCEPTION;
    }

    request->req.data = request;
    request->data = buffer;

    uv_buf_t buf = uv_buf_init((char*)buffer, length);
    int r = uv_write(&request->req, &worker->h.stream, &buf, 1, uv__write_cb);
    if (r != 0) {
        js_free(ctx, buffer);
        js_free(ctx, request);
        return JS_EXCEPTION;
    }

    return JS_UNDEFINED;
}

static JSValue tjs_worker_terminate(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSWorker* worker = tjs_worker_get(ctx, this_val);
    if (!worker) {
        return JS_EXCEPTION;
    }

    if (worker->is_main && worker->wrt) {
        TJS_Stop(worker->wrt);
        CHECK_EQ(uv_thread_join(&worker->tid), 0);
        uv_update_time(tjs_get_loop(ctx));
        worker->wrt = NULL;
    }

    return JS_UNDEFINED;
}

static JSValue tjs_worker_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSWorker* worker = tjs_worker_get(ctx, this_val);
    if (!worker) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, worker->events[magic]);
}

static JSValue tjs_worker_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSWorker* worker = tjs_worker_get(ctx, this_val);
    if (!worker) {
        return JS_EXCEPTION;
    }

    if (JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value)) {
        JS_FreeValue(ctx, worker->events[magic]);
        worker->events[magic] = JS_DupValue(ctx, value);
    }

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_worker_proto_funcs[] = {
    TJS_CFUNC_DEF("postMessage", 1, tjs_worker_postmessage),
    TJS_CFUNC_DEF("terminate", 0, tjs_worker_terminate),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_worker_event_get, tjs_worker_event_set, WORKER_EVENT_MESSAGE),
    TJS_CGETSET_MAGIC_DEF("onmessageerror", tjs_worker_event_get, tjs_worker_event_set, WORKER_EVENT_MESSAGE_ERROR),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_worker_event_get, tjs_worker_event_set, WORKER_EVENT_ERROR),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Worker", JS_PROP_CONFIGURABLE),
};

void tjs_mod_worker_init(JSContext* ctx, JSModuleDef* m)
{
    JSValue proto, obj;

    /* Worker class */
    JS_NewClassID(&tjs_worker_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_worker_class_id, &tjs_worker_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_worker_proto_funcs, countof(tjs_worker_proto_funcs));
    JS_SetClassProto(ctx, tjs_worker_class_id, proto);

    /* Worker object */
    obj = JS_NewCFunction2(ctx, tjs_worker_constructor, "Worker", 1, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, m, "Worker", obj);
}

void tjs_mod_worker_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "Worker");
}
