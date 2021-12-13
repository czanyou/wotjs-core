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

typedef struct tjs_signal_handler_s {
    JSContext* ctx;
    int closed;
    int finalized;
    uv_signal_t handle;
    int sig_num;
    JSValue func;

} TJSSignalHandler;

static JSClassID tjs_signal_handler_class_id;

static void tjs__signal_close_cb(uv_handle_t* handle)
{
    TJSSignalHandler* handler = handle->data;
    if (handler) {
        handler->closed = 1;
        if (handler->finalized) {
            free(handler);
        }
    }
}

static void tjs__signal_maybe_close(TJSSignalHandler* handler)
{
    if (!uv_is_closing((uv_handle_t*)&handler->handle)) {
        uv_close((uv_handle_t*)&handler->handle, tjs__signal_close_cb);
    }
}

static void tjs_signal_handler_finalizer(JSRuntime* rt, JSValue val)
{
    TJSSignalHandler* handler = JS_GetOpaque(val, tjs_signal_handler_class_id);
    if (handler) {
        JS_FreeValueRT(rt, handler->func);
        handler->finalized = 1;
        if (handler->closed) {
            free(handler);
            
        } else {
            tjs__signal_maybe_close(handler);
        }
    }
}

static void tjs_signal_handler_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSSignalHandler* handler = JS_GetOpaque(val, tjs_signal_handler_class_id);
    if (handler) {
        JS_MarkValue(rt, handler->func, mark_func);
    }
}

static JSClassDef tjs_signal_handler_class = {
    "SignalHandler",
    .finalizer = tjs_signal_handler_finalizer,
    .gc_mark = tjs_signal_handler_mark,
};

static void tjs__signal_cb(uv_signal_t* handle, int sig_num)
{
    TJSSignalHandler* handler = handle->data;
    CHECK_NOT_NULL(handler);
    tjs_call_handler(handler->ctx, handler->func);
}

static JSValue tjs_signal(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int32_t sig_num;
    if (argc < 1 || JS_ToInt32(ctx, &sig_num, argv[0])) {
        return JS_EXCEPTION;
    }

    JSValueConst func = argv[1];
    if (argc < 2 || !JS_IsFunction(ctx, func)) {
        return JS_ThrowTypeError(ctx, "not a function");
    }

    JSValue obj = JS_NewObjectClass(ctx, tjs_signal_handler_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSSignalHandler* handler = calloc(1, sizeof(*handler));
    if (!handler) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    int ret = uv_signal_init(tjs_get_loop(ctx), &handler->handle);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(handler);
        return JS_ThrowInternalError(ctx, "couldn't initialize Signal handle");
    }

    ret = uv_signal_start(&handler->handle, tjs__signal_cb, sig_num);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(handler);
        return tjs_throw_errno(ctx, ret);
    }

    uv_unref((uv_handle_t*)&handler->handle);

    handler->ctx = ctx;
    handler->sig_num = sig_num;
    handler->handle.data = handler;
    handler->func = JS_DupValue(ctx, func);

    JS_SetOpaque(obj, handler);
    return obj;
}

static TJSSignalHandler* tjs_signal_handler_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_signal_handler_class_id);
}

static JSValue tjs_signal_handler_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSSignalHandler* handler = tjs_signal_handler_get(ctx, this_val);
    if (!handler) {
        return JS_EXCEPTION;
    }

    tjs__signal_maybe_close(handler);
    return JS_UNDEFINED;
}

static JSValue tjs_signal_handler_signum_get(JSContext* ctx, JSValueConst this_val)
{
    TJSSignalHandler* handler = tjs_signal_handler_get(ctx, this_val);
    if (!handler) {
        return JS_EXCEPTION;
    }

    return JS_NewInt32(ctx, handler->sig_num);
}

