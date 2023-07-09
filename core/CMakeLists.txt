cmake_minimum_required(VERSION 3.12)

project(TJS VERSION 19.8.81)

include(CheckCCompilerFlag)
include(../targets/common/make.cmake)

###############################################################################
# Cross compiler options
# determine the parameters of the compiler tool chain through BOARD_TYPE

# Development board type
if (NOT BOARD_TYPE)
  set(BOARD_TYPE local)
endif ()

set(TJS_BOARD ${BOARD_TYPE})
set(BUILD_MBEDTLS ON)

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

include(make.cmake)
