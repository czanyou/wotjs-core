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
    int readStart;
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

static void uv__udp_close_cb(uv_handle_t* handle)
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
    if (!uv_is_closing((uv_handle_t*)&udp->udp)) {
        uv_close((uv_handle_t*)&udp->udp, uv__udp_close_cb);
    }
}

static void tjs_udp_emit_event(JSContext* ctx, TJSUdp* stream, int event, JSValue arg)
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

static void tjs_udp_finalizer(JSRuntime* rt, JSValue val)
{
    TJSUdp* udp = JS_GetOpaque(val, tjs_udp_class_id);
    if (udp == NULL) {
        return;
    }

    for (int i = 0; i < UDP_EVENT_MAX; i++) {
        JS_FreeValueRT(rt, udp->events[i]);
    }

    TJS_FreePromiseRT(rt, &udp->read.result);
    udp->finalized = 1;
    if (udp->closed) {
        free(udp);

    } else {
        tjs_udp_maybe_close(udp);
    }
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

static JSClassDef tjs_udp_class = {
    "UDP",
    .finalizer = tjs_udp_finalizer,
    .gc_mark = tjs_udp_mark,
};

static TJSUdp* tjs_udp_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_udp_class_id);
}

static JSValue tjs_udp_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    if (!udp) {
        return JS_EXCEPTION;
    }

    if (TJS_IsPromisePending(ctx, &udp->read.result)) {
        JSValue arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "data", JS_UNDEFINED, JS_PROP_C_W_E);
        TJS_SettlePromise(ctx, &udp->read.result, false, 1, (JSValueConst*)&arg);
        TJS_ClearPromise(ctx, &udp->read.result);
    }

    tjs_udp_maybe_close(udp);
    return JS_UNDEFINED;
}

static void uv__udp_alloc_cb(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    TJSUdp* udp = handle->data;
    CHECK_NOT_NULL(udp);
    buf->base = js_malloc(udp->ctx, suggested_size);
    buf->len = suggested_size;
}

static void uv__udp_recv_cb(uv_udp_t* handle, ssize_t nread, const uv_buf_t* buf, const struct sockaddr* addr, unsigned flags)
{
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
        arg = tjs_new_error(ctx, nread);
        is_reject = 1;
        js_free(ctx, buf->base);

    } else {
        arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "data", TJS_NewArrayBuffer(ctx, (uint8_t*)buf->base, nread), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, arg, "flags", JS_NewInt32(ctx, flags), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, arg, "address", tjs_addr2obj(ctx, addr), JS_PROP_C_W_E);
    }

    TJS_SettlePromise(ctx, &udp->read.result, is_reject, 1, (JSValueConst*)&arg);
    TJS_ClearPromise(ctx, &udp->read.result);
}

static void uv__udp_recv_cb2(uv_udp_t* handle,
    ssize_t nread,
    const uv_buf_t* buf,
    const struct sockaddr* addr,
    unsigned flags)
{
    TJSUdp* udp = handle->data;
    CHECK_NOT_NULL(udp);

    // printf("uv__udp_recv_cb2(%d), %x\r\n", nread, addr);

    if (nread == 0 && addr == NULL) {
        js_free(udp->ctx, buf->base);
        return;
    }

    JSContext* ctx = udp->ctx;
    JSValue arg;
    int is_reject = 0;
    if (nread < 0) {
        arg = tjs_new_error(ctx, nread);
        is_reject = 1;
        js_free(ctx, buf->base);

        tjs_udp_emit_event(ctx, udp, UDP_EVENT_ERROR, arg);
        tjs_udp_emit_event(ctx, udp, UDP_EVENT_MESSAGE, JS_UNDEFINED);

    } else {
        arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "data", TJS_NewArrayBuffer(ctx, (uint8_t*)buf->base, nread), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, arg, "flags", JS_NewInt32(ctx, flags), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, arg, "address", tjs_addr2obj(ctx, addr), JS_PROP_C_W_E);

        tjs_udp_emit_event(ctx, udp, UDP_EVENT_MESSAGE, arg);
    }
}

static JSValue tjs_udp_recv(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    if (!udp) {
        return JS_EXCEPTION;
    }

    if (TJS_IsPromisePending(ctx, &udp->read.result)) {
        return tjs_throw_errno(ctx, UV_EBUSY);
    }

    int ret = uv_udp_recv_start(&udp->udp, uv__udp_alloc_cb, uv__udp_recv_cb);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return TJS_InitPromise(ctx, &udp->read.result);
}

static void uv__udp_send_cb(uv_udp_send_t* req, int status)
{
    TJSUdp* udp = req->handle->data;
    CHECK_NOT_NULL(udp);

    JSContext* ctx = udp->ctx;
    TJSSendReq* sr = req->data;

    int is_reject = 0;
    JSValue arg;
    if (status < 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = 1;

    } else {
        arg = JS_UNDEFINED;
    }

    TJS_SettlePromise(ctx, &sr->result, is_reject, 1, (JSValueConst*)&arg);
    js_free(ctx, sr);
}

