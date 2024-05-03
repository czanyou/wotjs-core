/*
 * QuickJS + libuv stand alone interpreter
 *
 * Copyright (c) 2019-present Saúl Ibarra Corretgé
 * Copyright (c) 2017-2018 Fabrice Bellard
 * Copyright (c) 2017-2018 Charlie Gordon
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
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include "private.h"
#include "tjs.h"
#include "version.h"

#include "util/getopt.h"
#include "util/path.h"

#define TJS_PROG_NAME "tjs"

#define EXIT_CODE_INVALID_ARG 2

static int tjs_cli_eval_file(JSContext* ctx, const char* filename, int load_as_module);

typedef struct tjs_file_item_s {
    struct list_head link;
    char* path;
} tjs_file_item_t;

typedef struct tjs_cli_flags_s {
    int option_index;
    bool interactive;
    bool empty_run;
    bool daemon;
    int load_as_module;
    struct list_head preload_modules;
    const char* eval_expression;
    const char* eval_command;
} tjs_cli_flags_t;

/**
 * 打印错误信息
 */
static int tjs_cli_print_error(const char* format, ...)
{
    va_list argp;
    va_start(argp, format);
    int ret = fprintf(stderr, "%s: ", TJS_PROG_NAME);
    ret += vfprintf(stderr, format, argp);
    va_end(argp);
    return ret;
}

static void tjs_cli_print_bad_option(int type, option_t* opt)
{
    if (type == 1) {
        if (opt->key) {
            tjs_cli_print_error("-%c requires an argument\n", opt->key);

        } else {
            tjs_cli_print_error("--%s requires an argument\n", opt->name);
        }

    } else if (type == 2) {
        if (opt->key) {
            tjs_cli_print_error("unknown option -%c\n", opt->key);

        } else {
            tjs_cli_print_error("unknown option --%s\n", opt->name);
        }

    } else {
        const char* name = opt->arg - 1;
        tjs_cli_print_error("bad option -%s\n", name);
    }
}

static void tjs_cli_print_help(void)
{
    printf("tjs is a JavaScript runtime for Web of Things\n\n"
           "Usage:\n"
           "  tjs [options] <script.js> [arguments]\n"
           "  tjs [options] <command> <subcommand> [arguments]\n"
           "\n"
           "Options:\n"
           "  -v, --version             print tjs version\n"
           "  -h, --help                list options\n"
           "      --dump                dump the memory usage stats\n"
           "      --unhandled-rejection abort when a rejected promise is not caught\n"
           "      --memory-limit n      limit the memory usage to 'n' bytes\n"
           "      --stack-size n        limit the stack size to 'n' bytes\n"
           "\n"
           "More help info: tjs help\n"
           "\n");
}

static void tjs_cli_print_version()
{
    printf("WoT.js v%s (git: %s) build: %s\n", tjs_version(), GIT_VERSION, tjs_core_build());
}

/**
 * @brief 解析命令行参数
 *
 * @param argc
 * @param argv
 * @param options
 * @param tjs_runtime_options
 * @return int
 */
