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
#if defined(__APPLE__)
#include <malloc/malloc.h>
#elif defined(__linux__)
#include <malloc.h>
#endif

#include "private.h"
#include "tjs.h"
#include "version.h"

#if defined(__APPLE__)
#define MALLOC_OVERHEAD 0
#else
#define MALLOC_OVERHEAD 8
#endif

struct trace_malloc_data {
    uint8_t* base;
};

static inline unsigned long long js_trace_malloc_ptr_offset(uint8_t* ptr,
    struct trace_malloc_data* dp)
{
    return ptr - dp->base;
}

/* default memory allocation functions with memory limitation */
static inline size_t js_trace_malloc_usable_size(void* ptr)
{
#if defined(__APPLE__)
    return malloc_size(ptr);
#elif defined(_WIN32)
    return _msize(ptr);
#elif defined(EMSCRIPTEN)
    return 0;
#elif defined(__linux__)
    return malloc_usable_size(ptr);
#else
    /* change this to `return 0;` if compilation fails */
    return malloc_usable_size(ptr);
#endif
}

static void
#ifdef _WIN32
    /* mingw printf is used */
    __attribute__((format(gnu_printf, 2, 3)))
#else
    __attribute__((format(printf, 2, 3)))
#endif
    js_trace_malloc_printf(JSMallocState* s, const char* fmt, ...)
{
    va_list ap;
    int c;

    va_start(ap, fmt);
    while ((c = *fmt++) != '\0') {
        if (c == '%') {
            /* only handle %p and %zd */
            if (*fmt == 'p') {
                uint8_t* ptr = va_arg(ap, void*);
                if (ptr == NULL) {
                    printf("NULL");
                } else {
                    printf("H%+06lld.%zd",
                        js_trace_malloc_ptr_offset(ptr, s->opaque),
                        js_trace_malloc_usable_size(ptr));
                }
                fmt++;
                continue;
            }
            if (fmt[0] == 'z' && fmt[1] == 'd') {
                size_t sz = va_arg(ap, size_t);
                printf("%zd", sz);
                fmt += 2;
                continue;
            }
        }
        putc(c, stdout);
    }
    va_end(ap);
}

static void js_trace_malloc_init(struct trace_malloc_data* s)
{
    free(s->base = malloc(8));
}

static void* js_trace_malloc(JSMallocState* s, size_t size)
{
    void* ptr;

    /* Do not allocate zero bytes: behavior is platform dependent */
    assert(size != 0);

    if (unlikely(s->malloc_size + size > s->malloc_limit))
        return NULL;
    ptr = malloc(size);
    js_trace_malloc_printf(s, "A %zd -> %p\n", size, ptr);
    if (ptr) {
        s->malloc_count++;
        s->malloc_size += js_trace_malloc_usable_size(ptr) + MALLOC_OVERHEAD;
    }
    return ptr;
}

static void js_trace_free(JSMallocState* s, void* ptr)
{
    if (!ptr)
        return;

    js_trace_malloc_printf(s, "F %p\n", ptr);
    s->malloc_count--;
    s->malloc_size -= js_trace_malloc_usable_size(ptr) + MALLOC_OVERHEAD;
    free(ptr);
}

static void* js_trace_realloc(JSMallocState* s, void* ptr, size_t size)
{
    size_t old_size;

    if (!ptr) {
        if (size == 0)
            return NULL;
        return js_trace_malloc(s, size);
    }
    old_size = js_trace_malloc_usable_size(ptr);
    if (size == 0) {
        js_trace_malloc_printf(s, "R %zd %p\n", size, ptr);
        s->malloc_count--;
        s->malloc_size -= old_size + MALLOC_OVERHEAD;
        free(ptr);
        return NULL;
    }
    if (s->malloc_size + size - old_size > s->malloc_limit)
        return NULL;

    js_trace_malloc_printf(s, "R %zd %p", size, ptr);

    ptr = realloc(ptr, size);
    js_trace_malloc_printf(s, " -> %p\n", ptr);
    if (ptr) {
        s->malloc_size += js_trace_malloc_usable_size(ptr) - old_size;
    }
    return ptr;
}