static const JSCFunctionListEntry tjs_signal_handler_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_signal_handler_close),
    TJS_CGETSET_DEF("signum", tjs_signal_handler_signum_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "SignalHandler", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_signal_signals[] = {
#ifdef SIGHUP
    TJS_CONST(SIGHUP),
#endif
#ifdef SIGINT
    TJS_CONST(SIGINT),
#endif
#ifdef SIGQUIT
    TJS_CONST(SIGQUIT),
#endif
#ifdef SIGILL
    TJS_CONST(SIGILL),
#endif
#ifdef SIGTRAP
    TJS_CONST(SIGTRAP),
#endif
#ifdef SIGABRT
    TJS_CONST(SIGABRT),
#endif
#ifdef SIGIOT
    TJS_CONST(SIGIOT),
#endif
#ifdef SIGBUS
    TJS_CONST(SIGBUS),
#endif
#ifdef SIGFPE
    TJS_CONST(SIGFPE),
#endif
#ifdef SIGKILL
    TJS_CONST(SIGKILL),
#endif
#ifdef SIGUSR1
    TJS_CONST(SIGUSR1),
#endif
#ifdef SIGSEGV
    TJS_CONST(SIGSEGV),
#endif
#ifdef SIGUSR2
    TJS_CONST(SIGUSR2),
#endif
#ifdef SIGPIPE
    TJS_CONST(SIGPIPE),
#endif
#ifdef SIGALRM
    TJS_CONST(SIGALRM),
#endif
    TJS_CONST(SIGTERM),
#ifdef SIGCHLD
    TJS_CONST(SIGCHLD),
#endif
#ifdef SIGSTKFLT
    TJS_CONST(SIGSTKFLT),
#endif
#ifdef SIGCONT
    TJS_CONST(SIGCONT),
#endif
#ifdef SIGSTOP
    TJS_CONST(SIGSTOP),
#endif
#ifdef SIGTSTP
    TJS_CONST(SIGTSTP),
#endif
#ifdef SIGBREAK
    TJS_CONST(SIGBREAK),
#endif
#ifdef SIGTTIN
    TJS_CONST(SIGTTIN),
#endif
#ifdef SIGTTOU
    TJS_CONST(SIGTTOU),
#endif
#ifdef SIGURG
    TJS_CONST(SIGURG),
#endif
#ifdef SIGXCPU
    TJS_CONST(SIGXCPU),
#endif
#ifdef SIGXFSZ
    TJS_CONST(SIGXFSZ),
#endif
#ifdef SIGVTALRM
    TJS_CONST(SIGVTALRM),
#endif
#ifdef SIGPROF
    TJS_CONST(SIGPROF),
#endif
#ifdef SIGWINCH
    TJS_CONST(SIGWINCH),
#endif
#ifdef SIGIO
    TJS_CONST(SIGIO),
#endif
#ifdef SIGPOLL
    TJS_CONST(SIGPOLL),
#endif
#ifdef SIGLOST
    TJS_CONST(SIGLOST),
#endif
#ifdef SIGPWR
    TJS_CONST(SIGPWR),
#endif
#ifdef SIGINFO
    TJS_CONST(SIGINFO),
#endif
#ifdef SIGSYS
    TJS_CONST(SIGSYS),
#endif
#ifdef SIGUNUSED
    TJS_CONST(SIGUNUSED),
#endif
};

static const JSCFunctionListEntry tjs_signal_funcs[] = {
    TJS_CFUNC_DEF("signal", 2, tjs_signal),
};

void tjs_mod_signals_init(JSContext* ctx, JSModuleDef* module)
{
    // Handler class
    JS_NewClassID(&tjs_signal_handler_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_signal_handler_class_id, &tjs_signal_handler_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_signal_handler_proto_funcs, countof(tjs_signal_handler_proto_funcs));
    JS_SetClassProto(ctx, tjs_signal_handler_class_id, proto);

    // functions
    JS_SetModuleExportList(ctx, module, tjs_signal_funcs, countof(tjs_signal_funcs));

    JSValue signals = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, signals, tjs_signal_signals, countof(tjs_signal_signals));
    JS_SetModuleExport(ctx, module, "signals", signals);
}

void tjs_mod_signals_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExportList(ctx, module, tjs_signal_funcs, countof(tjs_signal_funcs));
    JS_AddModuleExport(ctx, module, "signals");
}
