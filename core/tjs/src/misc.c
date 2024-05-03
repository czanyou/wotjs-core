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
#include "version.h"

#include <unistd.h>

#if defined(__linux__) || defined(__linux)
#include <syslog.h>
#endif

#ifndef TJS_BOARD
#define TJS_BOARD "local"
#endif

void mbedtls_version_get_string( char *string );
extern unsigned long http_parser_version(void);

static JSValue tjs_hrtime(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    return JS_NewBigUint64(ctx, uv_hrtime());
}

static JSValue tjs_gettimeofday(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uv_timeval64_t tv;
    int r = uv_gettimeofday(&tv);
    if (r != 0) {
        return tjs_throw_uv_error(ctx, r);
    }

    return JS_NewInt64(ctx, tv.tv_sec * 1000 + (tv.tv_usec / 1000));
}

static JSValue tjs_uname(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uv_utsname_t utsname;
    int r = uv_os_uname(&utsname);
    if (r != 0) {
        return tjs_throw_uv_error(ctx, r);
    }

    JSValue result = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, result, "sysname", JS_NewString(ctx, utsname.sysname), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "release", JS_NewString(ctx, utsname.release), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "version", JS_NewString(ctx, utsname.version), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "machine", JS_NewString(ctx, utsname.machine), JS_PROP_C_W_E);
    return result;
}

static JSValue tjs_isatty(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_FALSE;
    }

    int fd;
    if (!JS_IsNumber(argv[0])) {
        return JS_FALSE;

    } else if (JS_ToInt32(ctx, &fd, argv[0]) != 0) {
        return JS_FALSE;
    }

    int type = uv_guess_handle(fd);
    return JS_NewBool(ctx, type == UV_TTY);
}

static JSValue tjs_exit(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int status = 0;
    if (argc > 0) {
        if (JS_ToInt32(ctx, &status, argv[0])) {
            status = -1;
        }
    }

    exit(status);
    return JS_UNDEFINED;
}

static JSValue tjs_exit_code(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int status = 0;
    if (argc > 0) {
        if (JS_ToInt32(ctx, &status, argv[0])) {
            status = -1;
        }

        TJSRuntime* runtime = TJS_GetRuntime(ctx);
        if (runtime) {
            runtime->options.exit_code = status;
        }

        return JS_UNDEFINED;

    } else {
        TJSRuntime* runtime = TJS_GetRuntime(ctx);
        if (runtime) {
            status = runtime->options.exit_code;
        }

        return JS_NewInt32(ctx, status);
    }
}

static JSValue tjs_environ(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uv_env_item_t* environ;
    int count;

    int r = uv_os_environ(&environ, &count);
    if (r != 0) {
        return tjs_throw_uv_error(ctx, r);
    }

    JSValue result = JS_NewObjectProto(ctx, JS_NULL);
    for (int i = 0; i < count; i++) {
        JS_DefinePropertyValueStr(ctx, result, environ[i].name, JS_NewString(ctx, environ[i].value), JS_PROP_C_W_E);
    }

    uv_os_free_environ(environ, count);
    return result;
}

static JSValue tjs_getenv(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_UNDEFINED;
    }

    char buf[1024];
    size_t size = sizeof(buf);
    char* dbuf = buf;
    int r;

    JSValue ret = JS_UNDEFINED;
    r = uv_os_getenv(name, dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS) {
            goto exit;
        }

        dbuf = js_malloc(ctx, size);
        if (!dbuf) {
            ret = JS_EXCEPTION;
            goto exit;
        }

        r = uv_os_getenv(name, dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            ret = tjs_throw_uv_error(ctx, r);
            goto exit;
        }
    }

    ret = JS_NewStringLen(ctx, dbuf, size);
    if (dbuf != buf) {
        js_free(ctx, dbuf);
    }

exit:
    JS_FreeCString(ctx, name);

    return ret;
}

