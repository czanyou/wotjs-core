/*
 ijjs javascript runtime engine
 Copyright (C) 2010-2017 Trix

 This software is provided 'as-is', without any express or implied
 warranty.  In no event will the authors be held liable for any damages
 arising from the use of this software.

 Permission is granted to anyone to use this software for any purpose,
 including commercial applications, and to alter it and redistribute it
 freely, subject to the following restrictions:

 1. The origin of this software must not be misrepresented; you must not
 claim that you wrote the original software. If you use this software
 in a product, an acknowledgment in the product documentation would be
 appreciated but is not required.
 2. Altered source versions must be plainly marked as such, and must not be
 misrepresented as being the original software.
 3. This notice may not be removed or altered from any source distribution.
 */
#include "tjs-utils.h"
#include "adapters/libuv.h"

#include "hiredis.h"
#include <unistd.h>
#include <uv.h>

#ifdef _WIN32
int main(int argc, char** argv) { }
#endif

#define RD_STRING 1
#define RD_ARRAY 2
#define RD_NUMERIC 3
#define RD_NIL 4
#define RD_STATUS 5
#define RD_ERROR 6

////////////////////////////////////////////////////////////////////////////////////
// Redis context

typedef struct redisjs_context_t {
    redisAsyncContext* context;
    JSContext* ctx;
    TJSPromise promise;
} redisjs_context_t;

static redisjs_context_t redis_context;

////////////////////////////////////////////////////////////////////////////////////
// Redis

static JSClassID redisjs_class_id;

static void redisjs_finalizer(JSRuntime* rt, JSValue val)
{
}

static JSClassDef redisjs_class = { "Redis", .finalizer = redisjs_finalizer };

////////////////////////////////////////////////////////////////////////////////////
// Redis result

static JSClassID redisjs_result_class_id;
typedef struct redisjs_result_t {
    JSContext* ctx;
    TJSPromise promise;
} redisjs_result_t;

static void redisjs_result_finalizer(JSRuntime* rt, JSValue val)
{
    redisjs_result_t* result = JS_GetOpaque(val, redisjs_result_class_id);
    js_free_rt(rt, result);
}

static JSClassDef redisjs_result_class = { "RedisResult", .finalizer = redisjs_result_finalizer };

////////////////////////////////////////////////////////////////////////////////////
// Redis connect

void redisjs_connect_callback(const redisAsyncContext* context, int status)
{
    JSContext* ctx = redis_context.ctx;

    JSValue arg;
    bool is_reject = false;
    if (status != REDIS_OK) {
        arg = JS_NewError(ctx);
        JS_DefinePropertyValueStr(ctx, arg, "message", JS_NewString(ctx, "redis error"), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, arg, "errno", JS_NewInt32(ctx, status), JS_PROP_C_W_E);
        is_reject = true;

    } else {
        arg = JS_UNDEFINED;
    }

    TJS_SettlePromise(ctx, &redis_context.promise, is_reject, 1, (JSValueConst*)&arg);
}

void redisjs_disconnect_callback(const redisAsyncContext* context, int status)
{
    if (status != REDIS_OK) {
        printf("disconnect because of error: %s\n", context->errstr);
        return;
    }

    printf("Disconnected...\n");
}

static JSValue redisjs_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int port = 6379;
    if (argc > 1) {
        if (JS_ToInt32(ctx, &port, argv[1])) {
            return JS_EXCEPTION;
        }
    }

    const char* address = NULL;
    if (argc > 0) {
        address = JS_ToCString(ctx, argv[0]);
        if (!address) {
            return JS_EXCEPTION;
        }
    }

    const char* host = address;
    if (!host) {
        host = "127.0.0.1";
    }

    // printf("connect: %s:%d\r\n", host, port);
    redis_context.context = redisAsyncConnect(host, port);
    JS_FreeCString(ctx, address);

    redisLibuvAttach(redis_context.context, TJS_GetLoop(ctx));
    redisAsyncSetConnectCallback(redis_context.context, redisjs_connect_callback);
    redisAsyncSetDisconnectCallback(redis_context.context, redisjs_disconnect_callback);
    // redisAsyncSetTimeout(redis_context.context, (struct timeval) { .tv_sec = 1, .tv_usec = 0 });

    redis_context.ctx = ctx;
    return TJS_InitPromise(ctx, &redis_context.promise);
}

static JSValue redisjs_disconnect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    redis_context.ctx = ctx;
    redisAsyncDisconnect(redis_context.context);
    return JS_UNDEFINED;
}

