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
#include "tjs-utils.h"
#include "tjs.h"

#include <string.h>

#if defined(__linux__) || defined(__linux) || defined(__APPLE__)
#include <dlfcn.h>
#endif

extern int tjs_app_module_init();
extern int tjs_tjs_module_init();

typedef JSModuleDef*(tjs_module_init_func)(JSContext* ctx, const char* module_name);

typedef struct tjs_module_s {
    struct tjs_module_s* next;
    const char* name;
    const uint8_t* data;
    uint32_t data_len;
} tjs_module_t;

typedef struct tjs_module_context_s {
    tjs_module_t* modules;
    int module_count;
} tjs_module_context_t;

static tjs_module_context_t tjs_module_context = { 0 };

int tjs_module_add_module(const char* name, const uint8_t* data, uint32_t data_len)
{
    tjs_module_t* module = tjs_module_context.modules;
    while (module) {
        if (module->name == NULL) {
            break;
        }

        if (strcmp(name, module->name) == 0) {
            module->data = data;
            module->data_len = data_len;
            return 0;
        }

        module = module->next;
    }

    module = (tjs_module_t*)malloc(sizeof(tjs_module_t));
    if (module != NULL) {
        module->name = name;
        module->data = data;
        module->data_len = data_len;
        module->next = tjs_module_context.modules;
        tjs_module_context.modules = module;
        tjs_module_context.module_count++;
    }

    return 0;
}

/**
 * @brief 执行指定的模块文件 (字节码格式)
 *
 * @param ctx
 * @param filename 模块名：`\@app/path/to/$name/app.js`
 * @return 成功则返回 0
 */
int tjs_module_eval_file(JSContext* ctx, const char* filename)
{
    if (filename == NULL) {
        return -1;
    }

    // 1. get module data
    uint32_t size = 0;
    const uint8_t* byte_code = tjs_module_get_data(filename, &size);
    if (byte_code == NULL || size <= 0) {
        printf("Error: could not load '%s'\r\n", filename);
        return -1;
    }

    // 2. read as object
    JSValue object = JS_ReadObject(ctx, byte_code, size, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(object)) {
        goto error;
    }

    if (JS_VALUE_GET_TAG(object) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, object) < 0) {
            JS_FreeValue(ctx, object);
            goto error;
        }

        tjs_module_set_import_meta(ctx, object, FALSE, FALSE);
    }

    // 3. eval
    JSValue result = JS_EvalFunction(ctx, object);
    if (JS_IsException(result)) {
        JS_FreeValue(ctx, result);
        goto error;
    }

    JS_FreeValue(ctx, result);

    return 0;

error:
    TJS_DumpError(ctx);
    return -1;
}

/**
 * @brief 检查是否存在指定名称的插件
 *
 * @param name 插件名称
 * @return 如果存在则返回 1，否则返回 0
 */
const char* tjs_module_get_command_filename(char* filename, size_t buffer_size, const char* name)
{
    if (filename == NULL) {
        return NULL;

    } else if (name == NULL) {
        return NULL;
    }

    {
        // 1. @app/:name/app.js
        const char* prefix = "@app/";
        strncpy(filename, prefix, buffer_size);
        tjs_path_join(filename, name, buffer_size);
        tjs_path_join(filename, "app.js", buffer_size);

        uint32_t buffer_len = 0;
        const uint8_t* buffer = tjs_module_get_data(filename, &buffer_len);
        if (buffer != NULL) {
            return filename;
        }
    }

    {
        // 2. @app/bin/:name.js
        const char* prefix = "@app/bin/";
        strncpy(filename, prefix, buffer_size);
        tjs_path_join(filename, name, buffer_size);
        strcat(filename, ".js");

        uint32_t buffer_len = 0;
        const uint8_t* buffer = tjs_module_get_data(filename, &buffer_len);
        if (buffer != NULL) {
            return filename;
        }
    }

    return NULL;
}

const uint8_t* tjs_module_get_data(const char* name, uint32_t* psize)
{
    const uint8_t* data = NULL;
    if (name == NULL) {
        return data;
    }

    uint32_t name_len = strlen(name);

    tjs_module_t* module = tjs_module_context.modules;
    while (module) {
        if (module->name == NULL) {
            break;
        }

        if (strncmp(name, module->name, name_len) == 0) {
            const char* p = module->name + name_len;
            if (*p == '\0' || strcmp(p, ".js") == 0 || strcmp(p, ".mjs") == 0) {
                data = module->data;
                *psize = module->data_len;
                break;
            }
        }

        module = module->next;
    }

    return data;
}

