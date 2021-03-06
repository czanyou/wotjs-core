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

typedef struct tjs_timer_s {
    JSContext* ctx;
    uv_timer_t handle;
    int interval;
    JSValue obj;
    JSValue func;
    int argc;
    JSValue argv[];
} TJSTimer;

static void tjs__clear_timer(TJSTimer* timer)
{
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

static void tjs__call_timer(TJSTimer* timer)
{
    JSContext* ctx = timer->ctx;
    JSValue ret, func1;
    /* 'func' might be destroyed when calling itself (if it frees the handler), so must take extra care */
    func1 = JS_DupValue(ctx, timer->func);
    ret = JS_Call(ctx, func1, JS_UNDEFINED, timer->argc, (JSValueConst*)timer->argv);
    JS_FreeValue(ctx, func1);
    if (JS_IsException(ret)) {
        tjs_dump_error(ctx);
    }
    
    JS_FreeValue(ctx, ret);
}

static void tjs__timer_close(uv_handle_t* handle)
{
    TJSTimer* timer = handle->data;
    CHECK_NOT_NULL(timer);
    free(timer);
}

static void tjs__timer_cb(uv_timer_t* handle)
{
    TJSTimer* timer = handle->data;
    CHECK_NOT_NULL(timer);

    /* Timer always executes before check phase in libuv,
       so clear the microtask queue here before running setTimeout macrotasks */
    tjs_execute_jobs(timer->ctx);

    tjs__call_timer(timer);
    if (!timer->interval) {
        tjs__clear_timer(timer);
    }
}

static JSClassID tjs_timer_class_id;

static void tjs_timer_finalizer(JSRuntime* rt, JSValue val)
{
    TJSTimer* timer = JS_GetOpaque(val, tjs_timer_class_id);
    if (timer) {
        tjs__clear_timer(timer);
        uv_close((uv_handle_t*)&timer->handle, tjs__timer_close);
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
    CHECK_EQ(uv_timer_init(tjs_get_loop(ctx), &timer->handle), 0);
    timer->handle.data = timer;
    timer->interval = magic;
    timer->obj = JS_DupValue(ctx, obj);
    timer->func = JS_DupValue(ctx, func);
    timer->argc = nargs;

    for (int i = 0; i < nargs; i++) {
        timer->argv[i] = JS_DupValue(ctx, argv[i + 2]);
    }

    CHECK_EQ(uv_timer_start(&timer->handle, tjs__timer_cb, delay, magic ? delay : 0 /* repeat */), 0);

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
    tjs__clear_timer(timer);

    return JS_UNDEFINED;
}

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

    // functions
    JS_SetModuleExportList(ctx, m, tjs_timer_funcs, countof(tjs_timer_funcs));
}

void tjs_mod_timers_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExportList(ctx, m, tjs_timer_funcs, countof(tjs_timer_funcs));
}
