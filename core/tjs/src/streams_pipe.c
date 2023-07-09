/* Pipe */
#include "private.h"
#include "tjs-utils.h"
#include "streams.h"

#define TJS_PIPE_CLASS_NAME "Pipe"

static JSClassID tjs_pipe_class_id;

static void tjs_pipe_finalizer(JSRuntime* rt, JSValue val)
{
    CHECK_NOT_NULL(rt);
    // printf("tjs_pipe_finalizer\r\n");

    TJSStream* stream = JS_GetOpaque(val, tjs_pipe_class_id);
    CHECK_NOT_NULL(stream);

    tjs_stream_finalizer(rt, stream);
}

static void tjs_pipe_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    CHECK_NOT_NULL(rt);

    TJSStream* stream = JS_GetOpaque(val, tjs_pipe_class_id);
    CHECK_NOT_NULL(stream);

    tjs_stream_mark(rt, stream, mark_func);
}

static JSClassDef tjs_pipe_class = {
    TJS_PIPE_CLASS_NAME,
    .finalizer = tjs_pipe_finalizer,
    .gc_mark = tjs_pipe_mark,
};

JSValue tjs_pipe_new(JSContext* ctx)
{
    TJSStream* stream;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_pipe_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    stream = calloc(1, sizeof(*stream));
    if (!stream) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    r = uv_pipe_init(TJS_GetLoop(ctx), &stream->h.pipe, 0);
    if (r != 0) {
        JS_FreeValue(ctx, obj);
        free(stream);
        return JS_ThrowInternalError(ctx, "couldn't initialize Pipe handle");
    }

    // printf("tjs_pipe_new\r\n");
    return tjs_stream_init(ctx, obj, stream);
}

static JSValue tjs_pipe_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    return tjs_pipe_new(ctx);
}

static JSValue tjs_pipe_accept(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_accept(ctx, stream, argc, argv);
}

static JSValue tjs_pipe_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    const char* name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_EXCEPTION;
    }

    int r = uv_pipe_bind(&stream->h.pipe, name);
    JS_FreeCString(ctx, name);

    if (r != 0) {
        return tjs_throw_uv_error(ctx, r);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_pipe_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_close(ctx, stream, argc, argv);
}

static JSValue tjs_pipe_connect(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    const char* name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_UNDEFINED;
    }

    TJSConnectReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, name);
        return JS_EXCEPTION;
    }

    request->req.data = request;

    uv_pipe_connect(&request->req, &stream->h.pipe, name, tjs_stream_connect_callback);

    JS_FreeCString(ctx, name);

    return TJS_InitPromise(ctx, &request->result);
}

static JSValue tjs_pipe_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_event_get(ctx, stream, this_val, magic);
}

static JSValue tjs_pipe_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_event_set(ctx, stream, this_val, value, magic);
}

static JSValue tjs_pipe_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_fileno(ctx, stream, argc, argv);
}

TJSStream* tjs_pipe_get(JSContext* ctx, JSValueConst obj)
{
    CHECK_NOT_NULL(ctx);
    return JS_GetOpaque2(ctx, obj, tjs_pipe_class_id);
}

static JSValue tjs_pipe_get_address(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    char buf[1024];
    size_t len = sizeof(buf);
    int ret;

    if (magic == 0) {
        ret = uv_pipe_getsockname(&stream->h.pipe, buf, &len);
    } else {
        ret = uv_pipe_getpeername(&stream->h.pipe, buf, &len);
    }

    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return JS_NewStringLen(ctx, buf, len);
}

static JSValue tjs_pipe_get_queue_size(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    size_t size = uv_stream_get_write_queue_size(&stream->h.stream);
    return JS_NewInt32(ctx, size);
}

static JSValue tjs_pipe_get_id(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return JS_NewInt32(ctx, stream->stream_id);
}

uv_stream_t* tjs_pipe_get_stream(JSContext* ctx, JSValueConst obj)
{
    CHECK_NOT_NULL(ctx);

    TJSStream* stream = tjs_pipe_get(ctx, obj);
    if (stream) {
        return &stream->h.stream;
    }

    return NULL;
}

static JSValue tjs_pipe_has_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);
    
    int result = tjs_stream_has_ref(stream);
    return JS_NewInt32(ctx, result);
}

