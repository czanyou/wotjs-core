cmake_minimum_required(VERSION 3.12)

set(LIBTM_UTILS_DIR ${CMAKE_CURRENT_LIST_DIR}/)

# WoT.js 模块工具库 - tjs module utils
# 包含了 js 和 c 程序都依赖的一些工具

set(TM_UTILS_SOURCES
    ${LIBTM_UTILS_DIR}/src/digest/md5.c
    ${LIBTM_UTILS_DIR}/src/digest/sha1.c
    ${LIBTM_UTILS_DIR}/src/encoding/base64.c
    ${LIBTM_UTILS_DIR}/src/encoding/hex.c
    ${LIBTM_UTILS_DIR}/src/util/dbuffer.c
    ${LIBTM_UTILS_DIR}/src/util/uart.c
    ${LIBTM_UTILS_DIR}/src/util/base64.c
    ${LIBTM_UTILS_DIR}/src/util/md5.c
    ${LIBTM_UTILS_DIR}/src/util/getopt.c
)

add_library(tjs_util STATIC ${TM_UTILS_SOURCES})

target_include_directories(tjs_util PUBLIC ${LIBTM_UTILS_DIR}/include/)
