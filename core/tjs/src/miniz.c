#include "miniz.h"
#include "gzip.h"
#include "tjs.h"

typedef struct _zip_reader {
    JSContext* ctx;
    mz_zip_archive handle;
    size_t buffer_offset;
} zip_reader_t;

static JSClassID zip_reader_class_id;

static zip_reader_t* zip_reader_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, zip_reader_class_id);
}

static void zip_reader_finalizer(JSRuntime* runtime, JSValue val)
{
    zip_reader_t* reader = JS_GetOpaque(val, zip_reader_class_id);
    if (reader) {
        // Close the archive, freeing any resources it was using
        mz_zip_reader_end(&reader->handle);
        reader->buffer_offset = 0;

        free(reader);
    }
}

static void zip_reader_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    zip_reader_t* reader = JS_GetOpaque(val, zip_reader_class_id);
    if (reader) {
    }
}

static JSClassDef zip_reader_class = {
    "ZipReader",
    .finalizer = zip_reader_finalizer,
    .gc_mark = zip_reader_mark
};

static JSValue zip_reader_open(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    zip_reader_t* reader = zip_reader_get(ctx, this_val);
    if (!reader) {
        return JS_UNDEFINED;
    }

    const char* filename = NULL;
    if (argc > 0) {
        filename = JS_ToCString(ctx, argv[0]);
    }

    if (!filename) {
        JS_ThrowTypeError(ctx, "invalid argument: filename must be string");
        return JS_EXCEPTION;
    }

    int ret = mz_zip_reader_init_file(&reader->handle, filename, 0);
    JS_FreeCString(ctx, filename);

    return JS_NewInt32(ctx, ret);
}

static JSValue zip_reader_extract(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    zip_reader_t* reader = zip_reader_get(ctx, this_val);
    if (!reader) {
        return JS_UNDEFINED;
    }

    if (argc < 1) {
        return JS_UNDEFINED;
    }

    if (argc > 2 && JS_IsString(argv[1])) {
        const char* output = JS_ToCString(ctx, argv[1]);
        int ret = -1;

        if (JS_IsString(argv[0])) {
            const char* filename = JS_ToCString(ctx, argv[0]);
            ret = mz_zip_reader_extract_file_to_file(&reader->handle, filename, output, 0);
            JS_FreeCString(ctx, filename);
            JS_FreeCString(ctx, output);

        } else if (JS_IsNumber(argv[0])) {
            int32_t index = -1;
            JS_ToInt32(ctx, &index, argv[0]);
            ret = mz_zip_reader_extract_to_file(&reader->handle, index, output, 0);
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
            data = mz_zip_reader_extract_file_to_heap(&reader->handle, filename, &size, 0);
            JS_FreeCString(ctx, filename);

        } else if (JS_IsNumber(argv[0])) {
            int32_t index = -1;
            JS_ToInt32(ctx, &index, argv[0]);
            data = mz_zip_reader_extract_to_heap(&reader->handle, index, &size, 0);

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

static JSValue zip_reader_count(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    zip_reader_t* reader = zip_reader_get(ctx, this_val);
    if (!reader) {
        return JS_UNDEFINED;
    }

    int ret = mz_zip_reader_get_num_files(&reader->handle);
    return JS_NewInt32(ctx, ret);
}

static JSValue zip_reader_stat(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    zip_reader_t* reader = zip_reader_get(ctx, this_val);
    if (!reader) {
        return JS_UNDEFINED;
    }

    if (argc < 1) {
        return JS_UNDEFINED;
    }

    uint32_t index = 0;
    JS_ToUint32(ctx, &index, argv[0]);

    mz_zip_archive_file_stat file_stat;
    int ret = mz_zip_reader_file_stat(&reader->handle, index, &file_stat);
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

static JSValue zip_reader_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    zip_reader_t* reader = zip_reader_get(ctx, this_val);
    if (!reader) {
        return JS_UNDEFINED;
    }

    // Close the archive, freeing any resources it was using
    mz_zip_reader_end(&reader->handle);

    return JS_UNDEFINED;
}

static JSValue zip_reader_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    zip_reader_t* reader;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, zip_reader_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    reader = calloc(1, sizeof(*reader));
    if (!reader) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    reader->ctx = ctx;

    memset(&reader->handle, 0, sizeof(reader->handle));
    reader->buffer_offset = 0;

    JS_SetOpaque(obj, reader);
    return obj;
}

static JSValue zip_compress(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_UNDEFINED;
    }

    tjs_buffer_t buffer = TJS_GetArrayBuffer(ctx, argv[0]);
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

static JSValue zip_uncompress(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        return JS_UNDEFINED;
    }

    tjs_buffer_t buffer = TJS_GetArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    uint32_t usize = 0;
    JS_ToUint32(ctx, &usize, argv[1]);
    mz_ulong uncompressed_size = usize;
    uint8_t* uncompressed_data = NULL;

    if (uncompressed_size <= 0) {
        return JS_UNDEFINED;
    }

    uncompressed_data = js_malloc(ctx, uncompressed_size);
    int ret = uncompress(uncompressed_data, &uncompressed_size, buffer.data, buffer.length);
    if (ret != Z_OK) {
        js_free(ctx, uncompressed_data);
        return JS_UNDEFINED;
    }

    return TJS_NewArrayBuffer(ctx, uncompressed_data, uncompressed_size);
}

static JSValue zip_ungzip(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        return JS_UNDEFINED;
    }

    tjs_buffer_t buffer = TJS_GetArrayBuffer(ctx, argv[0]);
    if (JS_IsException(buffer.error)) {
        return buffer.error;
    }

    uint32_t usize = 0;
    JS_ToUint32(ctx, &usize, argv[1]);
    mz_ulong uncompressed_size = usize;
    uint8_t* uncompressed_data = NULL;

    if (uncompressed_size <= 0) {
        return JS_UNDEFINED;
    }

    uncompressed_data = js_malloc(ctx, uncompressed_size + 4);

    struct mini_gzip gzip;
    int ret = mini_gz_start(&gzip, buffer.data, buffer.length);
    int size = mini_gz_unpack(&gzip, uncompressed_data, uncompressed_size);
    if (size <= 0) {
        js_free(ctx, uncompressed_data);
        return JS_UNDEFINED;
    }

    uncompressed_data[size] = '\0';
    return TJS_NewArrayBuffer(ctx, uncompressed_data, size);
}

