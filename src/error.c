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
#include "utils.h"

JSValue tjs_new_error(JSContext* ctx, int errorCode)
{
    JSValue error = JS_NewError(ctx);
    JSValue message = JS_NewString(ctx, uv_strerror(errorCode));
    JS_DefinePropertyValueStr(ctx, error, "message", message, JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, error, "errno", JS_NewInt32(ctx, errorCode), JS_PROP_C_W_E);
    return error;
}

static JSValue tjs_error_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    int errorCode = 0;
    if (argc > 0) {
        if (JS_ToInt32(ctx, &errorCode, argv[0])) {
            return JS_EXCEPTION;
        }
    }

    return tjs_new_error(ctx, errorCode);
}

static JSValue tjs_error_strerror(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int errorCode = 0;
    if (argc > 0) {
        if (JS_ToInt32(ctx, &errorCode, argv[0])) {
            return JS_EXCEPTION;
        }
    }

    return JS_NewString(ctx, uv_strerror(errorCode));
}

JSValue tjs_throw_errno(JSContext* ctx, int errorNumber)
{
    JSValue error;
    error = tjs_new_error(ctx, errorNumber);
    if (JS_IsException(error)) {
        error = JS_NULL;
    }

    return JS_Throw(ctx, error);
}

static const JSCFunctionListEntry tjs_error_funcs[] = { 
    TJS_CFUNC_DEF("strerror", 1, tjs_error_strerror),
/* various errno values */
#define DEF(x, s) JS_PROP_INT32_DEF(STRINGIFY(UV_##x), UV_##x, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    UV_ERRNO_MAP(DEF)
#undef DEF
};

void tjs_mod_error_init(JSContext* ctx, JSModuleDef* m)
{
    JSValue obj = JS_NewCFunction2(ctx, tjs_error_constructor, "Error", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, obj, tjs_error_funcs, countof(tjs_error_funcs));
    JS_SetModuleExport(ctx, m, "Error", obj);
}

void tjs_mod_error_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "Error");
}
