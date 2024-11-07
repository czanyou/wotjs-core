/*
 * QuickJS command line compiler
 *
 * Copyright (c) 2018-2019 Fabrice Bellard
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
#include <inttypes.h>
#include <limits.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#if !defined(_WIN32)
#include <sys/wait.h>
#endif

#include "../../deps/quickjs/src/cutils.h"
#include "quickjs.h"

///////////////////////////////////////////////////////////////////////////////
// js

/* BEGIN: copied over from quickjs-libc to avoid dependency. */

/**
 * @brief 读取文件内容
 *
 * @param ctx 上下文
 * @param length 读取的文件内容长度
 * @param filename 要读取的文件名
 * @return 读取的文件内容
 */
static uint8_t* tjs_load_file(JSContext* ctx, size_t* length, const char* filename)
{
    if (filename == NULL || filename[0] == '\0') {
        return NULL;
    }

    FILE* file = fopen(filename, "rb");
    if (!file) {
        return NULL;
    }

    // length
    fseek(file, 0, SEEK_END);
    size_t file_length = ftell(file);
    fseek(file, 0, SEEK_SET);

    // data
    uint8_t* buffer = js_malloc(ctx, file_length + 1);
    if (buffer == NULL) {
        fclose(file);
        return NULL;
    }

    size_t size = fread(buffer, 1, file_length, file);
    buffer[file_length] = '\0';

    fclose(file);

    if (length) {
        *length = size;
    }

    return buffer;
}

/**
 * @brief 打印脚本错误
 *
 * @param ctx
 */
static void tjs_dump_error(JSContext* ctx)
{
    JSValue exception = JS_GetException(ctx);
    BOOL is_error = JS_IsError(ctx, exception);
    if (!is_error) {
        printf("Throw: ");
    }

    // message
    const char* message = JS_ToCString(ctx, exception);
    printf("%s\n", message);
    JS_FreeCString(ctx, message);

    // stack
    if (is_error) {
        JSValue value = JS_GetPropertyStr(ctx, exception, "stack");
        if (!JS_IsUndefined(value)) {
            const char* stack = JS_ToCString(ctx, value);
            printf("%s\n", stack);
            JS_FreeCString(ctx, stack);
        }

        JS_FreeValue(ctx, value);
    }

    JS_FreeValue(ctx, exception);
}

/* END: copied over from quickjs-libc to avoid dependency. */

///////////////////////////////////////////////////////////////////////////////
// namelist

typedef struct namelist_entry_s {
    char* name;
    char* short_name;
    size_t size;
    int flags;
} namelist_entry_t;

typedef struct namelist_s {
    namelist_entry_t* array;
    int count;
    int size;
} namelist_t;

/**
 * @brief
 *
 * @param list
 * @param name
 * @param short_name
 * @param flags
 */
void namelist_add(namelist_t* list, const char* name, const char* short_name, size_t size, int flags)
{
    if (list->count == list->size) {
        size_t new_size = list->size + (list->size >> 1) + 4;
        namelist_entry_t* array = realloc(list->array, sizeof(list->array[0]) * new_size);
        if (array == NULL) {
            return;
        }

        /* XXX: check for realloc failure */
        list->array = array;
        list->size = new_size;
    }

    namelist_entry_t* entry = &list->array[list->count++];
    entry->size = size;
    entry->flags = flags;
    entry->name = strdup(name);
    entry->short_name = short_name ? strdup(short_name) : NULL;
}

/**
 * @brief
 *
 * @param list
 */
void namelist_free(namelist_t* list)
{
    while (list->count > 0) {
        namelist_entry_t* entry = &list->array[--list->count];
        free(entry->name);
        free(entry->short_name);
    }

    free(list->array);
    list->array = NULL;
    list->size = 0;
}

/**
 * @brief
 *
 * @param list
 * @param name
 * @return namelist_entry_t*
 */
namelist_entry_t* namelist_find(namelist_t* list, const char* name)
{
    int i;
    for (i = 0; i < list->count; i++) {
        namelist_entry_t* entry = &list->array[i];
        if (!strcmp(entry->name, name)) {
            return entry;
        }
    }

    return NULL;
}

///////////////////////////////////////////////////////////////////////////////
//

/**
 * 编译选项
 */
typedef struct tjs_compiler_options_s {
    const char* outname; // 输出文件名
    const char* basepath; // 输入文件基础路径
    const char* libname; // 库名
    int is_module; //
    BOOL is_byte_swap; //

} tjs_compiler_options_t;