static const JSMallocFunctions trace_mf = {
    js_trace_malloc,
    js_trace_free,
    js_trace_realloc,
#if defined(__APPLE__)
    malloc_size,
#elif defined(_WIN32)
    (size_t(*)(const void*))_msize,
#elif defined(EMSCRIPTEN)
    NULL,
#elif defined(__linux__)
    (size_t(*)(const void*))malloc_usable_size,
#else
    /* change this to `NULL,` if compilation fails */
    malloc_usable_size,
#endif
};

#define TJS_PROG_NAME "tjs"

#define EXIT_INVALID_ARG 2

#define OPT_PREFIX '-'
#define OPT_ASSIGN '='

#define is_longopt(opt, str) (opt.name && !strncmp(opt.name, str, opt.length))
int tjs__eval_module(JSContext* ctx, const char* name);

typedef struct TJSOption {
    char key;
    char* name;
    size_t length;
} TJSOption;

typedef struct FileItem {
    struct list_head link;
    char* path;
} FileItem;

typedef struct TJSFlags {
    bool interactive;
    bool empty_run;
    bool daemon;
    bool module_detection;
    struct list_head preload_modules;
    const char* eval_expression;
    const char* eval_appjs;
    const char* override_filename;
} TJSFlags;

static int tjs_print_error(const char* format, ...)
{
    va_list argp;
    va_start(argp, format);
    int ret = fprintf(stderr, "%s: ", TJS_PROG_NAME);
    ret += vfprintf(stderr, format, argp);
    va_end(argp);
    return ret;
}

static void tjs_print_bad_option(char* name)
{
    tjs_print_error("bad option -%s\n", name);
}

static void tjs_print_missing_argument(TJSOption* opt)
{
    if (opt->key) {
        tjs_print_error("-%c requires an argument\n", opt->key);

    } else {
        tjs_print_error("--%s requires an argument\n", opt->name);
    }
}

static void tjs_print_unknown_option(TJSOption* opt)
{
    if (opt->key) {
        tjs_print_error("unknown option -%c\n", opt->key);

    } else {
        tjs_print_error("unknown option --%s\n", opt->name);
    }
}

static void tjs_print_help(void)
{
    printf("tjs is a JavaScript runtime for Web of Things\n\n"
           "Usage:\n"
           "  tjs [options] [script.js [arguments]]\n"
           "  tjs [options] <command> [arguments]\n"
           "\n"
           "Options:\n"
           "  -v  --version             print tjs version\n"
           "  -h  --help                list options\n"
           "  -e  --eval EXPR           evaluate EXPR\n"
           "  -i  --interactive         go to interactive mode\n"
           "  -l  --load FILENAME       module to preload (option can be repeated)\n"
           "  -m  --module              load as ES6 module (default=autodetect)\n"
           "  --script                  load as ES6 script (default=autodetect)\n"
           "  --unhandled-rejection     abort when a rejected promise is not caught\n"
           "  --override FILENAME       override filename in error messages\n"
           "  --memory-limit n          limit the memory usage to 'n' bytes\n"
           "  --stack-size n            limit the stack size to 'n' bytes\n"
           "\n");
}

static void tjs_print_version()
{
    printf("v%s-%s\n", tjs_version(), tjs_build());
}

static int tjs_get_eval_flags(const char* filepath, bool module_detection)
{
    int is_mjs = has_suffix(filepath, ".mjs");

    if (module_detection) {
        return is_mjs ? JS_EVAL_TYPE_MODULE : JS_EVAL_TYPE_GLOBAL;
    }

    if (is_mjs) {
        return JS_EVAL_TYPE_MODULE;
    }

    return -1 /* autodetect */;
}

static size_t tjs_get_option_length(const char* arg)
{
    const char* val_start = strchr(arg, OPT_ASSIGN);
    if (!val_start) {
        val_start = arg + strlen(arg);
    }

    return val_start - arg - 1;
}