static JSValue tjs_setenv(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        return JS_UNDEFINED;
    }

    const char* name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_UNDEFINED;
    }

    const char* value = JS_ToCString(ctx, argv[1]);
    if (!value) {
        JS_FreeCString(ctx, name);
        return JS_UNDEFINED;
    }

    int r = uv_os_setenv(name, value);
    JS_FreeCString(ctx, value);
    JS_FreeCString(ctx, name);

    if (r != 0) {
        return tjs_throw_uv_error(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_unsetenv(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_UNDEFINED;
    }

    int r = uv_os_unsetenv(name);
    JS_FreeCString(ctx, name);
    if (r != 0) {
        return tjs_throw_uv_error(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_cwd(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    char buf[1024];
    size_t size = sizeof(buf);
    char* dbuf = buf;

    int r = uv_cwd(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS) {
            return tjs_throw_uv_error(ctx, r);
        }

        dbuf = js_malloc(ctx, size);
        if (!dbuf) {
            return JS_EXCEPTION;
        }

        r = uv_cwd(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_uv_error(ctx, r);
        }
    }

    JSValue result = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf) {
        js_free(ctx, dbuf);
    }

    return result;
}

static JSValue tjs_homedir(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    char buf[1024];
    size_t size = sizeof(buf);
    char* dbuf = buf;

    int r = uv_os_homedir(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS) {
            return tjs_throw_uv_error(ctx, r);
        }

        dbuf = js_malloc(ctx, size);
        if (!dbuf) {
            return JS_EXCEPTION;
        }

        r = uv_os_homedir(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_uv_error(ctx, r);
        }
    }

    JSValue result = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf) {
        js_free(ctx, dbuf);
    }

    return result;
}

static JSValue tjs_tmpdir(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    char buf[1024];
    size_t size = sizeof(buf);
    char* dbuf = buf;

    int r = uv_os_tmpdir(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS) {
            return tjs_throw_uv_error(ctx, r);
        }

        dbuf = js_malloc(ctx, size);
        if (!dbuf) {
            return JS_EXCEPTION;
        }

        r = uv_os_tmpdir(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_uv_error(ctx, r);
        }
    }

    JSValue result = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf) {
        js_free(ctx, dbuf);
    }

    return result;
}

static JSValue tjs_script_path(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    return tjs__get_main_module_name(ctx);
}

static JSValue tjs_exepath(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    char buf[1024];
    size_t size = sizeof(buf);
    char* dbuf = buf;

    int r = uv_exepath(dbuf, &size);
    if (r != 0) {
        if (r != UV_ENOBUFS) {
            return tjs_throw_uv_error(ctx, r);
        }

        dbuf = js_malloc(ctx, size);
        if (!dbuf) {
            return JS_EXCEPTION;
        }

        r = uv_exepath(dbuf, &size);
        if (r != 0) {
            js_free(ctx, dbuf);
            return tjs_throw_uv_error(ctx, r);
        }
    }

    JSValue result = JS_NewStringLen(ctx, dbuf, size);

    if (dbuf != buf) {
        js_free(ctx, dbuf);
    }

    return result;
}

static JSValue tjs_openlog(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
#if defined(__linux__) || defined(__linux)
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    const char* ident = JS_ToCString(ctx, argv[0]);
    if (!ident) {
        return JS_UNDEFINED;
    }

    int option = LOG_CONS | LOG_PID;
    int facility = LOG_DAEMON;

    if (argc > 1) {
        option = TJS_ToInt32(ctx, argv[0], option);
    }

    openlog(ident, option, facility);

    JS_FreeCString(ctx, ident);

#endif
    return JS_UNDEFINED;
}

static JSValue tjs_syslog(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
#if defined(__linux__) || defined(__linux)
    if (argc < 2) {
        return JS_UNDEFINED;
    }

    const int32_t level = TJS_ToInt32(ctx, argv[0], LOG_DEBUG);
    const char* str = JS_ToCString(ctx, argv[1]);
    if (!str) {
        return JS_UNDEFINED;
    }

    syslog(level, "%s", str);
    JS_FreeCString(ctx, str);
#endif
    return JS_UNDEFINED;
}

static JSValue tjs_print(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    int i;
    const char* str;
    FILE* file = (magic == 0) ? stdout : stderr;

    for (i = 0; i < argc; i++) {
        if (i != 0) {
            fputc(' ', file);
        }

        str = JS_ToCString(ctx, argv[i]);
        if (!str) {
            return JS_UNDEFINED;
        }

        fputs(str, file);
        JS_FreeCString(ctx, str);
    }

    fputc('\n', file);
    return JS_UNDEFINED;
}

