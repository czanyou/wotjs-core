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
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#if !defined(_WIN32)
#include <sys/wait.h>
#endif

#include "../deps/quickjs/src/cutils.h"
#include "quickjs.h"

/* BEGIN: copied over from quickjs-libc to avoid dependency. */

uint8_t* js_load_file(JSContext* ctx, size_t* pbuf_len, const char* filename)
{
    FILE* f;
    uint8_t* buf;
    size_t buf_len;

    f = fopen(filename, "rb");
    if (!f) {
        return NULL;
    }

    fseek(f, 0, SEEK_END);
    buf_len = ftell(f);

    fseek(f, 0, SEEK_SET);
    buf = js_malloc(ctx, buf_len + 1);
    size_t size = fread(buf, 1, buf_len, f);
    buf[buf_len] = '\0';

    fclose(f);
    *pbuf_len = size;
    return buf;
}

void js_std_dump_error(JSContext* ctx)
{
    JSValue exception_val, val;
    const char *exc, *stack;
    BOOL is_error;

    exception_val = JS_GetException(ctx);
    is_error = JS_IsError(ctx, exception_val);
    if (!is_error) {
        printf("Throw: ");
    }

    exc = JS_ToCString(ctx, exception_val);
    printf("%s\n", exc);
    JS_FreeCString(ctx, exc);

    if (is_error) {
        val = JS_GetPropertyStr(ctx, exception_val, "stack");
        if (!JS_IsUndefined(val)) {
            stack = JS_ToCString(ctx, val);
            printf("%s\n", stack);
            JS_FreeCString(ctx, stack);
        }

        JS_FreeValue(ctx, val);
    }

    JS_FreeValue(ctx, exception_val);
}

/* END: copied over from quickjs-libc to avoid dependency. */

typedef struct namelist_entry_s {
    char* name;
    char* short_name;
    int flags;
} namelist_entry_t;

typedef struct namelist_s {
    namelist_entry_t* array;
    int count;
    int size;
} namelist_t;

static namelist_t cname_list;
static namelist_t cmodule_list;
static namelist_t init_module_list;

static BOOL byte_swap;
static const char* c_ident_prefix = "mjs_";

#define FE_ALL (-1)

void namelist_add(namelist_t* lp, const char* name, const char* short_name, int flags)
{
    namelist_entry_t* e;
    if (lp->count == lp->size) {
        size_t newsize = lp->size + (lp->size >> 1) + 4;
        namelist_entry_t* a = realloc(lp->array, sizeof(lp->array[0]) * newsize);
        /* XXX: check for realloc failure */
        lp->array = a;
        lp->size = newsize;
    }

    e = &lp->array[lp->count++];
    e->name = strdup(name);

    if (short_name) {
        e->short_name = strdup(short_name);
    } else {
        e->short_name = NULL;
    }

    e->flags = flags;
}

void namelist_free(namelist_t* lp)
{
    while (lp->count > 0) {
        namelist_entry_t* e = &lp->array[--lp->count];
        free(e->name);
        free(e->short_name);
    }

    free(lp->array);
    lp->array = NULL;
    lp->size = 0;
}

namelist_entry_t* namelist_find(namelist_t* lp, const char* name)
{
    int i;
    for (i = 0; i < lp->count; i++) {
        namelist_entry_t* e = &lp->array[i];
        if (!strcmp(e->name, name)) {
            return e;
        }
    }

    return NULL;
}

static void get_c_basename(char* buf, size_t buf_size, const char* file)
{
    const char *p, *r;
    size_t len, i;

    p = file;

    r = strrchr(p, '.');
    if (!r) {
        r = p + strlen(p);
    }

    len = r - p;
    if (len > buf_size - 1) {
        len = buf_size - 1;
    }
    memcpy(buf, p, len);

    for (i = 0; i < len; i++) {
        if (buf[i] == '-') {
            buf[i] = '_';

        } else if (buf[i] == '/') {
            buf[i] = '_';
        }
    }

    buf[len] = '\0';
    /* Note: could also try to avoid using C keywords */
}