static char* tjs_get_option_value(char* arg, int argc, char** argv, int* optind)
{
    if (*arg) {
        return arg;
    }

    if (*optind >= argc) {
        return NULL;
    }

    char* value = argv[*optind];
    if (*value == OPT_PREFIX) {
        return NULL;
    }

    *optind += 1;
    return value;
}

static bool tjs_get_option(char** arg, TJSOption* opt)
{
    /* a single `-` is not an option, it also stops argument scanning */
    if (!**arg) {
        return false;
    }

    opt->length = tjs_get_option_length(*arg);
    if (**arg == OPT_PREFIX) {
        opt->name = *arg + 1;
        /* `--` stops argument scanning */
        if (!*opt->name) {
            return false;
        }

        *arg += opt->length + 1;

    } else if (**arg) {
        opt->key = **arg;
        *arg += 1;
    }

    if (**arg == OPT_ASSIGN) {
        *arg += 1;
    }

    return true;
}

static int tjs_get_options(int argc, char** argv, TJSFlags* options, TJSRuntimeOptions* runtimeOptions)
{
    int optionIndex = 1;
    while (optionIndex < argc && *argv[optionIndex] == OPT_PREFIX) {
        char* arg = argv[optionIndex] + 1;
        TJSOption option = { .key = 0, .name = NULL, .length = 0 };
        if (!tjs_get_option(&arg, &option)) {
            break;
        }

        optionIndex += 1;

        /* combining short options is NOT supported */
        if (option.key && option.length > 0) {
            tjs_print_bad_option(arg - 1);
            runtimeOptions->exit_code = EXIT_INVALID_ARG;
            goto exit;
        }

        while (option.key || *option.name) {
            if (option.key == 'v' || is_longopt(option, "version")) {
                tjs_print_version();
                goto exit;

            } else if (option.key == 'h' || is_longopt(option, "help")) {
                tjs_print_help();
                goto exit;

            } else if (option.key == 'd' || is_longopt(option, "daemon")) {
                options->daemon = true;
                break;

            } else if (option.key == 'e' || is_longopt(option, "eval")) {
                options->eval_expression = tjs_get_option_value(arg, argc, argv, &optionIndex);
                if (!options->eval_expression) {
                    tjs_print_missing_argument(&option);
                    runtimeOptions->exit_code = EXIT_INVALID_ARG;
                    goto exit;
                }

                break;

            } else if (option.key == 'l' || is_longopt(option, "load")) {
                char* filepath = tjs_get_option_value(arg, argc, argv, &optionIndex);
                if (!filepath) {
                    tjs_print_missing_argument(&option);
                    runtimeOptions->exit_code = EXIT_INVALID_ARG;
                    goto exit;
                }

                FileItem* file = malloc(sizeof(*file));
                if (!file) {
                    tjs_print_error("could not allocate memory\n");
                    runtimeOptions->exit_code = EXIT_FAILURE;
                    goto exit;
                }

                file->path = filepath;
                list_add_tail(&file->link, &options->preload_modules);
                break;

            } else if (option.key == 'i' || is_longopt(option, "interactive")) {
                options->interactive = true;
                options->daemon = false;
                break;

            } else if (option.key == 'q' || is_longopt(option, "quit")) {
                options->empty_run = true;
                break;

            } else if (is_longopt(option, "override-filename")) {
                options->override_filename = tjs_get_option_value(arg, argc, argv, &optionIndex);
                if (!options->override_filename) {
                    tjs_print_missing_argument(&option);
                    runtimeOptions->exit_code = EXIT_INVALID_ARG;
                    goto exit;
                }

                break;

            } else if (is_longopt(option, "stack-size")) {
                char* value = tjs_get_option_value(arg, argc, argv, &optionIndex);
                if (!value) {
                    tjs_print_missing_argument(&option);
                    runtimeOptions->exit_code = EXIT_INVALID_ARG;
                    goto exit;
                }

                long n = strtol(value, NULL, 10);
                if (n > 0) {
                    runtimeOptions->stack_size = (size_t)n;
                    break;
                }

            } else if (is_longopt(option, "memory-limit")) {
                char* value = tjs_get_option_value(arg, argc, argv, &optionIndex);
                if (!value) {
                    tjs_print_missing_argument(&option);
                    runtimeOptions->exit_code = EXIT_INVALID_ARG;
                    goto exit;
                }

                long n = strtol(value, NULL, 10);
                if (n > 0) {
                    runtimeOptions->memory_limit = (size_t)n;
                    break;
                }

            } else if (option.key == 'm' || is_longopt(option, "module")) {
                options->module_detection = true;
                break;

            } else if (is_longopt(option, "unhandled-rejection")) {
                runtimeOptions->unhandled_rejection = true;
                break;

            } else if (is_longopt(option, "dump")) {
                runtimeOptions->dump_memory = true;
                break;

            } else {
                tjs_print_unknown_option(&option);
                runtimeOptions->exit_code = EXIT_INVALID_ARG;
                goto exit;
            }
        }
    }

    if (optionIndex >= argc) {
        /* interactive mode */
        options->interactive = true;
        options->daemon = false;
    }

    return optionIndex;

exit:
    options->empty_run = true;
    return optionIndex;
}

