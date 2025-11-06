cmake_minimum_required(VERSION 3.12)

# 是否编译共享库
set(BUILD_SHARED_LIBS     OFF)
set(BUILD_APP_JS          ON)
set(BUILD_APP_BUILD_JS    ON)
set(BUILD_MBEDTLS         ON)
set(BUILD_SQLITE_JS       ON)
set(BUILD_REDIS_JS        ON)

set(CMAKE_BUILD_TYPE "Debug")
set(CMAKE_VERBOSE_MAKEFILE OFF)
set(CMAKE_C_STANDARD 99)

set(TJS_ARCH  "${CMAKE_SYSTEM_PROCESSOR}")
set(TJS_BOARD "local")
set(TJS_ROOT  "/usr/local/tjs/")

# Script module build type (Shared|Static)
if (APPLE)
  set(CMAKE_MACOSX_RPATH 0)
  set(TJS_BOARD "darwin")
endif ()

if (LINUX)
  set(TJS_BOARD "linux")
  set(TJS_ARCH  "x64")
  add_definitions(-DCONFIG_SYSLOG)
  
  # Add share object flags
  # Under 64bit Linux, you must add -fPIC option to compile a dynamic link library
  add_compile_options("-fPIC")

  # Retain function names, etc., to facilitate dlopen or debugging
  add_compile_options("-rdynamic")
endif ()

set (CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC")
set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fPIC")
