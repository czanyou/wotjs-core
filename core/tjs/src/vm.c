/*
 * txiki.js
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

#include <string.h>

#define TJS__DEFAULT_STACK_SIZE 1048576

/** 命令行参数个数 */
static int tjs__argc = 0;

/**
 * 指定脚本名参数的位置
 * 1: tjs [options] script.js [args]
 * 2: tjs [options] command [args]
 * 3: command [args]
 */
static int tjs__arg0 = 0;

/** Command 的名称 */
static char tjs__command_name[64] = { 0 };

/** Script 的名称 */
static char tjs__script_filename[1024] = { 0 };

/** 命令行参数列表 */
static char** tjs__argv = NULL;

void tjs_mod_crypto_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_crypto_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_dns_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_dns_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_error_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_error_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_fs_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_fs_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_hal_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_hal_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_http_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_http_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_misc_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_misc_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_mqtt_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_mqtt_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_os_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_os_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_process_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_process_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_signals_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_signals_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_std_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_std_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_streams_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_streams_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_timers_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_timers_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_tls_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_tls_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_uart_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_uart_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_udp_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_udp_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_util_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_util_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_wasm_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_wasm_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_worker_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_worker_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_xhr_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_xhr_init(JSContext* ctx, JSModuleDef* m);
void tjs_mod_zlib_export(JSContext* ctx, JSModuleDef* m);
void tjs_mod_zlib_init(JSContext* ctx, JSModuleDef* m);

static int tjs_init(JSContext* ctx, JSModuleDef* m)
{
    tjs_mod_dns_init(ctx, m);
    tjs_mod_error_init(ctx, m);
    tjs_mod_fs_init(ctx, m);
    tjs_mod_hal_init(ctx, m);
    tjs_mod_http_init(ctx, m);
    tjs_mod_misc_init(ctx, m);
    tjs_mod_mqtt_init(ctx, m);
    tjs_mod_os_init(ctx, m);
    tjs_mod_process_init(ctx, m);
    tjs_mod_signals_init(ctx, m);
    tjs_mod_std_init(ctx, m);
    tjs_mod_streams_init(ctx, m);
    tjs_mod_timers_init(ctx, m);
    tjs_mod_uart_init(ctx, m);
    tjs_mod_udp_init(ctx, m);
    tjs_mod_util_init(ctx, m);
    tjs_mod_worker_init(ctx, m);
    tjs_mod_zlib_init(ctx, m);

#ifdef CONFIG_MBEDTLS
    tjs_mod_crypto_init(ctx, m);
    tjs_mod_tls_init(ctx, m);
#endif

#ifdef TJS_HAVE_WASM
    tjs_mod_wasm_init(ctx, m);
#endif

    return 0;
}

JSModuleDef* js_init_module_uv(JSContext* ctx, const char* name)
{
    JSModuleDef* m;
    m = JS_NewCModule(ctx, name, tjs_init);
    if (!m) {
        return NULL;
    }

    tjs_mod_dns_export(ctx, m);
    tjs_mod_error_export(ctx, m);
    tjs_mod_fs_export(ctx, m);
    tjs_mod_hal_export(ctx, m);
    tjs_mod_http_export(ctx, m);
    tjs_mod_misc_export(ctx, m);
    tjs_mod_mqtt_export(ctx, m);
    tjs_mod_os_export(ctx, m);
    tjs_mod_process_export(ctx, m);
    tjs_mod_signals_export(ctx, m);
    tjs_mod_std_export(ctx, m);
    tjs_mod_streams_export(ctx, m);
    tjs_mod_timers_export(ctx, m);
    tjs_mod_uart_export(ctx, m);
    tjs_mod_udp_export(ctx, m);
    tjs_mod_util_export(ctx, m);
    tjs_mod_worker_export(ctx, m);
    tjs_mod_zlib_export(ctx, m);

#ifdef CONFIG_MBEDTLS
    tjs_mod_tls_export(ctx, m);
    tjs_mod_crypto_export(ctx, m);
#endif

#ifdef TJS_HAVE_WASM
    tjs_mod_wasm_export(ctx, m);
#endif

    return m;
}

