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
#include "tjs-utils.h"

#define TJS_CheckNumber(ctx, index, value)                                                                \
    if ((argc > (index)) && !JS_IsUndefined(argv[(index)]) && JS_ToInt32(ctx, &(value), argv[(index)])) { \
        return JS_ThrowTypeError(ctx, #value " must be a number");                                        \
    }

#define TJS_CheckSocketAddress(ctx, index, value)                                \
    if (TJS_ToSocketAddress(ctx, argv[index], &(value)) != 0) {                  \
        return JS_ThrowTypeError(ctx, #value "must be a socket address object"); \
    }

#define TJS_GetResult(ctx, ret) \
    (((ret) != 0) ? tjs_throw_uv_error(ctx, (ret)) : JS_UNDEFINED);

/* UDP */
enum tjs_udp_event_s {
    UDP_EVENT_CLOSE = 0,
    UDP_EVENT_CONNECT,
    UDP_EVENT_ERROR,
    UDP_EVENT_MESSAGE,
    UDP_EVENT_MAX,
};

typedef struct tjs_udp_s {
    JSContext* ctx;
    int closed;
    int finalized;
    int read_start;
    uv_udp_t udp;
    struct {
        size_t size;
        TJSPromise result;
    } read;

    JSValue events[UDP_EVENT_MAX];
} TJSUdp;

typedef struct tjs_udp_send_req_s {
    uv_udp_send_t req;
    TJSPromise result;
    size_t size;
    char data[];
} TJSSendReq;

static JSClassID tjs_udp_class_id;

static TJSUdp* tjs_udp_get(JSContext* ctx, JSValueConst obj);
static JSValue tjs_udp_new(JSContext* ctx, int af);
static void tjs_udp_read_alloc_callback(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
static void tjs_udp_recv_on_message(uv_udp_t* handle, ssize_t nread, const uv_buf_t* buf, const struct sockaddr* addr, unsigned flags);

static JSValue tjs_udp_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    int af = AF_UNSPEC;
    TJS_CheckNumber(ctx, 0, af);

    return tjs_udp_new(ctx, af);
}

static JSValue tjs_udp_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    struct sockaddr_storage ss;
    int flags = 0;

    TJS_CheckSocketAddress(ctx, 0, ss);
    TJS_CheckNumber(ctx, 1, flags);

    int ret = uv_udp_bind(&udp->udp, (struct sockaddr*)&ss, flags);
    return TJS_GetResult(ctx, ret);
}

static void tjs_udp_close_callback(uv_handle_t* handle)
{
    TJSUdp* udp = handle->data;
    CHECK_NOT_NULL(udp);

    udp->closed = 1;
    if (udp->finalized) {
        free(udp);
    }
}

static void tjs_udp_maybe_close(TJSUdp* udp)
{
    CHECK_NOT_NULL(udp);

    if (!uv_is_closing((uv_handle_t*)&udp->udp)) {
        uv_close((uv_handle_t*)&udp->udp, tjs_udp_close_callback);
    }
}

static void tjs_udp_clear(TJSUdp* udp)
{
    CHECK_NOT_NULL(udp);

    JSContext* ctx = udp->ctx;
    CHECK_NOT_NULL(ctx);

    if (TJS_IsPromisePending(ctx, &udp->read.result)) {
        JSValue arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "data", JS_UNDEFINED, JS_PROP_C_W_E);
        TJS_SettlePromise(ctx, &udp->read.result, false, 1, (JSValueConst*)&arg);
        TJS_ClearPromise(ctx, &udp->read.result);
    }

    for (int i = 0; i < UDP_EVENT_MAX; i++) {
        JS_FreeValue(ctx, udp->events[i]);
        udp->events[i] = JS_UNDEFINED;
    }

    TJS_FreePromise(ctx, &udp->read.result);
}

static JSValue tjs_udp_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    tjs_udp_clear(udp);

    tjs_udp_maybe_close(udp);
    return JS_UNDEFINED;
}

static JSValue tjs_udp_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    struct sockaddr_storage ss;
    TJS_CheckSocketAddress(ctx, 0, ss);

    int ret = uv_udp_connect(&udp->udp, (struct sockaddr*)&ss);
    return TJS_GetResult(ctx, ret);
}

static JSValue tjs_udp_disconnect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    int ret = uv_udp_connect(&udp->udp, NULL);
    return TJS_GetResult(ctx, ret);
}

