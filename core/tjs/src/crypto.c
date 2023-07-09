// mbedtls headers
#include "mbedtls/cipher.h"
#include "mbedtls/ctr_drbg.h"
#include "mbedtls/debug.h"
#include "mbedtls/entropy.h"
#include "mbedtls/error.h"
#include "mbedtls/md.h"
#include "mbedtls/md5.h"

#include "mbedtls/pk.h"
#include "mbedtls/ripemd160.h"
#include "mbedtls/sha1.h"
#include "mbedtls/sha256.h"
#include "mbedtls/sha512.h"
#include "mbedtls/ssl.h"
#include "mbedtls/version.h"
#include "mbedtls/x509_crl.h"
#include "mbedtls/x509_csr.h"

#include "private.h"

static const mbedtls_md_info_t* tjs_crypto_md_info(JSContext* ctx, JSValueConst value)
{
    const mbedtls_md_info_t* md_info = NULL;
    if (JS_IsNumber(value)) {
        int type = TJS_ToInt32(ctx, value, -1);
        if (type > 0) {
            md_info = mbedtls_md_info_from_type(type);
        }

    } else {
        size_t typeSize;
        char* type = (char*)JS_ToCStringLen(ctx, &typeSize, value);
        if (type) {
            md_info = mbedtls_md_info_from_string(type);
            JS_FreeCString(ctx, type);
        }
    }

    return md_info;
}

static JSValue tjs_crypto_encrypt(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const mbedtls_cipher_info_t* cipher_info;
    mbedtls_cipher_context_t cipher_ctx;
    int ret = 0;

    unsigned char IV[16];
    unsigned char buffer[1024];
    unsigned char key[512];

    memset(IV, 0, sizeof(IV));
    memset(key, 0, sizeof(key));
    memset(buffer, 0, sizeof(buffer));
    mbedtls_cipher_init(&cipher_ctx);

    // AES-128-CBC AES-192-CBC AES-256-CBC
    // AES-128-CTR AES-192-CTR AES-256-CTR
    // AES-128-GCM AES-192-GCM AES-256-GCM
    cipher_info = mbedtls_cipher_info_from_string("");
    if (cipher_info == NULL) {
        return JS_EXCEPTION;
    }

    ret = mbedtls_cipher_setup(&cipher_ctx, cipher_info);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    int key_bitlen = (int)mbedtls_cipher_info_get_key_bitlen(cipher_info);
    ret = mbedtls_cipher_setkey(&cipher_ctx, key, key_bitlen, MBEDTLS_ENCRYPT);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    ret = mbedtls_cipher_set_iv(&cipher_ctx, IV, 16);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    ret = mbedtls_cipher_reset(&cipher_ctx);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    size_t ilen = 0;
    size_t olen = 0;
    size_t offset = 0;
    size_t total = 0;

    unsigned int block_size = mbedtls_cipher_get_block_size(&cipher_ctx);

    unsigned char output[1024];

    for (offset = 0; offset < total; offset += block_size) {
        ret = mbedtls_cipher_update(&cipher_ctx, buffer, ilen, output, &olen);
        if (ret != 0) {
            return JS_EXCEPTION;
        }
    }

    // The final block of data
    ret = mbedtls_cipher_finish(&cipher_ctx, output, &olen);
    if (ret != 0) {
        return JS_EXCEPTION;
    }

    return JS_NULL;
}

static JSValue tjs_crypto_decrypt(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    return JS_NULL;
}

static JSValue tjs_crypto_hmac(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue result = JS_NULL;
    tjs_buffer_t buffer = { 0 };
    tjs_buffer_t key = { 0 };

    if (argc < 3) {
        return result;
    }

    /* 1. init mbedtls_md_context_t structure */
    mbedtls_md_context_t md_ctx;
    mbedtls_md_init(&md_ctx);

    // payload
    buffer = TJS_ToArrayBuffer(ctx, argv[1]);
    if (JS_IsException(buffer.error)) {
        result = buffer.error;
        goto exit;
    }

    // key
    key = TJS_ToArrayBuffer(ctx, argv[2]);
    if (JS_IsException(key.error)) {
        result = key.error;
        goto exit;
    }

    // algorithm
    const mbedtls_md_info_t* md_info = tjs_crypto_md_info(ctx, argv[0]);
    if (md_info == NULL) {
        result = JS_ThrowTypeError(ctx, "invalid algorithm name");
        goto exit;
    }

    int ret = mbedtls_md_setup(&md_ctx, md_info, 1);
    if (ret != 0) {
        goto exit;
    }

    /* 4. start */
    ret = mbedtls_md_hmac_starts(&md_ctx, (unsigned char*)key.data, key.length);
    if (ret != 0) {
        goto exit;
    }

    /* 5. update */
    ret = mbedtls_md_hmac_update(&md_ctx, (const uint8_t*)buffer.data, buffer.length);
    if (ret != 0) {
        goto exit;
    }

    /* 6. finish */
    uint8_t* hmac = js_malloc(ctx, 64);
    ret = mbedtls_md_hmac_finish(&md_ctx, hmac);
    if (ret != 0) {
        js_free(ctx, hmac);
        goto exit;
    }

    int clen = mbedtls_md_get_size(md_info);
    result = TJS_NewArrayBuffer(ctx, hmac, clen);

exit:
    /* 7. free */
    mbedtls_md_free(&md_ctx);

    if (buffer.is_string) {
        JS_FreeCString(ctx, (char*)buffer.data);
    }

    if (key.is_string) {
        JS_FreeCString(ctx, (char*)key.data);
    }

    return result;
}