JSValue tjs__get_args(JSContext* ctx)
{
    JSValue args = JS_NewArray(ctx);
    for (int i = 0; i < tjs__argc; i++) {
        JS_SetPropertyUint32(ctx, args, i, JS_NewString(ctx, tjs__argv[i]));
    }

    return args;
}

JSValue tjs__get_arg0(JSContext* ctx)
{
    return JS_NewUint32(ctx, tjs__arg0);
}

JSValue tjs__get_command_name(JSContext* ctx)
{
    if (tjs__command_name[0]) {
        return JS_NewString(ctx, tjs__command_name);
    }

    return JS_UNDEFINED;
}

JSValue tjs__get_main_module_name(JSContext* ctx)
{
    if (tjs__script_filename[0]) {
        return JS_NewString(ctx, tjs__script_filename);
    }

    return JS_UNDEFINED;
}

static void tjs__promise_rejection_tracker(JSContext* ctx,
    JSValueConst promise,
    JSValueConst reason,
    BOOL is_handled,
    void* opaque)
{
    if (is_handled) {
        return;
    }

    JSValue global_obj = JS_GetGlobalObject(ctx);

    // PromiseRejectionEvent class
    JSValue event_constructor = JS_GetPropertyStr(ctx, global_obj, "PromiseRejectionEvent");
    CHECK_EQ(JS_IsUndefined(event_constructor), 0);

    // unhandledrejection event
    JSValue event_name = JS_NewString(ctx, "unhandledrejection");
    JSValueConst args[2];
    args[0] = event_name;
    args[1] = reason;
    JSValue event = JS_CallConstructor(ctx, event_constructor, 2, args);
    CHECK_EQ(JS_IsException(event), 0);

    // global.dispatchEvent
    JSValue dispatch_func = JS_GetPropertyStr(ctx, global_obj, "dispatchEvent");
    CHECK_EQ(JS_IsUndefined(dispatch_func), 0);
    JSValue ret = JS_Call(ctx, dispatch_func, global_obj, 1, &event);

    // free
    JS_FreeValue(ctx, global_obj);
    JS_FreeValue(ctx, event);
    JS_FreeValue(ctx, event_constructor);
    JS_FreeValue(ctx, event_name);
    JS_FreeValue(ctx, dispatch_func);

    if (JS_IsException(ret)) {
        TJS_DumpError(ctx);

    } else if (JS_ToBool(ctx, ret)) {
        // The event wasn't cancelled, log the error and maybe abort.
        fprintf(stderr, "tjs: Unhandled promise rejection: ");
        TJS_DumpException(ctx, reason);

        // rejected aborting
        TJSRuntime* qrt = TJS_GetRuntime(ctx);
        CHECK_NOT_NULL(qrt);
        if (qrt->options.unhandled_rejection) {
            fprintf(stderr, "tjs: Unhandled promise rejected, aborting!\n");
            fflush(stderr);
            abort();
        }
    }

    JS_FreeValue(ctx, ret);
}

static void uv__stop_cb(uv_async_t* handle)
{
    TJSRuntime* qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    uv_stop(&qrt->loop);
}

void TJS_DefaultOptions(TJSRuntimeOptions* options)
{
    static TJSRuntimeOptions default_options = {
        .unhandled_rejection = false,
        .dump_memory = false,
        .trace_memory = false,
        .memory_limit = 0,
        .exit_code = EXIT_SUCCESS,
        .stack_size = TJS__DEFAULT_STACK_SIZE
    };

    memcpy(options, &default_options, sizeof(*options));
}