static JSValue redisjs_create_value(JSContext* ctx, redisReply* reply)
{
    JSValue obj;
    obj = JS_NewObjectClass(ctx, redisjs_result_class_id);
    JS_DefinePropertyValueStr(ctx, obj, "type", JS_NewInt32(ctx, reply->type), JS_PROP_C_W_E);

    // value
    switch (reply->type) {
    case REDIS_REPLY_ERROR:
        JS_DefinePropertyValueStr(ctx, obj, "error", JS_NewString(ctx, reply->str), JS_PROP_C_W_E);
        break;

    case REDIS_REPLY_STATUS:
        JS_DefinePropertyValueStr(ctx, obj, "status", JS_NewString(ctx, reply->str), JS_PROP_C_W_E);
        break;

    case REDIS_REPLY_STRING:
        JS_DefinePropertyValueStr(ctx, obj, "value", JS_NewString(ctx, reply->str), JS_PROP_C_W_E);
        break;

    case REDIS_REPLY_INTEGER:
        JS_DefinePropertyValueStr(ctx, obj, "value", JS_NewBigInt64(ctx, reply->integer), JS_PROP_C_W_E);
        break;

    case REDIS_REPLY_DOUBLE:
        JS_DefinePropertyValueStr(ctx, obj, "value", JS_NewFloat64(ctx, reply->dval), JS_PROP_C_W_E);
        break;

    case REDIS_REPLY_BOOL:
        JS_DefinePropertyValueStr(ctx, obj, "value", JS_NewBool(ctx, (int)(reply->integer)), JS_PROP_C_W_E);
        break;

    case REDIS_REPLY_ARRAY: {
        JSValue arr = JS_NewArray(ctx);
        for (size_t i = 0; i < reply->elements; ++i) {
            JS_DefinePropertyValueUint32(ctx, arr, i, redisjs_create_value(ctx, reply->element[i]), JS_PROP_C_W_E);
        }

        JS_DefinePropertyValueStr(ctx, obj, "value", arr, JS_PROP_C_W_E);
    } break;
    default:
        break;
    }

    return obj;
}

static void redisjs_execute_callback(struct redisAsyncContext* context, void* reply, void* data)
{
    redisjs_result_t* result = data;
    JSContext* ctx = result->ctx;
    JSValue obj = redisjs_create_value(ctx, reply);
    TJS_SettlePromise(ctx, &result->promise, false, 1, (JSValueConst*)&obj);
    JS_SetOpaque(obj, result);
}

static JSValue redisjs_execute(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* arg = JS_ToCString(ctx, argv[0]);
    if (arg == NULL) {
        return JS_UNDEFINED;
    }

    redisjs_result_t* result = js_malloc(ctx, sizeof(*result));
    if (!result) {
        JS_FreeCString(ctx, arg);
        return JS_EXCEPTION;
    }

    result->ctx = ctx;
    int ret = redisAsyncCommand(redis_context.context, redisjs_execute_callback, result, arg);
    JS_FreeCString(ctx, arg);

    if (ret == REDIS_ERR) {
        return JS_UNDEFINED;
    }

    return TJS_InitPromise(ctx, &result->promise);
}

static const JSCFunctionListEntry redisjs_module_funcs[] = {
    TJS_CONST(RD_STRING),
    TJS_CONST(RD_ARRAY),
    TJS_CONST(RD_NUMERIC),
    TJS_CONST(RD_NIL),
    TJS_CONST(RD_STATUS),
    TJS_CONST(RD_ERROR),
    TJS_CFUNC_DEF("connect", 2, redisjs_connect),
    TJS_CFUNC_DEF("disconnect", 0, redisjs_disconnect),
    TJS_CFUNC_DEF("execute", 1, redisjs_execute)
};

static int module_init(JSContext* ctx, JSModuleDef* module)
{
    // Redis result
    JS_NewClassID(&redisjs_result_class_id);
    JS_NewClass(JS_GetRuntime(ctx), redisjs_result_class_id, &redisjs_result_class);

    // Redis
    JS_NewClassID(&redisjs_class_id);
    JS_NewClass(JS_GetRuntime(ctx), redisjs_class_id, &redisjs_class);

    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, redisjs_module_funcs, countof(redisjs_module_funcs));
    JS_SetClassProto(ctx, redisjs_class_id, proto);

    // redis
    JSValue obj = JS_NewObjectClass(ctx, redisjs_class_id);
    JS_SetPropertyFunctionList(ctx, obj, redisjs_module_funcs, countof(redisjs_module_funcs));
    JS_SetModuleExport(ctx, module, "redis", obj);
    return 0;
}

#ifdef JS_SHARED_LIBRARY
#define JS_INIT_MODULE js_init_module
#else
#define JS_INIT_MODULE js_init_module_redis
#endif

JSModuleDef* JS_INIT_MODULE(JSContext* ctx, const char* module_name)
{
    JSModuleDef* module = JS_NewCModule(ctx, module_name, module_init);
    if (!module) {
        return NULL;
    }

    JS_AddModuleExport(ctx, module, "redis");
    return module;
}
