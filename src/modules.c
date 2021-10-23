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
#include "utils.h"

#include <string.h>

#if defined(__linux__) || defined(__linux)
#include <dlfcn.h>
#endif

#ifdef CONFIG_TJS_APPJS
const uint8_t* tjs_app_get_module(const char* name, uint32_t* psize);

int tjs__eval_module(JSContext* ctx, const char* name)
{
    if (name == NULL) {
        return -1;
    }

    uint32_t buf_len = 0;
    const uint8_t* buf = tjs_app_get_module(name, &buf_len);
    if (buf == NULL || buf_len <= 0) {
        printf("Error: could not load '%s'\r\n", name);
        return -1;
    }

    JSValue obj = JS_ReadObject(ctx, buf, buf_len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(obj)) {
        goto error;
    }

    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, obj) < 0) {
            JS_FreeValue(ctx, obj);
            goto error;
        }

        js_module_set_import_meta(ctx, obj, FALSE, FALSE);
    }

    JSValue val = JS_EvalFunction(ctx, obj);
    if (JS_IsException(val)) {
        goto error;
    }

    JS_FreeValue(ctx, val);

    return 0;

error:
    tjs_dump_error(ctx);
    return -1;
}

JSModuleDef* tjs_app_js_module_loader(JSContext* ctx, const char* name)
{
    JSModuleDef* module = NULL;
    // printf("tjs_app_js_module_loader: %s\r\n", name);

    uint32_t buf_len = 0;
    const uint8_t* buf = tjs_app_get_module(name, &buf_len);
    if (buf == NULL) {
        return NULL;
    }

    JSValue obj = JS_ReadObject(ctx, buf, buf_len, JS_READ_OBJ_BYTECODE);
    if (JS_IsException(obj)) {
        goto error;
    }

    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
        if (JS_ResolveModule(ctx, obj) < 0) {
            JS_FreeValue(ctx, obj);
            goto error;
        }

        js_module_set_import_meta(ctx, obj, FALSE, FALSE);
    }

    module = JS_VALUE_GET_PTR(obj);
    JS_FreeValue(ctx, obj);

error:
    return module;
}

#endif

#ifdef TJS_HAVE_CURL

JSModuleDef* tjs__load_http(JSContext* ctx, const char* url)
{
    JSModuleDef* module;
    DynBuf dbuf;

    dbuf_init(&dbuf);

    int r = tjs_curl_load_http(&dbuf, url);
    if (r != 200) {
        module = NULL;
        JS_ThrowReferenceError(ctx, "could not load '%s' code: %d", url, r);
        goto end;
    }

    /* compile the module */
    JSValue func_val = JS_Eval(ctx, (char*)dbuf.buf, dbuf.size - 1, url, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(func_val)) {
        JS_FreeValue(ctx, func_val);
        module = NULL;
        goto end;
    }

    /* XXX: could propagate the exception */
    js_module_set_import_meta(ctx, func_val, FALSE, FALSE);
    /* the module is already referenced, so we must free it */
    module = JS_VALUE_GET_PTR(func_val);
    JS_FreeValue(ctx, func_val);

end:
    /* free the memory we allocated */
    dbuf_free(&dbuf);

    return module;
}

#endif

#if defined(_WIN32)
static JSModuleDef* tjs_so_module_loader(JSContext* ctx, const char* module_name)
{
    JS_ThrowReferenceError(ctx, "shared library modules are not supported yet");
    return NULL;
}
#else

typedef JSModuleDef*(JSInitModuleFunc)(JSContext* ctx, const char* module_name);

static JSModuleDef* tjs_so_module_loader(JSContext* ctx, const char* module_name)
{
    JSModuleDef* module;
    void* handle;
    JSInitModuleFunc* init;
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
}
#endif /* !_WIN32 */

