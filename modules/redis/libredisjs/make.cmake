cmake_minimum_required(VERSION 3.12)

set(LIBREDISJS_DIR ${CMAKE_CURRENT_LIST_DIR}/src)

set(REDISJS_SOURCES
  ${LIBREDISJS_DIR}/redis-js.c
)

add_library(redisjs STATIC ${REDISJS_SOURCES})
target_include_directories(redisjs PUBLIC ${LIBREDISJS_DIR}/)

target_link_libraries(redisjs tjs_core tjs_quickjs hiredis tjs_uv m)