static int tjs_eval_expression(JSContext* ctx, const char* buf, const char* filename, int eval_flags)
{
    JSValue val;
    int ret = 0;

    val = JS_Eval(ctx, buf, strlen(buf), filename, eval_flags);
    if (JS_IsException(val)) {
        tjs_dump_error(ctx);
        ret = -1;
    }

    JS_FreeValue(ctx, val);
    return ret;
}

static int tjs_eval_module(JSContext* ctx, const char* filepath, const char* override_filename, int eval_flags)
{
    JSValue val;
    int ret = 0;

    size_t size = 500;
    char filename[500];
    int isScript = false;

    if (has_suffix(filepath, ".js")) {
        isScript = true;

    } else if (has_suffix(filepath, ".mjs")) {
        isScript = true;
    }

    if (!isScript) {
        const char* appname = filepath;
        uv_exepath(filename, &size);

        char* p = strrchr(filename, '/');
        if (!p) {
            p = filename + size;
        }

        *p++ = '/';
        *p++ = 'a';
        *p++ = 'p';
        *p++ = 'p';
        *p++ = '/';
        strncpy(p, appname, 500 - size);

        int len = strlen(filename);
        strcpy(filename + len, "/app.js");

        if (access(filename, R_OK) == 0) {
            filepath = filename;

        } else {
#ifdef CONFIG_TJS_APPJS
            const char* appname = filepath;
            // printf("eval_module: %s\r\n", filepath);
            strncpy(filename, "@app/", 10);
            strncpy(filename + 5, appname, 500 - 5);
            int len = strlen(filename);
            strcpy(filename + len, "/app.js");

            // printf("eval_module: %s\r\n", filename);
            return tjs__eval_module(ctx, filename);
#endif
        }
    }

    val = TJS_EvalFile(ctx, filepath, eval_flags, true, override_filename);
    if (JS_IsException(val)) {
        tjs_dump_error(ctx);
        ret = -1;
    }

    JS_FreeValue(ctx, val);
    return ret;
}

/** Let current program runs into the background. */
static int tjs_run_as_daemon()
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

static const char* tjs_get_basename(const char* argv0)
{
    const char* p = argv0 + strlen(argv0);
    while (p > argv0) {
        p--;
        if (*p == '/' || *p == '\\') {
            argv0 = p + 1;
            break;
        }
    }

    return argv0;
}

static void tjs_signal_handler(int sig)
{
    // do nothing
}

static void tjs_signal_init()
{
#if defined(__linux__) || defined(__linux)
    // 屏蔽 SIGPIPE 信号, 发生在写半开的 Socket
    struct sigaction sa;
    sa.sa_handler = tjs_signal_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGPIPE, &sa, NULL);
#endif
}

