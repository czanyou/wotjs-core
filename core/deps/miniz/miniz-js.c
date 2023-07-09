#include "wotjs.h"
#include "src/miniz.h"

typedef struct _zip_reader {
    JSContext* ctx;
    mz_zip_archive handle;
    size_t buffer_offset;
} TJSZipReader;

static JSClassID tjs_zip_reader_class_id;

static TJSZipReader* tjs_zip_reader_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_zip_reader_class_id);
}

static void tjs_zip_reader_finalizer(JSRuntime* runtime, JSValue val)
{
    TJSZipReader* zipReader = JS_GetOpaque(val, tjs_zip_reader_class_id);
    if (zipReader) {
        // Close the archive, freeing any resources it was using
        mz_zip_reader_end(&zipReader->handle);
        zipReader->buffer_offset = 0;

        free(zipReader);
    }
}

static void tjs_zip_reader_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSZipReader* zipReader = JS_GetOpaque(val, tjs_zip_reader_class_id);
    if (zipReader) {

    }
}

static JSClassDef tjs_zip_reader_class = {
    "ZipReader",
    .finalizer = tjs_zip_reader_finalizer,
    .gc_mark = tjs_zip_reader_mark
};

static JSValue tjs_zip_reader_open(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSZipReader* zipReader = tjs_zip_reader_get(ctx, this_val);
    if (!zipReader) {
        return JS_EXCEPTION;
    }

    const char* filename = NULL;
    if (argc > 0) {
        filename = JS_ToCString(ctx, argv[0]);
    }

    if (!filename) {
        JS_ThrowTypeError(ctx, "invalid argument: filename must be string");
        return JS_EXCEPTION;
    }

    int ret = mz_zip_reader_init_file(&zipReader->handle, filename, 0);
    JS_FreeCString(ctx, filename);

    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_zip_reader_extract(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSZipReader* zipReader = tjs_zip_reader_get(ctx, this_val);
    if (!zipReader) {
        return JS_EXCEPTION;
    }

    if (argc < 1) {
        JS_ThrowTypeError(ctx, "invalid argument: filename or index");
        return JS_EXCEPTION;
    }

    if (argc > 2 && JS_IsString(argv[1])) {
        const char* output = JS_ToCString(ctx, argv[1]);
        int ret = -1;

        if (JS_IsString(argv[0])) {
            const char* filename = JS_ToCString(ctx, argv[0]);
            ret = mz_zip_reader_extract_file_to_file(&zipReader->handle, filename, output, 0);
            JS_FreeCString(ctx, filename);
            JS_FreeCString(ctx, output);

        } else if (JS_IsNumber(argv[0])) {
            int32_t index = -1;
            JS_ToInt32(ctx, &index, argv[0]);
            ret = mz_zip_reader_extract_to_file(&zipReader->handle, index, output, 0);
            JS_FreeCString(ctx, output);

        } else {
            JS_ThrowTypeError(ctx, "invalid argument: filename or index");
            return JS_EXCEPTION;
        }

        return JS_NewInt32(ctx, ret);

    } else {
        size_t size = -1;
        uint8_t* data = NULL;

        if (JS_IsString(argv[0])) {
            const char* filename = JS_ToCString(ctx, argv[0]);
            data = mz_zip_reader_extract_file_to_heap(&zipReader->handle, filename, &size, 0);
            JS_FreeCString(ctx, filename);

        } else if (JS_IsNumber(argv[0])) {
            int32_t index = -1;
            JS_ToInt32(ctx, &index, argv[0]);
            data = mz_zip_reader_extract_to_heap(&zipReader->handle, index, &size, 0);

        } else {
            JS_ThrowTypeError(ctx, "invalid argument: filename or index");
            return JS_EXCEPTION;
        }

        if (data == NULL) {
            return JS_UNDEFINED;
        }

        return TJS_NewArrayBuffer(ctx, data, size);
    }
}

static JSValue tjs_zip_reader_count(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSZipReader* zipReader = tjs_zip_reader_get(ctx, this_val);
    if (!zipReader) {
        return JS_EXCEPTION;
    }

    int ret = mz_zip_reader_get_num_files(&zipReader->handle);
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_zip_reader_stat(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSZipReader* zipReader = tjs_zip_reader_get(ctx, this_val);
    if (!zipReader) {
        return JS_EXCEPTION;
    }

    if (argc < 1) {
        JS_ThrowTypeError(ctx, "invalid argument: index");
        return JS_EXCEPTION;
    }

    uint32_t index = 0;
    JS_ToUint32(ctx, &index, argv[0]);

    mz_zip_archive_file_stat file_stat;
    int ret = mz_zip_reader_file_stat(&zipReader->handle, index, &file_stat);
    if (!ret) {
        return JS_UNDEFINED;
    }

    JSValue statInfo = JS_NewObjectProto(ctx, JS_NULL);
    JS_DefinePropertyValueStr(ctx, statInfo, "filename", JS_NewString(ctx, file_stat.m_filename), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "comment", JS_NewString(ctx, file_stat.m_comment), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "size", JS_NewUint32(ctx, file_stat.m_uncomp_size), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "index", JS_NewUint32(ctx, file_stat.m_file_index), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "flags", JS_NewUint32(ctx, file_stat.m_bit_flag), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "mtime", JS_NewUint32(ctx, file_stat.m_time), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "method", JS_NewUint32(ctx, file_stat.m_method), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "compressedSize", JS_NewUint32(ctx, file_stat.m_comp_size), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "directory", JS_NewBool(ctx, file_stat.m_is_directory), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "encrypted", JS_NewBool(ctx, file_stat.m_is_encrypted), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, statInfo, "supported", JS_NewBool(ctx, file_stat.m_is_supported), JS_PROP_C_W_E);

    return statInfo;
}

static JSValue tjs_zip_reader_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSZipReader* zipReader = tjs_zip_reader_get(ctx, this_val);
    if (!zipReader) {
        return JS_EXCEPTION;
    }

    // Close the archive, freeing any resources it was using
    mz_zip_reader_end(&zipReader->handle);

    return JS_UNDEFINED;
}

static JSValue tjs_new_zip_readers(JSContext* ctx)
{
    TJSZipReader* zipReader;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_zip_reader_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    zipReader = calloc(1, sizeof(*zipReader));
    if (!zipReader) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    zipReader->ctx = ctx;

    memset(&zipReader->handle, 0, sizeof(zipReader->handle));
    zipReader->buffer_offset = 0;

    JS_SetOpaque(obj, zipReader);
    return obj;
}

static JSValue tjs_zip_reader_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    return tjs_new_zip_readers(ctx);
}

