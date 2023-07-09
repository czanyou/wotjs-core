cmake_minimum_required(VERSION 2.8)

project(WOTJSCORE C)

include(CheckCCompilerFlag)

set(TJS_VERSION_MAJOR 19)
set(TJS_VERSION_MINOR 6)
set(TJS_VERSION_PATCH 53)

set(TJS_VERSION "${TJS_VERSION_MAJOR}.${TJS_VERSION_MINOR}.${TJS_VERSION_PATCH}")
set(CMAKE_VERBOSE_MAKEFILE OFF)

###############################################################################
# Cross compiler options
# determine the parameters of the compiler tool chain through BOARD_TYPE

# Development board type
if (NOT BOARD_TYPE)
  set(BOARD_TYPE local)
endif ()

set(TJS_BOARD ${BOARD_TYPE})

###############################################################################
# OS build options

# Linux
if ("${CMAKE_SYSTEM_NAME}" MATCHES "Linux")
  set(LINUX ON)
endif ()

if (LINUX)
  # Add share object flags
  # Under 64bit Linux, you must add -fPIC option to compile a dynamic link library
  add_compile_options("-fPIC")

  # Retain function names, etc., to facilitate dlopen or debugging
  add_compile_options("-rdynamic")
endif ()

###############################################################################
# build sub directory

include(deps/quickjs.cmake)
include(deps/libuv.cmake)
include(deps/http-parser.cmake)
include(deps/mqtt/make.cmake)
include(deps/miniz/make.cmake)
include(deps/mbedtls.cmake)
include(js/make.cmake)
include(core.cmake)

###############################################################################
# echo settings

message(STATUS "")
message(STATUS "== Project Configuration:")
message(STATUS ".. CMAKE_C_COMPILER ............ [${CMAKE_C_COMPILER}]")
message(STATUS ".. CMAKE_SYSTEM_NAME ........... [${CMAKE_SYSTEM_NAME}]")
message(STATUS ".. CMAKE_SYSTEM_VERSION ........ [${CMAKE_SYSTEM_VERSION}]")
message(STATUS ".. CMAKE_SYSTEM_PROCESSOR ...... [${CMAKE_SYSTEM_PROCESSOR}]")
message(STATUS ".. CMAKE_C_FLAGS ............... [${CMAKE_C_FLAGS}]")
message(STATUS ".. CMAKE_CXX_FLAGS ............. [${CMAKE_CXX_FLAGS}]")
message(STATUS ".. CMAKE_C_STANDARD ............ [${CMAKE_C_STANDARD}]")
message(STATUS ".. CMAKE_BUILD_TYPE ............ [${CMAKE_BUILD_TYPE}]")
message(STATUS ".. CMAKE_EXE_LINKER_FLAGS ...... [${CMAKE_EXE_LINKER_FLAGS}]")
message(STATUS ".. CMAKE_SHARED_LINKER_FLAGS ... [${CMAKE_SHARED_LINKER_FLAGS}]")
message(STATUS "==")