static JSModuleDef* tjs_js_module_loader(JSContext* ctx, const char* filename, const char* module_name)
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

    r = tjs__load_file(ctx, &dbuf, filename);
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
    js_module_set_import_meta(ctx, function, TRUE, FALSE);
    /* the module is already referenced, so we must free it */
    module = JS_VALUE_GET_PTR(function);
    JS_FreeValue(ctx, function);

    return module;
}

static JSModuleDef* tjs_app_module_loader(JSContext* ctx, const char* module_name)
{
    JSModuleDef* module = NULL;
    char filename[PATH_MAX];
    size_t size = PATH_MAX;
    uv_exepath(filename, &size);

    char* p = strrchr(filename, '/');
    if (!p) {
        p = filename + size;
    }

    strncpy(p, module_name, PATH_MAX - size);
    *p = '/';

    if (has_suffix(filename, ".so")) {
        return tjs_so_module_loader(ctx, filename);
    }

    // printf("tjs_app_module_loader: %s (%s)\r\n", module_name, filename);
    module = tjs_js_module_loader(ctx, filename, module_name);

#ifdef CONFIG_TJS_APPJS
    if (module == NULL) {
        module = tjs_app_js_module_loader(ctx, module_name);
    }
#endif

    return module;
}

JSModuleDef* tjs_module_loader(JSContext* ctx, const char* module_name, void* opaque)
{
    if (module_name[0] == '@') {
        return tjs_app_module_loader(ctx, module_name);

    } else if (has_suffix(module_name, ".so")) {
        return tjs_so_module_loader(ctx, module_name);

    } else {
        return tjs_js_module_loader(ctx, module_name, module_name);
    }
}

int js_module_set_import_meta(JSContext* ctx, JSValueConst func_val, JS_BOOL use_realpath, JS_BOOL is_main)
{
    JSModuleDef* module;
    char buf[PATH_MAX + 16];
    int r;
    JSValue meta_obj;
    JSAtom module_name_atom;
    const char* module_name;

    CHECK_EQ(JS_VALUE_GET_TAG(func_val), JS_TAG_MODULE);
    module = JS_VALUE_GET_PTR(func_val);

    module_name_atom = JS_GetModuleName(ctx, module);
    module_name = JS_AtomToCString(ctx, module_name_atom);
    
#if 0
    fprintf(stdout, "XXX loaded module: %s\n", module_name);
#endif

    JS_FreeAtom(ctx, module_name_atom);
    if (!module_name) {
        return -1;
    }

    if (!strchr(module_name, ':')) {
        pstrcpy(buf, sizeof(buf), "file://");
        /* realpath() cannot be used with modules compiled with tjsc
           because the corresponding module source code is not
           necessarily present */
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
        pstrcpy(buf, sizeof(buf), module_name);
    }

    JS_FreeCString(ctx, module_name);

    meta_obj = JS_GetImportMeta(ctx, module);
    if (JS_IsException(meta_obj)) {
        return -1;
    }

    JS_DefinePropertyValueStr(ctx, meta_obj, "url", JS_NewString(ctx, buf), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, meta_obj, "main", JS_NewBool(ctx, is_main), JS_PROP_C_W_E);
    JS_FreeValue(ctx, meta_obj);
    return 0;
}

#if defined(_WIN32)
#define TJS__PATHSEP '\\'
#define TJS__PATHSEPS "\\"
#else
#define TJS__PATHSEP '/'
#define TJS__PATHSEPS "/"
#endif

char* tjs_module_normalizer(JSContext* ctx, const char* base_name, const char* name, void* opaque)
{
    static char* internal_modules[] = {
        "@tjs/abort-controller",
        "@tjs/bootstrap",
        "@tjs/console",
        "@tjs/crypto",
        "@tjs/encoding",
        "@tjs/event-target",
        "@tjs/form-data",
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

    if (name[0] != '.') {
        /* if no initial dot, the module name is not modified */
        return js_strdup(ctx, name);
    }

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

    memcpy(filename, base_name, len);
    filename[len] = '\0';

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

#undef TJS__PATHSEP