/** 编译选项 */
static tjs_compiler_options_t tjs_options = { 0 };

static namelist_t tjs_c_module_list;
static namelist_t tjs_init_module_list;
static namelist_t tjs_js_module_list;

/**
 * 输出文件中 (C语言)，变量名前缀
 */
static const char* tjs_c_ident_prefix = "tjs_m_";

/**
 * @brief
 *
 * @param buf
 * @param buf_size
 * @param filename
 */
static void tjs_get_cname(char* buf, size_t buf_size, const char* filename)
{
    const char *p, *end;
    size_t len, i;

    p = filename;

    // ext
    if (has_suffix(filename, ".js")) {
        end = strrchr(p, '.');
        if (!end) {
            end = p + strlen(p);
        }

    } else {
        end = p + strlen(p);
    }

    len = end - p;
    if (len > buf_size - 1) {
        len = buf_size - 1;
    }

    memcpy(buf, p, len);

    // - -> _, / -> _
    for (i = 0; i < len; i++) {
        if (buf[i] == '-') {
            buf[i] = '_';

        } else if (buf[i] == '/') {
            buf[i] = '_';

        } else if (buf[i] == '.' || buf[i] == '@' || buf[i] == '$') {
            buf[i] = '_';
        }
    }

    buf[len] = '\0';
    /* Note: could also try to avoid using C keywords */
}

/**
 * @brief
 *
 * @param buffer
 * @param buffer_size
 * @param prefix
 * @param basename
 */
static void tjs_get_packge_name(char* buffer, size_t buffer_size, const char* prefix, const char* basename)
{
    int prefix_length = strlen(prefix);
    pstrcpy(buffer, sizeof(buffer), prefix);

    buffer += prefix_length;
    buffer_size -= prefix_length;

    const char* p = basename;
    const char* end = NULL;

    if (strcmp(prefix, "@tjs/") == 0) {
        end = strrchr(p, '.');
    }

    if (!end) {
        end = p + strlen(p);
    }

    size_t len = end - p;
    if (len > buffer_size - 1) {
        len = buffer_size - 1;
    }

    memcpy(buffer, p, len);
    buffer[len] = '\0';
}

/**
 * @brief
 *
 * @param output
 * @param buffer
 * @param length
 */
static void tjs_print_hex_string(FILE* output, const uint8_t* buffer, size_t length)
{
    size_t i;
    size_t col = 0;
    for (i = 0; i < length; i++) {
        fprintf(output, " 0x%02x,", buffer[i]);
        if (++col == 16) {
            fprintf(output, "\n");
            col = 0;
        }
    }

    if (col != 0) {
        fprintf(output, "\n");
    }
}

/**
 * 打印字节码
 *
 * @param ctx
 * @param output
 * @param object
 * @param package_name
 * @param cname
 * @param load_only
 *
 */
static void tjs_print_module_byte_code(JSContext* ctx, FILE* output, JSValueConst module,
    const char* package_name, const char* cname, BOOL load_only)
{
    int flags = JS_WRITE_OBJ_BYTECODE;
    if (tjs_options.is_byte_swap) {
        flags |= JS_WRITE_OBJ_BSWAP;
    }

    size_t code_length;
    uint8_t* code_bytes = JS_WriteObject(ctx, &code_length, module, flags);
    if (!code_bytes) {
        tjs_dump_error(ctx);
        exit(1);
    }

    // printf("tjs_print_module_byte_code: %s - %s\r\n", package_name, cname);
    uint32_t code_size = code_length;
    namelist_add(&tjs_js_module_list, package_name, cname, code_size, load_only);

    // fprintf(output, "#define %s%s_size_t %u\n\n", tjs_c_ident_prefix, cname, code_size);
    // fprintf(output, "const uint32_t %s%s_size = %u;\n\n", tjs_c_ident_prefix, cname, code_size);
    fprintf(output, "static const uint8_t %s%s[%u] = {\n", tjs_c_ident_prefix, cname, code_size);
    tjs_print_hex_string(output, code_bytes, code_length);
    fprintf(output, "};\n\n");

    js_free(ctx, code_bytes);
}

static int tjs_module_dummy_init(JSContext* ctx, JSModuleDef* m)
{
    /* should never be called when compiling JS code */
    abort();
}