static int tjs_cli_parse_options(int argc, char** argv, tjs_cli_flags_t* options, TJSRuntimeOptions* tjs_runtime_options)
{
    option_t option = { 0 };
    option_init(&option, argc, argv);

    while (true) {
        if (!option_get(&option)) {
            break;
        }

        option.index += 1;

        /* combining short options is NOT supported */
        if (option.key && option.length > 0) {
            tjs_cli_print_bad_option(0, &option);
            tjs_runtime_options->exit_code = EXIT_CODE_INVALID_ARG;
            goto exit;
        }

        while (option.key || *option.name) {
            if (option_is(&option, 'v', "version")) {
                tjs_cli_print_version();
                goto exit;

            } else if (option_is(&option, 'h', "help")) {
                tjs_cli_print_help();
                goto exit;

            } else if (option_is(&option, 'd', "daemon")) {
                options->daemon = true;
                break;

            } else if (option_is(&option, 'e', "eval")) {
                options->eval_expression = option_get_value(&option);
                if (!options->eval_expression) {
                    tjs_cli_print_bad_option(1, &option);
                    tjs_runtime_options->exit_code = EXIT_CODE_INVALID_ARG;
                    goto exit;
                }

                break;

            } else if (option_is(&option, 'I', "include")) {
                char* filepath = option_get_value(&option);
                if (!filepath) {
                    tjs_cli_print_bad_option(1, &option);
                    tjs_runtime_options->exit_code = EXIT_CODE_INVALID_ARG;
                    goto exit;
                }

                tjs_file_item_t* file = malloc(sizeof(*file));
                if (!file) {
                    tjs_cli_print_error("could not allocate memory\n");
                    tjs_runtime_options->exit_code = EXIT_FAILURE;
                    goto exit;
                }

                file->path = filepath;
                list_add_tail(&file->link, &options->preload_modules);
                break;

            } else if (option_is(&option, 'i', "interactive")) {
                options->interactive = true;
                options->daemon = false;
                break;

            } else if (option_is(&option, 'q', "quit")) {
                options->empty_run = true;
                break;

            } else if (option_is(&option, 'm', "module")) {
                options->load_as_module = 1;
                break;

            } else if (option_is(&option, 0, "script")) {
                options->load_as_module = 0;
                break;

            } else if (option_is(&option, 0, "stack-size")) {
                char* value = option_get_value(&option);
                if (!value) {
                    tjs_cli_print_bad_option(1, &option);
                    tjs_runtime_options->exit_code = EXIT_CODE_INVALID_ARG;
                    goto exit;
                }

                long n = strtol(value, NULL, 10);
                if (n > 0) {
                    tjs_runtime_options->stack_size = (size_t)n;
                    break;
                }

            } else if (option_is(&option, 0, "memory-limit")) {
                char* value = option_get_value(&option);
                if (!value) {
                    tjs_cli_print_bad_option(1, &option);
                    tjs_runtime_options->exit_code = EXIT_CODE_INVALID_ARG;
                    goto exit;
                }

                long n = strtol(value, NULL, 10);
                if (n > 0) {
                    tjs_runtime_options->memory_limit = (size_t)n;
                    break;
                }

            } else if (option_is(&option, 0, "unhandled-rejection")) {
                tjs_runtime_options->unhandled_rejection = true;
                break;

            } else if (option_is(&option, 0, "dump")) {
                tjs_runtime_options->dump_memory = true;
                break;

            } else {
                tjs_cli_print_bad_option(2, &option);
                tjs_runtime_options->exit_code = EXIT_CODE_INVALID_ARG;
                goto exit;
            }
        }
    }

    if (option.index >= argc) {
        /* interactive mode */
        options->interactive = true;
        options->daemon = false;
    }

    return option.index;

exit:
    options->empty_run = true;
    return option.index;
}

/**
 * @brief 返回指定名称的插件的入口脚本的路径和文件名
 * - $path/app/${name}/app.js
 * - $path/app/bin/${name}.js
 *
 * @param filename 用于保存文件名的缓存区
 * @param size 文件缓存区大小
 * @param name 插件的名称
 * @return 如果成功则返回 0
 */
static char* tjs_cli_get_exepath_command_filename(char* buffer, size_t buffer_size, const char* name)
{
    if (name == NULL) {
        return NULL;
    }

    // /path/to/exepath/app/name/app.js
    size_t size = buffer_size;
    uv_exepath(buffer, &size);

    // 1. /exepath
    while (true) {
        char* p = strrchr(buffer, TJS__PATHSEP);
        if (p == NULL || p == buffer) {
            break;
        }

        // $path/app/:name/app.js
        *p = '\0';
        path_join(buffer, "app", buffer_size);
        path_join(buffer, name, buffer_size);
        path_join(buffer, "app.js", buffer_size);
        // printf("filename=%s\r\n", buffer);
        if (access(buffer, R_OK) == 0) {
            return buffer;
        }

        // $path/app/bin/:name.js
        *p = '\0';
        path_join(buffer, "app", buffer_size);
        path_join(buffer, "bin", buffer_size);
        path_join(buffer, name, buffer_size);
        strncat(buffer, ".js", buffer_size);
        // printf("filename=%s\r\n", buffer);
        if (access(buffer, R_OK) == 0) {
            return buffer;
        }

        *p = '\0';
    }

    return NULL;
}

/**
 * @brief 返回指定名称的插件的入口脚本的路径和文件名
 * - ${root}/app/${name}/app.js
 * - ${root}/app/bin/${name}.js
 *
 * @param filename 用于保存文件名的缓存区
 * @param size 文件缓存区大小
 * @param name 插件的名称
 * @return 如果成功则返回 0
 */
