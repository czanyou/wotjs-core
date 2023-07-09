/**********************************************************************
 *                                                                    *
 * sqlite3.c                                                          *
 *                                                                    *
 * For sqlite3 function docs, see:                                    *
 * https://www.sqlite.org/c3ref/funclist.html                         *
 *                                                                    *
 **********************************************************************/

#define _GNU_SOURCE
#include <errno.h>
#include <sqlite3.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <quickjs.h>

#define countof(x) (sizeof(x) / sizeof((x)[0]))

typedef struct sqlite_db {
    char* name;
    sqlite3* db;
} sqlite_db;

static JSClassID db_class_id;

typedef struct sqlite_st {
    sqlite3_stmt* st;
} sqlite_st;

static JSClassID st_class_id;

static inline JS_BOOL JS_IsInteger(JSValueConst v)
{
    int tag = JS_VALUE_GET_TAG(v);
    return tag == JS_TAG_INT || tag == JS_TAG_BIG_INT;
}

static void st_finalizer(JSRuntime* rt, JSValue val)
{
    sqlite_st* s = JS_GetOpaque(val, st_class_id);
    if (s) {
        if (s->st) {
            sqlite3_finalize(s->st);
        }

        js_free_rt(rt, s);
    }
}

static JSValue st_new(JSContext* ctx, sqlite3_stmt* st)
{
    sqlite_st* s;
    JSValue obj;
    obj = JS_NewObjectClass(ctx, st_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    s = js_mallocz(ctx, sizeof(*s));
    if (!s) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    s->st = st;
    JS_SetOpaque(obj, s);
    return obj;
}

static void db_finalizer(JSRuntime* rt, JSValue val)
{
    sqlite_db* s = JS_GetOpaque(val, db_class_id);
    if (s) {
        if (s->db) {
            sqlite3_close(s->db);
        }

        js_free_rt(rt, s);
    }
}

static JSValue db_ctor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    sqlite_db* s;
    JSValue obj = JS_UNDEFINED;
    JSValue protocol;
    int r;
    const char* name;

    s = js_mallocz(ctx, sizeof(*s));
    if (!s) {
        return JS_EXCEPTION;
    }

    name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        goto fail;
    }

    protocol = JS_GetPropertyStr(ctx, new_target, "prototype");
    if (JS_IsException(protocol)) {
        goto fail;
    }

    obj = JS_NewObjectProtoClass(ctx, protocol, db_class_id);
    JS_FreeValue(ctx, protocol);
    if (JS_IsException(obj)) {
        goto fail;
    }

    JS_SetOpaque(obj, s);
    r = sqlite3_open(name, &(s->db));
    if (r != SQLITE_OK) {
        goto fail;
    }

    JS_FreeCString(ctx, name);
    return obj;

fail:
    if (name) {
        JS_FreeCString(ctx, name);
    }

    js_free(ctx, s);
    JS_FreeValue(ctx, obj);
    return JS_EXCEPTION;
}

static sqlite3* sqlite3_get(JSContext* ctx, JSValueConst this_val)
{
    sqlite_db* db = JS_GetOpaque2(ctx, this_val, db_class_id);
    if (db == NULL) {
        return NULL;
    }

    return db->db;
}

static JSValue db_errmsg(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3* db = sqlite3_get(ctx, this_val);
    if (!db) {
        return JS_EXCEPTION;
    }

    return JS_NewString(ctx, sqlite3_errmsg(db));
}

static JSValue db_last_insert_rowid(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3* db = sqlite3_get(ctx, this_val);
    if (!db) {
        return JS_EXCEPTION;
    }

    return JS_NewInt32(ctx, sqlite3_last_insert_rowid(db));
}

static JSValue db_prepare(JSContext* ctx, JSValueConst this_val,
    int argc, JSValueConst* argv)
{
    sqlite3* db = sqlite3_get(ctx, this_val);
    if (!db) {
        return JS_EXCEPTION;
    }

    const char* sql;
    sqlite3_stmt* t;
    int r;

    sql = JS_ToCString(ctx, argv[0]);
    if (!sql) {
        return JS_EXCEPTION;
    }

    r = sqlite3_prepare_v2(db, sql, strlen(sql) + 1, &t, NULL);
    JS_FreeCString(ctx, sql);
    if (r != SQLITE_OK || t == NULL) {
        return JS_NULL;
    }

    return st_new(ctx, t);
}

static JSValue db_exec(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3* db = sqlite3_get(ctx, this_val);
    if (!db) {
        return JS_EXCEPTION;
    }

    int r;
    const char* sql;

    sql = JS_ToCString(ctx, argv[0]);
    if (!sql) {
        return JS_EXCEPTION;
    }

    r = sqlite3_exec(db, sql, NULL, NULL, NULL);
    JS_FreeCString(ctx, sql);
    if (r == SQLITE_OK) {
        return JS_TRUE;
    }

    return JS_FALSE;
}

