/*
 * txiki.js
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

#include "util/sha1.h"

#if defined(__linux__) || defined(__linux)
#include <sys/file.h>
#endif

static JSClassID tjs_file_class_id;

typedef struct tjs_file_s {
    JSContext* ctx;
    JSValue path;
    uv_file fd;
} TJSFile;

static void tjs_file_finalizer(JSRuntime* rt, JSValue val)
{
    TJSFile* file = JS_GetOpaque(val, tjs_file_class_id);
    if (file) {
        if (file->fd != -1) {
            uv_fs_t req;
            uv_fs_close(NULL, &req, file->fd, NULL);
            uv_fs_req_cleanup(&req);
        }

        JS_FreeValueRT(rt, file->path);
        js_free_rt(rt, file);
    }
}

static JSClassDef tjs_file_class = {
    "File",
    .finalizer = tjs_file_finalizer,
};

static JSClassID tjs_dir_class_id;

typedef struct tjs_dir_s {
    JSContext* ctx;
    JSValue path;
    uv_dir_t* dir;
    uv_dirent_t dirent;
    bool done;
} TJSDir;

static void tjs_dir_finalizer(JSRuntime* rt, JSValue val)
{
    TJSDir* d = JS_GetOpaque(val, tjs_dir_class_id);
    if (d) {
        if (d->dir) {
            uv_fs_t req;
            uv_fs_closedir(NULL, &req, d->dir, NULL);
            uv_fs_req_cleanup(&req);
        }

        JS_FreeValueRT(rt, d->path);
        js_free_rt(rt, d);
    }
}

static JSClassDef tjs_dir_class = { "Directory", .finalizer = tjs_dir_finalizer };

typedef struct tjs_fs_req_s {
    uv_fs_t req;
    JSContext* ctx;
    JSValue obj;
    TJSPromise result;
    BOOL isBigint;
    const char* syscall;
    char* path;
} TJSFsReq;

typedef struct tjs_fs_read_req_s {
    TJSFsReq base;
    char* buf;
} TJSFsReadReq;

typedef struct tjs_fs_write_req_s {
    TJSFsReq base;
    char data[];
} TJSFsWriteReq;

typedef struct tjs_fs_readfile_req_s {
    uv_work_t req;
    JSContext* ctx;
    TJSPromise result;
    DynBuf dbuf;
    int ret;
    char* path;
} TJSFsReadFileReq;

static JSValue js__statfs2obj(JSContext* ctx, uv_statfs_t* st, BOOL isBigint)
{
    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    if (isBigint) {
#define SET_UINT64_FIELD(name, x) \
    JS_DefinePropertyValueStr(ctx, obj, STRINGIFY(name), JS_NewBigUint64(ctx, st->x), JS_PROP_C_W_E)
        SET_UINT64_FIELD(type, f_type);
        SET_UINT64_FIELD(bsize, f_bsize);
        SET_UINT64_FIELD(blocks, f_blocks);
        SET_UINT64_FIELD(bfree, f_bfree);
        SET_UINT64_FIELD(bavail, f_bavail);
        SET_UINT64_FIELD(ffree, f_ffree);
        SET_UINT64_FIELD(files, f_files);
#undef SET_UINT64_FIELD
    } else {
#define SET_UINT32_FIELD(name, x) \
    JS_DefinePropertyValueStr(ctx, obj, STRINGIFY(name), JS_NewUint32(ctx, st->x), JS_PROP_C_W_E)
        SET_UINT32_FIELD(type, f_type);
        SET_UINT32_FIELD(bsize, f_bsize);
        SET_UINT32_FIELD(blocks, f_blocks);
        SET_UINT32_FIELD(bfree, f_bfree);
        SET_UINT32_FIELD(bavail, f_bavail);
        SET_UINT32_FIELD(ffree, f_ffree);
        SET_UINT32_FIELD(files, f_files);
#undef SET_UINT32_FIELD
    }

    return obj;
}

static JSValue js__stat2obj(JSContext* ctx, uv_stat_t* st, BOOL isBigint)
{
    JSValue obj = JS_NewObjectProto(ctx, JS_NULL);
    if (isBigint) {
#define SET_UINT64_FIELD(name, x) \
    JS_DefinePropertyValueStr(ctx, obj, STRINGIFY(name), JS_NewBigUint64(ctx, st->x), JS_PROP_C_W_E)
        SET_UINT64_FIELD(dev, st_dev);
        SET_UINT64_FIELD(mode, st_mode);
        SET_UINT64_FIELD(nlink, st_nlink);
        SET_UINT64_FIELD(uid, st_uid);
        SET_UINT64_FIELD(gid, st_gid);
        SET_UINT64_FIELD(rdev, st_rdev);
        SET_UINT64_FIELD(ino, st_ino);
        SET_UINT64_FIELD(size, st_size);
        SET_UINT64_FIELD(blksize, st_blksize);
        SET_UINT64_FIELD(blocks, st_blocks);
        SET_UINT64_FIELD(flags, st_flags);
        SET_UINT64_FIELD(gen, st_gen);
#undef SET_UINT64_FIELD
    } else {
#define SET_UINT32_FIELD(name, x) \
    JS_DefinePropertyValueStr(ctx, obj, STRINGIFY(name), JS_NewUint32(ctx, st->x), JS_PROP_C_W_E)
        SET_UINT32_FIELD(dev, st_dev);
        SET_UINT32_FIELD(mode, st_mode);
        SET_UINT32_FIELD(nlink, st_nlink);
        SET_UINT32_FIELD(uid, st_uid);
        SET_UINT32_FIELD(gid, st_gid);
        SET_UINT32_FIELD(rdev, st_rdev);
        SET_UINT32_FIELD(ino, st_ino);
        SET_UINT32_FIELD(size, st_size);
        SET_UINT32_FIELD(blksize, st_blksize);
        SET_UINT32_FIELD(blocks, st_blocks);
        SET_UINT32_FIELD(flags, st_flags);
        SET_UINT32_FIELD(gen, st_gen);
#undef SET_UINT32_FIELD
    }

#define SET_TIMESPEC_FIELD(name, x)                              \
    JS_DefinePropertyValueStr(ctx,                               \
        obj,                                                     \
        STRINGIFY(name),                                         \
        JS_NewFloat64(ctx, st->x.tv_sec + 1e-9 * st->x.tv_nsec), \
        JS_PROP_C_W_E)
    SET_TIMESPEC_FIELD(atime, st_atim);
    SET_TIMESPEC_FIELD(mtime, st_mtim);
    SET_TIMESPEC_FIELD(ctime, st_ctim);
    SET_TIMESPEC_FIELD(birthtime, st_birthtim);
#undef SET_TIMESPEC_FIELD

    const char* type = NULL;
    if (S_ISREG(st->st_mode)) {
        type = "file";

    } else if (S_ISDIR(st->st_mode)) {
        type = "directory";

#if defined(__linux__) || defined(__linux)
    } else if (S_ISLNK(st->st_mode)) {
        type = "link";
#endif

    } else if (S_ISFIFO(st->st_mode)) {
        type = "fifo";

#ifdef S_ISSOCK
    } else if (S_ISSOCK(st->st_mode)) {
        type = "socket";
#endif

    } else if (S_ISCHR(st->st_mode)) {
        type = "char";

    } else if (S_ISBLK(st->st_mode)) {
        type = "block";
    }

    if (type) {
        JS_DefinePropertyValueStr(ctx, obj, "type", JS_NewString(ctx, type), JS_PROP_C_W_E);
    }

    return obj;
}

static JSValue tjs_new_file(JSContext* ctx, uv_file fd, const char* path)
{
    TJSFile* file;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, tjs_file_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    file = js_malloc(ctx, sizeof(*file));
    if (!file) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    file->path = JS_NewString(ctx, path);
    file->ctx = ctx;
    file->fd = fd;

    JS_SetOpaque(obj, file);
    return obj;
}

static TJSFile* tjs_file_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_file_class_id);
}

static JSValue tjs_new_dir(JSContext* ctx, uv_dir_t* dir, const char* path)
{
    TJSDir* d;
    JSValue obj;

    obj = JS_NewObjectClass(ctx, tjs_dir_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    d = js_malloc(ctx, sizeof(*d));
    if (!d) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    d->path = JS_NewString(ctx, path);
    d->ctx = ctx;
    d->dir = dir;
    d->done = false;

    JS_SetOpaque(obj, d);
    return obj;
}

static TJSDir* tjs_dir_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_dir_class_id);
}

static JSValue tjs_fs_req_init(JSContext* ctx, TJSFsReq* request, JSValue this_val)
{
    request->ctx = ctx;
    request->req.data = request;
    request->obj = JS_DupValue(ctx, this_val);

    return TJS_InitPromise(ctx, &request->result);
}

static JSValue tjs_fs_req_init2(JSContext* ctx, TJSFsReq* request, JSValue this_val, int ret)
{
    if (ret != 0) {
        js_free(ctx, request->path);
        js_free(ctx, request);
        return tjs_throw_errno(ctx, ret);
    }

    request->ctx = ctx;
    request->req.data = request;
    request->obj = JS_DupValue(ctx, this_val);

    return TJS_InitPromise(ctx, &request->result);
}

JSValue tjs_new_file_error(JSContext* ctx, TJSFsReq* request)
{
    JSValue error = JS_NewError(ctx);
    JSValue message = JS_UNDEFINED;

    int errorCode = request->req.result;
    const char* description = uv_strerror(errorCode);
    if (description) {
        const char* path = request->path;
        if (path) {
            JS_DefinePropertyValueStr(ctx, error, "path", JS_NewString(ctx, path), JS_PROP_C_W_E);

            const char* syscall = request->syscall;
            if (syscall == NULL) {
                syscall = "file";

            } else {
                JS_DefinePropertyValueStr(ctx, error, "syscall", JS_NewString(ctx, syscall), JS_PROP_C_W_E);
            }

            size_t total = strlen(path) + strlen(description);
            char* buffer = js_malloc(ctx, total + 16);
            snprintf(buffer, total + 16, "%s, %s '%s'", description, syscall, path);
            message = JS_NewString(ctx, buffer);
            js_free(ctx, buffer);

        } else {
            message = JS_NewString(ctx, description);
        }
    }

    JS_DefinePropertyValueStr(ctx, error, "message", message, JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, error, "errno", JS_NewInt32(ctx, errorCode), JS_PROP_C_W_E);
    return error;
}

const char* tjs_check_string(JSContext* ctx, JSValue value, const char* name)
{

}

JSValue tjs_throw_file_error(JSContext* ctx, int errorNumber)
{
    JSValue error;
    error = tjs_new_error(ctx, errorNumber);
    if (JS_IsException(error)) {
        error = JS_NULL;
    }

    return JS_Throw(ctx, error);
}

static void uv__fs_req_cb(uv_fs_t* req)
{
    TJSFsReq* fr = req->data;
    if (!fr) {
        return;
    }

    JSContext* ctx = fr->ctx;
    TJSFsReadReq* rr;
    JSValue arg;
    TJSFile* f;
    TJSDir* d;
    uv_statfs_t* stats;
    bool is_reject = false;

    if (req->result < 0) {
        arg = tjs_new_file_error(ctx, fr);
        is_reject = true;
        if (req->fs_type == UV_FS_READ) {
            rr = (TJSFsReadReq*)fr;
            js_free(ctx, rr->buf);
        }

        goto skip;
    }

    switch (req->fs_type) {
    case UV_FS_ACCESS:
        arg = JS_NewInt32(ctx, fr->req.result);
        break;

    case UV_FS_OPEN:
        arg = tjs_new_file(ctx, fr->req.result, fr->req.path);
        break;

    case UV_FS_CLOSE:
        arg = JS_UNDEFINED;
        f = tjs_file_get(ctx, fr->obj);
        CHECK_NOT_NULL(f);
        f->fd = -1;
        JS_FreeValue(ctx, f->path);
        f->path = JS_UNDEFINED;
        break;

    case UV_FS_READ:
        rr = (TJSFsReadReq*)fr;
        arg = TJS_NewArrayBuffer(ctx, (uint8_t*)rr->buf, req->result);
        break;

    case UV_FS_WRITE:
        arg = JS_NewInt32(ctx, fr->req.result);
        break;

    case UV_FS_STATFS:
        stats = req->ptr;
        arg = js__statfs2obj(ctx, stats, false);
        break;

    case UV_FS_STAT:
    case UV_FS_LSTAT:
    case UV_FS_FSTAT:
        arg = js__stat2obj(ctx, &fr->req.statbuf, false);
        break;

    case UV_FS_REALPATH:
    case UV_FS_READLINK:
        arg = JS_NewString(ctx, fr->req.ptr);
        break;

    case UV_FS_CHMOD:
    case UV_FS_CHOWN:
    case UV_FS_COPYFILE:
    case UV_FS_FSYNC:
    case UV_FS_FTRUNCATE:
    case UV_FS_MKDIR:
    case UV_FS_RENAME:
    case UV_FS_RMDIR:
    case UV_FS_SYMLINK:
    case UV_FS_UNLINK:
        arg = JS_UNDEFINED;
        break;

    case UV_FS_MKDTEMP:
        arg = JS_NewString(ctx, fr->req.path);
        break;

    case UV_FS_MKSTEMP:
        arg = tjs_new_file(ctx, fr->req.result, fr->req.path);
        break;

    case UV_FS_OPENDIR:
        arg = tjs_new_dir(ctx, fr->req.ptr, fr->req.path);
        break;

    case UV_FS_CLOSEDIR:
        arg = JS_UNDEFINED;
        d = tjs_dir_get(ctx, fr->obj);
        CHECK_NOT_NULL(d);
        d->dir = NULL;
        JS_FreeValue(ctx, d->path);
        d->path = JS_UNDEFINED;
        break;

    case UV_FS_READDIR:
        d = tjs_dir_get(ctx, fr->obj);
        d->done = fr->req.result == 0;
        arg = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, arg, "done", JS_NewBool(ctx, d->done), JS_PROP_C_W_E);
        if (fr->req.result != 0) {
            JSValue item = JS_NewObjectProto(ctx, JS_NULL);
            JS_DefinePropertyValueStr(ctx, item, "name", JS_NewString(ctx, d->dirent.name), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, item, "type", JS_NewInt32(ctx, d->dirent.type), JS_PROP_C_W_E);
            JS_DefinePropertyValueStr(ctx, arg, "value", item, JS_PROP_C_W_E);
        }
        break;

    default:
        abort();
    }

skip:
    TJS_SettlePromise(ctx, &fr->result, is_reject, 1, (JSValueConst*)&arg);

    JS_FreeValue(ctx, fr->obj);

    uv_fs_req_cleanup(&fr->req);
    js_free(ctx, fr->path);
    js_free(ctx, fr);
}

/* File functions */

