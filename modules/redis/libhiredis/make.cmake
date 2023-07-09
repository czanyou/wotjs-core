cmake_minimum_required(VERSION 3.12)

set(LIBREDIS_DIR ${CMAKE_CURRENT_LIST_DIR}/src)

# libhiredis

set(REDIS_SOURCES
  ${LIBREDIS_DIR}/alloc.c
  ${LIBREDIS_DIR}/async.c
  ${LIBREDIS_DIR}/dict.c
  ${LIBREDIS_DIR}/hiredis.c
  ${LIBREDIS_DIR}/net.c
  ${LIBREDIS_DIR}/read.c
  ${LIBREDIS_DIR}/sds.c
  ${LIBREDIS_DIR}/sockcompat.c
)

add_library(hiredis STATIC ${REDIS_SOURCES})
target_include_directories(hiredis PUBLIC ${LIBREDIS_DIR}/)

# redis_test

set(REDIS_TEST_SOURCES
  ${LIBREDIS_DIR}/examples/example-libuv.c
)

add_executable(redis_test ${REDIS_TEST_SOURCES})
target_link_libraries(redis_test hiredis tjs_uv m)
