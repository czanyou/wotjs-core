#include "private.h"
#include "utils.h"
#include "version.h"

#include "util/md5.h"
#include "util/sha1.h"

#include <unistd.h>

enum tjs_util_type_enum {
    HASH_MD5 = 1,
    HASH_SHA1 = 2,
    CODE_HEX = 10,
    CODE_BASE64 = 11,
    ENCODING_UTF8 = 100,
    ENCODING_GBK = 101
};

extern int lutils_hex_decode(uint8_t* buffer, size_t bufferSize, const void* data, size_t dataSize);
extern int lutils_hex_encode(char* buffer, size_t bufferSize, const void* data, size_t dataSize);

extern int lutils_base64_encode(unsigned char* dst, size_t dlen, size_t* olen,
    const unsigned char* src, size_t slen);
extern int lutils_base64_decode(unsigned char* dst, size_t dlen, size_t* olen,
    const unsigned char* src, size_t slen);

static JSValue tjs_util_test(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int32_t value1 = tjs_to_int32(ctx, argv[0], -1);
    printf("tjs_util_test 1: %d\r\n", value1);

    uint32_t value2 = tjs_to_uint32(ctx, argv[0], -1);
    printf("tjs_util_test 2: %u\r\n", value2);

    int32_t value3 = tjs_object_get_int32(ctx, argv[1], "name", -1);
    printf("tjs_util_test 3: %d\r\n", value3);

    //int64_t value4 = tjs_to_int64(ctx, argv[0], -1);
    //printf("tjs_util_test 4: %d\r\n", value4);

    //JS_ToInt64(ctx, &value4, argv[0]);
    //printf("tjs_util_test 5: %d\r\n", value4);

    return JS_UNDEFINED;
}

static JSValue tjs_util_hash(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue jsPayloadData = argv[0];
    size_t payloadSize;
    uint8_t* payload;

    payload = JS_GetArrayBuffer(ctx, &payloadSize, jsPayloadData);
    if (payload == NULL) {
        size_t aoffset, asize;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsPayloadData, &aoffset, &asize, NULL);
        if (JS_IsException(abuf)) {
            return abuf;
        }

        payload = JS_GetArrayBuffer(ctx, &payloadSize, abuf);
        JS_FreeValue(ctx, abuf);
        if (!payload) {
            return JS_EXCEPTION;
        }

        payload += aoffset;
        payloadSize = asize;
    }

    int32_t type = -1;
    if (argc > 1) {
        type = tjs_to_int32(ctx, argv[1], -1);
    }

    if (type == HASH_SHA1) {
        char* buffer = js_malloc(ctx, 22);
        SHA1(buffer, payload, payloadSize);
        return TJS_NewUint8Array(ctx, buffer, 20);

    } else {
        char* buffer = js_malloc(ctx, MD5_HASHSIZE);
        md5(payload, payloadSize, buffer);
        return TJS_NewUint8Array(ctx, buffer, MD5_HASHSIZE);
    }
}

static JSValue tjs_util_text_decode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    tjs_buffer_t buffer = tjs_to_buffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    int32_t type = ENCODING_UTF8;
    if (argc > 1) {
        type = tjs_to_int32(ctx, argv[1], -1);
    }

    JSValue ret = JS_UNDEFINED;
    if (type == ENCODING_UTF8) {
        ret = JS_NewStringLen(ctx, buffer.data, buffer.length);

    } else {
        ret = JS_NewStringLen(ctx, buffer.data, buffer.length);
    }

    return ret;
}

static JSValue tjs_util_text_encode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "expected 1 arguments, but got %d.", argc);
        return JS_EXCEPTION;
    }

    size_t dataSize = 0;
    const char* data = JS_ToCStringLen(ctx, &dataSize, argv[0]);
    if (!data) {
        return JS_EXCEPTION;
    }

    int32_t type = ENCODING_UTF8;
    if (argc > 1) {
        type = tjs_to_int32(ctx, argv[1], -1);
    }

    uint8_t* buffer = NULL;

    if (type == ENCODING_UTF8) {
        if (dataSize > 0) {
            buffer = js_malloc(ctx, dataSize);
            memcpy(buffer, data, dataSize);
        }

        JS_FreeCString(ctx, data);
        return TJS_NewUint8Array(ctx, buffer, dataSize);

    } else {
        if (dataSize > 0) {
            buffer = js_malloc(ctx, dataSize);
            memcpy(buffer, data, dataSize);
        }

        JS_FreeCString(ctx, data);
        return TJS_NewUint8Array(ctx, buffer, dataSize);
    }
}

