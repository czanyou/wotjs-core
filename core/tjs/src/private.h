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

#ifndef TJS_PRIVATE_H
#define TJS_PRIVATE_H

#include <string.h>

#include "../../deps/quickjs/src/cutils.h"
#include "../../deps/quickjs/src/list.h"

#include "tjs.h"
#include "wasm.h"

#include <quickjs.h>
#include <stdbool.h>
#include <uv.h>

#define ENABLE_BOOTSTRAP 1
#define DISABLE_WASM 1
#define DISABLE_CURL 1

#define kDefaultReadSize 65536

#if defined(_WIN32)
#define TJS__PATHSEP '\\'
#else
#define TJS__PATHSEP '/'
#endif

struct TJSRuntime {
    TJSRuntimeOptions options;
    JSRuntime *rt;
    JSContext *ctx;
    uv_loop_t loop;
    struct {
        uv_check_t check;
        uv_idle_t idle;
        uv_prepare_t prepare;
    } jobs;
    uv_async_t stop;
    bool is_worker;
    bool in_bootstrap;

#ifdef TJS_HAVE_WASM
    struct {
        IM3Environment env;
    } wasm_ctx;
#endif
    struct {
        JSValue u8array_ctor;
    } builtins;
};

///////////////////////////////////////////////////////////////
// error

/** 新建一个 libuv 错误 */
JSValue tjs_new_uv_error(JSContext *ctx, int err);

/** 抛出一个 libuv 错误 */
JSValue tjs_throw_uv_error(JSContext *ctx, int err);

///////////////////////////////////////////////////////////////
// pipe

/** 新建一个 Pipe 管道类的实例 */
JSValue tjs_pipe_new(JSContext *ctx);

/** 返回这个管理关联的 libuv stream 实例 */
uv_stream_t *tjs_pipe_get_stream(JSContext *ctx, JSValueConst pipe);

///////////////////////////////////////////////////////////////
// jobs

/** execute the pending JavaScript jobs */
void tjs_execute_pending_jobs(JSContext *ctx);

///////////////////////////////////////////////////////////////
// file

/** 读取一个文件的内容 */
int tjs_load_file(JSContext *ctx, DynBuf *dbuf, const char *filename);

///////////////////////////////////////////////////////////////
// module

/** tjs 模块加载器 */
JSModuleDef *tjs_module_loader(JSContext *ctx, const char *module_name, void *opaque);

/** tjs 模块名称修正 */
char *tjs_module_normalizer(JSContext *ctx, const char *base_name, const char *name, void *opaque);

/** 设置模块信息 */
int tjs_module_set_import_meta(JSContext *ctx, JSValueConst func_val, JS_BOOL use_realpath, JS_BOOL is_main);

///////////////////////////////////////////////////////////////
// args

/** 当前输入的命令行参数 */
JSValue tjs__get_args(JSContext *ctx);

/** 当前输入的命令行参数 */
JSValue tjs__get_arg0(JSContext *ctx);

/** 当前执行的命令名 */
JSValue tjs__get_command_name(JSContext *ctx);

/** 当前执行的脚本的路径和文件名 */
JSValue tjs__get_main_module_name(JSContext *ctx);

///////////////////////////////////////////////////////////////
// bootstrap

/** 执行二进制字节码 */
int tjs__eval_binary(JSContext *ctx, const uint8_t *buf, size_t buf_len);

/** 启动时加载的内置模块 */
void tjs__bootstrap_globals(JSContext *ctx);

/** 启动时加载的附加的内置模块 */
void tjs__add_builtins(JSContext *ctx);

int tjs_init_internal_modules(JSContext* ctx);

///////////////////////////////////////////////////////////////
// worker

/** 创建一个工作线程运行时 */
TJSRuntime *tjs_new_worker_runtime(void);

/** 返回相关的 loop */
uv_loop_t *TJS_GetLoopRT(TJSRuntime *runtime);

///////////////////////////////////////////////////////
// Export

// 导出一个类
#define TJS_ExportModuleClass(ctx, m, func, name) { \
    JSValue clazz = JS_NewCFunction2(ctx, (func), (name), 1, JS_CFUNC_constructor, 0); \
    JS_SetModuleExport(ctx, m, (name), clazz); }

// 导出一个名称空间/对象
#define TJS_ExportModuleObject(ctx, m, name, table) { \
    JSValue object = JS_NewObject(ctx); \
    JS_SetPropertyFunctionList(ctx, object, table, countof(table)); \
    JS_SetModuleExport(ctx, m, (name), object); }

///////////////////////////////////////////////////////
// Socket Address

int TJS_ToSocketAddress(JSContext *ctx, JSValueConst value, struct sockaddr_storage *ss);
JSValue TJS_NewSocketAddress(JSContext *ctx, const struct sockaddr *sa);

JSValue tjs_get_fileno(JSContext* ctx, uv_handle_t* handle);
void tjs_call_handler(JSContext *ctx, JSValueConst func);
void JS_FreePropEnum(JSContext *ctx, JSPropertyEnum *tab, uint32_t len);

char* path_join(char* buffer, const char* subname, size_t buffer_size);

int tjs_module_eval_file(JSContext* ctx, const char* name);
const char* tjs_module_get_command_filename(char* filename, size_t buffer_size, const char* name);

int tjs_gpio_set_output(const char *name, int value);
int tjs_gpio_get_value(const char *name);
int tjs_gpio_set_input(const char *name);

#endif