static JSValue zip_extract(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        return JS_UNDEFINED;

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

static JSValue zip_add(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 3) {
        return JS_UNDEFINED;

    } else if (!JS_IsString(argv[0])) {
        JS_ThrowTypeError(ctx, "not string (0)");
        return JS_EXCEPTION;

    } else if (!JS_IsString(argv[1])) {
        JS_ThrowTypeError(ctx, "not string (1)");
        return JS_EXCEPTION;
    }

    tjs_buffer_t buffer = TJS_GetArrayBuffer(ctx, argv[2]);
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

static const JSCFunctionListEntry zip_reader_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, zip_reader_close),
    TJS_CFUNC_DEF("count", 0, zip_reader_count),
    TJS_CFUNC_DEF("extract", 2, zip_reader_extract),
    TJS_CFUNC_DEF("open", 1, zip_reader_open),
    TJS_CFUNC_DEF("stat", 1, zip_reader_stat)
};

static const JSCFunctionListEntry zip_lib_funcs[] = {
    TJS_CFUNC_DEF("compress", 1, zip_compress),
    TJS_CFUNC_DEF("uncompress", 1, zip_uncompress),
    TJS_CFUNC_DEF("ungzip", 1, zip_ungzip),
    TJS_CFUNC_DEF("extract", 2, zip_extract),
    TJS_CFUNC_DEF("add", 3, zip_add),
};

void tjs_mod_zlib_init(JSContext* ctx, JSModuleDef* module)
{
    /* class */
    JS_NewClassID(&zip_reader_class_id);
    JS_NewClass(JS_GetRuntime(ctx), zip_reader_class_id, &zip_reader_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, zip_reader_proto_funcs, countof(zip_reader_proto_funcs));
    JS_SetClassProto(ctx, zip_reader_class_id, proto);

    /* object */
    JSValue readerClass = JS_NewCFunction2(ctx, zip_reader_constructor, "ZipReader", 1, JS_CFUNC_constructor, 0);

    JSValue zlib = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, zlib, "Reader", readerClass, JS_PROP_C_W_E);
    JS_SetPropertyFunctionList(ctx, zlib, zip_lib_funcs, countof(zip_lib_funcs));
    JS_SetModuleExport(ctx, module, "zlib", zlib);
}

void tjs_mod_zlib_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "zlib");
}