static void tjs_udp_event_emit(JSContext* ctx, TJSUdp* udp, int event, JSValue arg)
{
    CHECK_NOT_NULL(udp);

    JSValue callback = udp->events[event];
    TJS_EmitEvent(ctx, callback, arg);
}

static JSValue tjs_udp_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSUdp* udp = JS_GetOpaque(this_val, tjs_udp_class_id);
    CHECK_NOT_NULL(udp);

    return JS_DupValue(ctx, udp->events[magic]);
}

static JSValue tjs_udp_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSUdp* udp = JS_GetOpaque(this_val, tjs_udp_class_id);
    CHECK_NOT_NULL(udp);

    if (!(JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value))) {
        return JS_UNDEFINED;
    }

    if (!udp->read_start && magic == UDP_EVENT_MESSAGE && JS_IsFunction(ctx, value)) {
        // printf("uv_udp_recv_start (%d)\r\n", udp->read_start);
        udp->read_start = 1;

        uv_udp_recv_start(&udp->udp, tjs_udp_read_alloc_callback, tjs_udp_recv_on_message);
    }

    JS_FreeValue(ctx, udp->events[magic]);
    udp->events[magic] = JS_DupValue(ctx, value);

    return JS_UNDEFINED;
}

static JSValue tjs_udp_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    return tjs_get_fileno(ctx, (uv_handle_t*)&udp->udp);
}

static void tjs_udp_finalizer(JSRuntime* rt, JSValue val)
{
    TJSUdp* udp = JS_GetOpaque(val, tjs_udp_class_id);
    if (udp == NULL) {
        return;
    }

    tjs_udp_clear(udp);

    udp->finalized = 1;
    if (udp->closed) {
        free(udp);

    } else {
        tjs_udp_maybe_close(udp);
    }
}

static TJSUdp* tjs_udp_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_udp_class_id);
}

static JSValue tjs_udp_get_address(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    int ret;
    struct sockaddr_storage addr;
    int namelen = sizeof(addr);
    if (magic == 0) {
        ret = uv_udp_getsockname(&udp->udp, (struct sockaddr*)&addr, &namelen);

    } else {
        ret = uv_udp_getpeername(&udp->udp, (struct sockaddr*)&addr, &namelen);
    }

    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_NewSocketAddress(ctx, (struct sockaddr*)&addr);
}

static JSValue tjs_udp_has_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    int result = uv_has_ref((uv_handle_t*)&udp->udp);
    return JS_NewInt32(ctx, result);
}

static void tjs_udp_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSUdp* udp = JS_GetOpaque(val, tjs_udp_class_id);
    if (udp == NULL) {
        return;
    }

    TJS_MarkPromise(rt, &udp->read.result, mark_func);

    for (int i = 0; i < UDP_EVENT_MAX; i++) {
        JS_MarkValue(rt, udp->events[i], mark_func);
    }
}

static JSValue tjs_udp_new(JSContext* ctx, int af)
{
    JSValue obj = JS_NewObjectClass(ctx, tjs_udp_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSUdp* udp = calloc(1, sizeof(*udp));
    if (!udp) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    int ret = uv_udp_init_ex(TJS_GetLoop(ctx), &udp->udp, af);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(udp);
        return JS_ThrowInternalError(ctx, "couldn't initialize UDP handle");
    }

    udp->ctx = ctx;
    udp->closed = 0;
    udp->finalized = 0;
    udp->read_start = 0;
    udp->udp.data = udp;

    TJS_ClearPromise(ctx, &udp->read.result);

    for (int i = 0; i < UDP_EVENT_MAX; i++) {
        udp->events[i] = JS_UNDEFINED;
    }

    JS_SetOpaque(obj, udp);
    return obj;
}

static void tjs_udp_read_alloc_callback(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    CHECK_NOT_NULL(handle);

    TJSUdp* udp = handle->data;
    CHECK_NOT_NULL(udp);

    buf->base = js_malloc(udp->ctx, suggested_size);
    buf->len = suggested_size;
}