static JSValue tjs_file_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    /* arg 1: length to read */
    uint64_t len = kDefaultReadSize;
    if (!JS_IsUndefined(argv[0]) && JS_ToIndex(ctx, &len, argv[0])) {
        return JS_EXCEPTION;
    }

    /* arg 2: position (on the file) */
    int64_t pos = -1;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1]) && JS_ToInt64(ctx, &pos, argv[1])) {
            return JS_EXCEPTION;
        }
    }

    TJSFsReadReq* rr = js_malloc(ctx, sizeof(*rr));
    if (!rr) {
        return JS_EXCEPTION;
    }

    rr->buf = js_malloc(ctx, len);
    if (!rr->buf) {
        js_free(ctx, rr);
        return JS_EXCEPTION;
    }

    TJSFsReq* request = (TJSFsReq*)&rr->base;
    uv_buf_t b = uv_buf_init(rr->buf, len);
    int ret = uv_fs_read(tjs_get_loop(ctx), &request->req, file->fd, &b, 1, pos, uv__fs_req_cb);
    if (ret != 0) {
        js_free(ctx, rr->buf);
        js_free(ctx, rr);
        return tjs_throw_errno(ctx, ret);
    }

    tjs_fs_req_init(ctx, request, this_val);
    return request->result.p;
}