static JSValue tjs_pipe_listen(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_listen(ctx, stream, argc, argv);
}

static JSValue tjs_pipe_open(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int fd = -1;
    if (argc > 0) {
        JS_ToInt32(ctx, &fd, argv[0]);
    }

    if (fd < 0) {
        return JS_UNDEFINED;
    }

    int ret = uv_pipe_open(&stream->h.pipe, fd);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_pipe_pause(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_pause(ctx, stream, argc, argv);
}

static JSValue tjs_pipe_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    tjs_stream_ref(stream);
    return JS_UNDEFINED;
}

static JSValue tjs_pipe_resume(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_resume(ctx, stream, argc, argv);
}

static JSValue tjs_pipe_set_debug(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int32_t enable = 0;
    if (argc > 0 && !JS_IsUndefined(argv[0])) {
        JS_ToInt32(ctx, &enable, argv[0]);
    }

    stream->stream_debug = enable;
    return JS_NewInt32(ctx, stream->stream_debug);
}

static JSValue tjs_pipe_shutdown(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_shutdown(ctx, stream, argc, argv);
}

static JSValue tjs_pipe_unref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    tjs_stream_unref(stream);    
    return JS_UNDEFINED;
}

static JSValue tjs_pipe_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_pipe_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_write(ctx, stream, argc, argv);
}

static const JSCFunctionListEntry tjs_pipe_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("accept", 0, tjs_pipe_accept),
    TJS_CFUNC_DEF("close", 0, tjs_pipe_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_pipe_fileno),
    TJS_CFUNC_DEF("hasRef", 0, tjs_pipe_has_ref),
    TJS_CFUNC_DEF("listen", 1, tjs_pipe_listen),
    TJS_CFUNC_DEF("open", 1, tjs_pipe_open),
    TJS_CFUNC_DEF("pause", 0, tjs_pipe_pause),
    TJS_CFUNC_DEF("ref", 0, tjs_pipe_ref),
    TJS_CFUNC_DEF("resume", 0, tjs_pipe_resume),
    TJS_CFUNC_DEF("shutdown", 0, tjs_pipe_shutdown),
    TJS_CFUNC_DEF("unref", 0, tjs_pipe_unref),
    TJS_CFUNC_DEF("write", 1, tjs_pipe_write),

    /* Pipe functions */
    TJS_CFUNC_MAGIC_DEF("address", 0, tjs_pipe_get_address, 0),
    TJS_CFUNC_MAGIC_DEF("remoteAddress", 0, tjs_pipe_get_address, 1),

    TJS_CFUNC_DEF("bind", 1, tjs_pipe_bind),
    TJS_CFUNC_DEF("bufferedAmount", 0, tjs_pipe_get_queue_size),
    TJS_CFUNC_DEF("connect", 1, tjs_pipe_connect),
    TJS_CFUNC_DEF("id", 0, tjs_pipe_get_id),
    TJS_CFUNC_DEF("setDebug", 1, tjs_pipe_set_debug),

    TJS_CGETSET_MAGIC_DEF("onclose", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_CLOSE),
    TJS_CGETSET_MAGIC_DEF("onconnect", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_CONNECT),
    TJS_CGETSET_MAGIC_DEF("onconnection", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_CONNECTION),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_MESSAGE),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_pipe_event_get, tjs_pipe_event_set, STREAM_EVENT_ERROR),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", TJS_PIPE_CLASS_NAME, JS_PROP_CONFIGURABLE),
};

void tjs_mod_pipe_init(JSContext* ctx, JSModuleDef* module)
{
    /* Pipe class */
    JS_NewClassID(&tjs_pipe_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_pipe_class_id, &tjs_pipe_class);
    JSValue prototype = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, prototype, tjs_pipe_proto_funcs, countof(tjs_pipe_proto_funcs));
    JS_SetClassProto(ctx, tjs_pipe_class_id, prototype);

    /* Pipe constructor */
    JSValue constructor = JS_NewCFunction2(ctx, tjs_pipe_constructor, TJS_PIPE_CLASS_NAME, 1, JS_CFUNC_constructor, 0);
    JS_SetModuleExport(ctx, module, TJS_PIPE_CLASS_NAME, constructor);
}
