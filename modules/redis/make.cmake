cmake_minimum_required(VERSION 3.12)

set(LIBREDIS_DIR ${CMAKE_CURRENT_LIST_DIR}/libhiredis/src)

# libhiredis

set(REDISJS_SOURCES
  ${LIBREDIS_DIR}/alloc.c
  ${LIBREDIS_DIR}/async.c
  ${LIBREDIS_DIR}/dict.c
  ${LIBREDIS_DIR}/hiredis.c
  ${LIBREDIS_DIR}/net.c
  ${LIBREDIS_DIR}/read.c
  ${LIBREDIS_DIR}/sds.c
  ${LIBREDIS_DIR}/sockcompat.c
)

set(LIBREDISJS_DIR ${CMAKE_CURRENT_LIST_DIR}/libredisjs/src)

set(REDISJS_SOURCES ${REDISJS_SOURCES}
  ${LIBREDISJS_DIR}/redis-js.c
)

add_library(tjs_redis STATIC ${REDISJS_SOURCES})
target_include_directories(tjs_redis PUBLIC ${LIBREDIS_DIR}/)
target_include_directories(tjs_redis PUBLIC ${LIBREDISJS_DIR}/)
target_link_libraries(tjs_redis tjs_core tjs_quickjs tjs_uv m)
