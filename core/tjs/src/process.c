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

#include <string.h>
#include <unistd.h>

static JSClassID tjs_process_class_id;

typedef struct tjs_process_s {
    JSContext* ctx;
    bool closed;
    bool finalized;
    uv_process_t process;
    JSValue stdio[3];

    struct {
        bool exited;
        int64_t exit_status;
        int term_signal;
        TJSPromise result;
    } status;
} TJSProcess;

static void tjs_process_close_callback(uv_handle_t* handle)
{
    TJSProcess* process = handle->data;
    CHECK_NOT_NULL(process);

    process->closed = true;
    if (process->finalized) {
        free(process);
    }
}

static void tjs_process_maybe_close(TJSProcess* process)
{
    if (!uv_is_closing((uv_handle_t*)&process->process)) {
        uv_close((uv_handle_t*)&process->process, tjs_process_close_callback);
    }
}

static void tjs_process_clear(TJSProcess* process)
{
    JSContext* ctx = process->ctx;

    TJS_FreePromise(ctx, &process->status.result);
    JS_FreeValue(ctx, process->stdio[0]);
    JS_FreeValue(ctx, process->stdio[1]);
    JS_FreeValue(ctx, process->stdio[2]);

    process->stdio[0] = JS_UNDEFINED;
    process->stdio[1] = JS_UNDEFINED;
    process->stdio[2] = JS_UNDEFINED;
}

static void tjs_process_finalizer(JSRuntime* rt, JSValue val)
{
    TJSProcess* process = JS_GetOpaque(val, tjs_process_class_id);
    if (process == NULL) {
        return;
    }

    tjs_process_clear(process);

    process->finalized = true;
    if (process->closed) {
        free(process);

    } else {
        tjs_process_maybe_close(process);
    }
}

static void tjs_process_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSProcess* process = JS_GetOpaque(val, tjs_process_class_id);
    if (process) {
        TJS_MarkPromise(rt, &process->status.result, mark_func);
        JS_MarkValue(rt, process->stdio[0], mark_func);
        JS_MarkValue(rt, process->stdio[1], mark_func);
        JS_MarkValue(rt, process->stdio[2], mark_func);
    }
}

static TJSProcess* tjs_process_get(JSContext* ctx, JSValueConst obj)
{
    CHECK_NOT_NULL(ctx);

    return JS_GetOpaque2(ctx, obj, tjs_process_class_id);
}

static JSValue tjs_process_kill(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    TJSProcess* process = tjs_process_get(ctx, this_val);
    CHECK_NOT_NULL(process);

    int32_t signal_number = SIGTERM;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &signal_number, argv[0])) {
        return JS_EXCEPTION;
    }

    int ret = uv_process_kill(&process->process, signal_number);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_process_wait(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSProcess* process = tjs_process_get(ctx, this_val);
    CHECK_NOT_NULL(process);

    if (process->status.exited) {
        JSValue result = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, result, "code", JS_NewInt32(ctx, process->status.exit_status), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, result, "signal", JS_NewInt32(ctx, process->status.term_signal), JS_PROP_C_W_E);
        return TJS_NewResolvedPromise(ctx, 1, &result);

    } else if (process->closed) {
        return JS_UNDEFINED;

    } else {
        return TJS_InitPromise(ctx, &process->status.result);
    }
}

static JSValue tjs_process_pid_get(JSContext* ctx, JSValueConst this_val)
{
    TJSProcess* process = tjs_process_get(ctx, this_val);
    CHECK_NOT_NULL(process);

    return JS_NewInt32(ctx, uv_process_get_pid(&process->process));
}

static JSValue tjs_process_stdio_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSProcess* process = tjs_process_get(ctx, this_val);
    CHECK_NOT_NULL(process);

    return JS_DupValue(ctx, process->stdio[magic]);
}

static void tjs_process_exit_callback(uv_process_t* handle, int64_t exit_status, int term_signal)
{
    TJSProcess* process = handle->data;
    CHECK_NOT_NULL(process);

    process->status.exited = true;
    process->status.exit_status = exit_status;
    process->status.term_signal = term_signal;

    if (!JS_IsUndefined(process->status.result.p)) {
        JSContext* ctx = process->ctx;
        JSValue arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "code", JS_NewInt32(ctx, exit_status), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, arg, "signal", JS_NewInt32(ctx, term_signal), JS_PROP_C_W_E);

        TJS_SettlePromise(ctx, &process->status.result, false, 1, (JSValueConst*)&arg);
        TJS_ClearPromise(ctx, &process->status.result);
    }

    tjs_process_clear(process);
    tjs_process_maybe_close(process);
}

