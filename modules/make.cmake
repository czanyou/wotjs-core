cmake_minimum_required(VERSION 3.12)

set(MODULES_DIR ${CMAKE_CURRENT_LIST_DIR}/)

# 网络协议模块
if (BUILD_NETWORKING)
    include(${CMAKE_CURRENT_LIST_DIR}/networking/make.cmake)
endif ()

# Redis 内存数据库客户端模块
if (BUILD_REDIS_JS)
    include(${CMAKE_CURRENT_LIST_DIR}/redis/make.cmake)
endif ()

# Sqlite3 嵌入式数据库模块
if (BUILD_SQLITE_JS)
    include(${CMAKE_CURRENT_LIST_DIR}/sqlite/make.cmake)
endif ()
