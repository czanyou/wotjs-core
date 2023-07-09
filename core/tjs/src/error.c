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
#include "tjs-utils.h"

JSValue tjs_new_uv_error(JSContext* ctx, int errorCode)
{
    const char* message = uv_strerror(errorCode);
    JSValue error = JS_NewError(ctx);
    TJS_SetPropertyValue(ctx, error, "code", JS_NewString(ctx, "UV_ERROR"));
    TJS_SetPropertyValue(ctx, error, "message", JS_NewString(ctx, message));
    TJS_SetPropertyValue(ctx, error, "errno", JS_NewInt32(ctx, errorCode));
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

    return tjs_new_uv_error(ctx, errorCode);
}

static JSValue tjs_error_strerror(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int errorCode = 0;
    if (argc > 0) {
        if (JS_ToInt32(ctx, &errorCode, argv[0])) {
            return JS_EXCEPTION;
        }
    }

    if (errorCode == 0) {
        return JS_UNDEFINED;
    }

    return JS_NewString(ctx, uv_strerror(errorCode));
}

JSValue tjs_throw_uv_error(JSContext* ctx, int errorNumber)
{
    JSValue error;
    error = tjs_new_uv_error(ctx, errorNumber);
    if (JS_IsException(error)) {
        error = JS_NULL;
    }

    return JS_Throw(ctx, error);
}

static const JSCFunctionListEntry tjs_error_funcs[] = {
    TJS_CFUNC_DEF("strerror", 1, tjs_error_strerror),
};

static const JSCFunctionListEntry tjs_error_errors[] = {
/* various errno values */
#define DEF(x, s) JS_PROP_INT32_DEF(STRINGIFY(UV_##x), UV_##x, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    UV_ERRNO_MAP(DEF)
#undef DEF
};

void tjs_mod_error_init(JSContext* ctx, JSModuleDef* m)
{
    JS_SetModuleExportList(ctx, m, tjs_error_funcs, countof(tjs_error_funcs));

    TJS_ExportModuleClass(ctx, m, tjs_error_constructor, "Error");
    TJS_ExportModuleObject(ctx, m, "errors", tjs_error_errors);
}

void tjs_mod_error_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExportList(ctx, m, tjs_error_funcs, countof(tjs_error_funcs));

    JS_AddModuleExport(ctx, m, "Error");
    JS_AddModuleExport(ctx, m, "errors");
}