static JSValue db_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite_db* s = JS_GetOpaque2(ctx, this_val, db_class_id);
    if (!s) {
        return JS_EXCEPTION;
    }

    if (s->db) {
        sqlite3_close(s->db);
        s->db = NULL;
    }

    return JS_UNDEFINED;
}

static sqlite3_stmt* sqlite3_stmt_get(JSContext* ctx, JSValueConst this_val)
{
    sqlite_st* stmt = JS_GetOpaque2(ctx, this_val, st_class_id);
    if (stmt == NULL) {
        return NULL;
    }

    return stmt->st;
}

static JSValue st_finalize(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite_st* s = JS_GetOpaque2(ctx, this_val, st_class_id);
    sqlite3_stmt* st;
    if (!s)
        return JS_EXCEPTION;
    st = s->st;
    s->st = NULL;
    if (!st)
        return JS_TRUE;
    if (sqlite3_finalize(s->st) == SQLITE_OK)
        return JS_TRUE;
    return JS_FALSE;
}

static JSValue st_reset(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    if (sqlite3_reset(stmt) == SQLITE_OK) {
        return JS_TRUE;
    }

    return JS_FALSE;
}

static JSValue st_clear_bindings(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    if (sqlite3_clear_bindings(stmt) == SQLITE_OK) {
        return JS_TRUE;
    }
    
    return JS_FALSE;
}

static JSValue st_bind_parameter_count(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    return JS_NewInt32(ctx, sqlite3_bind_parameter_count(stmt));
}

static JSValue st_column_text(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    int n;
    if (JS_ToInt32(ctx, &n, argv[0])) {
        return JS_EXCEPTION;
    }

    return JS_NewString(ctx, sqlite3_column_text(stmt, n));
}

static JSValue st_column_name(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    int n;
    if (JS_ToInt32(ctx, &n, argv[0])) {
        return JS_EXCEPTION;
    }

    return JS_NewString(ctx, sqlite3_column_name(stmt, n));
}

static JSValue st_column_count(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    return JS_NewInt32(ctx, sqlite3_column_count(stmt));
}

static JSValue st_bind_parameter_name(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    int n;
    if (JS_ToInt32(ctx, &n, argv[0])) {
        return JS_EXCEPTION;
    }

    return JS_NewString(ctx, sqlite3_bind_parameter_name(stmt, n));
}

static JSValue st_bind_parameter_index(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    const char* name = JS_ToCString(ctx, argv[0]);
    if (!name) {
        return JS_NULL;
    }

    int n = sqlite3_bind_parameter_index(stmt, name);
    JS_FreeCString(ctx, name);
    return JS_NewInt32(ctx, n);
}

static JSValue st_step(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    int r = sqlite3_step(stmt);
    switch (r) {
    case SQLITE_ROW:
        return JS_NewString(ctx, "row");

    case SQLITE_DONE:
        return JS_NewString(ctx, "done");

    case SQLITE_BUSY:
        return JS_NewString(ctx, "busy");

    default:
        return JS_NULL;
    }
}

static JSValue st_column_value(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    int n;
    if (JS_ToInt32(ctx, &n, argv[0])) {
        return JS_EXCEPTION;
    }

    switch (sqlite3_column_type(stmt, n)) {
    case SQLITE_INTEGER:
        return JS_NewInt64(ctx, sqlite3_column_int64(stmt, n));

    case SQLITE_FLOAT:
        return JS_NewFloat64(ctx, sqlite3_column_double(stmt, n));

    case SQLITE_BLOB:
        return JS_NewArrayBufferCopy(ctx, (uint8_t*)sqlite3_column_blob(stmt, n),
            (size_t)sqlite3_column_bytes(stmt, n));

    case SQLITE_NULL:
        return JS_NULL;

    case SQLITE3_TEXT:
    default:
        return JS_NewString(ctx, sqlite3_column_text(stmt, n));
    }

    return JS_EXCEPTION;
}

