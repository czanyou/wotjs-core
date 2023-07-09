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

typedef struct tjs_timer_s {
    JSContext* ctx;
    uv_timer_t handle;
    int interval;
    JSValue obj;
    JSValue func;
    int argc;
    JSValue argv[];
} TJSTimer;

static void tjs_timer_clear(TJSTimer* timer)
{
    CHECK_NOT_NULL(timer);

    JSContext* ctx = timer->ctx;

    JS_FreeValue(ctx, timer->func);
    timer->func = JS_UNDEFINED;

    for (int i = 0; i < timer->argc; i++) {
        JS_FreeValue(ctx, timer->argv[i]);
        timer->argv[i] = JS_UNDEFINED;
    }
    timer->argc = 0;

    JSValue obj = timer->obj;
    timer->obj = JS_UNDEFINED;
    JS_FreeValue(ctx, obj);
}

static void tjs_timer_call(TJSTimer* timer)
{
    CHECK_NOT_NULL(timer);

    JSContext* ctx = timer->ctx;

    /* 'func' might be destroyed when calling itself (if it frees the handler), so must take extra care */
    JSValue func = JS_DupValue(ctx, timer->func);
    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, timer->argc, (JSValueConst*)timer->argv);
    JS_FreeValue(ctx, func);

    if (JS_IsException(ret)) {
        TJS_DumpError(ctx);
    }
    
    JS_FreeValue(ctx, ret);
}

static void tjs_timer_close_callback(uv_handle_t* handle)
{
    TJSTimer* timer = handle->data;
    CHECK_NOT_NULL(timer);
    free(timer);
}

static void tjs_timer_callback(uv_timer_t* handle)
{
    TJSTimer* timer = handle->data;
    CHECK_NOT_NULL(timer);

    /* Timer always executes before check phase in libuv,
       so clear the microtask queue here before running setTimeout macrotasks */
    tjs_execute_pending_jobs(timer->ctx);

    tjs_timer_call(timer);
    if (!timer->interval) {
        tjs_timer_clear(timer);
    }
}

static JSClassID tjs_timer_class_id;

static void tjs_timer_finalizer(JSRuntime* rt, JSValue val)
{
    TJSTimer* timer = JS_GetOpaque(val, tjs_timer_class_id);
    if (timer) {
        tjs_timer_clear(timer);
        
        uv_close((uv_handle_t*)&timer->handle, tjs_timer_close_callback);
    }
}

static void tjs_timer_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSTimer* timer = JS_GetOpaque(val, tjs_timer_class_id);
    if (timer) {
        JS_MarkValue(rt, timer->func, mark_func);
        for (int i = 0; i < timer->argc; i++) {
            JS_MarkValue(rt, timer->argv[i], mark_func);
        }
    }
}

static JSClassDef tjs_timer_class = {
    "Timer",
    .finalizer = tjs_timer_finalizer,
    .gc_mark = tjs_timer_mark,
};

static JSValue tjs_set_timeout(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    int64_t delay = 0;
    JSValueConst func;
    TJSTimer* timer;
    JSValue obj;

    // handler
    func = argv[0];
    if (!JS_IsFunction(ctx, func)) {
        return JS_ThrowTypeError(ctx, "not a function");
    }

    // timeout
    if (argc > 1) {
        if (JS_IsUndefined(argv[1])) {
            return JS_ThrowTypeError(ctx, "not a number");
        }

        if (JS_ToInt64(ctx, &delay, argv[1])) {
            return JS_ThrowTypeError(ctx, "not a number");
        }
    }

    obj = JS_NewObjectClass(ctx, tjs_timer_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    int nargs = (argc > 2) ? argc - 2 : 0;
    timer = calloc(1, sizeof(*timer) + nargs * sizeof(JSValue));
    if (!timer) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    timer->ctx = ctx;
    CHECK_EQ(uv_timer_init(TJS_GetLoop(ctx), &timer->handle), 0);
    timer->handle.data = timer;
    timer->interval = magic;
    timer->obj = JS_DupValue(ctx, obj);
    timer->func = JS_DupValue(ctx, func);
    timer->argc = nargs;

    for (int i = 0; i < nargs; i++) {
        timer->argv[i] = JS_DupValue(ctx, argv[i + 2]);
    }

    CHECK_EQ(uv_timer_start(&timer->handle, tjs_timer_callback, delay, magic ? delay : 0 /* repeat */), 0);

    JS_SetOpaque(obj, timer);
    return obj;
}

static JSValue tjs_clear_timeout(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSTimer* timer = JS_GetOpaque2(ctx, argv[0], tjs_timer_class_id);
    if (!timer) {
        return JS_EXCEPTION;
    }

    CHECK_EQ(uv_timer_stop(&timer->handle), 0);
    tjs_timer_clear(timer);

    return JS_UNDEFINED;
}


static JSValue tjs_timer_has_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSTimer* timer = JS_GetOpaque2(ctx, this_val, tjs_timer_class_id);
    CHECK_NOT_NULL(timer);
    int result = uv_has_ref((uv_handle_t*)&timer->handle);
    
    return JS_NewInt32(ctx, result);
}

static JSValue tjs_timer_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSTimer* timer = JS_GetOpaque2(ctx, this_val, tjs_timer_class_id);
    CHECK_NOT_NULL(timer);
    uv_ref((uv_handle_t*)&timer->handle);
    
    return JS_UNDEFINED;
}

static JSValue tjs_timer_unref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSTimer* timer = JS_GetOpaque2(ctx, this_val, tjs_timer_class_id);
    CHECK_NOT_NULL(timer);
    uv_unref((uv_handle_t*)&timer->handle);
    
    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_timer_proto_funcs[] = {
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Timer", JS_PROP_CONFIGURABLE),
    TJS_CFUNC_DEF("hasRef", 0, tjs_timer_has_ref),
    TJS_CFUNC_DEF("ref", 0, tjs_timer_ref),
    TJS_CFUNC_DEF("unref", 0, tjs_timer_unref)
};

static const JSCFunctionListEntry tjs_timer_funcs[] = {
    TJS_CFUNC_DEF("clearInterval", 1, tjs_clear_timeout),
    TJS_CFUNC_DEF("clearTimeout", 1, tjs_clear_timeout),
    TJS_CFUNC_MAGIC_DEF("setInterval", 2, tjs_set_timeout, 1),
    TJS_CFUNC_MAGIC_DEF("setTimeout", 2, tjs_set_timeout, 0)
};

void tjs_mod_timers_init(JSContext* ctx, JSModuleDef* m)
{
    // Timer class
    JS_NewClassID(&tjs_timer_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_timer_class_id, &tjs_timer_class);
    JSValue prototype = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, prototype, tjs_timer_proto_funcs, countof(tjs_timer_proto_funcs));
    JS_SetClassProto(ctx, tjs_timer_class_id, prototype);

    // functions
    JS_SetModuleExportList(ctx, m, tjs_timer_funcs, countof(tjs_timer_funcs));
}

void tjs_mod_timers_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExportList(ctx, m, tjs_timer_funcs, countof(tjs_timer_funcs));
}
