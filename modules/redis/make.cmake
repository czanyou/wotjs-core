cmake_minimum_required(VERSION 3.12)

include(${CMAKE_CURRENT_LIST_DIR}/libhiredis/make.cmake)

if (BUILD_QUICKJS)
    include(${CMAKE_CURRENT_LIST_DIR}/libredisjs/make.cmake)
endif ()