TJSRuntime* tjs_new_runtime(bool is_worker, TJSRuntimeOptions* options)
{
    TJSRuntime* qrt = calloc(1, sizeof(*qrt));

    memcpy(&qrt->options, options, sizeof(*options));

    qrt->rt = JS_NewRuntime();
    CHECK_NOT_NULL(qrt->rt);

    qrt->ctx = JS_NewContext(qrt->rt);
    CHECK_NOT_NULL(qrt->ctx);

    JSRuntime* rt = qrt->rt;
    JSContext* ctx = qrt->ctx;

    JS_SetRuntimeOpaque(rt, qrt);
    JS_SetContextOpaque(ctx, qrt);

    /* Increase stack size */
    JS_SetMaxStackSize(rt, options->stack_size);

    if (options->memory_limit != 0) {
        JS_SetMemoryLimit(rt, options->memory_limit);
    }

    /* Enable BigFloat and BigDecimal */
    JS_AddIntrinsicBigFloat(ctx);
    JS_AddIntrinsicBigDecimal(ctx);

    qrt->is_worker = is_worker;

    CHECK_EQ(uv_loop_init(&qrt->loop), 0);

    /* handle which runs the job queue */
    CHECK_EQ(uv_prepare_init(&qrt->loop, &qrt->jobs.prepare), 0);
    qrt->jobs.prepare.data = qrt;

    /* handle to prevent the loop from blocking for i/o when there are pending jobs. */
    CHECK_EQ(uv_idle_init(&qrt->loop, &qrt->jobs.idle), 0);
    qrt->jobs.idle.data = qrt;

    /* handle which runs the job queue */
    CHECK_EQ(uv_check_init(&qrt->loop, &qrt->jobs.check), 0);
    qrt->jobs.check.data = qrt;

    /* hande for stopping this runtime (also works from another thread) */
    CHECK_EQ(uv_async_init(&qrt->loop, &qrt->stop, uv__stop_cb), 0);
    qrt->stop.data = qrt;

    /* loader for ES6 modules */
    tjs_module_init(rt, qrt);

    /* unhandled promise rejection tracker */
    JS_SetHostPromiseRejectionTracker(rt, tjs__promise_rejection_tracker, NULL);

    /* start bootstrap */
    qrt->in_bootstrap = true;

    /* core module */
    js_init_module_uv(ctx, "@tjs/native");

    tjs_init_internal_modules(ctx);

    tjs__bootstrap_globals(ctx);

    /* extra builtin modules */
    tjs__add_builtins(ctx);

    /* end bootstrap */
    qrt->in_bootstrap = false;

    /* WASM */
#ifdef TJS_HAVE_WASM
    qrt->wasm_ctx.env = m3_NewEnvironment();
#endif

    /* Load some builtin references for easy access */
    JSValue global_obj = JS_GetGlobalObject(ctx);
    qrt->builtins.u8array_ctor = JS_GetPropertyStr(ctx, global_obj, "Uint8Array");
    CHECK_EQ(JS_IsUndefined(qrt->builtins.u8array_ctor), 0);
    JS_FreeValue(ctx, global_obj);

    return qrt;
}

TJSRuntime* TJS_NewRuntime(TJSRuntimeOptions* options)
{
    TJSRuntimeOptions default_options;
    if (options == NULL) {
        options = &default_options;
        TJS_DefaultOptions(options);
    }

    return tjs_new_runtime(false, options);
}

TJSRuntime* tjs_new_worker_runtime(void)
{
    TJSRuntimeOptions options;
    TJS_DefaultOptions(&options);
    return tjs_new_runtime(true, &options);
}