static int tjs_spawn_free_options(JSContext* ctx, uv_process_options_t* options)
{
    if (options == NULL) {
        return -1;
    }

    if (options->args) {
        for (int i = 0; options->args[i] != NULL; i++) {
            js_free(ctx, options->args[i]);
        }

        js_free(ctx, options->args);
    }

    if (options->env) {
        for (int i = 0; options->env[i] != NULL; i++) {
            js_free(ctx, options->env[i]);
        }

        js_free(ctx, options->env);
    }

    if (options->cwd) {
        js_free(ctx, (void*)options->cwd);
    }

    if (options->stdio) {
        js_free(ctx, (void*)options->stdio);
    }

    return 0;
}

static int tjs_spawn_get_stdio_options(JSContext* ctx, TJSProcess* process, uv_process_options_t* options, JSValueConst arg1)
{
    // stdio
    uv_stdio_container_t* stdio = js_malloc(ctx, sizeof(uv_stdio_container_t) * 3);

    stdio[0].flags = UV_INHERIT_FD;
    stdio[0].data.fd = STDIN_FILENO;

    stdio[1].flags = UV_INHERIT_FD;
    stdio[1].data.fd = STDOUT_FILENO;

    stdio[2].flags = UV_INHERIT_FD;
    stdio[2].data.fd = STDERR_FILENO;

    options->stdio_count = 3;
    options->stdio = stdio;

    if (JS_IsUndefined(arg1)) {
        return 0;
    }

    /* stdio */
    JSValue js_stdin = JS_GetPropertyStr(ctx, arg1, "stdin");
    if (!JS_IsException(js_stdin) && !JS_IsUndefined(js_stdin)) {
        const char* in = JS_ToCString(ctx, js_stdin);
        if (strcmp(in, "inherit") == 0) {
            stdio[0].flags = UV_INHERIT_FD;
            stdio[0].data.fd = STDIN_FILENO;

        } else if (strcmp(in, "pipe") == 0) {
            JSValue obj = tjs_pipe_new(ctx);
            if (JS_IsException(obj)) {
                JS_FreeValue(ctx, js_stdin);
                JS_FreeCString(ctx, in);
                goto fail;
            }

            process->stdio[0] = obj;
            stdio[0].flags = UV_CREATE_PIPE | UV_READABLE_PIPE;
            stdio[0].data.stream = tjs_pipe_get_stream(ctx, obj);

        } else if (strcmp(in, "ignore") == 0) {
            stdio[0].flags = UV_IGNORE;
        }

        if (in) {
            JS_FreeCString(ctx, in);
        }
    }

    JS_FreeValue(ctx, js_stdin);

    JSValue js_stdout = JS_GetPropertyStr(ctx, arg1, "stdout");
    if (!JS_IsException(js_stdout) && !JS_IsUndefined(js_stdout)) {
        const char* out = JS_ToCString(ctx, js_stdout);
        if (strcmp(out, "inherit") == 0) {
            stdio[1].flags = UV_INHERIT_FD;
            stdio[1].data.fd = STDOUT_FILENO;

        } else if (strcmp(out, "pipe") == 0) {
            JSValue obj = tjs_pipe_new(ctx);
            if (JS_IsException(obj)) {
                JS_FreeValue(ctx, js_stdout);
                JS_FreeCString(ctx, out);
                goto fail;
            }

            process->stdio[1] = obj;
            stdio[1].flags = UV_CREATE_PIPE | UV_WRITABLE_PIPE;
            stdio[1].data.stream = tjs_pipe_get_stream(ctx, obj);

        } else if (strcmp(out, "ignore") == 0) {
            stdio[1].flags = UV_IGNORE;
        }

        if (out) {
            JS_FreeCString(ctx, out);
        }
    }

    JS_FreeValue(ctx, js_stdout);

    JSValue js_stderr = JS_GetPropertyStr(ctx, arg1, "stderr");
    if (!JS_IsException(js_stderr) && !JS_IsUndefined(js_stderr)) {
        const char* err = JS_ToCString(ctx, js_stderr);
        if (strcmp(err, "inherit") == 0) {
            stdio[2].flags = UV_INHERIT_FD;
            stdio[2].data.fd = STDERR_FILENO;

        } else if (strcmp(err, "pipe") == 0) {
            JSValue obj = tjs_pipe_new(ctx);
            if (JS_IsException(obj)) {
                JS_FreeValue(ctx, js_stderr);
                JS_FreeCString(ctx, err);
                goto fail;
            }
            process->stdio[2] = obj;
            stdio[2].flags = UV_CREATE_PIPE | UV_WRITABLE_PIPE;
            stdio[2].data.stream = tjs_pipe_get_stream(ctx, obj);

        } else if (strcmp(err, "ignore") == 0) {
            stdio[2].flags = UV_IGNORE;
        }

        if (err) {
            JS_FreeCString(ctx, err);
        }
    }

    JS_FreeValue(ctx, js_stderr);

    return 0;

fail:
    return -1;
}

