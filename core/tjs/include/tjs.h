
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

#ifndef TJS_H
#define TJS_H

#include "tjs-utils.h"

#include <uv.h>

#include <quickjs.h>
#include <stdbool.h>

///////////////////////////////////////////////////////
// Runtime

typedef struct TJSRuntime TJSRuntime;

/** 运行时选项 */
typedef struct TJSRuntimeOptions {
    bool unhandled_rejection;
    bool trace_memory;
    bool dump_memory;
    size_t stack_size;
    size_t memory_limit;
    int exit_code;
} TJSRuntimeOptions;

///////////////////////////////////////////////////////
// Runtime

/** 获取默认的选项 */
void TJS_DefaultOptions(TJSRuntimeOptions *options);

/** 创建一个主线程运行时 */
TJSRuntime *TJS_NewRuntime(TJSRuntimeOptions *options);

/** 返回指定上下文的运行时 */
TJSRuntime *TJS_GetRuntime(JSContext *ctx);

/** 返回上下文 */
JSContext *TJS_GetContext(TJSRuntime *runtime);

/** 释放指定的运行时 */
void TJS_FreeRuntime(TJSRuntime *runtime);

/** 运行指定的运行时 */
void TJS_Run(TJSRuntime *runtime);

/** 异步通知停止指定的运行时 */
void TJS_Stop(TJSRuntime *runtime);

///////////////////////////////////////////////////////
// Eval

/** 执行指定的文件 */
JSValue TJS_EvalFile(JSContext *ctx, const char *filename, int eval_flags, bool is_main, const char *override_filename);

///////////////////////////////////////////////////////
// CLI

/** 设置脚本名参数索引位置 */
void TJS_SetArg0(int arg0, const char* command);

/** 设置脚本名参数 */
void TJS_SetScriptFilename(const char* script);

/** 设置命令行参数列表 */
void TJS_SetArgs(int argc, char **argv);

/** 设置脚本名参数 */
int tjs_cli(int argc, char** argv);

#endif