static JSValue tjs_zip_compress(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        JS_ThrowTypeError(ctx, "invalid argument: data");
        return JS_EXCEPTION;
    }

    tjs_buffer_t buffer = tjs_to_buffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    mz_ulong compressed_size = compressBound(buffer.length);
    uint8_t* compressed_data = js_malloc(ctx, compressed_size);
    int ret = compress(compressed_data, &compressed_size, buffer.data, buffer.length);
    if (ret != Z_OK) {
        js_free(ctx, compressed_data);
        return JS_UNDEFINED;
    }

    return TJS_NewArrayBuffer(ctx, compressed_data, compressed_size);
}

static JSValue tjs_zip_uncompress(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        JS_ThrowTypeError(ctx, "expected 2 arguments, but got %d.", argc);
        return JS_EXCEPTION;
    }

    tjs_buffer_t buffer = tjs_to_buffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    uint32_t usize = 0;
    JS_ToUint32(ctx, &usize, argv[1]);
    mz_ulong uncompressed_size = usize;
    uint8_t* uncompressed_data = NULL;

    if (uncompressed_size > 0) {
        uncompressed_data = js_malloc(ctx, uncompressed_size);
        int ret = uncompress(uncompressed_data, &uncompressed_size, buffer.data, buffer.length);
        if (ret != Z_OK) {
            js_free(ctx, uncompressed_data);
            return JS_UNDEFINED;
        }
    }

    return TJS_NewArrayBuffer(ctx, uncompressed_data, uncompressed_size);
}

