#include "private.h"
#include "tjs-utils.h"
#include "version.h"

#include "digest/md5.h"
#include "digest/sha1.h"

#include <unistd.h>

enum tjs_util_type_enum {
    HASH_MD5 = 1,
    HASH_SHA1 = 2,
    CODE_HEX = 10,
    CODE_BASE64 = 11
};

extern int utils_hex_decode(uint8_t* buffer, size_t bufferSize, const void* data, size_t data_size);
extern int utils_hex_encode(char* buffer, size_t bufferSize, const void* data, size_t data_size);

extern int utils_base64_encode(unsigned char* dst, size_t dlen, size_t* olen,
    const unsigned char* src, size_t slen);
extern int utils_base64_decode(unsigned char* dst, size_t dlen, size_t* olen,
    const unsigned char* src, size_t slen);


#ifdef BUILD_APP_JS
const uint8_t* tjs_get_app_module_data(const char* name, uint32_t* psize);
const char* tjs_get_app_module_name(int index);
#endif

const char* tjs_get_tjs_module_name(int index);

static JSValue tjs_util_test(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    return JS_UNDEFINED;
}

static JSValue tjs_util_hash(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    tjs_buffer_t buffer = TJS_GetArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    int32_t type = -1;
    if (argc > 1) {
        type = TJS_ToInt32(ctx, argv[1], -1);
    }

    if (type == HASH_SHA1) {
        char* result = js_malloc(ctx, 22);
        SHA1(result, (char*)buffer.data, buffer.length);
        return TJS_NewUint8Array(ctx, (uint8_t*)result, 20);

    } else {
        char* result = js_malloc(ctx, MD5_HASHSIZE);
        md5((char*)buffer.data, buffer.length, result);
        return TJS_NewUint8Array(ctx, (uint8_t*)result, MD5_HASHSIZE);
    }
}

static JSValue tjs_utf8_decode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    tjs_buffer_t buffer = TJS_GetArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return JS_ThrowTypeError(ctx, "The provided value is not of type '(ArrayBuffer or ArrayBufferView)'");
    }

    return JS_NewStringLen(ctx, buffer.data, buffer.length);
}

static JSValue tjs_utf8_encode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uint8_t* buffer = NULL;
    size_t data_length = 0;

    if (argc > 0) {
        const char* data = JS_ToCStringLen(ctx, &data_length, argv[0]);
        if (!data) {
            return JS_EXCEPTION;
        }

        if (data_length > 0) {
            buffer = js_malloc(ctx, data_length);
            memcpy(buffer, data, data_length);
        }

        JS_FreeCString(ctx, data);
    }

    return TJS_NewUint8Array(ctx, buffer, data_length);
}

static JSValue tjs_read_app_file(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc <= 0) {
        return JS_UNDEFINED;
    }

    size_t name_length = 0;
    const char* name = JS_ToCStringLen(ctx, &name_length, argv[0]);
    if (!name) {
        return JS_UNDEFINED;
    }

#ifdef BUILD_APP_JS
    uint32_t data_length = 0;
    const uint8_t* data = tjs_get_app_module_data(name, &data_length);
    JS_FreeCString(ctx, name);

    if (data == NULL || data_length == 0) {
        return JS_UNDEFINED;
    }

    uint8_t* buffer = js_malloc(ctx, data_length);
    memcpy(buffer, data, data_length);
    return TJS_NewArrayBuffer(ctx, buffer, data_length);

#else
    return JS_UNDEFINED;
#endif
}

static JSValue tjs_get_core_module_names(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue array = JS_NewArray(ctx);

    int position = 0;
    int index = 0;
    while (true) {
        const char* name = tjs_get_tjs_module_name(index++);
        if (name == NULL) {
            break;
        }
       
        JS_DefinePropertyValueUint32(ctx, array, position++, JS_NewString(ctx, name), JS_PROP_C_W_E);
    }

    return array;
}

static JSValue tjs_get_app_module_names(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue array = JS_NewArray(ctx);

#ifdef BUILD_APP_JS
    int position = 0;
    int index = 0;
    while (true) {
        const char* name = tjs_get_app_module_name(index++);
        if (name == NULL) {
            break;
        }
       
        JS_DefinePropertyValueUint32(ctx, array, position++, JS_NewString(ctx, name), JS_PROP_C_W_E);
    }
#endif

    return array;
}