JSValue tjs_module_get_names(JSContext* ctx)
{
    JSValue array = JS_NewArray(ctx);

    int position = 0;

    tjs_module_t* module = tjs_module_context.modules;
    while (module) {
        const char* name = module->name;
        if (name == NULL) {
            break;
        }

        module = module->next;
        JS_DefinePropertyValueUint32(ctx, array, position++, JS_NewString(ctx, name), JS_PROP_C_W_E);
    }

    return array;
}

uint32_t tjs_module_read_uint32(uint8_t* buffer, int size)
{
    if (buffer == NULL || size < sizeof(uint32_t)) {
        return 0;
    }

    uint32_t value = 0;
    for (int i = 0; i < sizeof(uint32_t); ++i) {
        value = (value << 8) | buffer[i];
    }

    return value;
}

int tjs_module_load()
{
    // exepath
    char exepath[PATH_MAX] = { 0 };
    size_t size = PATH_MAX;
    uv_exepath(exepath, &size);

    FILE* file = fopen(exepath, "rb");
    if (file == NULL) {
        perror("fopen");
        return -1;
    }

    // read file size
    fseek(file, 0, SEEK_END);
    size_t filesize = ftell(file);

    // 读取 exepath 指向的文件最后 16 个字节的内容
    size_t file_end_size = 16;
    fseek(file, filesize - file_end_size, SEEK_SET);
    uint8_t buffer[16];
    size_t bytes_read = fread(buffer, 1, file_end_size, file);
    if (bytes_read != file_end_size) {
        fprintf(stderr, "Failed to read 16 bytes from the file.\n");
        fclose(file);
        return -1;
    }

    if (strncmp((const char*)buffer, "@tjs/modules", 12) != 0) {
        // fprintf(stderr, "Bad magic code.\n");
        fclose(file);
        return -1;
    }

    size_t offset = tjs_module_read_uint32(buffer + 12, 4);
    if (offset > filesize - file_end_size) {
        fprintf(stderr, "Invalid offset value.\n");
        fclose(file);
        return -1;
    }

    while (offset < filesize - file_end_size) {
        fseek(file, offset, SEEK_SET);

        size_t tag_header_size = 8;
        bytes_read = fread(buffer, 1, tag_header_size, file);
        if (bytes_read != tag_header_size) {
            fprintf(stderr, "Failed to read 8 bytes from the file.\n");
            break;
        }

        size_t tag_size = tjs_module_read_uint32(buffer, 4);
        if (offset + tag_size + tag_header_size > filesize - file_end_size) {
            break;
        }

        // read module name
        size_t name_size = buffer[7];
        uint8_t* name = (uint8_t*)malloc(name_size + 1);
        bytes_read = fread(name, 1, name_size, file);
        if (bytes_read != name_size) {
            fprintf(stderr, "Failed to read %d bytes from the file.\n", name_size);
            break;
        }

        name[name_size] = '\0';

        // read module code
        size_t code_size = tag_size - name_size;
        uint8_t* data = (uint8_t*)malloc(code_size + 4);
        bytes_read = fread(data, 1, code_size, file);
        if (bytes_read != code_size) {
            fprintf(stderr, "Failed to read %d bytes from the file.\n", code_size);
            free(name);
            break;
        }

        offset += tag_size + 8;
        tjs_module_add_module(name, data, code_size);
    }

    fclose(file);
    return 0;
}

int tjs_module_init(JSRuntime* rt, void* user_data)
{
    tjs_tjs_module_init();
    tjs_app_module_init();
    tjs_module_load();

    JS_SetModuleLoaderFunc(rt, tjs_module_normalizer, tjs_module_loader, user_data);
    return 0;
}

/**
 * 字节码模块加载器
 */
static JSModuleDef* tjs_module_load_bytecode(JSContext* ctx, const char* name)
{
    if (name == NULL) {
        return NULL;
    }

    // 1. get module bytecode data
    uint32_t data_len = 0;
    const uint8_t* data = tjs_module_get_data(name, &data_len);
    if (data == NULL) {
        JS_ThrowReferenceError(ctx, "could not load module filename '%s' as library", name);
        return NULL;
    }

    // 2. read as object
    JSValue object = JS_ReadObject(ctx, data, data_len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(object)) {
        goto error;
    }

    if (JS_VALUE_GET_TAG(object) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, object) < 0) {
            JS_FreeValue(ctx, object);
            goto error;
        }

        tjs_module_set_import_meta(ctx, object, FALSE, FALSE);
    }

    JSModuleDef* module = JS_VALUE_GET_PTR(object);
    JS_FreeValue(ctx, object);

error:
    return module;
}

/**
 * @brief 外部 JavaScript/JSON 文件模块加载器
 *
 * @param ctx
 * @param filename 文件名
 * @param module_name 对应的模块名
 * @return
 */