static char* tjs_cli_get_root_command_filename(char* buffer, size_t buffer_size, const char* name)
{
    if (name == NULL) {
        return NULL;
    }

    // 1. ${root}/app/${name}/app.js
    strncpy(buffer, TJS_ROOT, buffer_size);
    path_join(buffer, "app", buffer_size);
    path_join(buffer, name, buffer_size);
    path_join(buffer, "app.js", buffer_size);
    // printf("file: %s\r\n", buffer);
    if (access(buffer, R_OK) == 0) {
        return buffer;
    }

    // 2. ${root}/app/bin/${name}.js
    strncpy(buffer, TJS_ROOT, buffer_size);
    path_join(buffer, "app", buffer_size);
    path_join(buffer, "bin", buffer_size);
    path_join(buffer, name, buffer_size);
    strncat(buffer, ".js", buffer_size);
    // printf("filename=%s\r\n", buffer);
    if (access(buffer, R_OK) == 0) {
        return buffer;
    }

    return NULL;
}

/**
 * @brief 检查指定名称的文件是否是一个脚本文件
 *
 * @param filename
 * @return true 表示是一个脚本文件
 */
static int tjs_cli_has_script_file(const char* filename)
{
    if (access(filename, R_OK) != 0) {
        return false;

    } else if (has_suffix(filename, ".js")) {
        return true;

    } else if (has_suffix(filename, ".mjs")) {
        return true;
    }

    return false;
}

/**
 * @brief 执行指定名称的命令
 * @param ctx 上下文
 * @param name 命令名称
 * @return 如果成功则返回 0
 */
static int tjs_cli_eval_command(JSContext* ctx, const char* name)
{
    size_t size = PATH_MAX;
    char filename[PATH_MAX];

    // 1. `tjs $exepath/app/:name/app.js`
    const char* script_name = tjs_cli_get_exepath_command_filename(filename, size, name);
    if (script_name) {
        TJS_SetScriptFilename(filename);
        return tjs_cli_eval_file(ctx, filename, 1);
    }

    // 2. `tjs $root/app/:name/app.js`
    script_name = tjs_cli_get_root_command_filename(filename, size, name);
    if (script_name) {
        TJS_SetScriptFilename(filename);
        return tjs_cli_eval_file(ctx, filename, 1);
    }

#ifdef BUILD_APP_JS
    // 3. `@app/:name/app.js`
    script_name = tjs_module_get_command_filename(filename, size, name);
    // printf("eval_module: (%s)%s\r\n", script_name, filename);
    if (script_name) {
        TJS_SetScriptFilename(filename);
        return tjs_module_eval_file(ctx, filename);
    }

#endif

    return -1;
}

/**
 * @brief 执行指定的脚本文件
 * @param ctx 上下文
 * @param filename 要执行的文件或应用的名称
 * @param load_as_module
 * @return 如果成功则返回 0
 */
static int tjs_cli_eval_file(JSContext* ctx, const char* filename, int load_as_module)
{
    // eval file
    int eval_flags = -1;
    if (load_as_module >= 0) {
        eval_flags = load_as_module ? JS_EVAL_TYPE_MODULE : JS_EVAL_TYPE_GLOBAL;

    } else if (has_suffix(filename, ".mjs")) {
        eval_flags = JS_EVAL_TYPE_MODULE;
    }

    TJS_SetScriptFilename(filename);

    JSValue result = TJS_EvalFile(ctx, filename, eval_flags, true, NULL);
    if (JS_IsException(result)) {
        TJS_DumpError(ctx);
        return -1;
    }

    JS_FreeValue(ctx, result);
    return 0;
}

/**
 * @brief 执行指定的字符串脚本
 *
 * @param ctx 上下文
 * @param expression JavaScript 脚本字符串
 * @param filename 文件名（仅供显示）
 * @return 如果成功则返回 0
 */
static int tjs_cli_eval_string(JSContext* ctx, const char* expression, const char* filename)
{
    TJS_SetScriptFilename(filename);

    int ret = 0;
    int eval_flags = JS_EVAL_TYPE_GLOBAL;
    JSValue value = JS_Eval(ctx, expression, strlen(expression), filename, eval_flags);
    if (JS_IsException(value)) {
        TJS_DumpError(ctx);
        ret = -1;
    }

    JS_FreeValue(ctx, value);

    return ret;
}

/**
 * @brief 执行指定的脚本文件
 * tjs <name> [args]:
 * - 1. script: ./:name.js
 * - 2. exec command: $exepath/app/:name/app.js
 * - 3. internal command: @app/:name/app.js
 * - 4. root command: $root/app/:name/app.js
 * - 5. applet command: @app/bin/:name.js
 * @param ctx 上下文
 * @param filename 要执行的文件或应用的名称
 * @param load_as_module
 * @return 如果成功则返回 0
 */