void TJS_FreeRuntime(TJSRuntime* qrt)
{
    /* Close all loop handles. */
    uv_close((uv_handle_t*)&qrt->jobs.prepare, NULL);
    uv_close((uv_handle_t*)&qrt->jobs.idle, NULL);
    uv_close((uv_handle_t*)&qrt->jobs.check, NULL);
    uv_close((uv_handle_t*)&qrt->stop, NULL);

    JS_FreeValue(qrt->ctx, qrt->builtins.u8array_ctor);

    JS_FreeContext(qrt->ctx);
    JS_FreeRuntime(qrt->rt);

    /* Destroy WASM runtime. */
#ifdef TJS_HAVE_WASM
    m3_FreeEnvironment(qrt->wasm_ctx.env);
#endif

    /* Cleanup loop. All handles should be closed. */
    int closed = 0;
    for (int i = 0; i < 5; i++) {
        if (uv_loop_close(&qrt->loop) == 0) {
            closed = 1;
            break;
        }

        uv_run(&qrt->loop, UV_RUN_NOWAIT);
    }

#ifdef DEBUG
    if (!closed) {
        uv_print_all_handles(&qrt->loop, stderr);
    }
#endif

    if (closed != 1) {
        printf("CHECK_EQ(closed, 1): %d\r\n", closed);
        // CHECK_EQ(closed, 1);
    }

    free(qrt);
}

void TJS_SetArgs(int argc, char** argv)
{
    tjs__argc = argc;
    tjs__argv = uv_setup_args(argc, argv);
    if (!tjs__argv) {
        tjs__argv = argv;
    }
}

void TJS_SetArg0(int arg0, const char* command)
{
    tjs__arg0 = arg0;
    if (command) {
        strncpy(tjs__command_name, command, sizeof(tjs__command_name));
    }
}

void TJS_SetScriptFilename(const char* script)
{
    // printf("TJS_SetScriptFilename: %s\r\n", script);
    if (script) {
        strncpy(tjs__script_filename, script, 1024);
    }
}

JSContext* TJS_GetContext(TJSRuntime* qrt)
{
    return qrt->ctx;
}

TJSRuntime* TJS_GetRuntime(JSContext* ctx)
{
    return JS_GetContextOpaque(ctx);
}

uv_loop_t* TJS_GetLoopRT(TJSRuntime* qrt)
{
    return &qrt->loop;
}

static void uv__idle_cb(uv_idle_t* handle)
{
    // Noop
}

static void uv__maybe_idle(TJSRuntime* qrt)
{
    if (JS_IsJobPending(qrt->rt)) {
        CHECK_EQ(uv_idle_start(&qrt->jobs.idle, uv__idle_cb), 0);

    } else {
        CHECK_EQ(uv_idle_stop(&qrt->jobs.idle), 0);
    }
}

static void uv__prepare_cb(uv_prepare_t* handle)
{
    TJSRuntime* qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    uv__maybe_idle(qrt);
}

void tjs_execute_pending_jobs(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSContext* ctx1;
    int err;

    /* execute the pending jobs */
    for (;;) {
        err = JS_ExecutePendingJob(rt, &ctx1);
        if (err <= 0) {
            if (err < 0) {
                TJS_DumpError(ctx1);
            }

            break;
        }
    }
}

static void uv__check_cb(uv_check_t* handle)
{
    TJSRuntime* qrt = handle->data;
    CHECK_NOT_NULL(qrt);

    tjs_execute_pending_jobs(qrt->ctx);

    uv__maybe_idle(qrt);
}

/* main loop which calls the user JS callbacks */
void TJS_Run(TJSRuntime* qrt)
{
    CHECK_EQ(uv_prepare_start(&qrt->jobs.prepare, uv__prepare_cb), 0);
    uv_unref((uv_handle_t*)&qrt->jobs.prepare);

    CHECK_EQ(uv_check_start(&qrt->jobs.check, uv__check_cb), 0);
    uv_unref((uv_handle_t*)&qrt->jobs.check);

    /* Use the async handle to keep the worker alive even when there is nothing to do. */
    if (!qrt->is_worker) {
        uv_unref((uv_handle_t*)&qrt->stop);
    }

    int ret = 0;
    do {
        uv__maybe_idle(qrt);
        ret = uv_run(&qrt->loop, UV_RUN_DEFAULT);
    } while (ret == 0 && JS_IsJobPending(qrt->rt));
}