static JSValue tjs_zip_extract(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        JS_ThrowTypeError(ctx, "expected 2 arguments, but got %d.", argc);
        return JS_EXCEPTION;

    } else if (!JS_IsString(argv[0])) {
        JS_ThrowTypeError(ctx, "not string (0)");
        return JS_EXCEPTION;

    } else if (!JS_IsString(argv[1])) {
        JS_ThrowTypeError(ctx, "not string (1)");
        return JS_EXCEPTION;
    }

    const char* zipname = JS_ToCString(ctx, argv[0]);
    const char* filename = JS_ToCString(ctx, argv[1]);

    size_t size = -1;
    uint8_t* data = NULL;

    data = mz_zip_extract_archive_file_to_heap(zipname, filename, &size, 0);
    JS_FreeCString(ctx, zipname);
    JS_FreeCString(ctx, filename);

    if (data == NULL) {
        return JS_UNDEFINED;
    }

    return TJS_NewArrayBuffer(ctx, data, size);
}

static JSValue tjs_zip_add(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 3) {
        JS_ThrowTypeError(ctx, "expected 3 arguments, but got %d.", argc);
        return JS_EXCEPTION;

    } else if (!JS_IsString(argv[0])) {
        JS_ThrowTypeError(ctx, "not string (0)");
        return JS_EXCEPTION;

    } else if (!JS_IsString(argv[1])) {
        JS_ThrowTypeError(ctx, "not string (1)");
        return JS_EXCEPTION;
    }

    tjs_buffer_t buffer = tjs_to_buffer(ctx, argv[2]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    const char* zipname = JS_ToCString(ctx, argv[0]);
    const char* filename = JS_ToCString(ctx, argv[1]);

    mz_bool ret = mz_zip_add_mem_to_archive_file_in_place(zipname, filename, buffer.data, buffer.length, NULL, 0, MZ_BEST_COMPRESSION);
    JS_FreeCString(ctx, zipname);
    JS_FreeCString(ctx, filename);

    return JS_NewInt32(ctx, ret);
}

static const JSCFunctionListEntry tjs_zip_reader_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_zip_reader_close),
    TJS_CFUNC_DEF("count", 0, tjs_zip_reader_count),
    TJS_CFUNC_DEF("extract", 2, tjs_zip_reader_extract),
    TJS_CFUNC_DEF("open", 1, tjs_zip_reader_open),
    TJS_CFUNC_DEF("stat", 1, tjs_zip_reader_stat)
};

static const JSCFunctionListEntry tjs_zlib_class_funcs[] = {
    TJS_CFUNC_DEF("compress", 1, tjs_zip_compress),
    TJS_CFUNC_DEF("uncompress", 1, tjs_zip_uncompress),
    TJS_CFUNC_DEF("extract", 2, tjs_zip_extract),
    TJS_CFUNC_DEF("add", 3, tjs_zip_add),
};

void tjs_mod_zlib_init(JSContext* ctx, JSModuleDef* module)
{
    /* class */
    JS_NewClassID(&tjs_zip_reader_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_zip_reader_class_id, &tjs_zip_reader_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_zip_reader_proto_funcs, countof(tjs_zip_reader_proto_funcs));
    JS_SetClassProto(ctx, tjs_zip_reader_class_id, proto);

    JSValue readerClass = JS_NewCFunction2(ctx, tjs_zip_reader_constructor, "ZipReader", 1, JS_CFUNC_constructor, 0);

    /* object */
    JSValue zlib = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, zlib, "Reader", readerClass, JS_PROP_C_W_E);
    JS_SetPropertyFunctionList(ctx, zlib, tjs_zlib_class_funcs, countof(tjs_zlib_class_funcs));
    JS_SetModuleExport(ctx, module, "zlib", zlib);
}

void tjs_mod_zlib_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "zlib");
}