static int tjs_cli_eval(JSContext* ctx, const char* filename, int load_as_module)
{
    size_t size = PATH_MAX;
    char buffer[PATH_MAX];

    // 1. `tjs filename.js` - 是否存在指定的脚本文件
    if (tjs_cli_has_script_file(filename)) {
        return tjs_cli_eval_file(ctx, filename, load_as_module);
    }

    // 2. `tjs $exepath/app/:name/app.js`
    // 检查 ${exepath}/app/:name/app.js 是否存在
    const char* script_name = NULL;
    script_name = tjs_cli_get_exepath_command_filename(buffer, size, filename);
    if (script_name) {
        return tjs_cli_eval_file(ctx, script_name, load_as_module);
    }

#ifdef BUILD_APP_JS
    // 3. `tjs @app/:name/app.js`
    script_name = tjs_module_get_command_filename(buffer, size, filename);
    if (script_name) {
        // 执行内置在主程序中的命令： @app/${app_name}/app.js
        return tjs_cli_eval_command(ctx, filename);
    }
#endif

    // 4. `tjs $root/app/:name/app.js`
    script_name = tjs_cli_get_root_command_filename(buffer, size, filename);
    if (script_name) {
        return tjs_cli_eval_file(ctx, script_name, load_as_module);
    }

    printf("Cannot find module: '%s'\r\n\r\n", filename);
    return 0;
}

/**
 * 指出是否存在指定名称的命令
 * - `@app/:name/app.js`
 * - `@app/bin/:name.js`
 * - `${root}/app/${name}/app.js`
 * @param name 应用的名称
 */
int tjs_cli_has_command(const char* name)
{
    size_t size = PATH_MAX;
    char buffer[PATH_MAX];

    // `@app/:name/app.js`
    const char* script_name = tjs_module_get_command_filename(buffer, size, name);
    if (script_name) {
        return 1;
    }

    // `${root}/app/${name}/app.js`
    script_name = tjs_cli_get_root_command_filename(buffer, size, name);
    if (script_name) {
        return 1;
    }

    return 0;
}

/** Let current program runs into the background. */
static int tjs_cli_run_as_daemon()
{
#ifndef _WIN32
    // fork off the parent process & let it terminate if forking was successful.
    // -> Because the parent process has terminated, the child process now runs in the background.
    if (fork() != 0) {
        exit(EXIT_SUCCESS);
    }

    // Create a new session. The calling process becomes the leader of the new
    // session and the process group leader of the new process group.
    // The process is now detached from its controlling terminal
    if (setsid() < 0) {
        exit(EXIT_FAILURE);
    }

    signal(SIGCHLD, SIG_IGN);
    signal(SIGHUP, SIG_IGN);

    // fork again & let the parent process terminate to ensure that you get rid
    // of the session leading process. (Only session leaders may get a TTY again.)
    if (fork() != 0) {
        exit(EXIT_FAILURE);
    }

    // Change the file mode mask according to the needs of the daemon.
    umask(022);

#endif
    return 0;
}

static void tjs_cli_init_signal()
{
#if defined(__linux__) || defined(__linux)
    // 屏蔽 SIGPIPE 信号, 发生在写半开的 Socket
    signal(SIGPIPE, SIG_IGN);
#endif
}

static tjs_cli_flags_t tjs_cli_flags = {
    .option_index = 1,
    .empty_run = false,
    .eval_command = NULL,
    .eval_expression = NULL,
    .interactive = false,
    .preload_modules = LIST_HEAD_INIT(tjs_cli_flags.preload_modules),
    .load_as_module = -1
};

static TJSRuntimeOptions tjs_runtime_options = { 0 };

static int tjs_cli_preload_modules(JSContext* ctx, TJSRuntime* runtime)
{
    /* preload modules specified using `-l, --load FILENAME` */
    struct list_head* el = NULL;
    struct list_head* el1 = NULL;
    list_for_each(el, &tjs_cli_flags.preload_modules)
    {
        // preload modules
        tjs_file_item_t* file = list_entry(el, tjs_file_item_t, link);
        const char* filename = file->path;
        if (tjs_cli_eval(ctx, filename, tjs_cli_flags.load_as_module)) {
            runtime->options.exit_code = EXIT_FAILURE;
            return -1;
        }
    }

    return 0;
}

static int tjs_cli_free_modules()
{
    struct list_head* el = NULL;
    struct list_head* el1 = NULL;

    // free modules
    list_for_each_safe(el, el1, &tjs_cli_flags.preload_modules)
    {
        tjs_file_item_t* file = list_entry(el, tjs_file_item_t, link);
        list_del(&file->link);
        free(file);
    }

    return 0;
}

