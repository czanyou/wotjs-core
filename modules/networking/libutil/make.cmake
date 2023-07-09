cmake_minimum_required(VERSION 3.12)

# 网络相关工具模块

set(LIBNETWORKING_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(NETWORKING_SOURCES
  ${LIBNETWORKING_DIR}/source/util/darray.c
  ${LIBNETWORKING_DIR}/source/util/uuid.c
  ${LIBNETWORKING_DIR}/source/digest/md5.c
)

add_library(tjs_networking_util STATIC ${NETWORKING_SOURCES})
target_link_libraries(tjs_networking_util tjs_networking tjs_util tjs_uv)
target_include_directories(tjs_networking_util PUBLIC ${LIBNETWORKING_DIR}/include/)