static JSValue tjs_file_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    JSValue jsData = argv[0];
    bool is_string = false;
    size_t size;
    char* buf;

    if (JS_IsString(jsData)) {
        is_string = true;
        buf = (char*)JS_ToCStringLen(ctx, &size, jsData);
        if (!buf) {
            return JS_EXCEPTION;
        }

    } else {
        buf = JS_GetArrayBuffer(ctx, &size, jsData);
        if (buf == NULL) {
            size_t aoffset, asize;
            JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
            if (JS_IsException(abuf)) {
                return abuf;
            }

            buf = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
            JS_FreeValue(ctx, abuf);
            if (!buf) {
                return JS_EXCEPTION;
            }

            buf += aoffset;
            size = asize;
        }
    }

    /* arg 2: position (on the file) */
    int64_t pos = -1;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1]) && JS_ToInt64(ctx, &pos, argv[1])) {
            if (is_string)
                JS_FreeCString(ctx, buf);
            return JS_EXCEPTION;
        }
    }

    TJSFsWriteReq* wr = js_malloc(ctx, sizeof(*wr) + size);
    if (!wr) {
        if (is_string) {
            JS_FreeCString(ctx, buf);
        }

        return JS_EXCEPTION;
    }

    memcpy(wr->data, buf, size);

    if (is_string) {
        JS_FreeCString(ctx, buf);
    }

    TJSFsReq* request = (TJSFsReq*)&wr->base;
    uv_buf_t b = uv_buf_init(wr->data, size);
    int ret = uv_fs_write(tjs_get_loop(ctx), &request->req, file->fd, &b, 1, pos, uv__fs_req_cb);
    if (ret != 0) {
        js_free(ctx, wr);
        return tjs_throw_errno(ctx, ret);
    }

    tjs_fs_req_init(ctx, request, this_val);
    return request->result.p;
}

