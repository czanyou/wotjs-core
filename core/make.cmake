cmake_minimum_required(VERSION 3.12)

if (BUILD_MBEDTLS)
  add_definitions(-DCONFIG_MBEDTLS)
  include(${CMAKE_CURRENT_LIST_DIR}/deps/mbedtls.cmake)
endif ()

set(BUILD_QUICKJS ON)

include(${CMAKE_CURRENT_LIST_DIR}/deps/quickjs.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/deps/libuv.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/deps/http/make.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/deps/mqtt/make.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/deps/miniz/make.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/deps/util/make.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/deps/networking/make.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/tjs/make.cmake)
include(${CMAKE_CURRENT_LIST_DIR}/js/make.cmake)