static JSModuleDef* tjs_module_load_js(JSContext* ctx, const char* filename, const char* module_name)
{
    static const char json_tpl_start[] = "export default JSON.parse(`";
    static const char json_tpl_end[] = "`);";

    JSModuleDef* module;
    JSValue function;
    int r, is_json;
    DynBuf dbuf;

    // local file module
    dbuf_init(&dbuf);

    is_json = has_suffix(filename, ".json");

    /* Support importing JSON files bcause... why not? */
    if (is_json) {
        dbuf_put(&dbuf, (const uint8_t*)json_tpl_start, strlen(json_tpl_start));
    }

    r = tjs_load_file(ctx, &dbuf, filename);
    if (r != 0) {
        dbuf_free(&dbuf);
        JS_ThrowReferenceError(ctx, "could not load '%s'", filename);
        return NULL;
    }

    if (is_json) {
        dbuf_put(&dbuf, (const uint8_t*)json_tpl_end, strlen(json_tpl_end));
    }

    /* Add null termination, required by JS_Eval. */
    dbuf_putc(&dbuf, '\0');

    /* compile JS the module */
    function = JS_Eval(ctx, (char*)dbuf.buf, dbuf.size - 1, module_name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    dbuf_free(&dbuf);
    if (JS_IsException(function)) {
        JS_FreeValue(ctx, function);
        return NULL;
    }

    /* XXX: could propagate the exception */
    tjs_module_set_import_meta(ctx, function, TRUE, FALSE);
    /* the module is already referenced, so we must free it */
    module = JS_VALUE_GET_PTR(function);
    JS_FreeValue(ctx, function);

    return module;
}

static JSModuleDef* tjs_module_load_so(JSContext* ctx, const char* module_name)
{
#if defined(_WIN32)
    JS_ThrowReferenceError(ctx, "shared library modules are not supported yet");
    return NULL;
#else

    JSModuleDef* module;
    void* handle;
    tjs_module_init_func* init;
    char* filename;

    if (!strchr(module_name, '/')) {
        /* must add a '/' so that the DLL is not searched in the
           system library paths */
        filename = js_malloc(ctx, strlen(module_name) + 2 + 1);
        if (!filename) {
            return NULL;
        }

        strcpy(filename, "./");
        strcpy(filename + 2, module_name);

    } else {
        filename = (char*)module_name;
    }

    /* C module */
    handle = dlopen(filename, RTLD_NOW | RTLD_LOCAL);
    if (filename != module_name) {
        js_free(ctx, filename);
    }

    if (!handle) {
        JS_ThrowReferenceError(ctx, "could not load module filename '%s' as shared library", module_name);
        goto fail;
    }

    init = dlsym(handle, "js_init_module");
    if (!init) {
        JS_ThrowReferenceError(ctx, "could not load module filename '%s': js_init_module not found", module_name);
        goto fail;
    }

    module = init(ctx, module_name);
    if (!module) {
        JS_ThrowReferenceError(ctx, "could not load module filename '%s': initialization error", module_name);

    fail:
        if (handle) {
            dlclose(handle);
        }

        return NULL;
    }

    return module;

#endif /* !_WIN32 */
}

/**
 * @brief tjs 模块加载器
 * - path/to/module.so: so 二进制模块
 * - path/to/script.js: js/mjs/json 脚本文件
 * - @path/to/bytecode.js: 内置字节码模块
 *
 * @param ctx
 * @param module_name 模块名
 * @param opaque
 * @return
 */
JSModuleDef* tjs_module_loader(JSContext* ctx, const char* module_name, void* opaque)
{
    if (module_name[0] == '@') {
        // 内置字节码模块
        return tjs_module_load_bytecode(ctx, module_name);

    } else if (has_suffix(module_name, ".so")) {
        // so 二进制模块
        return tjs_module_load_so(ctx, module_name);

    } else if (has_suffix(module_name, ".js")) {
        return tjs_module_load_js(ctx, module_name, module_name);

    } else if (has_suffix(module_name, ".json")) {
        return tjs_module_load_js(ctx, module_name, module_name);

    } else if (has_suffix(module_name, ".mjs")) {
        return tjs_module_load_js(ctx, module_name, module_name);

    } else {
        // 外部 js/mjs/json 脚本文件
        char name[PATH_MAX];
        memset(name, 0, sizeof(name));
        strncat(name, module_name, PATH_MAX - 1);
        strncat(name, ".js", PATH_MAX - 1);
        return tjs_module_load_js(ctx, name, name);
    }
}

/**
 * 修正相对目录
 * @param base_name
 * @param name
 */
char* tjs_module_normalizer(JSContext* ctx, const char* base_name, const char* name, void* opaque)
{
    static char* internal_modules[] = {
        "@tjs/abort-controller",
        "@tjs/bootstrap",
        // "@tjs/console",
        // "@tjs/crypto",
        // "@tjs/encoding",
        // "@tjs/event-target", // for defineEventAttribute
        // "@tjs/form-data",
        "@tjs/native-bootstrap",
        // "@tjs/native", // for test
        "@tjs/navigator",
        "@tjs/performance",
        "@tjs/url",
        "@tjs/worker-bootstrap"
    };

    TJSRuntime* qrt = opaque;
    CHECK_NOT_NULL(qrt);

    // printf("normalize: %s %s\n", base_name, name);

    // 1. internal module
    if (!qrt->in_bootstrap && name[0] == '@') {
        /* check if it's an internal module, those cannot be imported */
        for (int i = 0; i < ARRAY_SIZE(internal_modules); i++) {
            if (strncmp(internal_modules[i], name, strlen(internal_modules[i])) == 0) {
                JS_ThrowReferenceError(ctx, "could not load '%s', it's an internal module", name);
                return NULL;
            }
        }
    }

    char *filename, *p;
    const char* r;
    int len;

    // 2. 非相对目录
    if (name[0] != '.') {
        /* if no initial dot, the module name is not modified */
        return js_strdup(ctx, name);
    }

    // 3. 分配缓存区
    p = strrchr(base_name, '/'); // TJS__PATHSEP);
    if (p) {
        len = p - base_name;
    } else {
        len = 0;
    }

    filename = js_malloc(ctx, len + strlen(name) + 1 + 1);
    if (!filename) {
        return NULL;
    }

    // 4. base name
    memcpy(filename, base_name, len);
    filename[len] = '\0';

    // 5. normalize
    /* we only normalize the leading '..' or '.' */
    r = name;
    for (;;) {
        if (r[0] == '.' && r[1] == '/') {
            r += 2;

        } else if (r[0] == '.' && r[1] == '.' && r[2] == '/') {
            /* remove the last path element of filename, except if "."
               or ".." */
            if (filename[0] == '\0') {
                break;
            }

            p = strrchr(filename, '/');
            if (!p) {
                p = filename;
            } else {
                p++;
            }

            if (!strcmp(p, ".") || !strcmp(p, "..")) {
                break;
            }

            if (p > filename) {
                p--;
            }

            *p = '\0';
            r += 3;

        } else {
            break;
        }
    }

    // 6. name
    if (filename[0] != '\0') {
        strcat(filename, "/");
    }

    strcat(filename, r);

#if 0 // defined(_WIN32)
    for (p = filename; *p; p++) {
        if (p[0] == '/')
            p[0] = '\\';
    }
    // printf("normalize: %s %s -> %s\n", base_name, name, filename);
#endif

    // printf("normalize: %s %s\n", name, filename);
    return filename;
}

/**
 * 设置 import 元数据
 * realpath() cannot be used with modules compiled with tjsc because the corresponding
 * module source code is not necessarily present
 * @param func_val
 * @param use_realpath
 * @param is_main
 */
int tjs_module_set_import_meta(JSContext* ctx, JSValueConst func_val, JS_BOOL use_realpath, JS_BOOL is_main)
{
    char buf[PATH_MAX + 16];
    int r;

    // module name
    CHECK_EQ(JS_VALUE_GET_TAG(func_val), JS_TAG_MODULE);
    JSModuleDef* module = JS_VALUE_GET_PTR(func_val);

    JSAtom module_name_atom = JS_GetModuleName(ctx, module);
    const char* module_name = JS_AtomToCString(ctx, module_name_atom);
    JS_FreeAtom(ctx, module_name_atom);
    if (!module_name) {
        return -1;
    }

#if 0
    fprintf(stdout, "XXX loaded module: %s\n", module_name);
#endif

    // url
    if (!strchr(module_name, ':')) {
        pstrcpy(buf, sizeof(buf), "file://");
        /*  */
        if (use_realpath) {
            uv_fs_t req;
            r = uv_fs_realpath(NULL, &req, module_name, NULL);
            if (r != 0) {
                uv_fs_req_cleanup(&req);
                JS_ThrowTypeError(ctx, "realpath failure");
                JS_FreeCString(ctx, module_name);
                return -1;
            }

            pstrcat(buf, sizeof(buf), req.ptr);
            uv_fs_req_cleanup(&req);

        } else {
            pstrcat(buf, sizeof(buf), module_name);
        }

    } else {
        // http://
        pstrcpy(buf, sizeof(buf), module_name);
    }

    JS_FreeCString(ctx, module_name);

    // meta
    JSValue meta_obj = JS_GetImportMeta(ctx, module);
    if (JS_IsException(meta_obj)) {
        return -1;
    }

    JS_DefinePropertyValueStr(ctx, meta_obj, "url", JS_NewString(ctx, buf), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, meta_obj, "main", JS_NewBool(ctx, is_main), JS_PROP_C_W_E);
    JS_FreeValue(ctx, meta_obj);
    return 0;
}
