cmake_minimum_required(VERSION 3.4)

set(QUICKJS_DIR ${CMAKE_CURRENT_LIST_DIR}/quickjs)

include_directories(${QUICKJS_DIR}/include/)

add_library(quickjs STATIC
    ${QUICKJS_DIR}/src/cutils.c
    ${QUICKJS_DIR}/src/libbf.c
    ${QUICKJS_DIR}/src/libregexp.c
    ${QUICKJS_DIR}/src/libunicode.c
    ${QUICKJS_DIR}/src/quickjs.c
)

# flags
set(quickjs_cflags -Wall)
list(APPEND quickjs_cflags -Wno-array-bounds -Wno-unused-variable -Wno-unused-but-set-variable)
target_compile_options(quickjs PRIVATE ${quickjs_cflags})

# VERSION
file(STRINGS "${QUICKJS_DIR}/VERSION" QJS_VERSION_STR)
target_compile_definitions(quickjs PRIVATE QJS_VERSION_STR="${QJS_VERSION_STR}")
target_compile_definitions(quickjs PRIVATE CONFIG_BIGNUM CONFIG_VERSION="${QJS_VERSION_STR}")

if (CMAKE_BUILD_TYPE MATCHES Debug)
    target_compile_definitions(quickjs PRIVATE DUMP_LEAKS)
endif()

target_include_directories(quickjs PRIVATE ${QUICKJS_DIR}/src)

if ("${CMAKE_CXX_COMPILER_ID}" STREQUAL "GNU")
    target_link_libraries(quickjs atomic)
endif()
