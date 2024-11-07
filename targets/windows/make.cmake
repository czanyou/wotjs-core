cmake_minimum_required(VERSION 3.12)

set(BUILD_MBEDTLS      ON)
set(BUILD_APP_JS       ON)
set(BUILD_APP_WOT_JS   ON)
set(BUILD_APP_BUILD_JS ON)
set(BUILD_WITH_MINGW   ON)

set(TJS_ARCH     "amd64")
set(TJS_BOARD    "windows")

# Set the root path name
set(TJS_ROOT     "C:/wotjs/")

add_definitions(-DOS_WINDOWS)
add_link_options(-static)
add_link_options(-Wl,-Bstatic)

# Set the target system type to `Windows`: 
set(WIN32 TRUE)
set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_VERSION 8.0)
set(CMAKE_SYSTEM_PROCESSOR x86_64)
set(CMAKE_C_STANDARD 99)

# 64bit
set(CMAKE_C_COMPILER "x86_64-w64-mingw32-gcc")
set(CMAKE_CXX_COMPILER "x86_64-w64-mingw32-g++")

# Clear `-rdynamic` link option
set(CMAKE_SHARED_LIBRARY_LINK_C_FLAGS)

# Verbose
set(CMAKE_VERBOSE_MAKEFILE OFF)