static int tjs_spawn_get_args_options(JSContext* ctx, uv_process_options_t* options, JSValueConst arg0)
{
    if (JS_IsString(arg0)) {
        options->args = js_mallocz(ctx, sizeof(*options->args) * 2);
        if (!options->args) {
            goto fail;
        }

        const char* text = JS_ToCString(ctx, arg0);
        if (text) {
            options->args[0] = js_strdup(ctx, text);
            JS_FreeCString(ctx, text);
        }

    } else if (JS_IsArray(ctx, arg0)) {
        JSValue jsLength = JS_GetPropertyStr(ctx, arg0, "length");
        uint64_t len;
        if (JS_ToIndex(ctx, &len, jsLength)) {
            JS_FreeValue(ctx, jsLength);
            goto fail;
        }

        JS_FreeValue(ctx, jsLength);
        options->args = js_mallocz(ctx, sizeof(*options->args) * (len + 1));
        if (!options->args) {
            goto fail;
        }

        for (int i = 0; i < len; i++) {
            JSValue v = JS_GetPropertyUint32(ctx, arg0, i);
            if (JS_IsException(v)) {
                goto fail;
            }

            const char* text = JS_ToCString(ctx, v);
            if (text) {
                options->args[i] = js_strdup(ctx, text);
                JS_FreeCString(ctx, text);
            }

            JS_FreeValue(ctx, v);
        }

    } else {
        JS_ThrowTypeError(ctx, "only string and array are allowed");
        goto fail;
    }

    options->file = options->args[0];

    return 0;

fail:
    return -1;
}

static int tjs_spawn_get_env_options(JSContext* ctx, uv_process_options_t* options, JSValueConst arg1)
{
    JSValue js_env = JS_GetPropertyStr(ctx, arg1, "env");
    if (JS_IsObject(js_env)) {
        JSPropertyEnum* ptab;
        uint32_t plen;

        if (JS_GetOwnPropertyNames(ctx, &ptab, &plen, js_env, JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY)) {
            JS_FreeValue(ctx, js_env);
            goto fail;
        }

        options->env = js_mallocz(ctx, sizeof(*options->env) * (plen + 1));
        if (!options->env) {
            JS_FreePropEnum(ctx, ptab, plen);
            JS_FreeValue(ctx, js_env);
            goto fail;
        }

        for (int i = 0; i < plen; i++) {
            JSValue prop = JS_GetProperty(ctx, js_env, ptab[i].atom);
            if (JS_IsException(prop)) {
                JS_FreePropEnum(ctx, ptab, plen);
                JS_FreeValue(ctx, js_env);
                goto fail;
            }

            const char* key = JS_AtomToCString(ctx, ptab[i].atom);
            const char* value = JS_ToCString(ctx, prop);
            size_t len = strlen(key) + strlen(value) + 2; /* KEY=VALUE\0 */
            options->env[i] = js_malloc(ctx, len);
            snprintf(options->env[i], len, "%s=%s", key, value);
        }

        JS_FreePropEnum(ctx, ptab, plen);
    }

    JS_FreeValue(ctx, js_env);
    return 0;

fail:
    return -1;
}

