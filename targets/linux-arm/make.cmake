cmake_minimum_required(VERSION 3.12)

# 模块编译开关
set(BUILD_APP_BUILD_JS ON) # 嵌入 Build APP 脚本
set(BUILD_APP_JS       ON) # 嵌入 APP 脚本
set(BUILD_MBEDTLS      ON) # medtls 嵌入式 TLS
set(BUILD_REDIS_JS     OFF) # 嵌入 Redis 客户端
set(BUILD_SQLITE_JS    OFF) # sqlite3 嵌入式数据库

# 开发板/平台信息
set(TJS_BOARD       "linux")
set(TJS_ROOT        "/usr/local/tjs/")

# CMake 编译选项
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_C_STANDARD 99)

# ARM 嵌入式板
set(TJS_ARCH        "arm")
set(CMAKE_C_COMPILER "/opt/arm-linux-gnueabihf/bin/arm-linux-gnueabihf-gcc")
set(CMAKE_CXX_COMPILER "/opt/arm-linux-gnueabihf/bin/arm-linux-gnueabihf-g++")

# 其他编译选项和宏定义
add_compile_options("-fPIC")
add_definitions(-DCONFIG_SYSLOG) # 支持 syslog API
add_definitions(-D_NO_GLIBC)
add_definitions(-D_GNU_SOURCE)
