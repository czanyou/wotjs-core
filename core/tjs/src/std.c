/*
 * QuickJS C library
 *
 * Copyright (c) 2017-2019 Fabrice Bellard
 * Copyright (c) 2017-2019 Charlie Gordon
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

#include <string.h>
#include <uv.h>

static JSValue tjs_std_read_object(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uint8_t* buf;
    uint64_t pos, len;
    JSValue obj;
    size_t size;

    if (JS_ToIndex(ctx, &pos, argv[1])) {
        return JS_EXCEPTION;
    }

    if (JS_ToIndex(ctx, &len, argv[2])) {
        return JS_EXCEPTION;
    }

    buf = JS_GetArrayBuffer(ctx, &size, argv[0]);
    if (!buf) {
        return JS_EXCEPTION;
    }

    if (pos + len > size) {
        return JS_ThrowRangeError(ctx, "array buffer overflow");
    }

    int flags = 0;
    if (argc > 3) {
        if (JS_ToBool(ctx, argv[3])) {
            flags |= JS_READ_OBJ_REFERENCE;
        }
    }

    obj = JS_ReadObject(ctx, buf + pos, len, flags);
    return obj;
}

static JSValue tjs_std_write_object(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    size_t len;
    uint8_t* buf;
    JSValue array;

    int flags = 0;
    if (argc > 1) {
        if (JS_ToBool(ctx, argv[1])) {
            flags |= JS_WRITE_OBJ_REFERENCE;
        }
    }

    buf = JS_WriteObject(ctx, &len, argv[0], flags);
    if (!buf) {
        return JS_EXCEPTION;
    }

    array = JS_NewArrayBufferCopy(ctx, buf, len);
    js_free(ctx, buf);
    return array;
}

/* load and evaluate a file */
static JSValue tjs_std_load_script(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* filename;
    JSValue ret;

    filename = JS_ToCString(ctx, argv[0]);
    if (!filename) {
        return JS_EXCEPTION;
    }

    int flags = JS_EVAL_TYPE_GLOBAL;
    if (argc > 1) {
        if (JS_ToBool(ctx, argv[1])) {
            flags = JS_EVAL_TYPE_MODULE;
        }
    }

    ret = TJS_EvalFile(ctx, filename, flags, false, NULL);
    JS_FreeCString(ctx, filename);
    return ret;
}

static JSValue tjs_std_gc(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JS_RunGC(JS_GetRuntime(ctx));
    return JS_UNDEFINED;
}

static JSValue tjs_std_eval_script(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* script;
    size_t len;
    JSValue ret;
    script = JS_ToCStringLen(ctx, &len, argv[0]);
    if (!script) {
        return JS_EXCEPTION;
    }

    ret = JS_Eval(ctx, script, len, "<evalScript>", JS_EVAL_TYPE_GLOBAL | JS_EVAL_FLAG_BACKTRACE_BARRIER);
    JS_FreeCString(ctx, script);
    return ret;
}

static const JSCFunctionListEntry js_std_funcs[] = {
    TJS_CFUNC_DEF("evalScript", 1, tjs_std_eval_script),
    TJS_CFUNC_DEF("gc", 0, tjs_std_gc),
    TJS_CFUNC_DEF("loadScript", 1, tjs_std_load_script),
    TJS_CFUNC_DEF("readObject", 4, tjs_std_read_object),
    TJS_CFUNC_DEF("writeObject", 2, tjs_std_write_object),
};

void tjs_mod_std_init(JSContext* ctx, JSModuleDef* m)
{
    JSValue runtime = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, runtime, js_std_funcs, countof(js_std_funcs));

    JS_SetModuleExport(ctx, m, "runtime", runtime);
}

void tjs_mod_std_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "runtime");
}