static JSValue tjs_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    int i;
    const char* str;
    FILE* file = (magic == 0) ? stdout : stderr;

    for (i = 0; i < argc; i++) {
        if (i != 0) {
            fputc(' ', file);
        }

        str = JS_ToCString(ctx, argv[i]);
        if (!str) {
            return JS_UNDEFINED;
        }

        fputs(str, file);
        JS_FreeCString(ctx, str);
    }

    fflush(file);

    return JS_UNDEFINED;
}

static JSValue tjs_confirm(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue str;

    const char* message = NULL;
    const char* default_value = NULL;
    char buf[4096];

    if (argc > 0) {
        message = JS_ToCString(ctx, argv[0]);
        if (!message) {
            return JS_UNDEFINED;
        }
    }

    if (argc > 1) {
        default_value = JS_ToCString(ctx, argv[1]);
    }

    if (message) {
        fputs(message, stdout);
    }

    if (fgets(buf, sizeof(buf), stdin) != NULL) {
        size_t len = strcspn(buf, "\r\n"); /* skip newline */
        if (len == 0) {
            goto use_default;
        }
        str = JS_NewStringLen(ctx, buf, len);
        
    } else {
    use_default:
        if (default_value != NULL) {
            str = JS_NewString(ctx, default_value);
        } else {
            str = JS_UNDEFINED;
        }
    }

    if (message) {
        JS_FreeCString(ctx, message);
    }

    if (default_value) {
        JS_FreeCString(ctx, default_value);
    }

    return str;
}

static JSValue tjs_prompt(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue str;

    const char* message = NULL;
    const char* default_value = NULL;
    char buf[4096];

    if (argc > 0) {
        message = JS_ToCString(ctx, argv[0]);
        if (!message) {
            return JS_UNDEFINED;
        }
    }

    if (argc > 1) {
        default_value = JS_ToCString(ctx, argv[1]);
    }

    if (message) {
        fputs(message, stdout);
    }

    if (fgets(buf, sizeof(buf), stdin) != NULL) {
        size_t len = strcspn(buf, "\r\n"); /* skip newline */
        if (len == 0) {
            goto use_default;
        }
        str = JS_NewStringLen(ctx, buf, len);
        
    } else {
    use_default:
        if (default_value != NULL) {
            str = JS_NewString(ctx, default_value);
        } else {
            str = JS_UNDEFINED;
        }
    }

    if (message) {
        JS_FreeCString(ctx, message);
    }

    if (default_value) {
        JS_FreeCString(ctx, default_value);
    }

    return str;
}

static JSValue tjs_random(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    size_t size;
    uint8_t* buf = JS_GetArrayBuffer(ctx, &size, argv[0]);
    if (!buf) {
        return JS_UNDEFINED;
    }

    uint64_t off = 0;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1]) && JS_ToIndex(ctx, &off, argv[1])) {
            return JS_UNDEFINED;
        }
    }

    uint64_t len = size;
    if (!JS_IsUndefined(argv[2]) && JS_ToIndex(ctx, &len, argv[2])) {
        return JS_UNDEFINED;
    }

    if (off + len > size) {
        return JS_ThrowRangeError(ctx, "array buffer overflow");
    }

    int r = uv_random(NULL, NULL, buf + off, len, 0, NULL);
    if (r != 0) {
        return tjs_throw_uv_error(ctx, r);
    }

    return JS_UNDEFINED;
}