JSModuleDef* tjs_module_loader(JSContext* ctx, const char* module_name, void* opaque)
{
    static const char tjs_prefix[] = "@";

    /* check if it's a builtin */
    if (strncmp(tjs_prefix, module_name, sizeof(tjs_prefix) - 1) == 0) {
        return JS_NewCModule(ctx, module_name, tjs_module_dummy_init);
    }

    printf("tjsc: loader=%s\r\n", module_name);
    JSModuleDef* module = NULL;

    /* check if it is a declared C or system module */
    namelist_entry_t* entry = namelist_find(&tjs_c_module_list, module_name);
    if (entry) {
        /* add in the static init module list */
        namelist_add(&tjs_init_module_list, entry->name, entry->short_name, 0, 0);

        /* create a dummy module */
        module = JS_NewCModule(ctx, module_name, tjs_module_dummy_init);

    } else {
        JS_ThrowReferenceError(ctx, "failed to load module '%s'", module_name);
        return NULL;
    }

    return module;
}

/**
 * @brief 编译 JavaScript 文件
 *
 * @param ctx JavaScript 运行时上下文
 * @param output 输出文件
 * @param filename 要编译的源文件名
 *
 * @param is_module 是否是模块
 * @param libname 库名，如 'tjs' 表示 '@tjs/...'
 * @param basepath 要编译的文件的基础路径
 */
static void tjs_compile_javascript_file(JSContext* ctx, FILE* output, const char* filename)
{
    char package_name[PATH_MAX] = { 0 };
    char package_prefix[PATH_MAX] = { 0 };
    char cname[PATH_MAX] = { 0 };
    char dirname[PATH_MAX] = { 0 };

    // printf("tjsc: compile: %s - %s\r\n", prefix, filename);

    // load file data
    size_t filesize;
    char* filedata = (char*)tjs_load_file(ctx, &filesize, filename);
    if (!filedata) {
        fprintf(stderr, "Could not load '%s'\n", filename);
        exit(1);
    }

    const char* basepath = tjs_options.basepath;
    if (!basepath) {
        char* p = strrchr(filename, '/');
        if (p) {
            strncpy(dirname, filename, p - filename + 1);
            basepath = dirname;

        } else {
            basepath = "";
        }
    }

    // module name
    const char* basename = filename + strlen(basepath);

    // C 语言变量名
    tjs_get_cname(cname, sizeof(cname), basename);

    // javascript 包名
    snprintf(package_prefix, sizeof(package_prefix), "@%s/", tjs_options.libname ? tjs_options.libname : "tjs");
    tjs_get_packge_name(package_name, sizeof(package_name), package_prefix, basename);
    // printf("tjs_compile_javascript_file: %s - %s (%s, %s), %s\r\n", basepath, cname, prefix, package_name, filename);
    // printf("tjsc: add=%s\n", package_name);

    // eval flags
    int eval_flags = JS_EVAL_FLAG_COMPILE_ONLY;
    int is_module = tjs_options.is_module;
    if (is_module < 0) {
        is_module = JS_DetectModule(filedata, filesize);
    }

    if (is_module) {
        eval_flags |= JS_EVAL_TYPE_MODULE;

    } else {
        eval_flags |= JS_EVAL_TYPE_GLOBAL;
    }

    // eval file: 加载 js 文件模块
    JSValue module = JS_Eval(ctx, filedata, filesize, package_name, eval_flags);
    js_free(ctx, filedata);

    if (JS_IsException(module)) {
        tjs_dump_error(ctx);
        exit(1);
    }

    // encode: 输出字节码
    tjs_print_module_byte_code(ctx, output, module, package_name, cname, FALSE);

    // free
    JS_FreeValue(ctx, module);
}

/**
 * @brief
 *
 * @param ctx
 * @param output
 * @param filename
 */
