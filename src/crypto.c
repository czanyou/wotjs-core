// mbedtls headers
#include <mbedtls/certs.h>

#include "mbedtls/cipher.h"
#include "mbedtls/ctr_drbg.h"
#include "mbedtls/debug.h"
#include "mbedtls/entropy.h"
#include "mbedtls/error.h"
#include "mbedtls/md.h"
#include "mbedtls/md5.h"
#include "mbedtls/net.h"
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

static JSValue tjs_crypto_encrypt(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const mbedtls_cipher_info_t* cipher_info;
    const mbedtls_md_info_t* md_info;
    mbedtls_cipher_context_t cipher_ctx;
    mbedtls_md_context_t md_ctx;
    int ret = 0;

    unsigned char IV[16];
    unsigned char tmp[16];
    unsigned char digest[64];
    unsigned char buffer[1024];
    unsigned char key[512];

    memset(IV, 0, sizeof(IV));
    memset(key, 0, sizeof(key));
    memset(digest, 0, sizeof(digest));
    memset(buffer, 0, sizeof(buffer));
    mbedtls_cipher_init(&cipher_ctx);

    cipher_info = mbedtls_cipher_info_from_string("");
    if (md_info == NULL) {
        return JS_EXCEPTION;
    }

    if ((ret = mbedtls_cipher_setup(&cipher_ctx, cipher_info)) != 0) {
        return JS_EXCEPTION;
    }
}

static JSValue tjs_crypto_decrypt(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
}

static JSValue tjs_crypto_hmac(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
}

static JSValue tjs_crypto_sign(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
}

static JSValue tjs_crypto_verify(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
}

static JSValue tjs_crypto_digest(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        JS_ThrowTypeError(ctx, "invalid parameters");
        return JS_EXCEPTION;
    }

    // payload
    JSValue jsData = argv[1];
    bool isString = false;
    size_t size;
    uint8_t* buffer;

    if (JS_IsString(jsData)) {
        isString = true;
        buffer = (uint8_t*)JS_ToCStringLen(ctx, &size, jsData);
        if (!buffer) {
            JS_ThrowTypeError(ctx, "invalid data");
            return JS_EXCEPTION;
        }

    } else {
        buffer = JS_GetArrayBuffer(ctx, &size, jsData);
        if (buffer == NULL) {
            size_t aoffset, asize;
            JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
            if (JS_IsException(abuf)) {
                return abuf;
            }

            buffer = JS_GetArrayBuffer(ctx, &size, abuf);
            JS_FreeValue(ctx, abuf);
            if (!buffer) {
                JS_ThrowTypeError(ctx, "invalid data");
                return JS_EXCEPTION;
            }

            buffer += aoffset;
            size = asize;
        }
    }

    uint8_t* hash = js_malloc(ctx, 64);
    const mbedtls_md_info_t* md_info = mbedtls_md_info_from_type(MBEDTLS_MD_MD5);

    if (argc > 0) {
        if (JS_IsNumber(argv[0])) {
            int type = tjs_to_int32(ctx, argv[0], -1);
            if (type > 0) {
                md_info = mbedtls_md_info_from_type(type);
            }

        } else {
            size_t typeSize;
            char* type = (char*)JS_ToCStringLen(ctx, &typeSize, argv[0]);
            if (type) {
                md_info = mbedtls_md_info_from_string(type);
                JS_FreeCString(ctx, type);
            }
        }

        if (md_info == NULL) {
            JS_ThrowTypeError(ctx, "invalid algorithm name");
            return JS_EXCEPTION;
        }
    }

    int ret = mbedtls_md(md_info, buffer, size, hash);
    if (isString) {
        JS_FreeCString(ctx, buffer);
    }

    if (ret != 0) {
        JS_ThrowTypeError(ctx, "invalid algorithm");
        return JS_EXCEPTION;
    }

    int clen = mbedtls_md_get_size(md_info);

    JSValue value = TJS_NewArrayBuffer(ctx, hash, clen);
    return value;
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