static JSValue tjs_util_encode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
#if 1
    size_t payloadSize;
    JSValue jsPayloadData = argv[0];
    uint8_t* payload;

    payload = JS_GetArrayBuffer(ctx, &payloadSize, jsPayloadData);
    if (payload == NULL) {
        size_t offset, size;
        JSValue arrayBuffer = JS_GetTypedArrayBuffer(ctx, jsPayloadData, &offset, &size, NULL);
        if (JS_IsException(arrayBuffer)) {
            return arrayBuffer;
        }

        payload = JS_GetArrayBuffer(ctx, &payloadSize, arrayBuffer);
        JS_FreeValue(ctx, arrayBuffer);
        if (!payload) {
            return JS_EXCEPTION;
        }

        payload += offset;
        payloadSize = size;
    }
#endif

    int32_t type = CODE_HEX;
    if (argc > 1) {
        type = tjs_to_int32(ctx, argv[1], -1);
    }

    JSValue ret = JS_UNDEFINED;

#if 1
    if (type == CODE_HEX) {
        size_t bufferSize = payloadSize * 2 + 2;
        char* buffer = js_malloc(ctx, bufferSize);

        lutils_hex_encode(buffer, bufferSize, payload, payloadSize);
        ret = JS_NewStringLen(ctx, buffer, payloadSize * 2);
        js_free(ctx, buffer);
        

    } else if (type == CODE_BASE64) {
        size_t bufferSize = payloadSize * 2;
        char* buffer = js_malloc(ctx, bufferSize);

        size_t olen = 0;
        lutils_base64_encode(buffer, bufferSize, &olen, payload, payloadSize);
        ret = JS_NewStringLen(ctx, buffer, olen);
        js_free(ctx, buffer);

    } else {
        ret = JS_NewStringLen(ctx, payload, payloadSize);
    }

#endif
    return ret;
}

static JSValue tjs_util_decode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    size_t dataSize = 0;
    const char* data = JS_ToCStringLen(ctx, &dataSize, argv[0]);
    if (!data) {
        return JS_EXCEPTION;
    }

    int32_t type = CODE_HEX;
    if (argc > 1) {
        type = tjs_to_int32(ctx, argv[1], -1);
    }

    if (type == CODE_HEX) {
        size_t bufferSize = dataSize / 2 + 2;
        char* buffer = js_malloc(ctx, bufferSize);
        int status = lutils_hex_decode(buffer, bufferSize, data, dataSize);
        JS_FreeCString(ctx, data);

        if (status < 0) {
            js_free(ctx, buffer);
            return JS_UNDEFINED;
        }

        return TJS_NewUint8Array(ctx, buffer, status);

    } else if (type == CODE_BASE64) {
        size_t bufferSize = dataSize;
        char* buffer = js_malloc(ctx, dataSize);
        // memcpy(buffer, data, dataSize);
        size_t olen = 0;
        lutils_base64_decode(buffer, bufferSize, &olen, data, dataSize);
        JS_FreeCString(ctx, data);

        return TJS_NewUint8Array(ctx, buffer, olen);

    } else {
        char* buffer = js_malloc(ctx, dataSize);
        memcpy(buffer, data, dataSize);
        JS_FreeCString(ctx, data);

        return TJS_NewUint8Array(ctx, buffer, dataSize);
    }
}

static const JSCFunctionListEntry tjs_util_funcs[] = {
    TJS_CONST(HASH_MD5),
    TJS_CONST(HASH_SHA1),
    TJS_CONST(CODE_HEX),
    TJS_CONST(CODE_BASE64),
    TJS_CONST(ENCODING_UTF8),

    TJS_CFUNC_DEF("test", 2, tjs_util_test),
    TJS_CFUNC_DEF("hash", 2, tjs_util_hash),
    TJS_CFUNC_DEF("decode", 2, tjs_util_decode),
    TJS_CFUNC_DEF("encode", 2, tjs_util_encode),
    TJS_CFUNC_DEF("textDecode", 2, tjs_util_text_decode),
    TJS_CFUNC_DEF("textEncode", 2, tjs_util_text_encode)
};

void tjs_mod_util_init(JSContext* ctx, JSModuleDef* m)
{
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, obj, tjs_util_funcs, countof(tjs_util_funcs));
    JS_SetModuleExport(ctx, m, "util", obj);
}

void tjs_mod_util_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "util");
}