static void tjs_add_file(JSContext* ctx, FILE* output, const char* filename)
{
    char package_name[PATH_MAX] = { 0 };
    char package_prefix[PATH_MAX] = { 0 };
    char cname[PATH_MAX] = { 0 };
    char dirname[PATH_MAX] = { 0 };

    // printf("tjsc: compile: %s - %s\r\n", prefix, filename);

    // file data
    size_t filesize;
    char* filedata = (char*)tjs_load_file(ctx, &filesize, filename);
    if (!filedata) {
        fprintf(stderr, "Could not load '%s'\n", filename);
        exit(1);
    }

    // basepath
    const char* basepath = tjs_options.basepath;
    if (!basepath) {
        char* p = strrchr(filename, '/');
        if (p) {
            strncpy(dirname, filename, p - filename + 1);
            basepath = dirname;

        } else {
            basepath = "";
        }
    }

    // module name
    const char* basename = filename + strlen(basepath);
    tjs_get_cname(cname, sizeof(cname), basename);

    snprintf(package_prefix, sizeof(package_prefix), "@%s/", tjs_options.libname ? tjs_options.libname : "tjs");
    tjs_get_packge_name(package_name, sizeof(package_name), package_prefix, basename);

    // printf("tjsc: add=%s\n", package_name);
    // printf("tjsc add: cname=%s, package=%s, basename=%s\r\n", cname, package_name, basename);

    // encode
    uint32_t code_size = filesize;
    namelist_add(&tjs_js_module_list, package_name, cname, code_size, 0);

    // code
    // fprintf(output, "#define %s%s_size_t %u\n\n", tjs_c_ident_prefix, cname, code_size);
    // fprintf(output, "const uint32_t %s%s_size = %u;\n\n", tjs_c_ident_prefix, cname, code_size);
    fprintf(output, "static const uint8_t %s%s[%u] = {\n", tjs_c_ident_prefix, cname, code_size);
    tjs_print_hex_string(output, filedata, code_size);
    fprintf(output, "};\n\n");
}

/**
 * 输出文件头
 *
 * - C 语言格式
 * @param output 输出文件
 */
static void tjs_print_output_file_header(FILE* output)
{
    fprintf(output,
        "/* File generated automatically by the WoT.js compiler. */\n"
        "\n"
        "#include <inttypes.h>\n"
        "#include <stddef.h>\n"
        "#include <string.h>\n"
        "\n");
}

/**
 * 输出文件尾
 *
 * - C 语言格式
 * @param output 输出文件
 * @param type 输出文件类型名, 如 `app` 或 `tjs`
 * @param list 模块文件列表
 */
static void tjs_print_output_file_footer(FILE* output, const char* type, namelist_t* list)
{
    int i;
    printf("tjsc: (%s) Add total %d files\n", type, list->count);

    // 0. tjs_module_count
    fprintf(output, "static uint32_t tjs_module_count = %d;\r\n", list->count);

    // 1. tjs_module_names
    fprintf(output, "static const char* tjs_module_names[] = {\r\n");
    for (i = 0; i < list->count; i++) {
        namelist_entry_t* entry = &list->array[i];
        fprintf(output, "    \"%s\",\r\n", entry->name);
    }
    fprintf(output, "    NULL\r\n};\r\n\r\n");

    // 2. tjs_module_data
    fprintf(output, "static const uint8_t* tjs_module_data[] = {\r\n");
    for (i = 0; i < list->count; i++) {
        namelist_entry_t* entry = &list->array[i];
        fprintf(output, "    tjs_m_%s,\r\n", entry->short_name);
    }
    fprintf(output, "    NULL\r\n};\r\n\r\n");

    // 3. tjs_module_size
    fprintf(output, "static const size_t tjs_module_size[] = {\r\n");
    for (i = 0; i < list->count; i++) {
        namelist_entry_t* entry = &list->array[i];
        fprintf(output, "    %ld,\r\n", entry->size);
    }
    fprintf(output, "    0\r\n};\r\n\r\n");

    // 4. tjs_get_module_data
    fprintf(output, "\r\n"
                    "const uint8_t* tjs_get_%s_module_data(const char* name, uint32_t* psize)\r\n"
                    "{\r\n"
                    "    if (name == NULL) {\r\n"
                    "        return NULL;\r\n"
                    "    }\r\n\r\n"
                    "    int count = tjs_module_count;\r\n"
                    "    for (int i = 0; i < count; i++) {\r\n"
                    "        const char* module_name = tjs_module_names[i];\r\n"
                    "        if (module_name && strcmp(name, module_name) == 0) {\r\n"
                    "            *psize = tjs_module_size[i];\r\n"
                    "            return tjs_module_data[i];\r\n"
                    "        }\r\n"
                    "    }\r\n\r\n"
                    "    return NULL;\r\n"
                    "}\r\n",
        type);

    // 5. tjs_get_module_name
    fprintf(output, "\r\n"
                    "const char* tjs_get_%s_module_name(int index)\r\n"
                    "{\r\n"
                    "    if (index < 0 || index > tjs_module_count) {\r\n"
                    "        return NULL;\r\n"
                    "    }\r\n\r\n"
                    "    return tjs_module_names[index];\r\n"
                    "}\r\n",
        type);

    // 4. tjs_module_init
    fprintf(output, "\r\n"
                    "extern int tjs_module_add_module(const char* name, const uint8_t* data, uint32_t data_len);\r\n"
                    "int tjs_%s_module_init()\r\n"
                    "{\r\n"
                    "    int count = tjs_module_count;\r\n"
                    "    for (int i = 0; i < count; i++) {\r\n"
                    "        const char* module_name = tjs_module_names[i];\r\n"
                    "        if (module_name) {\r\n"
                    "            tjs_module_add_module(module_name, tjs_module_data[i], tjs_module_size[i]);\r\n"
                    "        }\r\n"
                    "    }\r\n\r\n"
                    "    return 0;\r\n"
                    "}\r\n",
        type);
}