static JSValue tjs_file_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    int ret = uv_fs_close(tjs_get_loop(ctx), &request->req, file->fd, uv__fs_req_cb);
    return tjs_fs_req_init2(ctx, request, this_val, ret);
}

static JSValue tjs_file_stat(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    int ret = uv_fs_fstat(tjs_get_loop(ctx), &request->req, file->fd, uv__fs_req_cb);
    return tjs_fs_req_init2(ctx, request, this_val, ret);
}

static JSValue tjs_file_sync(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    int ret = uv_fs_fsync(tjs_get_loop(ctx), &request->req, file->fd, uv__fs_req_cb);
    return tjs_fs_req_init2(ctx, request, this_val, ret);
}

static JSValue tjs_file_truncate(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    uint32_t offset = 0;
    if (argc > 0 && JS_IsNumber(argv[0])) {
        JS_ToUint32(ctx, &offset, argv[0]);
    }

    int ret = uv_fs_ftruncate(tjs_get_loop(ctx), &request->req, file->fd, offset, uv__fs_req_cb);
    return tjs_fs_req_init2(ctx, request, this_val, ret);
}

static JSValue tjs_file_flock(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

#if defined(__linux__) || defined(__linux)
    int ret = flock(file->fd, LOCK_EX | LOCK_NB);
    return JS_NewInt32(ctx, ret);
#else
    return 0;
#endif
}

static JSValue tjs_file_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    return JS_NewInt32(ctx, file->fd);
}

static JSValue tjs_file_fd_get(JSContext* ctx, JSValueConst this_val)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    return JS_NewInt32(ctx, file->fd);
}