static JSValue st_bind(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    sqlite3_stmt* stmt = sqlite3_stmt_get(ctx, this_val);
    if (!stmt) {
        return JS_EXCEPTION;
    }

    JSValueConst a;
    int n, r;

    if (JS_ToInt32(ctx, &n, argv[0])) {
        return JS_EXCEPTION;
    }
    
    a = argv[1];

    if (JS_IsNull(a)) {
        r = sqlite3_bind_null(stmt, n);

    } else if (JS_IsBool(a)) {
        int b = JS_ToBool(ctx, a);
        r = sqlite3_bind_int(stmt, n, b);

    } else if (JS_IsInteger(a)) {
        int64_t i64;
        int i;
        double d;
        if (!JS_ToInt32(ctx, &i, a)) {
            r = sqlite3_bind_int(stmt, n, i);
        }

        if (!JS_ToInt64(ctx, &i64, a)) {
            r = sqlite3_bind_int64(stmt, n, i64);

        } else if (!JS_ToFloat64(ctx, &d, a)) {
            r = sqlite3_bind_double(stmt, n, d);

        } else {
            return JS_EXCEPTION;
        }

    } else if (JS_IsNumber(a)) {
        double d;
        if (JS_ToFloat64(ctx, &d, a)) {
            return JS_EXCEPTION;
        }

        r = sqlite3_bind_double(stmt, n, d);

    } else if (JS_IsString(a)) {
        const char* t;
        t = JS_ToCString(ctx, a);
        r = sqlite3_bind_text(stmt, n, t, strlen(t), SQLITE_TRANSIENT);
        JS_FreeCString(ctx, t);

    } else {
        uint8_t* buf;
        size_t size;
        buf = JS_GetArrayBuffer(ctx, &size, a);
        if (!buf) {
            return JS_EXCEPTION;
        }
        
        r = sqlite3_bind_blob(stmt, n, buf, size, SQLITE_TRANSIENT);
    }

    return JS_NewInt32(ctx, r);
}

static JSClassDef db_class = {
    "sqlite3_db",
    .finalizer = db_finalizer,
};

static const JSCFunctionListEntry db_proto_funcs[] = {
    JS_CFUNC_DEF("close", 0, db_close),
    JS_CFUNC_DEF("errmsg", 0, db_errmsg),
    JS_CFUNC_DEF("exec", 1, db_exec),
    JS_CFUNC_DEF("lastInsertId", 0, db_last_insert_rowid),
    JS_CFUNC_DEF("prepare", 0, db_prepare),
};

static const JSCFunctionListEntry st_proto_funcs[] = {
    JS_CFUNC_DEF("bind", 2, st_bind),
    JS_CFUNC_DEF("parameterCount", 0, st_bind_parameter_count),
    JS_CFUNC_DEF("parameterIndex", 1, st_bind_parameter_index),
    JS_CFUNC_DEF("parameterName", 1, st_bind_parameter_name),
    JS_CFUNC_DEF("clearBindings", 0, st_clear_bindings),
    JS_CFUNC_DEF("columnCount", 0, st_column_count),
    JS_CFUNC_DEF("name", 1, st_column_name),
    JS_CFUNC_DEF("text", 1, st_column_text),
    JS_CFUNC_DEF("value", 1, st_column_value),
    JS_CFUNC_DEF("finalize", 0, st_finalize),
    JS_CFUNC_DEF("reset", 0, st_reset),
    JS_CFUNC_DEF("step", 0, st_step),
};

static JSClassDef st_class = {
    "sqlite3_st",
    .finalizer = st_finalizer,
};

static int st_init(JSContext* ctx, JSModuleDef* module)
{
    JS_NewClassID(&st_class_id);
    JS_NewClass(JS_GetRuntime(ctx), st_class_id, &st_class);

    JSValue protocol = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, protocol, st_proto_funcs, countof(st_proto_funcs));
    JS_SetClassProto(ctx, st_class_id, protocol);
    return 0;
}

static int db_init(JSContext* ctx, JSModuleDef* module)
{
    st_init(ctx, module);

    JS_NewClassID(&db_class_id);
    JS_NewClass(JS_GetRuntime(ctx), db_class_id, &db_class);

    JSValue protocol = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, protocol, db_proto_funcs, countof(db_proto_funcs));
    JS_SetClassProto(ctx, db_class_id, protocol);

    JSValue class = JS_NewCFunction2(ctx, db_ctor, "Database", 2, JS_CFUNC_constructor, 0);
    JS_SetConstructor(ctx, class, protocol);
    JS_SetModuleExport(ctx, module, "Database", class);
    return 0;
}

#ifdef JS_SHARED_LIBRARY
#define JS_INIT_MODULE js_init_module
#else
#define JS_INIT_MODULE js_init_module_sqlite3
#endif

JSModuleDef* JS_INIT_MODULE(JSContext* ctx, const char* name)
{
    JSModuleDef* module = JS_NewCModule(ctx, name, db_init);
    if (!module) {
        return NULL;
    }

    JS_AddModuleExport(ctx, module, "Database");
    return module;
}

/* ce: .mc; */
