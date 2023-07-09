cmake_minimum_required(VERSION 3.12)

# 是否编译共享库
set(BUILD_SHARED_LIBS     OFF)

# 将 app 和主程序一起打包成单一可执行文件
set(BUILD_APP_JS          ON)

# 打包 build APP
set(BUILD_APP_BUILD_JS    ON)

# 生成 faad AAC 音频解码工具
set(BUILD_FAAD            OFF)

# 生成 mbedtls 加解密模块
set(BUILD_MBEDTLS         ON)

# 生成 mDNS 服务
set(BUILD_MDNS            OFF)

# 生成 sqlite 模块
set(BUILD_SQLITE_JS       OFF)

# 生成设备平台相关模块
set(BUILD_MEDIA_PLATFORMS OFF)

set(BUILD_PLATFORM_T31    OFF)

# 生成 tuya 服务
set(BUILD_CAMERA_DAEMON   OFF)

# 生成 utils 相关工具类模块
set(BUILD_NETWORKING      ON)
set(BUILD_NETWORKING_EXAMPLES OFF)

set(BUILD_REDIS_JS        OFF)

set(CMAKE_BUILD_TYPE "Debug")
set(CMAKE_VERBOSE_MAKEFILE OFF)
set(CMAKE_C_STANDARD 99)

set(TJS_ARCH  "${CMAKE_SYSTEM_PROCESSOR}")
set(TJS_BOARD "local")
set(TJS_ROOT  "/usr/local/tjs/")

# Script module build type (Shared|Static)
if (APPLE)
  set(CMAKE_MACOSX_RPATH 0)
endif ()

if (LINUX)
  add_definitions(-DCONFIG_SYSLOG)
  
  # Add share object flags
  # Under 64bit Linux, you must add -fPIC option to compile a dynamic link library
  add_compile_options("-fPIC")

  # Retain function names, etc., to facilitate dlopen or debugging
  add_compile_options("-rdynamic")
endif ()

set (CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC")
set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fPIC")