static int tjs_cli_dump_memory()
{
    // dump memory
    if (tjs_cli_flags.empty_run && tjs_runtime_options.dump_memory) {
        clock_t t[5];
        double best[5];
        int i, j;
        for (i = 0; i < 100; i++) {
            t[0] = clock();
            JSRuntime* rt = JS_NewRuntime();
            t[1] = clock();
            JSContext* ctx = JS_NewContext(rt);
            t[2] = clock();
            JS_FreeContext(ctx);
            t[3] = clock();
            JS_FreeRuntime(rt);
            t[4] = clock();
            for (j = 4; j > 0; j--) {
                double ms = 1000.0 * (t[j] - t[j - 1]) / CLOCKS_PER_SEC;
                if (i == 0 || best[j] > ms)
                    best[j] = ms;
            }
        }

        printf("\nInstantiation times (ms): %.3f = %.3f+%.3f+%.3f+%.3f\n",
            best[1] + best[2] + best[3] + best[4],
            best[1], best[2], best[3], best[4]);
    }

    return 0;
}

static int tjs_cli_parse_args(int argc, char** argv)
{
    TJS_DefaultOptions(&tjs_runtime_options);
    TJS_SetArgs(argc, argv);

    /* cannot use getopt because we want to pass the command line to the script */
    tjs_cli_flags.option_index = 1;

    // argv0 & tjs_cli_flags
    const char* argv0 = path_basename(argv[0]);
    // printf("command: %s\r\n", argv0);

    int is_command = tjs_cli_has_command(argv0);
    if (is_command) {
        tjs_cli_flags.eval_command = argv0;
        tjs_cli_flags.option_index--;
        TJS_SetArg0(tjs_cli_flags.option_index, argv0);

    } else {
        tjs_cli_flags.option_index = tjs_cli_parse_options(argc, argv, &tjs_cli_flags, &tjs_runtime_options);
        TJS_SetArg0(tjs_cli_flags.option_index, NULL);
    }

    return 0;
}

int tjs_cli(int argc, char** argv)
{
    tjs_cli_init_signal();
    tjs_cli_parse_args(argc, argv);

    uv_disable_stdio_inheritance();

    // run as daemon
    if (tjs_cli_flags.daemon) {
        tjs_cli_flags.interactive = false;
        tjs_cli_run_as_daemon();
    }

    // create runtime
    TJSRuntime* tjs_runtime = TJS_NewRuntime(&tjs_runtime_options);
    JSContext* js_context = TJS_GetContext(tjs_runtime);

    if (tjs_cli_flags.empty_run) {
        goto exit;

    } else if (tjs_cli_preload_modules(js_context, tjs_runtime) < 0) {
        goto exit;
    }

    int ret = 0;
    if (tjs_cli_flags.eval_expression) {
        // eval expression - 执行命令行提供的表达式
        tjs_cli_flags.interactive = false;
        ret = tjs_cli_eval_string(js_context, tjs_cli_flags.eval_expression, "<expression>");

    } else if (tjs_cli_flags.eval_command) {
        // eval app.js script - 执行内置的 APP 子程序
        tjs_cli_flags.interactive = false;
        const char* filename = tjs_cli_flags.eval_command;
        ret = tjs_cli_eval_command(js_context, filename);

    } else if (tjs_cli_flags.option_index < argc) {
        // tjs script.js
        // eval script.js - 执行指定的脚本文件
        const char* filename = argv[tjs_cli_flags.option_index];
        ret = tjs_cli_eval(js_context, filename, tjs_cli_flags.load_as_module);

    } else {
        /* eval interactive mode */
        tjs_cli_flags.interactive = true;
    }

    if (ret != 0) {
        tjs_runtime->options.exit_code = EXIT_FAILURE;
        goto exit;
    }

    if (tjs_cli_flags.interactive) {
        if (tjs_cli_has_command("help")) {
            ret = tjs_cli_eval(js_context, "help", 1);

        } else {
            tjs_cli_print_help();
        }
    }

    TJS_Run(tjs_runtime);

    tjs_cli_eval_string(js_context, "process?.onExit();", "<exit>");

    // dump memory
    if (tjs_runtime->options.dump_memory) {
        JSMemoryUsage stats;
        JS_ComputeMemoryUsage(tjs_runtime->rt, &stats);
        JS_DumpMemoryUsage(stdout, &stats, tjs_runtime->rt);
    }

exit:
    tjs_cli_free_modules();

    // free runtime
    int exit_code = 0;
    if (tjs_runtime) {
        exit_code = tjs_runtime->options.exit_code;
        TJS_FreeRuntime(tjs_runtime);
    }

    tjs_cli_dump_memory();

    return exit_code;
}
