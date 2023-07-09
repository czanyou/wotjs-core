cmake_minimum_required(VERSION 3.12)

set(JS_DIR ${CMAKE_CURRENT_LIST_DIR})

# core-js.c

set(core_js_files
    ${JS_DIR}/tjs/*.js
)

# build js files to c files
set(TJS_COMPILER "${CMAKE_SOURCE_DIR}/build/local/tjsc" CACHE STRING "Custom path to tjsc")

# 版本信息
configure_file(${JS_DIR}/version.json ${CMAKE_BINARY_DIR}/version.json @ONLY)

# message("-- # TJS_COMPILER: ${TJS_COMPILER}")
# message("-- # core_js_files: ${core_js_files}")

add_custom_command(
    COMMAND
        ${TJS_COMPILER} -o ${CMAKE_CURRENT_BINARY_DIR}/core-js.c -m ${core_js_files}
    DEPENDS
        ${TJS_COMPILER}
        ${core_js_files}
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/core-js.c
    COMMENT
        "Built core js files"
)
