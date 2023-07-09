cmake_minimum_required(VERSION 3.12)

# 网络工具模块
if (BUILD_NETWORKING)
    include(${CMAKE_CURRENT_LIST_DIR}/libutil/make.cmake)
endif ()

# HTTP 客户端/服务端模块
if (BUILD_NETWORKING)
    include(${CMAKE_CURRENT_LIST_DIR}/libhttp/make.cmake)
endif ()

# cJSON 模块
if (BUILD_NETWORKING)
    include(${CMAKE_CURRENT_LIST_DIR}/libcjson/make.cmake)
endif ()

# JSON-RPC 模块
if (BUILD_NETWORKING)
    include(${CMAKE_CURRENT_LIST_DIR}/libjsonrpc/make.cmake)
endif ()

# MQTT 客户端模块
if (BUILD_NETWORKING)
    include(${CMAKE_CURRENT_LIST_DIR}/libmqtt/make.cmake)
endif ()

# 网络协议示例
if (BUILD_NETWORKING)
    if (BUILD_NETWORKING_EXAMPLES)
        include(${CMAKE_CURRENT_LIST_DIR}/examples/make.cmake)
    endif ()
endif ()
