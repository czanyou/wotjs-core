#include "private.h"
#include "streams.h"
#include "tjs-utils.h"

/* TTY */
static TJSStream* tjs_tty_get(JSContext* ctx, JSValueConst obj);

static JSClassID tjs_tty_class_id;

static void tjs_tty_finalizer(JSRuntime* rt, JSValue val)
{
    CHECK_NOT_NULL(rt);

    TJSStream* stream = JS_GetOpaque(val, tjs_tty_class_id);
    CHECK_NOT_NULL(stream);

    tjs_stream_finalizer(rt, stream);
}

static void tjs_tty_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func)
{
    CHECK_NOT_NULL(rt);

    TJSStream* stream = JS_GetOpaque(val, tjs_tty_class_id);
    CHECK_NOT_NULL(stream);

    tjs_stream_mark(rt, stream, mark_func);
}

static JSClassDef tjs_tty_class = {
    "TTY",
    .finalizer = tjs_tty_finalizer,
    .gc_mark = tjs_tty_mark,
};

static JSValue tjs_tty_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    CHECK_NOT_NULL(ctx);

    // 1. fd
    int fd;
    if (JS_ToInt32(ctx, &fd, argv[0])) {
        return JS_EXCEPTION;
    }

    JSValue obj = JS_NewObjectClass(ctx, tjs_tty_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    TJSStream* stream = calloc(1, sizeof(*stream));
    if (!stream) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    int readable = 0;
    int ret = uv_tty_init(TJS_GetLoop(ctx), &stream->h.tty, fd, readable);
    if (ret != 0) {
        JS_FreeValue(ctx, obj);
        free(stream);
        return JS_ThrowInternalError(ctx, "couldn't initialize TTY handle");
    }

    // printf("tjs_tty_constructor\r\n");
    return tjs_stream_init(ctx, obj, stream);
}

static JSValue tjs_tty_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_close(ctx, stream, argc, argv);
}

static JSValue tjs_tty_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_event_get(ctx, stream, this_val, magic);
}

static JSValue tjs_tty_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_event_set(ctx, stream, this_val, value, magic);
}

static JSValue tjs_tty_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_fileno(ctx, stream, argc, argv);
}

static TJSStream* tjs_tty_get(JSContext* ctx, JSValueConst obj)
{
    CHECK_NOT_NULL(ctx);
    return JS_GetOpaque2(ctx, obj, tjs_tty_class_id);
}

static JSValue tjs_tty_get_window_size(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int ret, width, height;
    ret = uv_tty_get_winsize(&stream->h.tty, &width, &height);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    JSValue result = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, result, "width", JS_NewInt32(ctx, width), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, result, "height", JS_NewInt32(ctx, height), JS_PROP_C_W_E);
    return result;
}

static JSValue tjs_tty_has_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);
    
    int result = tjs_stream_has_ref(stream);
    return JS_NewInt32(ctx, result);
}

static JSValue tjs_tty_ref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    tjs_stream_ref(stream);
    return JS_UNDEFINED;
}

static JSValue tjs_tty_set_mode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    int mode;
    if (JS_ToInt32(ctx, &mode, argv[0])) {
        return JS_EXCEPTION;
    }

    int ret = uv_tty_set_mode(&stream->h.tty, mode);
    if (ret != 0) {
        return tjs_throw_uv_error(ctx, ret);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_tty_unref(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    tjs_stream_unref(stream);
    return JS_UNDEFINED;
}

static JSValue tjs_tty_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSStream* stream = tjs_tty_get(ctx, this_val);
    CHECK_NOT_NULL(stream);

    return tjs_stream_write(ctx, stream, argc, argv);
}

static const JSCFunctionListEntry tjs_tty_proto_funcs[] = {
    /* Stream functions */
    TJS_CFUNC_DEF("close", 0, tjs_tty_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_tty_fileno),
    TJS_CFUNC_DEF("hasRef", 0, tjs_tty_has_ref),
    TJS_CFUNC_DEF("ref", 0, tjs_tty_ref),
    TJS_CFUNC_DEF("unref", 0, tjs_tty_unref),
    TJS_CFUNC_DEF("write", 1, tjs_tty_write),

    /* TTY functions */
    TJS_CFUNC_DEF("getWinSize", 0, tjs_tty_get_window_size),
    TJS_CFUNC_DEF("setMode", 1, tjs_tty_set_mode),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_tty_event_get, tjs_tty_event_set, STREAM_EVENT_MESSAGE),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_tty_event_get, tjs_tty_event_set, STREAM_EVENT_ERROR),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "TTY", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_tty_class_funcs[] = {
    JS_PROP_INT32_DEF("MODE_NORMAL", UV_TTY_MODE_NORMAL, 0),
    JS_PROP_INT32_DEF("MODE_RAW", UV_TTY_MODE_RAW, 0),
    JS_PROP_INT32_DEF("MODE_IO", UV_TTY_MODE_IO, 0),
};

void tjs_mod_tty_init(JSContext* ctx, JSModuleDef* module)
{
    /* TTY class */
    JS_NewClassID(&tjs_tty_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_tty_class_id, &tjs_tty_class);
    JSValue prototype = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, prototype, tjs_tty_proto_funcs, countof(tjs_tty_proto_funcs));
    JS_SetClassProto(ctx, tjs_tty_class_id, prototype);

    /* TTY constructor */
    JSValue constructor = JS_NewCFunction2(ctx, tjs_tty_constructor, "TTY", 1, JS_CFUNC_constructor, 0);
    JS_SetPropertyFunctionList(ctx, constructor, tjs_tty_class_funcs, countof(tjs_tty_class_funcs));
    JS_SetModuleExport(ctx, module, "TTY", constructor);
}
