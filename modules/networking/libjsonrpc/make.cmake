cmake_minimum_required(VERSION 3.12)

set(LIBJSONRPC_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(JSONRPC_SOURCES
    ${LIBJSONRPC_DIR}/source/jsonrpc/server.c
    ${LIBJSONRPC_DIR}/source/jsonrpc/client.c
)

add_library(tjs_jsonrpc STATIC ${JSONRPC_SOURCES})
target_link_libraries(tjs_jsonrpc tjs_cjson tjs_util)
target_include_directories(tjs_jsonrpc PUBLIC ${LIBJSONRPC_DIR}/include/)
target_include_directories(tjs_jsonrpc PRIVATE ${LIBUV_DIR}/include/)
