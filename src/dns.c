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

#include "private.h"
#include "utils.h"

#include <string.h>

typedef struct tjs_dns_getaddrinfo_req_s {
    JSContext* ctx;
    uv_getaddrinfo_t req;
    TJSPromise result;
} TJSGetAddrInfoReq;

static JSValue tjs_addrinfo2obj(JSContext* ctx, struct addrinfo* ai)
{
    JSValue obj = JS_NewArray(ctx);

    struct addrinfo* ptr;
    int i = 0;
    for (ptr = ai; ptr; ptr = ptr->ai_next) {
        if (!ptr->ai_addrlen) {
            continue;
        }

        JSValue canonname = ptr->ai_canonname ? JS_NewString(ctx, ptr->ai_canonname) : JS_UNDEFINED;

        JSValue item = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, item, "address", tjs_addr2obj(ctx, ptr->ai_addr), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "socktype", JS_NewInt32(ctx, ptr->ai_socktype), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "protocol", JS_NewInt32(ctx, ptr->ai_protocol), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "canonname", canonname, JS_PROP_C_W_E);
        JS_DefinePropertyValueUint32(ctx, obj, i, item, JS_PROP_C_W_E);
        i++;
    }

    return obj;
}

static void tjs_obj2addrinfo(JSContext* ctx, JSValue obj, struct addrinfo* ai)
{
    JSValue family = JS_GetPropertyStr(ctx, obj, "family");
    if (!JS_IsUndefined(family)) {
        JS_ToInt32(ctx, &ai->ai_family, family);
    }
    JS_FreeValue(ctx, family);

    JSValue socktype = JS_GetPropertyStr(ctx, obj, "socktype");
    if (!JS_IsUndefined(socktype)) {
        JS_ToInt32(ctx, &ai->ai_socktype, socktype);
    }
    JS_FreeValue(ctx, socktype);

    JSValue protocol = JS_GetPropertyStr(ctx, obj, "protocol");
    if (!JS_IsUndefined(protocol)) {
        JS_ToInt32(ctx, &ai->ai_protocol, protocol);
    }
    JS_FreeValue(ctx, protocol);

    JSValue flags = JS_GetPropertyStr(ctx, obj, "flags");
    if (!JS_IsUndefined(flags)) {
        JS_ToInt32(ctx, &ai->ai_flags, flags);
    }
    JS_FreeValue(ctx, flags);
}

static void uv__getaddrinfo_cb(uv_getaddrinfo_t* req, int status, struct addrinfo* res)
{
    TJSGetAddrInfoReq* request = req->data;
    CHECK_NOT_NULL(request);

    JSContext* ctx = request->ctx;
    JSValue arg;
    bool is_reject = status != 0;

    if (status != 0) {
        arg = tjs_new_error(ctx, status);
    } else {
        arg = tjs_addrinfo2obj(ctx, res);
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);

    uv_freeaddrinfo(res);
    js_free(ctx, request);
}

static JSValue tjs_dns_getaddrinfo(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* service = NULL;
    const char* node = JS_ToCString(ctx, argv[0]);
    if (!node) {
        return JS_EXCEPTION;
    }

    TJSGetAddrInfoReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, node);
        return JS_EXCEPTION;
    }

    request->ctx = ctx;
    request->req.data = request;

    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));

    if (argc > 1) {
        JSValue opts = argv[1];
        if (JS_IsObject(opts)) {
            tjs_obj2addrinfo(ctx, opts, &hints);
            JSValue js_service = JS_GetPropertyStr(ctx, opts, "service");
            if (!JS_IsUndefined(js_service)) {
                service = JS_ToCString(ctx, js_service);
            }
            JS_FreeValue(ctx, js_service);
        }
    }

    int r = uv_getaddrinfo(tjs_get_loop(ctx), &request->req, uv__getaddrinfo_cb, node, service, &hints);
    JS_FreeCString(ctx, node);
    if (r != 0) {
        js_free(ctx, request);
        return tjs_throw_errno(ctx, r);
    }

    return TJS_InitPromise(ctx, &request->result);
}

static const JSCFunctionListEntry tjs_dns_funcs[] = {
    TJS_CFUNC_DEF("getaddrinfo", 2, tjs_dns_getaddrinfo),
#ifdef AI_PASSIVE
    TJS_CONST(AI_PASSIVE),
#endif
#ifdef AI_CANONNAME
    TJS_CONST(AI_CANONNAME),
#endif
#ifdef AI_NUMERICHOST
    TJS_CONST(AI_NUMERICHOST),
#endif
#ifdef AI_V4MAPPED
    TJS_CONST(AI_V4MAPPED),
#endif
#ifdef AI_ALL
    TJS_CONST(AI_ALL),
#endif
#ifdef AI_ADDRCONFIG
    TJS_CONST(AI_ADDRCONFIG),
#endif
#ifdef AI_NUMERICSERV
    TJS_CONST(AI_NUMERICSERV),
#endif
};

void tjs_mod_dns_init(JSContext* ctx, JSModuleDef* m)
{
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, obj, tjs_dns_funcs, countof(tjs_dns_funcs));
    JS_SetModuleExport(ctx, m, "dns", obj);
}

void tjs_mod_dns_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "dns");
}