static JSValue tjs_util_encode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    tjs_buffer_t buffer = TJS_GetArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    int32_t type = CODE_HEX;
    if (argc > 1) {
        type = TJS_ToInt32(ctx, argv[1], -1);
    }

    JSValue ret = JS_UNDEFINED;

#if 1
    if (type == CODE_HEX) {
        size_t bufferSize = buffer.length * 2 + 2;
        char* result = js_malloc(ctx, bufferSize);

        utils_hex_encode(result, bufferSize, buffer.data, buffer.length);
        ret = JS_NewStringLen(ctx, result, buffer.length * 2);
        js_free(ctx, result);

    } else if (type == CODE_BASE64) {
        size_t bufferSize = buffer.length * 2;
        char* result = js_malloc(ctx, bufferSize);

        size_t olen = 0;
        utils_base64_encode((uint8_t*)result, bufferSize, &olen, buffer.data, buffer.length);
        ret = JS_NewStringLen(ctx, result, olen);
        js_free(ctx, result);

    } else {
        ret = JS_NewStringLen(ctx, buffer.data, buffer.length);
    }

#endif
    return ret;
}

static JSValue tjs_util_decode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    size_t data_size = 0;
    const char* data = JS_ToCStringLen(ctx, &data_size, argv[0]);
    if (!data) {
        return JS_EXCEPTION;
    }

    int32_t type = CODE_HEX;
    if (argc > 1) {
        type = TJS_ToInt32(ctx, argv[1], -1);
    }

    if (type == CODE_HEX) {
        size_t bufferSize = data_size / 2 + 2;
        uint8_t* buffer = js_malloc(ctx, bufferSize);
        int status = utils_hex_decode(buffer, bufferSize, data, data_size);
        JS_FreeCString(ctx, data);

        if (status < 0) {
            js_free(ctx, buffer);
            return JS_UNDEFINED;
        }

        return TJS_NewUint8Array(ctx, buffer, status);

    } else if (type == CODE_BASE64) {
        size_t bufferSize = data_size;
        char* buffer = js_malloc(ctx, data_size);
        // memcpy(buffer, data, data_size);
        size_t olen = 0;
        utils_base64_decode(buffer, bufferSize, &olen, data, data_size);
        JS_FreeCString(ctx, data);

        return TJS_NewUint8Array(ctx, (uint8_t*)buffer, olen);

    } else {
        uint8_t* buffer = js_malloc(ctx, data_size);
        memcpy(buffer, data, data_size);
        JS_FreeCString(ctx, data);

        return TJS_NewUint8Array(ctx, buffer, data_size);
    }
}

static const JSCFunctionListEntry tjs_util_funcs[] = {
    TJS_CONST(HASH_MD5),
    TJS_CONST(HASH_SHA1),
    TJS_CONST(CODE_HEX),
    TJS_CONST(CODE_BASE64),

    TJS_CFUNC_DEF("test", 2, tjs_util_test),
    TJS_CFUNC_DEF("hash", 2, tjs_util_hash),
    TJS_CFUNC_DEF("asset", 1, tjs_read_app_file),
    TJS_CFUNC_DEF("modules", 0, tjs_get_core_module_names),
    TJS_CFUNC_DEF("applications", 0, tjs_get_app_module_names),
    TJS_CFUNC_DEF("decode", 2, tjs_util_decode),
    TJS_CFUNC_DEF("encode", 2, tjs_util_encode),
    TJS_CFUNC_DEF("toString", 2, tjs_utf8_decode),
    TJS_CFUNC_DEF("toBuffer", 2, tjs_utf8_encode)
};

static const JSCFunctionListEntry tjs_utf8_funcs[] = {
    TJS_CFUNC_DEF("decode", 2, tjs_utf8_decode),
    TJS_CFUNC_DEF("encode", 2, tjs_utf8_encode)
};

void tjs_mod_util_init(JSContext* ctx, JSModuleDef* m)
{
    TJS_ExportModuleObject(ctx, m, "util", tjs_util_funcs);
    TJS_ExportModuleObject(ctx, m, "utf8", tjs_utf8_funcs);
}

void tjs_mod_util_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "util");
    JS_AddModuleExport(ctx, m, "utf8");
}