static void tjs_print_help(void)
{
    printf("WoT.js compiler - version " QJS_VERSION_STR "\n\n"
           "Usage: tjsc [options] [files]\n"
           "\n"
           "Options:\n\n"
           //         "  -c          only output bytecode in a C file\n"
           "  -o output   set the output filename\n"
           "  -l libname  set the output libname\n"
           "  -b basepath set the base path name\n"
           "  -m          compile as Javascript module (default=autodetect)\n"
           "  -x          byte swapped output\n"
           "\n");

    exit(1);
}

int tjs_parse_options(int argc, char** argv)
{
    int c, i;

    tjs_options.outname = NULL;
    tjs_options.basepath = NULL;
    tjs_options.libname = NULL;
    tjs_options.is_module = -1;
    tjs_options.is_byte_swap = FALSE;

    for (;;) {
        c = getopt(argc, argv, "hmxo:b:l:");
        if (c == -1) {
            break;
        }

        switch (c) {
        case 'h':
            tjs_print_help();
            break;

        case 'o':
            tjs_options.outname = optarg;
            break;

        case 'b':
            tjs_options.basepath = optarg;
            break;

        case 'l':
            tjs_options.libname = optarg;
            break;

        case 'm':
            tjs_options.is_module = 1;
            break;

        case 'x':
            tjs_options.is_byte_swap = TRUE;
            break;

        default:
            break;
        }
    }

    if (!tjs_options.outname) {
        tjs_options.outname = "out.c";
    }

    if (!tjs_options.libname) {
        tjs_options.libname = "tjs";
    }

    return 0;
}

int tjs_compiler(int argc, char** argv)
{
    int i;

    // 1. options
    tjs_parse_options(argc, argv);

    if (optind >= argc) {
        tjs_print_help();
    }

    // 1.1 output filename
    char filename[1024];
    pstrcpy(filename, sizeof(filename), tjs_options.outname);
    FILE* output = fopen(filename, "w");
    if (!output) {
        perror(filename);
        exit(1);
    }

    // 2. init runtime
    JSRuntime* js_runtime = JS_NewRuntime();
    JSContext* js_context = JS_NewContext(js_runtime);

    /* Enable BigFloat and BigDecimal */
#ifdef CONFIG_BIGNUM
    JS_AddIntrinsicBigFloat(js_context);
    JS_AddIntrinsicBigDecimal(js_context);
#endif

    /* loader for ES6 modules */
    JS_SetModuleLoaderFunc(js_runtime, NULL, tjs_module_loader, NULL);

    // 3. header
    tjs_print_output_file_header(output);

    // 4. add files
    for (i = optind; i < argc; i++) {
        const char* filename = argv[i];
        if (strstr(filename, "/@assets/")) {
            // 资源文件
            tjs_add_file(js_context, output, filename);

        } else if (has_suffix(filename, ".js")) {
            // javascript 文件
            tjs_compile_javascript_file(js_context, output, filename);

        } else {
            // 资源文件
            tjs_add_file(js_context, output, filename);
        }
    }

    // 5. footer
    tjs_print_output_file_footer(output, tjs_options.libname, &tjs_js_module_list);
    fclose(output);

    // 6. free runtime
    JS_FreeContext(js_context);
    JS_FreeRuntime(js_runtime);

    // free names
    namelist_free(&tjs_js_module_list);
    namelist_free(&tjs_c_module_list);
    namelist_free(&tjs_init_module_list);
    return 0;
}

int main(int argc, char** argv)
{
    return tjs_compiler(argc, argv);
}
