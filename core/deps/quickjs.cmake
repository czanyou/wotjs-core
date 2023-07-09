cmake_minimum_required(VERSION 3.4)

set(QUICKJS_DIR ${CMAKE_CURRENT_LIST_DIR}/quickjs)

set(SOURCES
    ${QUICKJS_DIR}/src/cutils.c
    ${QUICKJS_DIR}/src/libbf.c
    ${QUICKJS_DIR}/src/libregexp.c
    ${QUICKJS_DIR}/src/libunicode.c
    ${QUICKJS_DIR}/src/quickjs.c
)

if (BUILD_SHARED_LIBS)
	add_library(tjs_quickjs SHARED ${SOURCES})
	
else ()
	add_library(tjs_quickjs STATIC ${SOURCES})
endif ()

# flags
set(quickjs_cflags -Wall)
list(APPEND quickjs_cflags -Wno-array-bounds -Wno-unused-variable)

if (CMAKE_SYSTEM_NAME STREQUAL "Android")
    list(APPEND quickjs_cflags -Wno-implicit-const-int-float-conversion)
else ()
    list(APPEND quickjs_cflags -Wno-unused-but-set-variable)
endif ()

target_compile_options(tjs_quickjs PRIVATE ${quickjs_cflags})

# VERSION
file(STRINGS "${QUICKJS_DIR}/VERSION" QJS_VERSION_STR)
target_compile_definitions(tjs_quickjs PRIVATE QJS_VERSION_STR="${QJS_VERSION_STR}")
target_compile_definitions(tjs_quickjs PRIVATE CONFIG_BIGNUM CONFIG_VERSION="${QJS_VERSION_STR}")

if (CMAKE_BUILD_TYPE MATCHES Debug)
    target_compile_definitions(tjs_quickjs PRIVATE DUMP_LEAKS)
endif()

target_include_directories(tjs_quickjs PRIVATE ${QUICKJS_DIR}/src)
target_include_directories(tjs_quickjs PUBLIC ${QUICKJS_DIR}/include)

if (CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    target_link_libraries(tjs_quickjs atomic)
endif()