int main(int argc, char** argv)
{
    TJSRuntime* jsRuntime = NULL;
    JSContext* jsContext = NULL;
    TJSRuntimeOptions runtimeOptions;
    TJSFlags flags = {
        .empty_run = false,
        .eval_appjs = NULL,
        .eval_expression = NULL,
        .interactive = false,
        .override_filename = NULL,
        .preload_modules = LIST_HEAD_INIT(flags.preload_modules),
        .module_detection = false
    };

    tjs_signal_init();

    TJS_DefaultOptions(&runtimeOptions);
    TJS_SetupArgs(argc, argv);

    uv_disable_stdio_inheritance();

    /* cannot use getopt because we want to pass the command line to the script */
    int optionIndex = 1;

    // argv0
    const char* argv0 = tjs_get_basename(argv[0]);
    if (strncmp(argv0, TJS_PROG_NAME, strlen(TJS_PROG_NAME)) != 0) {
        // argv0 != "tjs"
        flags.eval_appjs = argv0;
        optionIndex--;
        TJS_SetupArg0(optionIndex, argv0);

    } else {
        // argv0 == "tjs"
        optionIndex = tjs_get_options(argc, argv, &flags, &runtimeOptions);
        TJS_SetupArg0(optionIndex, NULL);
    }

    // daemon
    if (flags.daemon) {
        tjs_run_as_daemon();
    }

    jsRuntime = TJS_NewRuntimeOptions(&runtimeOptions);
    jsContext = TJS_GetJSContext(jsRuntime);

    if (flags.empty_run) {
        goto exit;
    }

    /* preload modules specified using `-l, --load FILENAME` */
    struct list_head* el = NULL;
    struct list_head* el1 = NULL;
    list_for_each(el, &flags.preload_modules)
    {
        // preload modules
        FileItem* file = list_entry(el, FileItem, link);
        int eval_flags = tjs_get_eval_flags(file->path, flags.module_detection);
        if (tjs_eval_module(jsContext, file->path, NULL, eval_flags)) {
            jsRuntime->options.exit_code = EXIT_FAILURE;
            goto exit;
        }
    }

    if (flags.eval_expression) {
        // eval expression
        flags.interactive = false;
        if (tjs_eval_expression(jsContext, flags.eval_expression, "<cmdline>", JS_EVAL_TYPE_GLOBAL)) {
            jsRuntime->options.exit_code = EXIT_FAILURE;
            goto exit;
        }

    } else if (flags.eval_appjs) {
        // app.js script
        flags.interactive = false;
        int eval_flags = tjs_get_eval_flags(flags.eval_appjs, flags.module_detection);
        if (tjs_eval_module(jsContext, flags.eval_appjs, flags.override_filename, eval_flags)) {
            jsRuntime->options.exit_code = EXIT_FAILURE;
            goto exit;
        }

    } else if (optionIndex >= argc) {
        /* interactive mode */
        flags.interactive = true;

    } else {
        // script.js
        const char* filepath = argv[optionIndex];
        int eval_flags = tjs_get_eval_flags(filepath, flags.module_detection);
        if (tjs_eval_module(jsContext, filepath, flags.override_filename, eval_flags)) {
            jsRuntime->options.exit_code = EXIT_FAILURE;
            goto exit;
        }
    }

    if (flags.interactive) {
        tjs_print_help();
    }

    TJS_Run(jsRuntime);

    if (jsRuntime->options.dump_memory) {
        JSMemoryUsage stats;
        JS_ComputeMemoryUsage(jsRuntime->rt, &stats);
        JS_DumpMemoryUsage(stdout, &stats, jsRuntime->rt);
    }

exit:
    list_for_each_safe(el, el1, &flags.preload_modules)
    {
        FileItem* file = list_entry(el, FileItem, link);
        list_del(&file->link);
        free(file);
    }

    if (jsRuntime) {
        runtimeOptions.exit_code = jsRuntime->options.exit_code;
        TJS_FreeRuntime(jsRuntime);
    }

    if (flags.empty_run && runtimeOptions.dump_memory) {
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

    return runtimeOptions.exit_code;
}
