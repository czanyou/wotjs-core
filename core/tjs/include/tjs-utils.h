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

#ifndef TJS_UTILS_H
#define TJS_UTILS_H

#include <quickjs.h>
#include <stdbool.h>
#include <stdlib.h>
#include <uv.h>

///////////////////////////////////////////////////////
// countof

#ifndef countof
#define countof(x) (sizeof(x) / sizeof((x)[0]))
#endif

#define ARRAY_SIZE(a) (sizeof(a) / sizeof((a)[0]))

///////////////////////////////////////////////////////
// Assertion

struct AssertionInfo {
    const char *file_line;  // filename:line
    const char *message;
    const char *function;
};

#define TJS_ERROR_AND_ABORT(expr)                                                                                          \
    do {                                                                                                                   \
        static const struct AssertionInfo args = { __FILE__ ":" STRINGIFY(__LINE__), #expr, TJS_PRETTY_FUNCTION_NAME };    \
        tjs_assert(args);                                                                                                  \
    } while (0)

#ifdef __GNUC__
#define TJS_LIKELY(expr)    __builtin_expect(!!(expr), 1)
#define TJS_UNLIKELY(expr)  __builtin_expect(!!(expr), 0)
#define TJS_PRETTY_FUNCTION_NAME __PRETTY_FUNCTION__
#else
#define TJS_LIKELY(expr)    expr
#define TJS_UNLIKELY(expr)  expr
#define TJS_PRETTY_FUNCTION_NAME ""
#endif

#define STRINGIFY_(x) #x
#define STRINGIFY(x)  STRINGIFY_(x)

#define TJS_CHECK(expr)                 \
    do {                                \
        if (TJS_UNLIKELY(!(expr))) {    \
            TJS_ERROR_AND_ABORT(expr);  \
        }                               \
    } while (0)

#define CHECK_EQ(a, b)      TJS_CHECK((a) == (b))
#define CHECK_GE(a, b)      TJS_CHECK((a) >= (b))
#define CHECK_GT(a, b)      TJS_CHECK((a) > (b))
#define CHECK_LE(a, b)      TJS_CHECK((a) <= (b))
#define CHECK_LT(a, b)      TJS_CHECK((a) < (b))
#define CHECK_NE(a, b)      TJS_CHECK((a) != (b))
#define CHECK_NULL(val)     TJS_CHECK((val) == NULL)
#define CHECK_NOT_NULL(val) TJS_CHECK((val) != NULL)

void tjs_assert(const struct AssertionInfo info);

///////////////////////////////////////////////////////
// 

#define TJS_CFUNC_DEF(name, length, func1) { name, JS_PROP_C_W_E, JS_DEF_CFUNC, 0, .u = { .func = { length, JS_CFUNC_generic, { .generic = func1 } } } }
#define TJS_CFUNC_MAGIC_DEF(name, length, func1, magic) { name, JS_PROP_C_W_E, JS_DEF_CFUNC, magic, .u = { .func = { length, JS_CFUNC_generic_magic, { .generic_magic = func1 } } } }
#define TJS_CGETSET_DEF(name, fgetter, fsetter) { name, JS_PROP_CONFIGURABLE, JS_DEF_CGETSET, 0, .u = { .getset = { .get = { .getter = fgetter }, .set = { .setter = fsetter } } } }
#define TJS_CGETSET_MAGIC_DEF(name, fgetter, fsetter, magic) { name, JS_PROP_CONFIGURABLE, JS_DEF_CGETSET_MAGIC, magic, .u = { .getset = { .get = { .getter_magic = fgetter }, .set = { .setter_magic = fsetter } } } }
#define TJS_CONST(x) JS_PROP_INT32_DEF(#x, x, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE)

///////////////////////////////////////////////////////
// Loop

uv_loop_t *TJS_GetLoop(JSContext *ctx);

///////////////////////////////////////////////////////
// Emit event

void TJS_EmitEvent(JSContext* ctx, JSValue callback, JSValue arg);

///////////////////////////////////////////////////////
// Error or exception

void TJS_DumpError(JSContext *ctx);
void TJS_DumpException(JSContext *ctx, JSValueConst exception);

///////////////////////////////////////////////////////
// To

// Buffer

typedef struct tjs_buffer_s {
    uint8_t* data;
    int is_string;
    size_t length;
    JSValue error;
} tjs_buffer_t;

/**
 * JS ArrayBuffer | TypedArray -> C Bytes
 */
tjs_buffer_t TJS_GetArrayBuffer(JSContext* ctx, JSValueConst value);

/**
 * JS String | ArrayBuffer | TypedArray -> C Bytes
 */
tjs_buffer_t TJS_ToArrayBuffer(JSContext* ctx, JSValueConst value);

// Value

int32_t TJS_ToInt32(JSContext *ctx, JSValueConst value, int32_t defaultValue);
int64_t TJS_ToInt64(JSContext *ctx, JSValueConst value, int64_t defaultValue);
uint32_t TJS_ToUint32(JSContext *ctx, JSValueConst value, uint32_t defaultValue);

// Array Buffer

/**
 * 创建一个 ArrayBuffer 值
 * C Bytes -> JS ArrayBuffer
 */
JSValue TJS_NewArrayBuffer(JSContext* ctx, uint8_t* data, size_t size);

/**
 * 创建一个 Uint8Array 值
 * C Bytes -> JS Uint8Array
 */
JSValue TJS_NewUint8Array(JSContext *ctx, uint8_t *data, size_t size);

///////////////////////////////////////////////////////
// Promise

typedef struct {
    JSValue p;
    JSValue rfuncs[2];
} TJSPromise;

JSValue TJS_InitPromise(JSContext *ctx, TJSPromise *promise);
bool TJS_IsPromisePending(JSContext *ctx, TJSPromise *promise);
void TJS_FreePromise(JSContext *ctx, TJSPromise *promise);
void TJS_FreePromiseRT(JSRuntime *rt, TJSPromise *promise);
void TJS_ClearPromise(JSContext *ctx, TJSPromise *promise);
void TJS_MarkPromise(JSRuntime *rt, TJSPromise *promise, JS_MarkFunc *mark_func);
void TJS_SettlePromise(JSContext *ctx, TJSPromise *promise, bool is_reject, int argc, JSValueConst *argv);
void TJS_ResolvePromise(JSContext *ctx, TJSPromise *promise, int argc, JSValueConst *argv);
void TJS_RejectPromise(JSContext *ctx, TJSPromise *promise, int argc, JSValueConst *argv);

JSValue TJS_NewResolvedPromise(JSContext *ctx, int argc, JSValueConst *argv);
JSValue TJS_NewRejectedPromise(JSContext *ctx, int argc, JSValueConst *argv);

///////////////////////////////////////////////////////
// Property

// 获取 object 属性值
int32_t TJS_GetPropertyInt32(JSContext *ctx, JSValueConst object, const char* name, int32_t defaultValue);

// 获取 object 属性值
uint32_t TJS_GetPropertyUint32(JSContext *ctx, JSValueConst object, const char* name, uint32_t defaultValue);

// 获取 object 属性值
char* TJS_GetPropertyString(JSContext *ctx, JSValueConst object, const char* name);

// 设置 object 属性值
#define TJS_SetPropertyValue(ctx, object, name, value) \
    JS_DefinePropertyValueStr(ctx, object, name, (value), JS_PROP_C_W_E)

// 设置数组元素值
#define TJS_SetElementValue(ctx, object, index, value) \
    JS_DefinePropertyValueUint32(ctx, object, index, (value), JS_PROP_C_W_E)

#endif