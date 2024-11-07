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

int tjs__eval_binary(JSContext* ctx, const uint8_t* buf, size_t buf_len)
{
    JSValue obj = JS_ReadObject(ctx, buf, buf_len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(obj)) {
        goto error;
    }

    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, obj) < 0) {
            JS_FreeValue(ctx, obj);
            goto error;
        }

        tjs_module_set_import_meta(ctx, obj, FALSE, FALSE);
    }

    JSValue val = JS_EvalFunction(ctx, obj);
    if (JS_IsException(val)) {
        goto error;
    }

    JS_FreeValue(ctx, val);

    return 0;

error:
    fprintf(stderr, "Load module: ");
    TJS_DumpError(ctx);
    abort();
    return -1;
}

int tjs__eval_module(JSContext* ctx, const char* filename)
{
    if (filename == NULL) {
        return -1;
    }

    // 1. get module data
    uint32_t size = 0;
    const uint8_t* byte_code = tjs_module_get_data(filename, &size);
    if (byte_code == NULL || size <= 0) {
        printf("Error: could not load '%s'\r\n", filename);
        return -1;
    }

    return tjs__eval_binary(ctx, byte_code, size);
}

void tjs__bootstrap_globals(JSContext* ctx)
{
#ifdef ENABLE_BOOTSTRAP
    tjs__eval_module(ctx, "@tjs/native-bootstrap");
    tjs__eval_module(ctx, "@tjs/encoding");
    tjs__eval_module(ctx, "@tjs/console");
    tjs__eval_module(ctx, "@tjs/crypto");
    tjs__eval_module(ctx, "@tjs/event-target");
    tjs__eval_module(ctx, "@tjs/storage");
    tjs__eval_module(ctx, "@tjs/performance");
    tjs__eval_module(ctx, "@tjs/url");
    tjs__eval_module(ctx, "@tjs/process");
    tjs__eval_module(ctx, "@tjs/abort-controller");
    tjs__eval_module(ctx, "@tjs/navigator");
    tjs__eval_module(ctx, "@tjs/bootstrap");
#endif
}

void tjs__add_builtins(JSContext* ctx)
{
#ifdef ENABLE_BOOTSTRAP
    tjs__eval_module(ctx, "@tjs/fetch");
#endif
}