static void get_c_basename2(char* buf, size_t buf_size, const char* file)
{
    const char *p, *r;
    size_t len;

    p = file;
    r = p + strlen(p);

    len = r - p;
    if (len > buf_size - 1) {
        len = buf_size - 1;
    }

    memcpy(buf, p, len);
    buf[len] = '\0';
}

static void get_c_name(char* buf, size_t buf_size, const char* file)
{
    const char *p, *r;
    size_t len, i;

    p = strrchr(file, '/');
    if (!p)
        p = file;
    else
        p++;

    r = strrchr(p, '.');
    if (!r) {
        r = p + strlen(p);
    }

    len = r - p;

    if (len > buf_size - 1) {
        len = buf_size - 1;
    }

    memcpy(buf, p, len);

    for (i = 0; i < len; i++) {
        if (buf[i] == '-') {
            buf[i] = '_';
        }
    }

    buf[len] = '\0';
    /* Note: could also try to avoid using C keywords */
}

static void get_c_name2(char* buf, size_t buf_size, const char* file)
{
    const char *p, *r;
    size_t len;

    p = strrchr(file, '/');
    if (!p) {
        p = file;
    } else {
        p++;
    }

    r = strrchr(p, '.');
    if (!r) {
        r = p + strlen(p);
    }

    len = r - p;

    if (len > buf_size - 1) {
        len = buf_size - 1;
    }

    memcpy(buf, p, len);
    buf[len] = '\0';
}

static void dump_hex(FILE* f, const uint8_t* buf, size_t len)
{
    size_t i, col;
    col = 0;
    for (i = 0; i < len; i++) {
        fprintf(f, " 0x%02x,", buf[i]);
        if (++col == 16) {
            fprintf(f, "\n");
            col = 0;
        }
    }

    if (col != 0) {
        fprintf(f, "\n");
    }
}

static void print_object_code(JSContext* ctx,
    FILE* outfile,
    JSValueConst obj,
    const char* c_name,
    const char* c_name2,
    BOOL load_only)
{
    uint8_t* out_buf;
    size_t out_buf_len;
    int flags;
    flags = JS_WRITE_OBJ_BYTECODE;
    if (byte_swap) {
        flags |= JS_WRITE_OBJ_BSWAP;
    }

    out_buf = JS_WriteObject(ctx, &out_buf_len, obj, flags);
    if (!out_buf) {
        js_std_dump_error(ctx);
        exit(1);
    }

    namelist_add(&cname_list, c_name, c_name2, load_only);

    fprintf(outfile, "#define %s%s_size_t %u\n\n", c_ident_prefix, c_name2, (unsigned int)out_buf_len);
    fprintf(outfile, "const uint32_t %s%s_size = %u;\n\n", c_ident_prefix, c_name2, (unsigned int)out_buf_len);
    fprintf(outfile, "const uint8_t %s%s[%u] = {\n", c_ident_prefix, c_name2, (unsigned int)out_buf_len);
    dump_hex(outfile, out_buf, out_buf_len);
    fprintf(outfile, "};\n\n");

    js_free(ctx, out_buf);
}

static int js_module_dummy_init(JSContext* ctx, JSModuleDef* m)
{
    /* should never be called when compiling JS code */
    abort();
}

