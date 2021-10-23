cmake_minimum_required(VERSION 2.8)

set(JS_DIR ${CMAKE_CURRENT_LIST_DIR})

# core-js.c

set(core_js_files
    ${JS_DIR}/bootstrap/*.js
    ${JS_DIR}/core/*.js
    ${JS_DIR}/ext/*.js
    ${JS_DIR}/internal/*.js
    ${JS_DIR}/net/*.js
)

# build js files to c files
if ("${BOARD_TYPE}" MATCHES "local")
set(CUSTOM_QJSC "${CMAKE_CURRENT_BINARY_DIR}/tjsc" CACHE STRING "Custom path to tjsc")
else ()
set(CUSTOM_QJSC "${PROJECT_ROOT_DIR}/build/local/tjsc" CACHE STRING "Custom path to tjsc")
endif ()

message("-- # QJSC: ${CUSTOM_QJSC}")

add_custom_command(
    COMMAND
        ${CUSTOM_QJSC}
        -o ${CMAKE_CURRENT_BINARY_DIR}/core-js.c
        -m ${core_js_files}
    DEPENDS
        ${CUSTOM_QJSC}
        ${core_js_files}
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/core-js.c
)
