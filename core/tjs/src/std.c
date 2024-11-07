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
    uint8_t* buffer = NULL;
    uint64_t pos = 0, len = 0;
    JSValue object;
    size_t buffer_size = 0;

    if (JS_ToIndex(ctx, &pos, argv[1])) {
        return JS_EXCEPTION;

    } else if (JS_ToIndex(ctx, &len, argv[2])) {
        return JS_EXCEPTION;
    }

    buffer = JS_GetArrayBuffer(ctx, &buffer_size, argv[0]);
    if (!buffer) {
        return JS_EXCEPTION;
    }

    if (pos + len > buffer_size) {
        return JS_ThrowRangeError(ctx, "array buffer overflow");
    }

    int flags = 0;
    if (argc > 3) {
        if (JS_ToInt32(ctx, &flags, argv[3])) {
            // flags |= JS_READ_OBJ_REFERENCE;
            return JS_EXCEPTION;
        }
    }

    object = JS_ReadObject(ctx, buffer + pos, len, flags);
    return object;
}

static JSValue tjs_std_write_object(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    size_t len = 0;
    uint8_t* data = NULL;
    JSValue array_buffer;

    int flags = 0;
    if (argc > 1) {
        if (JS_ToInt32(ctx, &flags, argv[1])) {
            return JS_EXCEPTION;
        }
    }

    // printf("flags: %x\n", flags);
    // flags |= JS_WRITE_OBJ_REFERENCE;
    // JS_WRITE_OBJ_BYTECODE

    data = JS_WriteObject(ctx, &len, argv[0], flags);
    if (!data) {
        return JS_EXCEPTION;
    }

    array_buffer = JS_NewArrayBufferCopy(ctx, data, len);
    js_free(ctx, data);
    return array_buffer;
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

static JSValue tjs_std_compile(JSContext* ctx, JSValue this_val, int argc, JSValue* argv)
{
    size_t len = 0;
    const uint8_t* tmp = JS_GetArrayBuffer(ctx, &len, argv[0]);
    if (!tmp) {
        return JS_EXCEPTION;
    }

    // We need to copy the buffer in order to null-terminate it, which JS_Eval needs.
    uint8_t* buf = js_malloc(ctx, len + 1);
    if (!buf) {
        return JS_EXCEPTION;
    }

    memcpy(buf, tmp, len);
    buf[len] = '\0';
    const char* module_name = JS_ToCString(ctx, argv[1]);
    if (!module_name) {
        js_free(ctx, buf);
        return JS_EXCEPTION;
    }

    int eval_flags = JS_EVAL_FLAG_COMPILE_ONLY;
    int is_module = 1;
    if (is_module < 0) {
        is_module = JS_DetectModule((const char*)buf, len);
        // 总是为 module
        printf("module: %d:%s\n", is_module, module_name);
    }

    if (is_module) {
        eval_flags |= JS_EVAL_TYPE_MODULE;
    } else {
        eval_flags |= JS_EVAL_TYPE_GLOBAL;
    }

    JSValue object = JS_Eval(ctx, (const char*)buf, len, module_name, eval_flags);
    JS_FreeCString(ctx, module_name);
    js_free(ctx, buf);

    if (JS_IsException(object)) {
        JS_FreeValue(ctx, object);
        return JS_EXCEPTION;
    }

    size_t code_length = 0;
    int flags = JS_WRITE_OBJ_BYTECODE;
    uint8_t* data = JS_WriteObject(ctx, &code_length, object, flags);
    if (!data) {
        JS_FreeValue(ctx, object);
        return JS_EXCEPTION;
    }

    JS_FreeValue(ctx, object);

    JSValue array_buffer = JS_NewArrayBufferCopy(ctx, data, code_length);
    js_free(ctx, data);
    return array_buffer;
}

static JSValue tjs_std_eval_bytecode(JSContext* ctx, JSValue this_val, int argc, JSValue* argv)
{
    uint8_t* buffer = NULL;
    uint64_t offset = 0, length = 0;
    JSValue object;
    size_t buffer_size = 0;

    if (JS_ToIndex(ctx, &offset, argv[1])) {
        return JS_EXCEPTION;

    } else if (JS_ToIndex(ctx, &length, argv[2])) {
        return JS_EXCEPTION;
    }

    buffer = JS_GetArrayBuffer(ctx, &buffer_size, argv[0]);
    if (!buffer) {
        return JS_EXCEPTION;
    }

    if (offset + length > buffer_size) {
        return JS_ThrowRangeError(ctx, "array buffer overflow");
    }

    int flags = JS_READ_OBJ_BYTECODE;
    object = JS_ReadObject(ctx, buffer + offset, length, flags);

    if (JS_IsException(object)) {
        return JS_EXCEPTION;
    }

    if (JS_VALUE_GET_TAG(object) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, object) < 0) {
            JS_FreeValue(ctx, object);
            return JS_EXCEPTION;
        }

        tjs_module_set_import_meta(ctx, object, FALSE, FALSE);
    }

    return JS_EvalFunction(ctx, object);
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
    TJS_CFUNC_DEF("compile", 2, tjs_std_compile),
    TJS_CFUNC_DEF("evalByteCode", 1, tjs_std_eval_bytecode),
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