static JSValue tjs_crypto_sign(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    return JS_NULL;
}

static JSValue tjs_crypto_verify(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    return JS_NULL;
}

static JSValue tjs_crypto_digest(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue result = JS_NULL;
    if (argc < 2) {
        return result;
    }

    // payload
    tjs_buffer_t buffer = TJS_ToArrayBuffer(ctx, argv[1]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    // algorithm
    const mbedtls_md_info_t* md_info = tjs_crypto_md_info(ctx, argv[0]);
    if (md_info == NULL) {
        result = JS_ThrowTypeError(ctx, "invalid algorithm name");
        goto exit;
    }

    // md
    uint8_t* hash = js_malloc(ctx, 64);
    int ret = mbedtls_md(md_info, (const uint8_t*)buffer.data, buffer.length, hash);
    if (ret != 0) {
        js_free(ctx, hash);
        goto exit;
    }

    // output
    int clen = mbedtls_md_get_size(md_info);
    result = TJS_NewArrayBuffer(ctx, hash, clen);

exit:
    if (buffer.is_string) {
        JS_FreeCString(ctx, (char*)buffer.data);
    }

    return result;
}

static JSValue tjs_crypto_hashfile(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSValue result = JS_NULL;
    if (argc < 2) {
        return result;
    }

    mbedtls_md_context_t md_ctx;
    mbedtls_md_init(&md_ctx);

    size_t typeSize;
    char* filename = (char*)JS_ToCStringLen(ctx, &typeSize, argv[1]);
    if (filename == NULL) {
        goto exit;
    }

    // 打开文件
    FILE* file = fopen(filename, "rb");
    if (!file) {
        goto exit;
    }

    // algorithm
    const mbedtls_md_info_t* md_info = tjs_crypto_md_info(ctx, argv[0]);
    if (md_info == NULL) {
        result = JS_ThrowTypeError(ctx, "invalid algorithm name");
        goto exit;
    }

    if (mbedtls_md_setup(&md_ctx, md_info, 1) != 0) {
        result = JS_ThrowTypeError(ctx, "setup algorithm failed");
        goto exit;
    }

    mbedtls_md_starts(&md_ctx);

    // 逐块读取文件并更新上下文
    unsigned char buffer[1024];
    size_t bytes_read;
    while ((bytes_read = fread(buffer, 1, sizeof(buffer), file)) > 0) {
        mbedtls_md_update(&md_ctx, buffer, bytes_read);
    }

    // 计算哈希值
    uint8_t* hash = js_malloc(ctx, 64);
    mbedtls_md_finish(&md_ctx, hash);

    int hash_size = mbedtls_md_get_size(md_info);
    result = TJS_NewArrayBuffer(ctx, hash, hash_size);

exit:
    if (filename) {
        JS_FreeCString(ctx, filename);
    }

    if (file) {
        fclose(file);
        file = NULL;
    }

    mbedtls_md_free(&md_ctx);

    return result;
}

static const JSCFunctionListEntry tjs_crypto_funcs[] = {
    JS_PROP_INT32_DEF("MD_MD5", MBEDTLS_MD_MD5, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MD_SHA1", MBEDTLS_MD_SHA1, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MD_SHA224", MBEDTLS_MD_SHA224, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MD_SHA256", MBEDTLS_MD_SHA256, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MD_SHA384", MBEDTLS_MD_SHA384, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MD_SHA512", MBEDTLS_MD_SHA512, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    JS_PROP_INT32_DEF("MD_RIPEMD160", MBEDTLS_MD_RIPEMD160, JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE),
    TJS_CFUNC_DEF("decrypt", 2, tjs_crypto_decrypt),
    TJS_CFUNC_DEF("encrypt", 2, tjs_crypto_encrypt),
    TJS_CFUNC_DEF("digest", 2, tjs_crypto_digest),
    TJS_CFUNC_DEF("hmac", 2, tjs_crypto_hmac),
    TJS_CFUNC_DEF("hashfile", 2, tjs_crypto_hashfile),
    TJS_CFUNC_DEF("sign", 2, tjs_crypto_sign),
    TJS_CFUNC_DEF("verify", 2, tjs_crypto_verify)
};

void tjs_mod_crypto_init(JSContext* ctx, JSModuleDef* m)
{
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, obj, tjs_crypto_funcs, countof(tjs_crypto_funcs));
    JS_SetModuleExport(ctx, m, "crypto", obj);
}

void tjs_mod_crypto_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "crypto");
}
