
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

#include "utils.h"

#include "private.h"
#include "tjs.h"

#include <stdlib.h>
#include <string.h>

void tjs_assert(const struct AssertionInfo info)
{
    fprintf(stderr,
        "%s:%s%s Assertion `%s' failed.\n",
        info.file_line,
        info.function,
        *info.function ? ":" : "",
        info.message);
    fflush(stderr);
    abort();
}

uv_loop_t* tjs_get_loop(JSContext* ctx)
{
    TJSRuntime* qrt = JS_GetContextOpaque(ctx);
    CHECK_NOT_NULL(qrt);

    return TJS_GetLoop(qrt);
}

int tjs_obj2addr(JSContext* ctx, JSValueConst obj, struct sockaddr_storage* ss)
{
    JSValue js_ip;
    JSValue js_port;
    const char* ip;
    uint32_t port;
    int ret;

    // port
    js_port = JS_GetPropertyStr(ctx, obj, "port");
    ret = JS_ToUint32(ctx, &port, js_port);
    JS_FreeValue(ctx, js_port);
    if (ret != 0) {
        return -1;
    }

    // address or ip
    js_ip = JS_GetPropertyStr(ctx, obj, "ip");
    if (JS_IsUndefined(js_ip)) {
        js_ip = JS_GetPropertyStr(ctx, obj, "address");
    }

    ip = JS_ToCString(ctx, js_ip);
    JS_FreeValue(ctx, js_ip);
    if (!ip) {
        return -1;
    }

    // to socket address
    memset(ss, 0, sizeof(*ss));

    if (uv_inet_pton(AF_INET, ip, &((struct sockaddr_in*)ss)->sin_addr) == 0) {
        ss->ss_family = AF_INET;
        ((struct sockaddr_in*)ss)->sin_port = htons(port);

    } else if (uv_inet_pton(AF_INET6, ip, &((struct sockaddr_in6*)ss)->sin6_addr) == 0) {
        ss->ss_family = AF_INET6;
        ((struct sockaddr_in6*)ss)->sin6_port = htons(port);

    } else {
        tjs_throw_errno(ctx, UV_EAFNOSUPPORT);
        JS_FreeCString(ctx, ip);
        return -1;
    }

    JS_FreeCString(ctx, ip);
    return 0;
}

JSValue tjs_addr2obj(JSContext* ctx, const struct sockaddr* sa)
{
    char buf[INET6_ADDRSTRLEN + 1];
    JSValue obj;

    switch (sa->sa_family) {
    case AF_INET: {
        struct sockaddr_in* addr4 = (struct sockaddr_in*)sa;
        uv_ip4_name(addr4, buf, sizeof(buf));

        obj = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, obj, "family", JS_NewInt32(ctx, 4), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "ip", JS_NewString(ctx, buf), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "address", JS_NewString(ctx, buf), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "port", JS_NewInt32(ctx, ntohs(addr4->sin_port)), JS_PROP_C_W_E);

        return obj;
    }

    case AF_INET6: {
        struct sockaddr_in6* addr6 = (struct sockaddr_in6*)sa;
        uv_ip6_name(addr6, buf, sizeof(buf));

        obj = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, obj, "family", JS_NewInt32(ctx, 6), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "ip", JS_NewString(ctx, buf), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "address", JS_NewString(ctx, buf), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "port", JS_NewInt32(ctx, ntohs(addr6->sin6_port)), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx,
            obj,
            "flowinfo",
            JS_NewInt32(ctx, ntohl(addr6->sin6_flowinfo)),
            JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, obj, "scopeId", JS_NewInt32(ctx, addr6->sin6_scope_id), JS_PROP_C_W_E);

        return obj;
    }

    default:
        /* If we don't know the address family, don't raise an exception -- return undefined. */
        return JS_UNDEFINED;
    }
}

/**
 * 打印对象信息
 */
static void tjs_dump_obj(JSContext* ctx, FILE* f, JSValueConst val)
{
    const char* str = JS_ToCString(ctx, val);
    if (str) {
        fprintf(f, "%s\n", str);
        JS_FreeCString(ctx, str);

    } else {
        fprintf(f, "[exception]\n");
    }
}

/**
 * 打印错误信息
 */
void tjs_dump_error(JSContext* ctx)
{
    JSValue exception = JS_GetException(ctx);
    tjs_dump_error1(ctx, exception);
    JS_FreeValue(ctx, exception);
}

/**
 * 打印错误信息
 */
void tjs_dump_error1(JSContext* ctx, JSValueConst exception)
{
    int isError = JS_IsError(ctx, exception);
    tjs_dump_obj(ctx, stderr, exception);

    // 打印调用堆栈信息
    if (isError) {
        JSValue val = JS_GetPropertyStr(ctx, exception, "stack");
        if (!JS_IsUndefined(val)) {
            tjs_dump_obj(ctx, stderr, val);
        }

        JS_FreeValue(ctx, val);
    }
}