static void tjs_udp_recv_callback(uv_udp_t* handle, ssize_t nread, const uv_buf_t* buf, const struct sockaddr* addr, unsigned flags)
{
    CHECK_NOT_NULL(handle);

    TJSUdp* udp = handle->data;
    CHECK_NOT_NULL(udp);

    if (nread == 0 && addr == NULL) {
        js_free(udp->ctx, buf->base);
        return;
    }

    uv_udp_recv_stop(handle);

    JSContext* ctx = udp->ctx;
    JSValue arg;
    int is_reject = 0;
    if (nread < 0) {
        arg = tjs_new_uv_error(ctx, nread);
        is_reject = 1;
        js_free(ctx, buf->base);

    } else {
        JSValue data = TJS_NewArrayBuffer(ctx, (uint8_t*)buf->base, nread);

        arg = JS_NewObjectProto(ctx, JS_NULL);
        TJS_SetPropertyValue(ctx, arg, "data", data);
        TJS_SetPropertyValue(ctx, arg, "flags", JS_NewInt32(ctx, flags));
        TJS_SetPropertyValue(ctx, arg, "address", TJS_NewSocketAddress(ctx, addr));
    }

    TJS_SettlePromise(ctx, &udp->read.result, is_reject, 1, (JSValueConst*)&arg);
    TJS_ClearPromise(ctx, &udp->read.result);
}

static void tjs_udp_recv_on_message(uv_udp_t* handle, ssize_t nread, const uv_buf_t* buf, const struct sockaddr* addr, unsigned flags)
{
    CHECK_NOT_NULL(handle);

    TJSUdp* udp = handle->data;
    CHECK_NOT_NULL(udp);

    // printf("tjs_udp_recv_on_message(%d), %x\r\n", nread, addr);

    if (nread == 0 && addr == NULL) {
        js_free(udp->ctx, buf->base);
        return;
    }

    JSContext* ctx = udp->ctx;
    JSValue arg;
    int is_reject = 0;
    if (nread < 0) {
        arg = tjs_new_uv_error(ctx, nread);
        is_reject = 1;
        js_free(ctx, buf->base);

        tjs_udp_event_emit(ctx, udp, UDP_EVENT_ERROR, arg);
        tjs_udp_event_emit(ctx, udp, UDP_EVENT_MESSAGE, JS_UNDEFINED);

    } else {
        JSValue data = TJS_NewArrayBuffer(ctx, (uint8_t*)buf->base, nread);

        arg = JS_NewObjectProto(ctx, JS_NULL);
        TJS_SetPropertyValue(ctx, arg, "data", data);
        TJS_SetPropertyValue(ctx, arg, "flags", JS_NewInt32(ctx, flags));
        TJS_SetPropertyValue(ctx, arg, "address", TJS_NewSocketAddress(ctx, addr));
        tjs_udp_event_emit(ctx, udp, UDP_EVENT_MESSAGE, arg);
    }
}

static JSValue tjs_udp_recv(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    if (TJS_IsPromisePending(ctx, &udp->read.result)) {
        return tjs_throw_uv_error(ctx, UV_EBUSY);
    }

    int ret = uv_udp_recv_start(&udp->udp, tjs_udp_read_alloc_callback, tjs_udp_recv_callback);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_InitPromise(ctx, &udp->read.result);
}

static JSValue tjs_udp_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);
    uv_ref((uv_handle_t*)&udp->udp);

    return JS_UNDEFINED;
}

static JSValue tjs_udp_set_broadcast(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    int32_t enabled = -1;
    if (argc > 0 && JS_IsBool(argv[0])) {
        enabled = JS_ToBool(ctx, argv[0]);
        uv_udp_set_broadcast(&udp->udp, enabled);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_udp_set_ttl(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    int32_t ttl = 0;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1])) {
            JS_ToInt32(ctx, &ttl, argv[1]);
            int ret = uv_udp_set_ttl(&udp->udp, ttl);
            return JS_NewInt32(ctx, ret);
        }
    }

    return JS_UNDEFINED;
}

static void tjs_udp_send_callback(uv_udp_send_t* req, int status)
{
    CHECK_NOT_NULL(req);

    TJSUdp* udp = req->handle->data;
    CHECK_NOT_NULL(udp);

    JSContext* ctx = udp->ctx;
    TJSSendReq* sr = req->data;

    int is_reject = 0;
    JSValue arg = JS_UNDEFINED;
    if (status < 0) {
        arg = tjs_new_uv_error(ctx, status);
        is_reject = 1;
    }

    TJS_SettlePromise(ctx, &sr->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, sr);
}