static JSValue tjs_file_path_get(JSContext* ctx, JSValueConst this_val)
{
    TJSFile* file = tjs_file_get(ctx, this_val);
    if (!file) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, file->path);
}

/* Dir functions */

static JSValue tjs_dir_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSDir* d = tjs_dir_get(ctx, this_val);
    if (!d) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    int ret = uv_fs_closedir(tjs_get_loop(ctx), &request->req, d->dir, uv__fs_req_cb);
    return tjs_fs_req_init2(ctx, request, this_val, ret);
}

static JSValue tjs_dir_path_get(JSContext* ctx, JSValueConst this_val)
{
    TJSDir* d = tjs_dir_get(ctx, this_val);
    if (!d) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, d->path);
}

static JSValue tjs_dir_next(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSDir* d = tjs_dir_get(ctx, this_val);
    if (!d) {
        return JS_EXCEPTION;
    }

    if (d->done) {
        return JS_UNDEFINED;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        return JS_EXCEPTION;
    }

    d->dir->dirents = &d->dirent;
    d->dir->nentries = 1;

    int ret = uv_fs_readdir(tjs_get_loop(ctx), &request->req, d->dir, uv__fs_req_cb);
    return tjs_fs_req_init2(ctx, request, this_val, ret);
}

static JSValue tjs_dir_iterator(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    return JS_DupValue(ctx, this_val);
}

/* Module functions */

static int tjs__uv_open_flags(const char* strflags, size_t len)
{
    int flags = 0, read = 0, write = 0;

    for (int i = 0; i < len; i++) {
        switch (strflags[i]) {
        case 'r':
            read = 1;
            break;

        case 'w':
            write = 1;
            flags |= O_TRUNC | O_CREAT;
            break;

        case 'a':
            write = 1;
            flags |= O_APPEND | O_CREAT;
            break;

        case '+':
            read = 1;
            write = 1;
            break;

        case 'x':
            flags |= O_EXCL;
            break;

        default:
            break;
        }
    }

    flags |= read ? (write ? O_RDWR : O_RDONLY) : (write ? O_WRONLY : 0);

    return flags;
}

static JSValue tjs_fs_open(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
   
    } else if (!JS_IsString(argv[1])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "flags");
    }

    const char* path;
    const char* strflags;
    size_t len;
    int flags;
    int32_t mode;

    path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    strflags = JS_ToCStringLen(ctx, &len, argv[1]);
    if (!strflags) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    flags = tjs__uv_open_flags(strflags, len);
    JS_FreeCString(ctx, strflags);

    if (len == 0) {
        JS_FreeCString(ctx, path);
        return JS_ThrowTypeError(ctx, "The value '%s' is invalid for option '%s'", strflags, "flags");
    }

    mode = 438; // 0o666
    if (argc > 2) {
        if (!JS_IsUndefined(argv[2]) && JS_ToInt32(ctx, &mode, argv[2])) {
            JS_FreeCString(ctx, path);
            return JS_EXCEPTION;
        }

        if (mode < 0) {
            return JS_ThrowRangeError(ctx, "The value of 'mode' is out of range.");
        }
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "open";

    int ret = uv_fs_open(tjs_get_loop(ctx), &request->req, path, flags, mode, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_file(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int fd = 0;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &fd, argv[0])) {
        return JS_EXCEPTION;
    }

    return tjs_new_file(ctx, fd, "@");
}