void tjs_call_handler(JSContext* ctx, JSValueConst func)
{
    JSValue ret, func1;
    /* 'func' might be destroyed when calling itself (if it frees the
       handler), so must take extra care */
    func1 = JS_DupValue(ctx, func);
    ret = JS_Call(ctx, func1, JS_UNDEFINED, 0, NULL);
    JS_FreeValue(ctx, func1);
    if (JS_IsException(ret)) {
        tjs_dump_error(ctx);
    }

    JS_FreeValue(ctx, ret);
}

void JS_FreePropEnum(JSContext* ctx, JSPropertyEnum* tab, uint32_t len)
{
    uint32_t i;
    if (tab) {
        for (i = 0; i < len; i++) {
            JS_FreeAtom(ctx, tab[i].atom);
        }

        js_free(ctx, tab);
    }
}

JSValue TJS_InitPromise(JSContext* ctx, TJSPromise* p)
{
    JSValue rfuncs[2];
    p->p = JS_NewPromiseCapability(ctx, rfuncs);
    if (JS_IsException(p->p)) {
        return JS_EXCEPTION;
    }

    p->rfuncs[0] = JS_DupValue(ctx, rfuncs[0]);
    p->rfuncs[1] = JS_DupValue(ctx, rfuncs[1]);
    return JS_DupValue(ctx, p->p);
}

bool TJS_IsPromisePending(JSContext* ctx, TJSPromise* p)
{
    return !JS_IsUndefined(p->p);
}

void TJS_FreePromise(JSContext* ctx, TJSPromise* p)
{
    JS_FreeValue(ctx, p->rfuncs[0]);
    JS_FreeValue(ctx, p->rfuncs[1]);
    JS_FreeValue(ctx, p->p);
}

void TJS_FreePromiseRT(JSRuntime* rt, TJSPromise* p)
{
    JS_FreeValueRT(rt, p->rfuncs[0]);
    JS_FreeValueRT(rt, p->rfuncs[1]);
    JS_FreeValueRT(rt, p->p);
}

void TJS_ClearPromise(JSContext* ctx, TJSPromise* p)
{
    p->p = JS_UNDEFINED;
    p->rfuncs[0] = JS_UNDEFINED;
    p->rfuncs[1] = JS_UNDEFINED;
}

void TJS_MarkPromise(JSRuntime* rt, TJSPromise* p, JS_MarkFunc* mark_func)
{
    JS_MarkValue(rt, p->p, mark_func);
    JS_MarkValue(rt, p->rfuncs[0], mark_func);
    JS_MarkValue(rt, p->rfuncs[1], mark_func);
}

void TJS_SettlePromise(JSContext* ctx, TJSPromise* p, bool is_reject, int argc, JSValueConst* argv)
{
    JSValue ret = JS_Call(ctx, p->rfuncs[is_reject], JS_UNDEFINED, argc, argv);
    for (int i = 0; i < argc; i++) {
        JS_FreeValue(ctx, argv[i]);
    }

    JS_FreeValue(ctx, ret); /* XXX: what to do if exception ? */
    JS_FreeValue(ctx, p->rfuncs[0]);
    JS_FreeValue(ctx, p->rfuncs[1]);
    TJS_FreePromise(ctx, p);
}

void TJS_ResolvePromise(JSContext* ctx, TJSPromise* p, int argc, JSValueConst* argv)
{
    TJS_SettlePromise(ctx, p, false, argc, argv);
}

void TJS_RejectPromise(JSContext* ctx, TJSPromise* p, int argc, JSValueConst* argv)
{
    TJS_SettlePromise(ctx, p, true, argc, argv);
}

static inline JSValue tjs__settled_promise(JSContext* ctx, bool is_reject, int argc, JSValueConst* argv)
{
    JSValue promise, resolving_funcs[2], ret;

    promise = JS_NewPromiseCapability(ctx, resolving_funcs);
    if (JS_IsException(promise)) {
        return JS_EXCEPTION;
    }

    ret = JS_Call(ctx, resolving_funcs[is_reject], JS_UNDEFINED, argc, argv);

    for (int i = 0; i < argc; i++) {
        JS_FreeValue(ctx, argv[i]);
    }

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, resolving_funcs[0]);
    JS_FreeValue(ctx, resolving_funcs[1]);

    return promise;
}

JSValue TJS_NewResolvedPromise(JSContext* ctx, int argc, JSValueConst* argv)
{
    return tjs__settled_promise(ctx, false, argc, argv);
}

JSValue TJS_NewRejectedPromise(JSContext* ctx, int argc, JSValueConst* argv)
{
    return tjs__settled_promise(ctx, true, argc, argv);
}

/** 在 Buffer 对象被回收时调用 */
static void tjs__on_buffer_free(JSRuntime* rt, void* opaque, void* ptr)
{
    if (ptr) {
        js_free_rt(rt, ptr);
    }
}

/**
 * 新建一个 ArrayBuffer
 * - data 指针会自动释放
 */