void TJS_Stop(TJSRuntime* qrt)
{
    CHECK_NOT_NULL(qrt);
    uv_async_send(&qrt->stop);
}

int tjs_load_file(JSContext* ctx, DynBuf* dbuf, const char* filename)
{
    uv_fs_t req;
    uv_file fd;
    int r;

    r = uv_fs_open(NULL, &req, filename, O_RDONLY, 0, NULL);
    uv_fs_req_cleanup(&req);
    if (r < 0) {
        return r;
    }

    fd = r;
    char buf[64 * 1024];
    uv_buf_t b = uv_buf_init(buf, sizeof(buf));
    size_t offset = 0;

    do {
        r = uv_fs_read(NULL, &req, fd, &b, 1, offset, NULL);
        uv_fs_req_cleanup(&req);
        if (r <= 0) {
            break;
        }

        offset += r;
        r = dbuf_put(dbuf, (const uint8_t*)b.base, r);
        if (r != 0) {
            break;
        }

    } while (1);

    uv_fs_close(NULL, &req, fd, NULL);
    uv_fs_req_cleanup(&req);
    return r;
}

JSValue TJS_EvalFile(JSContext* ctx, const char* filename, int flags, bool is_main, const char* override_filename)
{
    DynBuf dbuf;
    char* dbuf_data;
    size_t dbuf_size;
    int r, eval_flags;
    JSValue ret;

    dbuf_init(&dbuf);
    r = tjs_load_file(ctx, &dbuf, filename);
    if (r != 0) {
        dbuf_free(&dbuf);
        JS_ThrowReferenceError(ctx, "could not load '%s'", filename);
        return JS_EXCEPTION;
    }

    dbuf_size = dbuf.size;

    /* Add null termination, required by JS_Eval. */
    dbuf_putc(&dbuf, '\0');
    dbuf_data = (char*)dbuf.buf;

    // 跳过首行 #! 注释
    if ((dbuf_data[0] == '#') && (dbuf_data[1] == '!')) {
        dbuf_data[0] = '/';
        dbuf_data[1] = '/';
    }

    // printf("eval: file=%s, r=%d, size=%ld, data=[%s]\r\n", filename, r, dbuf_size, dbuf_data);
    if (flags == -1) {
        if (JS_DetectModule(dbuf_data, dbuf_size)) {
            eval_flags = JS_EVAL_TYPE_MODULE;

        } else {
            eval_flags = JS_EVAL_TYPE_GLOBAL;
        }

    } else {
        eval_flags = flags;
    }

    if ((eval_flags & JS_EVAL_TYPE_MASK) == JS_EVAL_TYPE_MODULE) {
        /* for the modules, we compile then run to be able to set import.meta */
        ret = JS_Eval(ctx,
            dbuf_data,
            dbuf_size,
            override_filename != NULL ? override_filename : filename,
            eval_flags | JS_EVAL_FLAG_COMPILE_ONLY);
        if (!JS_IsException(ret)) {
            tjs_module_set_import_meta(ctx, ret, TRUE, is_main);
            ret = JS_EvalFunction(ctx, ret);
        }

    } else {
        ret = JS_Eval(ctx,
            dbuf_data,
            dbuf_size,
            override_filename != NULL ? override_filename : filename,
            eval_flags);
    }

    /* Emit window 'load' event. */
    if (!JS_IsException(ret) && is_main) {
        static char emit_window_load[] = "window.dispatchEvent(new Event('load'));";
        JSValue ret1 = JS_Eval(ctx, emit_window_load, strlen(emit_window_load), "<global>", JS_EVAL_TYPE_GLOBAL);
        if (JS_IsException(ret1)) {
            TJS_DumpError(ctx);
        }
    }

    dbuf_free(&dbuf);
    return ret;
}
