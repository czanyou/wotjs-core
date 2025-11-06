cmake_minimum_required(VERSION 3.12)

set(MODULES_DIR ${CMAKE_CURRENT_LIST_DIR}/)

# Redis 内存数据库客户端模块
if (BUILD_REDIS_JS)
    include(${CMAKE_CURRENT_LIST_DIR}/redis/make.cmake)
endif ()

# Sqlite3 嵌入式数据库模块
if (BUILD_SQLITE_JS)
    include(${CMAKE_CURRENT_LIST_DIR}/sqlite/make.cmake)
endif ()