JSValue TJS_NewArrayBuffer(JSContext* ctx, uint8_t* data, size_t size)
{
    if (data == NULL && size > 0) {
        return JS_NULL;
    }

    JSValue arrayBuffer = JS_NewArrayBuffer(ctx, data, size, tjs__on_buffer_free, NULL, false);
    return arrayBuffer;
}

/**
 * 新建一个 Uint8Array
 * - data 指针会自动释放
 */
JSValue TJS_NewUint8Array(JSContext* ctx, uint8_t* data, size_t size)
{
    if (data == NULL && size > 0) {
        return JS_NULL;
    }

    JSValue abuf = JS_NewArrayBuffer(ctx, data, size, tjs__on_buffer_free, NULL, false);
    if (JS_IsException(abuf)) {
        return abuf;
    }

    TJSRuntime* qrt = TJS_GetRuntime(ctx);
    CHECK_NOT_NULL(qrt);
    JSValue buf = JS_CallConstructor(ctx, qrt->builtins.u8array_ctor, 1, &abuf);
    JS_FreeValue(ctx, abuf);
    return buf;
}

tjs_buffer_t tjs_to_buffer(JSContext* ctx, JSValueConst jsData)
{
    tjs_buffer_t buffer;
    buffer.data = NULL;
    buffer.length = 0;
    buffer.error = JS_UNDEFINED;

    // ArrayBuffer
    buffer.data = JS_GetArrayBuffer(ctx, &buffer.length, jsData);
    if (buffer.data != NULL) {
        return buffer;
    }

    /* Check if it's a typed array. */
    size_t byteOffset, byteLength;
    JSValue typedArray = JS_GetTypedArrayBuffer(ctx, jsData, &byteOffset, &byteLength, NULL);
    if (JS_IsException(typedArray)) {
        buffer.error = typedArray;
        return buffer;
    }

    buffer.data = JS_GetArrayBuffer(ctx, &buffer.length, typedArray);
    JS_FreeValue(ctx, typedArray);

    if (buffer.data != NULL) {
        buffer.data += byteOffset;
        buffer.length = byteLength;
    }

    return buffer;
}

int32_t tjs_to_int32(JSContext* ctx, JSValueConst value, int32_t defaultValue)
{
    int32_t result = defaultValue;
    if (JS_IsUndefined(value) || JS_IsNull(value) || JS_IsException(value)) {
        return result;
    }

    int ret = JS_ToInt32(ctx, &result, value);
    if (ret < 0) {
        result = defaultValue;
    }

    return result;
}

int64_t tjs_to_int64(JSContext* ctx, JSValueConst value, int64_t defaultValue)
{
    int64_t result = defaultValue;
    if (JS_IsUndefined(value) || JS_IsNull(value) || JS_IsException(value)) {
        return result;
    }

    int ret = JS_ToInt64(ctx, &result, value);
    if (ret < 0) {
        result = defaultValue;
    }

    return result;
}

uint32_t tjs_to_uint32(JSContext* ctx, JSValueConst value, uint32_t defaultValue)
{
    uint32_t result = defaultValue;
    if (JS_IsUndefined(value) || JS_IsNull(value) || JS_IsException(value)) {
        return result;
    }

    int ret = JS_ToUint32(ctx, &result, value);
    if (ret < 0) {
        result = defaultValue;
    }

    return result;
}

/**
 * 返回指定名称的整数类型属性值
 * @param name 属性名
 * @returns 整数类型属性值
 */
int32_t tjs_object_get_int32(JSContext* ctx, JSValueConst object, const char* name, int32_t defaultValue)
{
    if (name == NULL) {
        return defaultValue;
    }

    JSValue value = JS_GetPropertyStr(ctx, object, name);
    if (JS_IsException(value)) {
        return defaultValue;
    }

    int32_t ret = tjs_to_int32(ctx, value, defaultValue);
    JS_FreeValue(ctx, value);
    return ret;
}

/**
 * 返回指定名称的整数类型属性值
 * @param name 属性名
 * @returns 整数类型属性值
 */
uint32_t tjs_object_get_uint32(JSContext* ctx, JSValueConst object, const char* name, uint32_t defaultValue)
{
    if (name == NULL) {
        return defaultValue;
    }

    JSValue value = JS_GetPropertyStr(ctx, object, name);
    if (JS_IsException(value)) {
        return defaultValue;
    }

    uint32_t ret = tjs_to_uint32(ctx, value, defaultValue);
    JS_FreeValue(ctx, value);
    return ret;
}

/**
 * 返回指定名称的字符串属性值
 * @param name 属性名
 * @returns 字符串属性值
 */
char* tjs_object_get_string(JSContext* ctx, JSValueConst object, const char* name)
{
    if (name == NULL) {
        return NULL;
    }

    char* ret = NULL;
    JSValue value = JS_GetPropertyStr(ctx, object, name);
    if (JS_IsException(value)) {
        return NULL;
    }

    if (!JS_IsUndefined(value)) {
        ret = js_strdup(ctx, JS_ToCString(ctx, value));
    }

    JS_FreeValue(ctx, value);
    return ret;
}
