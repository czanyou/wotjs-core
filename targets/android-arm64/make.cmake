cmake_minimum_required(VERSION 3.12)

# 模块编译开关
set(BUILD_APP_JS    	ON)
set(BUILD_FAAD      	OFF)
set(BUILD_MBEDTLS   	ON)
set(BUILD_SQLITE_JS    	OFF)
set(BUILD_WITH_ANDROID  ON)

# 开发板/平台信息
set(TJS_ARCH        "arm64")
set(TJS_BOARD       "android")
set(TJS_ROOT        "~/system/wotjs/")

# 宏定义
add_definitions(-D_GNU_SOURCE)
add_definitions(-DCONFIG_ANDROID_LOG)

# Add share object flags
add_compile_options("-fPIC")
add_compile_options(-Wno-pointer-sign)

# Android 平台 NDK 编译选项
set(ANDROID ON)
set(ANDROID_PLATFORM android-19)
set(CMAKE_ANDROID_ARCH_ABI arm64-v8a)
set(CMAKE_ANDROID_NDK "/opt/android-ndk-r23b")
set(CMAKE_C_COMPILER_TARGET "${CMAKE_ANDROID_NDK}/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android30")
set(CMAKE_C_COMPILER "${CMAKE_C_COMPILER_TARGET}-clang")
set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_COMPILER "${CMAKE_C_COMPILER_TARGET}-clang++")
set(CMAKE_CXX_COMPILER_TARGET ${CMAKE_C_COMPILER_TARGET})
set(CMAKE_SYSTEM_NAME Android)
set(CMAKE_SYSTEM_PROCESSOR arm64)
set(CMAKE_SYSTEM_VERSION 19)
set(CMAKE_TOOLCHAIN_FILE "${CMAKE_ANDROID_NDK}/build/cmake/android.toolchain.cmake")
set(CMAKE_VERBOSE_MAKEFILE OFF)

message(STATUS "# CMAKE_ANDROID_NDK: ${CMAKE_ANDROID_NDK}")
message(STATUS "# ANDROID_PLATFORM: ${ANDROID_PLATFORM}")