static JSValue tjs_udp_send(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);

    /* arg 1: target address */
    struct sockaddr_storage ss;
    struct sockaddr* sa = NULL;
    int ret;
    if (!JS_IsUndefined(argv[1])) {
        ret = TJS_ToSocketAddress(ctx, argv[1], &ss);
        if (ret != 0) {
            return JS_EXCEPTION;
        }

        sa = (struct sockaddr*)&ss;
    }

    // arg 0
    tjs_buffer_t data = TJS_ToArrayBuffer(ctx, argv[0]);
    if (JS_IsException(data.error)) {
        return data.error;
    }

    /* First try to do the write inline */
    uv_buf_t b;
    uint8_t* buf = data.data;
    int size = data.length;
    b = uv_buf_init((char*)buf, size);
    ret = uv_udp_try_send(&udp->udp, &b, 1, sa);
    if (ret == size) {
        if (data.is_string) {
            JS_FreeCString(ctx, buf);
        }

        return TJS_NewResolvedPromise(ctx, 0, NULL);

    } else if (ret >= 0) {
        /* Do an async write, copy the data. */
        buf += ret;
        size -= ret;
    }

    // request
    TJSSendReq* request = js_malloc(ctx, sizeof(*request) + size);
    if (!request) {
        if (data.is_string) {
            JS_FreeCString(ctx, data.data);
        }

        return JS_EXCEPTION;
    }

    memset(request, 0, sizeof(*request));
    request->req.data = request;
    memcpy(request->data, buf, size);

    if (data.is_string) {
        JS_FreeCString(ctx, data.data);
    }

    // send
    b = uv_buf_init(request->data, size);
    ret = uv_udp_send(&request->req, &udp->udp, &b, 1, sa, tjs_udp_send_callback);
    if (ret != 0) {
        js_free(ctx, request);
        return tjs_throw_uv_error(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

static JSValue tjs_udp_unref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    CHECK_NOT_NULL(udp);
    uv_unref((uv_handle_t*)&udp->udp);

    return JS_UNDEFINED;
}

static JSClassDef tjs_udp_class = {
    "UDP",
    .finalizer = tjs_udp_finalizer,
    .gc_mark = tjs_udp_mark,
};

static const JSCFunctionListEntry tjs_udp_proto_funcs[] = {
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "UDP", JS_PROP_CONFIGURABLE),
    TJS_CFUNC_DEF("bind", 2, tjs_udp_bind),
    TJS_CFUNC_DEF("close", 0, tjs_udp_close),
    TJS_CFUNC_DEF("connect", 1, tjs_udp_connect),
    TJS_CFUNC_DEF("disconnect", 0, tjs_udp_disconnect),
    TJS_CFUNC_DEF("fileno", 0, tjs_udp_fileno),
    TJS_CFUNC_DEF("hasRef", 0, tjs_udp_has_ref),
    TJS_CFUNC_DEF("recv", 1, tjs_udp_recv),
    TJS_CFUNC_DEF("ref", 0, tjs_udp_ref),
    TJS_CFUNC_DEF("setBroadcast", 1, tjs_udp_set_broadcast),
    TJS_CFUNC_DEF("setTTL", 1, tjs_udp_set_ttl),
    TJS_CFUNC_DEF("send", 2, tjs_udp_send),
    TJS_CFUNC_DEF("unref", 0, tjs_udp_unref),

    TJS_CFUNC_MAGIC_DEF("address", 0, tjs_udp_get_address, 0),
    TJS_CFUNC_MAGIC_DEF("remoteAddress", 0, tjs_udp_get_address, 1),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_udp_event_get, tjs_udp_event_set, UDP_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_udp_event_get, tjs_udp_event_set, UDP_EVENT_MESSAGE)
};

static const JSCFunctionListEntry tjs_udp_class_funcs[] = {
    JS_PROP_INT32_DEF("IPV6ONLY", UV_UDP_IPV6ONLY, 0),
    JS_PROP_INT32_DEF("PARTIAL", UV_UDP_PARTIAL, 0),
    JS_PROP_INT32_DEF("REUSEADDR", UV_UDP_REUSEADDR, 0)
};

void tjs_mod_udp_init(JSContext* ctx, JSModuleDef* m)
{
    /* UDP class */
    JS_NewClassID(&tjs_udp_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_udp_class_id, &tjs_udp_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_udp_proto_funcs, countof(tjs_udp_proto_funcs));
    JS_SetClassProto(ctx, tjs_udp_class_id, proto);

    /* UDP constructor */
    JSValue constructor = JS_NewCFunction2(ctx, tjs_udp_constructor, "UDP", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, constructor, tjs_udp_class_funcs, countof(tjs_udp_class_funcs));
    JS_SetModuleExport(ctx, m, "UDP", constructor);
}

void tjs_mod_udp_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "UDP");
}