static JSValue tjs_udp_send(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    if (!udp) {
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

    /* arg 2: target address */
    struct sockaddr_storage ss;
    struct sockaddr* sa = NULL;
    int ret;
    if (!JS_IsUndefined(argv[1])) {
        ret = tjs_obj2addr(ctx, argv[1], &ss);
        if (ret != 0) {
            return JS_EXCEPTION;
        }
        sa = (struct sockaddr*)&ss;
    }

    /* First try to do the write inline */
    uv_buf_t b;
    b = uv_buf_init(buf, size);
    ret = uv_udp_try_send(&udp->udp, &b, 1, sa);
    if (ret == size) {
        if (is_string) {
            JS_FreeCString(ctx, buf);
        }

        return TJS_NewResolvedPromise(ctx, 0, NULL);
    }

    /* Do an async write, copy the data. */
    if (ret >= 0) {
        buf += ret;
        size -= ret;
    }

    TJSSendReq* request = js_malloc(ctx, sizeof(*request) + size);
    if (!request) {
        return JS_EXCEPTION;
    }

    memset(request, 0, sizeof(*request));
    request->req.data = request;
    memcpy(request->data, buf, size);

    if (is_string) {
        JS_FreeCString(ctx, buf);
    }

    b = uv_buf_init(request->data, size);
    ret = uv_udp_send(&request->req, &udp->udp, &b, 1, sa, uv__udp_send_cb);
    if (ret != 0) {
        js_free(ctx, request);
        return tjs_throw_errno(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

static JSValue tjs_udp_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    if (!udp) {
        return JS_EXCEPTION;
    }

    int ret;
    uv_os_fd_t fd;
    ret = uv_fileno((uv_handle_t*)&udp->udp, &fd);
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

static JSValue tjs_new_udp(JSContext* ctx, int af)
{
    TJSUdp* udp;
    JSValue obj;
    int ret;

    obj = JS_NewObjectClass(ctx, tjs_udp_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    udp = calloc(1, sizeof(*udp));
    if (!udp) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    ret = uv_udp_init_ex(tjs_get_loop(ctx), &udp->udp, af);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(udp);
        return JS_ThrowInternalError(ctx, "couldn't initialize UDP handle");
    }

    udp->ctx = ctx;
    udp->closed = 0;
    udp->finalized = 0;
    udp->readStart = 0;

    udp->udp.data = udp;

    TJS_ClearPromise(ctx, &udp->read.result);

    JS_SetOpaque(obj, udp);
    return obj;
}

static JSValue tjs_udp_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    int af = AF_UNSPEC;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &af, argv[0])) {
        return JS_EXCEPTION;
    }

    return tjs_new_udp(ctx, af);
}

static JSValue tjs_udp_get_address(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    if (!udp) {
        return JS_EXCEPTION;
    }

    int ret;
    int namelen;
    struct sockaddr_storage addr;
    namelen = sizeof(addr);
    if (magic == 0) {
        ret = uv_udp_getsockname(&udp->udp, (struct sockaddr*)&addr, &namelen);

    } else {
        ret = uv_udp_getpeername(&udp->udp, (struct sockaddr*)&addr, &namelen);
    }

    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return tjs_addr2obj(ctx, (struct sockaddr*)&addr);
}

static JSValue tjs_udp_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    if (!udp) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int ret;
    ret = tjs_obj2addr(ctx, argv[0], &ss);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    ret = uv_udp_connect(&udp->udp, (struct sockaddr*)&ss);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_udp_disconnect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    if (!udp) {
        return JS_EXCEPTION;
    }

    int ret = uv_udp_connect(&udp->udp, NULL);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_udp_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUdp* udp = tjs_udp_get(ctx, this_val);
    if (!udp) {
        return JS_EXCEPTION;
    }

    struct sockaddr_storage ss;
    int ret;
    ret = tjs_obj2addr(ctx, argv[0], &ss);
    if (ret != 0) {
        return JS_ThrowTypeError(ctx, "must be a socket address object");
    }

    int flags = 0;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1]) && JS_ToInt32(ctx, &flags, argv[1])) {
            return JS_ThrowTypeError(ctx, "flags must be a number");
        }
    }

    // printf("uv_udp_bind: %d, %d\r\n", ret, flags);
    ret = uv_udp_bind(&udp->udp, (struct sockaddr*)&ss, flags);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_udp_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSUdp* udp = JS_GetOpaque(this_val, tjs_udp_class_id);
    if (!udp) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, udp->events[magic]);
}

static JSValue tjs_udp_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSUdp* udp = JS_GetOpaque(this_val, tjs_udp_class_id);
    if (!udp) {
        return JS_EXCEPTION;
    }

    if (!(JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value))) {
        return JS_UNDEFINED;
    }

    if (!udp->readStart && magic == UDP_EVENT_MESSAGE && JS_IsFunction(ctx, value)) {
        // printf("uv_udp_recv_start (%d)\r\n", udp->readStart);
        udp->readStart = 1;

        uv_udp_recv_start(&udp->udp, uv__udp_alloc_cb, uv__udp_recv_cb2);
    }

    JS_FreeValue(ctx, udp->events[magic]);
    udp->events[magic] = JS_DupValue(ctx, value);

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_udp_proto_funcs[] = {
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "UDP", JS_PROP_CONFIGURABLE),
    TJS_CFUNC_DEF("bind", 2, tjs_udp_bind),
    TJS_CFUNC_DEF("close", 0, tjs_udp_close),
    TJS_CFUNC_DEF("connect", 1, tjs_udp_connect),
    TJS_CFUNC_DEF("disconnect", 0, tjs_udp_disconnect),
    TJS_CFUNC_DEF("fileno", 0, tjs_udp_fileno),
    TJS_CFUNC_DEF("recv", 1, tjs_udp_recv),
    TJS_CFUNC_DEF("send", 2, tjs_udp_send),
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
    JSValue proto, obj;

    /* UDP class */
    JS_NewClassID(&tjs_udp_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_udp_class_id, &tjs_udp_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_udp_proto_funcs, countof(tjs_udp_proto_funcs));
    JS_SetClassProto(ctx, tjs_udp_class_id, proto);

    /* UDP object */
    obj = JS_NewCFunction2(ctx, tjs_udp_constructor, "UDP", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_udp_class_funcs, countof(tjs_udp_class_funcs));
    JS_SetModuleExport(ctx, m, "UDP", obj);
}

void tjs_mod_udp_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "UDP");
}
