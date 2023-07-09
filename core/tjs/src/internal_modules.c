#include "private.h"
#include "tjs.h"

#ifdef BUILD_REDIS_JS
JSModuleDef* js_init_module_redis(JSContext* ctx, const char* name);
#endif

#ifdef BUILD_SQLITE_JS
JSModuleDef* js_init_module_sqlite3(JSContext* ctx, const char* name);
#endif

int tjs_init_internal_modules(JSContext* ctx)
{

#ifdef BUILD_REDIS_JS
    js_init_module_redis(ctx, "@tjs/redis");
#endif

#ifdef BUILD_SQLITE_JS
    js_init_module_sqlite3(ctx, "@tjs/sqlite3");
#endif

	return 0;
}