static const JSCFunctionListEntry tjs_misc_funcs[] = {
    TJS_CONST(AF_INET),
    TJS_CONST(AF_INET6),
    TJS_CONST(AF_UNSPEC),
    TJS_CONST(STDIN_FILENO),
    TJS_CONST(STDOUT_FILENO),
    TJS_CONST(STDERR_FILENO),
    TJS_CFUNC_DEF("confirm", 2, tjs_confirm),
    TJS_CFUNC_DEF("cwd", 0, tjs_cwd),
    TJS_CFUNC_DEF("environ", 0, tjs_environ),
    TJS_CFUNC_DEF("exepath", 0, tjs_exepath),
    TJS_CFUNC_DEF("exit", 1, tjs_exit),
    TJS_CFUNC_DEF("exitCode", 1, tjs_exit_code),
    TJS_CFUNC_DEF("getenv", 0, tjs_getenv),
    TJS_CFUNC_DEF("gettimeofday", 0, tjs_gettimeofday),
    TJS_CFUNC_DEF("homedir", 0, tjs_homedir),
    TJS_CFUNC_DEF("hrtime", 0, tjs_hrtime),
    TJS_CFUNC_DEF("isatty", 1, tjs_isatty),
    TJS_CFUNC_DEF("openlog", 2, tjs_openlog),
    TJS_CFUNC_DEF("prompt", 2, tjs_prompt),
    TJS_CFUNC_DEF("random", 3, tjs_random),
    TJS_CFUNC_DEF("scriptPath", 0, tjs_script_path),
    TJS_CFUNC_DEF("setenv", 2, tjs_setenv),
    TJS_CFUNC_DEF("syslog", 2, tjs_syslog),
    TJS_CFUNC_DEF("tmpdir", 0, tjs_tmpdir),
    TJS_CFUNC_DEF("uname", 0, tjs_uname),
    TJS_CFUNC_DEF("unsetenv", 1, tjs_unsetenv),
    TJS_CFUNC_MAGIC_DEF("alert", 1, tjs_print, 1),
    TJS_CFUNC_MAGIC_DEF("print", 1, tjs_print, 0),
    TJS_CFUNC_MAGIC_DEF("write", 1, tjs_write, 0)
};

void tjs_mod_misc_init(JSContext* ctx, JSModuleDef* m)
{
    char buffer[100];

    JS_SetModuleExportList(ctx, m, tjs_misc_funcs, countof(tjs_misc_funcs));

    JS_SetModuleExport(ctx, m, "command", tjs__get_command_name(ctx));
    JS_SetModuleExport(ctx, m, "arch", JS_NewString(ctx, TJS_ARCH));
    JS_SetModuleExport(ctx, m, "arg0", tjs__get_arg0(ctx));
    JS_SetModuleExport(ctx, m, "args", tjs__get_args(ctx));
    JS_SetModuleExport(ctx, m, "board", JS_NewString(ctx, tjs_board()));
    JS_SetModuleExport(ctx, m, "platform", JS_NewString(ctx, TJS_PLATFORM));
    JS_SetModuleExport(ctx, m, "root", JS_NewString(ctx, TJS_ROOT));
    JS_SetModuleExport(ctx, m, "version", JS_NewString(ctx, tjs_version()));

    JSValue versions = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, versions, "quickjs", JS_NewString(ctx, QJS_VERSION_STR), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "tjs", JS_NewString(ctx, tjs_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "build", JS_NewString(ctx, tjs_build()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "code", JS_NewInt32(ctx, tjs_code()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "core", JS_NewString(ctx, tjs_core_version()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "core_build", JS_NewString(ctx, tjs_core_build()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "core_code", JS_NewInt32(ctx, tjs_core_code()), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, versions, "uv", JS_NewString(ctx, uv_version_string()), JS_PROP_C_W_E);

#ifdef CONFIG_MBEDTLS
    mbedtls_version_get_string(buffer);
    JS_DefinePropertyValueStr(ctx, versions, "mbedtls", JS_NewString(ctx, buffer), JS_PROP_C_W_E);
#endif

    uint32_t versionCode = http_parser_version();
    sprintf(buffer, "%d.%d.%d", (versionCode >> 16) & 255, (versionCode >> 8) & 255, versionCode & 255);
    JS_DefinePropertyValueStr(ctx, versions, "http_parser", JS_NewString(ctx, buffer), JS_PROP_C_W_E);
    JS_SetModuleExport(ctx, m, "versions", versions);
}

void tjs_mod_misc_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExportList(ctx, m, tjs_misc_funcs, countof(tjs_misc_funcs));

    JS_AddModuleExport(ctx, m, "command");
    JS_AddModuleExport(ctx, m, "arch");
    JS_AddModuleExport(ctx, m, "arg0");
    JS_AddModuleExport(ctx, m, "args");
    JS_AddModuleExport(ctx, m, "board");
    JS_AddModuleExport(ctx, m, "platform");
    JS_AddModuleExport(ctx, m, "root");
    JS_AddModuleExport(ctx, m, "version");
    JS_AddModuleExport(ctx, m, "versions");
}