JSModuleDef* jsc_module_loader(JSContext* ctx, const char* module_name, void* opaque)
{
    // printf("jsc_module_loader: %s\r\n", module_name);

    static const char tjs_prefix[] = "@tjs/";
    static const char app_prefix[] = "@app/";

    JSModuleDef* m;
    namelist_entry_t* e;

    /* check if it's a builtin */
    if (strncmp(tjs_prefix, module_name, sizeof(tjs_prefix) - 1) == 0) {
        return JS_NewCModule(ctx, module_name, js_module_dummy_init);

    } else if (strncmp(app_prefix, module_name, sizeof(app_prefix) - 1) == 0) {
        return JS_NewCModule(ctx, module_name, js_module_dummy_init);
    }

    /* check if it is a declared C or system module */
    e = namelist_find(&cmodule_list, module_name);
    if (e) {
        /* add in the static init module list */
        namelist_add(&init_module_list, e->name, e->short_name, 0);

        /* create a dummy module */
        m = JS_NewCModule(ctx, module_name, js_module_dummy_init);

    } else {
        JS_ThrowReferenceError(ctx, "could not load module filename '%s'", module_name);
        return NULL;
    }

    return m;
}

/**
 * @brief 编译 JavaScript 文件
 * 
 * @param ctx JavaScript 运行时上下文
 * @param file 输出文件
 * @param filename 要编译的源文件名
 * @param is_module 是否是模块
 * @param prefix 
 * @param basepath 要编译的文件的基础路径
 */
static void compile_file(JSContext* ctx, FILE* file, const char* filename, int is_module, const char* libname, const char* basepath)
{
    char source_name[255];
    char c_name2[255];
    char prefix[255];

    // libname
    if (libname) {
        snprintf(prefix, sizeof(prefix), "@%s/", libname);

    } else {
        snprintf(prefix, sizeof(prefix), "@%s/", "tjs");
    }

    // file data
    size_t filesize;
    uint8_t*filedata = js_load_file(ctx, &filesize, filename);
    if (!filedata) {
        fprintf(stderr, "Could not load '%s'\n", filename);
        exit(1);
    }

    // flags
    int eval_flags = JS_EVAL_FLAG_COMPILE_ONLY;
    if (is_module < 0) {
        is_module = JS_DetectModule((const char*)filedata, filesize);
    }

    if (is_module) {
        eval_flags |= JS_EVAL_TYPE_MODULE;

    } else {
        eval_flags |= JS_EVAL_TYPE_GLOBAL;
    }

    // module name
    int prefix_len = strlen(prefix);
    int basename_len = 0;
    if (basepath) {
        basename_len = strlen(basepath);
        const char* file = filename + basename_len;
        get_c_basename(c_name2, sizeof(c_name2), file);
        pstrcpy(source_name, sizeof(source_name), prefix);
        get_c_basename2(source_name + prefix_len, sizeof(source_name) - prefix_len, file);

    } else {
        get_c_name(c_name2, sizeof(c_name2), filename);
        pstrcpy(source_name, sizeof(source_name), prefix);
        get_c_name2(source_name + prefix_len, sizeof(source_name) - prefix_len, filename);
    }

    // eval
    JSValue module = JS_Eval(ctx, (const char*)filedata, filesize, source_name, eval_flags);
    if (JS_IsException(module)) {
        js_std_dump_error(ctx);
        exit(1);
    }

    // encode
    js_free(ctx, filedata);
    print_object_code(ctx, file, module, source_name, c_name2, FALSE);
    JS_FreeValue(ctx, module);
}

void help(void)
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

void print_file_start(FILE* file)
{
    fprintf(file,
        "/* File generated automatically by the WoT.js compiler. */\n"
        "\n"
        "#include <inttypes.h>\n"
        "#include <stddef.h>\n"
        "#include <string.h>\n"
        "\n");
}