static JSValue tjs_fs_statfs(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int ret = uv_fs_statfs(tjs_get_loop(ctx), &request->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_stat(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv, int magic)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "stat";

    int ret;
    if (magic) {
        ret = uv_fs_lstat(tjs_get_loop(ctx), &request->req, path, uv__fs_req_cb);
    } else {
        ret = uv_fs_stat(tjs_get_loop(ctx), &request->req, path, uv__fs_req_cb);
    }

    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_access(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int mode = F_OK;
    // TODO:

    request->path = js_strdup(ctx, path);
    request->syscall = "access";
    int ret = uv_fs_access(tjs_get_loop(ctx), &request->req, path, mode, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_realpath(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "realpath";
    int ret = uv_fs_realpath(tjs_get_loop(ctx), &request->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_readlink(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "realpath";
    int ret = uv_fs_readlink(tjs_get_loop(ctx), &request->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_unlink(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "unlink";
    int ret = uv_fs_unlink(tjs_get_loop(ctx), &request->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_rename(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");

    } if (!JS_IsString(argv[1])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "new_path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    const char* new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        JS_FreeCString(ctx, new_path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "rename";
    int ret = uv_fs_rename(tjs_get_loop(ctx), &request->req, path, new_path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    JS_FreeCString(ctx, new_path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_symlink(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "target");
    
    } else if (!JS_IsString(argv[1])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "new_path");
    }

    const char* target = JS_ToCString(ctx, argv[0]);
    if (!target) {
        return JS_EXCEPTION;
    }

    const char* new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path) {
        JS_FreeCString(ctx, target);
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, target);
        JS_FreeCString(ctx, new_path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, target);
    request->syscall = "symlink";
    int ret = uv_fs_symlink(tjs_get_loop(ctx), &request->req, target, new_path, 0, uv__fs_req_cb);
    JS_FreeCString(ctx, target);
    JS_FreeCString(ctx, new_path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_mkdtemp(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "tpl");
    }

    const char* tpl = JS_ToCString(ctx, argv[0]);
    if (!tpl) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, tpl);
        return JS_EXCEPTION;
    }

    int ret = uv_fs_mkdtemp(tjs_get_loop(ctx), &request->req, tpl, uv__fs_req_cb);
    JS_FreeCString(ctx, tpl);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_mkstemp(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "tpl");
    }

    const char* tpl = JS_ToCString(ctx, argv[0]);
    if (!tpl) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, tpl);
        return JS_EXCEPTION;
    }

    int ret = uv_fs_mkstemp(tjs_get_loop(ctx), &request->req, tpl, uv__fs_req_cb);
    JS_FreeCString(ctx, tpl);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_chmod(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");

    } else if (!JS_IsNumber(argv[1])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type number", "mode");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    int32_t mode = -1;
    int ret = JS_ToInt32(ctx, &mode, argv[1]);
    if (mode <= 0) {
        JS_FreeCString(ctx, path);
        return JS_ThrowRangeError(ctx, "The value of 'mode' is out of range.");
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "chmod";
    ret = uv_fs_chmod(tjs_get_loop(ctx), &request->req, path, mode, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_chown(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");

    } else if (!JS_IsNumber(argv[1]) || !JS_IsNumber(argv[2])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type number", "uid and gid");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    int32_t uid = 0;
    JS_ToInt32(ctx, &uid, argv[1]);
    if (uid <= 0) {
        JS_FreeCString(ctx, path);
        return JS_ThrowRangeError(ctx, "The value of 'uid' is out of range.");
    }

    int32_t gid = 0;
    JS_ToInt32(ctx, &gid, argv[2]);
    if (gid <= 0) {
        JS_FreeCString(ctx, path);
        return JS_ThrowRangeError(ctx, "The value of 'gid' is out of range.");
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "chown";
    int ret = uv_fs_chown(tjs_get_loop(ctx), &request->req, path, uid, gid, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_rmdir(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "rmdir";
    int ret = uv_fs_rmdir(tjs_get_loop(ctx), &request->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_mkdir(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "mkdir";
    int ret = uv_fs_mkdir(tjs_get_loop(ctx), &request->req, path, 0755, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_copyfile(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");

    } else if (!JS_IsString(argv[1])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "new_path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    const char* new_path = JS_ToCString(ctx, argv[1]);
    if (!new_path) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    int32_t flags;
    if (JS_ToInt32(ctx, &flags, argv[2])) {
        JS_FreeCString(ctx, path);
        JS_FreeCString(ctx, new_path);
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        JS_FreeCString(ctx, new_path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "copyfile";
    int ret = uv_fs_copyfile(tjs_get_loop(ctx), &request->req, path, new_path, flags, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    JS_FreeCString(ctx, new_path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static JSValue tjs_fs_opendir(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->path = js_strdup(ctx, path);
    request->syscall = "opendir";
    int ret = uv_fs_opendir(tjs_get_loop(ctx), &request->req, path, uv__fs_req_cb);
    JS_FreeCString(ctx, path);
    return tjs_fs_req_init2(ctx, request, JS_UNDEFINED, ret);
}

static void tjs__readfile_free(JSRuntime* rt, void* opaque, void* ptr)
{
    TJSFsReadFileReq* request = opaque;
    CHECK_NOT_NULL(request);

    dbuf_free(&request->dbuf);
    js_free_rt(rt, request->path);
    js_free_rt(rt, request);
}

static void tjs__readfile_work(uv_work_t* req)
{
    TJSFsReadFileReq* request = req->data;
    CHECK_NOT_NULL(request);

    request->ret = tjs__load_file(request->ctx, &request->dbuf, request->path);
}

static void tjs__readfile_after_work(uv_work_t* req, int status)
{
    TJSFsReadFileReq* request = req->data;
    CHECK_NOT_NULL(request);

    JSContext* ctx = request->ctx;
    JSValue arg;
    bool is_reject = false;

    if (status != 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = true;

    } else if (request->ret < 0) {
        arg = tjs_new_error(ctx, request->ret);
        is_reject = true;

    } else {
        arg = JS_NewArrayBuffer(ctx, request->dbuf.buf, request->dbuf.size, tjs__readfile_free, (void*)request, false);
    }

    TJS_SettlePromise(ctx, &request->result, is_reject, 1, (JSValueConst*)&arg);

    if (is_reject) {
        tjs__readfile_free(JS_GetRuntime(ctx), (void*)request, NULL);
    }
}

static JSValue tjs_fs_readfile(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReadFileReq* request = js_malloc(ctx, sizeof(*request));
    if (!request) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    request->ctx = ctx;
    dbuf_init(&request->dbuf);
    request->ret = -1;
    request->path = js_strdup(ctx, path);
    request->req.data = request;
    JS_FreeCString(ctx, path);

    int ret = uv_queue_work(tjs_get_loop(ctx), &request->req, tjs__readfile_work, tjs__readfile_after_work);
    if (ret != 0) {
        js_free(ctx, request->path);
        js_free(ctx, request);
        return tjs_throw_errno(ctx, ret);
    }

    return TJS_InitPromise(ctx, &request->result);
}

static void tjs__hashfile_free(JSRuntime* rt, void* opaque, void* ptr)
{
    TJSFsReadFileReq* request = opaque;
    CHECK_NOT_NULL(request);

    dbuf_free(&request->dbuf);
    js_free_rt(rt, request->path);
    js_free_rt(rt, request);
}

int tjs__hashfile(JSContext* ctx, DynBuf* dbuf, const char* path)
{
    uv_fs_t req;
    uv_file fd;
    int ret, i;

    SHA1_CTX sha1ctx;
    SHA1Init(&sha1ctx);

    ret = uv_fs_open(NULL, &req, path, O_RDONLY, 0, NULL);
    uv_fs_req_cleanup(&req);
    if (ret < 0) {
        return ret;
    }

    fd = ret;
    char byteBuffer[64 * 1024];
    uv_buf_t buffer = uv_buf_init(byteBuffer, sizeof(byteBuffer));
    size_t offset = 0;

    do {
        ret = uv_fs_read(NULL, &req, fd, &buffer, 1, offset, NULL);
        uv_fs_req_cleanup(&req);
        if (ret <= 0) {
            break;
        }

        offset += ret;

        for (i = 0; i < ret; i += 1) {
            SHA1Update(&sha1ctx, (const unsigned char*)(buffer.base + i), 1);
        }

    } while (1);

    SHA1Final((unsigned char*)byteBuffer, &sha1ctx);
    byteBuffer[20] = '\0';
    ret = dbuf_put(dbuf, (const uint8_t*)byteBuffer, 20);

    uv_fs_close(NULL, &req, fd, NULL);
    uv_fs_req_cleanup(&req);
    return ret;
}

static void tjs__hashfile_work(uv_work_t* req)
{
    TJSFsReadFileReq* fr = req->data;
    CHECK_NOT_NULL(fr);

    fr->ret = tjs__hashfile(fr->ctx, &fr->dbuf, fr->path);
}

static void tjs__hashfile_after_work(uv_work_t* req, int status)
{
    TJSFsReadFileReq* fr = req->data;
    CHECK_NOT_NULL(fr);

    JSContext* ctx = fr->ctx;
    JSValue arg;
    bool is_reject = false;

    if (status != 0) {
        arg = tjs_new_error(ctx, status);
        is_reject = true;

    } else if (fr->ret < 0) {
        arg = tjs_new_error(ctx, fr->ret);
        is_reject = true;

    } else {
        char* buffer = js_malloc(ctx, fr->dbuf.size + 1);
        memcpy(buffer, fr->dbuf.buf, fr->dbuf.size);
        arg = TJS_NewUint8Array(ctx, buffer, fr->dbuf.size);
        tjs__hashfile_free(JS_GetRuntime(ctx), (void*)fr, NULL);
    }

    TJS_SettlePromise(ctx, &fr->result, is_reject, 1, (JSValueConst*)&arg);

    if (is_reject) {
        tjs__hashfile_free(JS_GetRuntime(ctx), (void*)fr, NULL);
    }
}

static JSValue tjs_fs_hashfile(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (!JS_IsString(argv[0])) {
        return JS_ThrowTypeError(ctx, "The '%s' argument must be of type string", "path");
    }

    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    TJSFsReadFileReq* fr = js_malloc(ctx, sizeof(*fr));
    if (!fr) {
        JS_FreeCString(ctx, path);
        return JS_EXCEPTION;
    }

    fr->ctx = ctx;
    dbuf_init(&fr->dbuf);
    fr->ret = -1;
    fr->path = js_strdup(ctx, path);
    fr->req.data = fr;
    JS_FreeCString(ctx, path);

    int ret = uv_queue_work(tjs_get_loop(ctx), &fr->req, tjs__hashfile_work, tjs__hashfile_after_work);
    if (ret != 0) {
        js_free(ctx, fr->path);
        js_free(ctx, fr);
        return tjs_throw_errno(ctx, ret);
    }

    return TJS_InitPromise(ctx, &fr->result);
}

static const JSCFunctionListEntry tjs_file_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_file_close),
    TJS_CFUNC_DEF("fileno", 0, tjs_file_fileno),
    TJS_CFUNC_DEF("flock", 1, tjs_file_flock),
    TJS_CFUNC_DEF("read", 2, tjs_file_read),
    TJS_CFUNC_DEF("stat", 0, tjs_file_stat),
    TJS_CFUNC_DEF("sync", 0, tjs_file_sync),
    TJS_CFUNC_DEF("truncate", 1, tjs_file_truncate),
    TJS_CFUNC_DEF("write", 2, tjs_file_write),

    TJS_CGETSET_DEF("fd", tjs_file_fd_get, NULL),
    TJS_CGETSET_DEF("path", tjs_file_path_get, NULL),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "FileHandle", JS_PROP_CONFIGURABLE),
};

static const JSCFunctionListEntry tjs_dir_proto_funcs[] = {
    TJS_CFUNC_DEF("close", 0, tjs_dir_close),
    TJS_CGETSET_DEF("path", tjs_dir_path_get, NULL),
    TJS_CFUNC_DEF("next", 0, tjs_dir_next),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Dir", JS_PROP_CONFIGURABLE),
    TJS_CFUNC_DEF("[Symbol.asyncIterator]", 0, tjs_dir_iterator),
};

static const JSCFunctionListEntry tjs_fs_funcs[] = {
    TJS_CONST(UV_DIRENT_UNKNOWN),
    TJS_CONST(UV_DIRENT_FILE),
    TJS_CONST(UV_DIRENT_DIR),
    TJS_CONST(UV_DIRENT_LINK),
    TJS_CONST(UV_DIRENT_FIFO),
    TJS_CONST(UV_DIRENT_SOCKET),
    TJS_CONST(UV_DIRENT_CHAR),
    TJS_CONST(UV_DIRENT_BLOCK),
    TJS_CONST(UV_FS_COPYFILE_EXCL),
    TJS_CONST(UV_FS_COPYFILE_FICLONE),
    TJS_CONST(UV_FS_COPYFILE_FICLONE_FORCE),
    TJS_CONST(S_IFMT),
    TJS_CONST(S_IFIFO),
    TJS_CONST(S_IFCHR),
    TJS_CONST(S_IFDIR),
    TJS_CONST(S_IFBLK),
    TJS_CONST(S_IFREG),
#ifdef S_IFSOCK
    TJS_CONST(S_IFSOCK),
#endif
    TJS_CONST(S_IFLNK),
#ifdef S_ISGID
    TJS_CONST(S_ISGID),
#endif
#ifdef S_ISUID
    TJS_CONST(S_ISUID),
#endif
    TJS_CFUNC_DEF("access", 2, tjs_fs_access),
    TJS_CFUNC_DEF("chmod", 2, tjs_fs_chmod),
    TJS_CFUNC_DEF("chown", 3, tjs_fs_chown),
    TJS_CFUNC_DEF("copyFile", 3, tjs_fs_copyfile),
    TJS_CFUNC_DEF("file", 3, tjs_fs_file),
    TJS_CFUNC_DEF("hashFile", 1, tjs_fs_hashfile),
    TJS_CFUNC_DEF("mkdir", 1, tjs_fs_mkdir),
    TJS_CFUNC_DEF("mkdtemp", 1, tjs_fs_mkdtemp),
    TJS_CFUNC_DEF("mkstemp", 1, tjs_fs_mkstemp),
    TJS_CFUNC_DEF("open", 3, tjs_fs_open),
    TJS_CFUNC_DEF("opendir", 1, tjs_fs_opendir),
    TJS_CFUNC_DEF("readFile", 1, tjs_fs_readfile),
    TJS_CFUNC_DEF("readlink", 1, tjs_fs_readlink),
    TJS_CFUNC_DEF("realpath", 1, tjs_fs_realpath),
    TJS_CFUNC_DEF("rename", 2, tjs_fs_rename),
    TJS_CFUNC_DEF("rmdir", 1, tjs_fs_rmdir),
    TJS_CFUNC_DEF("statfs", 1, tjs_fs_statfs),
    TJS_CFUNC_DEF("symlink", 2, tjs_fs_symlink),
    TJS_CFUNC_DEF("unlink", 1, tjs_fs_unlink),
    JS_CFUNC_MAGIC_DEF("lstat", 1, tjs_fs_stat, 1),
    JS_CFUNC_MAGIC_DEF("stat", 1, tjs_fs_stat, 0)
};

void tjs_mod_fs_init(JSContext* ctx, JSModuleDef* m)
{
    JSValue proto, obj;

    /* File object */
    JS_NewClassID(&tjs_file_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_file_class_id, &tjs_file_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_file_proto_funcs, countof(tjs_file_proto_funcs));
    JS_SetClassProto(ctx, tjs_file_class_id, proto);

    /* Dir object */
    JS_NewClassID(&tjs_dir_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_dir_class_id, &tjs_dir_class);
    proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_dir_proto_funcs, countof(tjs_dir_proto_funcs));
    JS_SetClassProto(ctx, tjs_dir_class_id, proto);

    // fs
    obj = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, obj, tjs_fs_funcs, countof(tjs_fs_funcs));
    JS_SetModuleExport(ctx, m, "fs", obj);
}

void tjs_mod_fs_export(JSContext* ctx, JSModuleDef* m)
{
    JS_AddModuleExport(ctx, m, "fs");
}