static int tjs_spawn_get_options(JSContext* ctx, uv_process_options_t* options, JSValueConst arg1)
{
    /* env */
    if (tjs_spawn_get_env_options(ctx, options, arg1) < 0) {
        goto fail;
    }

    /* detached */
    if (TJS_GetPropertyUint32(ctx, arg1, "detached", 0)) {
        options->flags |= UV_PROCESS_DETACHED;
    }

    /* cwd */
    options->cwd = TJS_GetPropertyString(ctx, arg1, "cwd");

    /* uid */
    int32_t uid = TJS_GetPropertyInt32(ctx, arg1, "uid", -1);
    if (uid >= 0) {
        options->uid = uid;
        options->flags |= UV_PROCESS_SETUID;
    }

    /* gid */
    int32_t gid = TJS_GetPropertyInt32(ctx, arg1, "gid", -1);
    if (gid >= 0) {
        options->gid = gid;
        options->flags |= UV_PROCESS_SETGID;
    }

    return 0;

fail:
    return -1;
}

static JSValue tjs_spawn(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "only string and array are allowed");
    }

    JSValue result;
    TJSProcess* process = calloc(1, sizeof(*process));
    if (!process) {
        return JS_EXCEPTION;
    }

    process->ctx = ctx;
    process->process.data = process;

    TJS_ClearPromise(ctx, &process->status.result);

    process->stdio[0] = JS_UNDEFINED;
    process->stdio[1] = JS_UNDEFINED;
    process->stdio[2] = JS_UNDEFINED;

    uv_process_options_t options;
    memset(&options, 0, sizeof(options));

    /* args */
    JSValue arg0 = argv[0];
    if (tjs_spawn_get_args_options(ctx, &options, arg0) < 0) {
        goto fail;
    }

    // options
    JSValue arg1 = argv[1];
    if (argc > 1 && !JS_IsUndefined(arg1)) {
        if (tjs_spawn_get_options(ctx, &options, arg1) < 0) {
            goto fail;
        }

        if (tjs_spawn_get_stdio_options(ctx, process, &options, arg1) < 0) {
            goto fail;
        }

    } else {
        if (tjs_spawn_get_stdio_options(ctx, process, &options, JS_UNDEFINED) < 0) {
            goto fail;
        }
    }

    // exit callback
    options.exit_cb = tjs_process_exit_callback;

    JSValue obj = JS_NewObjectClass(ctx, tjs_process_class_id);
    if (JS_IsException(obj)) {
        result = JS_UNDEFINED;
        goto fail;
    }

    // spawn
    int ret = uv_spawn(TJS_GetLoop(ctx), &process->process, &options);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        tjs_throw_uv_error(ctx, ret);
        goto fail;

    } else {
        JS_SetOpaque(obj, process);
        result = obj;
        goto cleanup;
    }

fail:
    JS_FreeValue(ctx, process->stdio[0]);
    JS_FreeValue(ctx, process->stdio[1]);
    JS_FreeValue(ctx, process->stdio[2]);
    free(process);

    result = JS_EXCEPTION;

cleanup:
    tjs_spawn_free_options(ctx, &options);

    return result;
}

static JSClassDef tjs_process_class = {
    "Process",
    .finalizer = tjs_process_finalizer,
    .gc_mark = tjs_process_mark,
};

static const JSCFunctionListEntry tjs_process_proto_funcs[] = {
    TJS_CFUNC_DEF("kill", 1, tjs_process_kill),
    TJS_CFUNC_DEF("wait", 0, tjs_process_wait),
    TJS_CGETSET_DEF("pid", tjs_process_pid_get, NULL),
    TJS_CGETSET_MAGIC_DEF("stdin", tjs_process_stdio_get, NULL, 0),
    TJS_CGETSET_MAGIC_DEF("stdout", tjs_process_stdio_get, NULL, 1),
    TJS_CGETSET_MAGIC_DEF("stderr", tjs_process_stdio_get, NULL, 2),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Process", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_process_funcs[] = {
    TJS_CFUNC_DEF("spawn", 2, tjs_spawn),
};

void tjs_mod_process_init(JSContext* ctx, JSModuleDef* m)
{
    // class
    JS_NewClassID(&tjs_process_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_process_class_id, &tjs_process_class);
    JSValue prototype = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, prototype, tjs_process_proto_funcs, countof(tjs_process_proto_funcs));
    JS_SetClassProto(ctx, tjs_process_class_id, prototype);

    JS_SetModuleExportList(ctx, m, tjs_process_funcs, countof(tjs_process_funcs));
}

void tjs_mod_process_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExportList(ctx, m, tjs_process_funcs, countof(tjs_process_funcs));
}