void print_file_end(FILE* file, const char* type, namelist_t* lp)
{
    int i;

#if 0
    fprintf(file,
        "const uint8_t* tjs_%s_get_module(const char* name, uint32_t* psize)\r\n"
        "{\r\n"
        "    if (name == NULL) {\r\n"
        "        return NULL;\r\n\r\n",
        type);

    for (i = 0; i < lp->count; i++) {
        namelist_entry_t* e = &lp->array[i];

        fprintf(file,
            "    } else if (strcmp(name, \"%s\") == 0) {\r\n"
            "        *psize = mjs_%s_size;\r\n"
            "        return mjs_%s;\r\n\r\n",
            e->name, e->short_name, e->short_name);
    }

    fprintf(file, "    }\r\n}\r\n");

#else 

    fprintf(file, "typedef struct module_entry_s {\r\n");
    fprintf(file, "    const char* name;\r\n");
    fprintf(file, "    const uint8_t* data;\r\n");
    fprintf(file, "    size_t size;\r\n");
    fprintf(file, "} module_entry_t;\r\n\r\n");

    fprintf(file, "static module_entry_t modules[] = {\r\n");

    for (i = 0; i < lp->count; i++) {
        namelist_entry_t* e = &lp->array[i];

        fprintf(file, "    { .name = \"%s\", .data = mjs_%s, .size = mjs_%s_size_t },\r\n", 
            e->name, e->short_name, e->short_name);
    }

    fprintf(file, "    { .name = NULL, .data = NULL, .size = 0 }\r\n");
    fprintf(file, "};\r\n\r\n");

    fprintf(file,
        "const uint8_t* tjs_%s_get_module(const char* name, uint32_t* psize)\r\n"
        "{\r\n"
        "    if (name == NULL) {\r\n"
        "        return NULL;\r\n"
        "    }\r\n\r\n"
        "    int count = sizeof(modules) / sizeof(module_entry_t);\r\n"
        "    for (int i = 0; i < count; i++) {\r\n"
        "        module_entry_t* module = &modules[i];\r\n"
        "        if (module->name && strcmp(name, module->name) == 0) {\r\n"
        "            *psize = module->size;\r\n"
        "            return module->data;\r\n"
        "        }\r\n"
        "    }\r\n\r\n"
        "    return NULL;\r\n"
        "}\r\n",
        type);

#endif
}

int main(int argc, char** argv)
{
    int c, i;
    const char* outname; // 输出文件名
    const char* basepath; // 输入文件基础路径
    const char* libname; // 库名
    char cfilename[1024];
    FILE* outfile;
    JSRuntime* rt;
    JSContext* ctx;
    int module;

    outname = NULL;
    basepath = NULL;
    libname = NULL;
    module = -1;
    byte_swap = FALSE;

    for (;;) {
        c = getopt(argc, argv, "hmxo:b:l:");
        if (c == -1) {
            break;
        }

        switch (c) {
        case 'h':
            help();
            break;

        case 'o':
            outname = optarg;
            break;

        case 'b':
            basepath = optarg;
            break;

        case 'l':
            libname = optarg;
            break;

        case 'm':
            module = 1;
            break;

        case 'x':
            byte_swap = TRUE;
            break;

        default:
            break;
        }
    }

    if (optind >= argc) {
        help();
    }

    if (!outname) {
        outname = "out.c";
    }

    pstrcpy(cfilename, sizeof(cfilename), outname);

    outfile = fopen(cfilename, "w");
    if (!outfile) {
        perror(cfilename);
        exit(1);
    }

    rt = JS_NewRuntime();
    ctx = JS_NewContext(rt);

    /* Enable BigFloat and BigDecimal */
#ifdef CONFIG_BIGNUM
    JS_AddIntrinsicBigFloat(ctx);
    JS_AddIntrinsicBigDecimal(ctx);
#endif

    /* loader for ES6 modules */
    JS_SetModuleLoaderFunc(rt, NULL, jsc_module_loader, NULL);

    print_file_start(outfile);

    for (i = optind; i < argc; i++) {
        const char* filename = argv[i];
        compile_file(ctx, outfile, filename, module, libname, basepath);
    }

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);

    if (libname) {
        print_file_end(outfile, libname, &cname_list);
    }

    fclose(outfile);

    namelist_free(&cname_list);
    namelist_free(&cmodule_list);
    namelist_free(&init_module_list);
    return 0;
}
