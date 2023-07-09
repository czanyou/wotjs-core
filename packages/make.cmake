cmake_minimum_required(VERSION 3.12)

# mDNS 服务端/客户端
if (BUILD_MDNS)
    include(${CMAKE_CURRENT_LIST_DIR}/mdns/make.cmake)
endif ()
