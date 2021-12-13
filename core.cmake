cmake_minimum_required(VERSION 2.8)

# WoT.js core native module cmake file

set(CORE_DIR ${CMAKE_CURRENT_LIST_DIR})

include_directories(${CORE_DIR}/include)

# tjsc compiler execute

set(QJSC_SOURCES ${CORE_DIR}/src/qjsc.c)

add_executable(tjsc ${QJSC_SOURCES})

if (BUILD_WITH_MINGW)
    target_link_libraries(tjsc quickjs)
else ()
    target_link_libraries(tjsc quickjs dl m)
endif ()

target_compile_definitions(tjsc PRIVATE CONFIG_BIGNUM QJS_VERSION_STR="${QJS_VERSION_STR}")

# tjs core library

set(SOURCES
    ${CORE_DIR}/src/bootstrap.c
    ${CORE_DIR}/src/crypto.c
    ${CORE_DIR}/src/dns.c
    ${CORE_DIR}/src/error.c
    ${CORE_DIR}/src/fs.c
    ${CORE_DIR}/src/hal.c
    ${CORE_DIR}/src/http.c
    ${CORE_DIR}/src/modules.c
    ${CORE_DIR}/src/misc.c
    ${CORE_DIR}/src/os.c
    ${CORE_DIR}/src/process.c
    ${CORE_DIR}/src/signals.c
    ${CORE_DIR}/src/std.c
    ${CORE_DIR}/src/util/sha1.c
    ${CORE_DIR}/src/util/md5.c
    ${CORE_DIR}/src/util/base64.c
    ${CORE_DIR}/src/util/hex.c
    ${CORE_DIR}/src/streams.c
    ${CORE_DIR}/src/timers.c
    ${CORE_DIR}/src/uart.c
    ${CORE_DIR}/src/udp.c
    ${CORE_DIR}/src/util.c
    ${CORE_DIR}/src/utils.c
    ${CORE_DIR}/src/version.c
    ${CORE_DIR}/src/vm.c
    ${CORE_DIR}/src/worker.c
    ${CORE_DIR}/src/tls/uv-tls-port.c
    ${CORE_DIR}/src/tls/uv-tls.c
    ${CORE_DIR}/src/tls.c
    ${CMAKE_CURRENT_BINARY_DIR}/core-js.c
)

# 将应用程序脚本字节码和原生模块打包成一个单独的可执行文件
if (BUILD_APP_JS)
    set(SOURCES ${SOURCES} ${CMAKE_CURRENT_BINARY_DIR}/app-js.c)
endif ()

add_library(core STATIC ${SOURCES})
set_property(TARGET core PROPERTY CONFIG_BIGNUM VERSION ${TJS_VERSION} SOVERSION ${TJS_VERSION_MAJOR})

target_include_directories(core PRIVATE ${CORE_DIR}/src )

string(TOLOWER ${CMAKE_SYSTEM_NAME} TJS_PLATFORM)

message(STATUS "== Core Configuration:")
message(STATUS ".. QJS_VERSION_STR ............. [${QJS_VERSION_STR}]")
message(STATUS ".. TJS_PLATFORM ................ [${TJS_PLATFORM}]")
message(STATUS ".. TJS_ARCH .................... [${TJS_ARCH}]")
message(STATUS ".. TJS_ROOT .................... [${TJS_ROOT}]")
message(STATUS ".. TJS_BOARD ................... [${TJS_BOARD}]")
message(STATUS ".. TJS_VERSION ................. [${TJS_VERSION}]")

target_compile_definitions(core PRIVATE
    QJS_VERSION_STR="${QJS_VERSION_STR}"
    TJS_PLATFORM="${TJS_PLATFORM}"
    TJS_ARCH="${TJS_ARCH}"
    TJS_BOARD="${TJS_BOARD}"
    TJS_VERSION_MAJOR=${TJS_VERSION_MAJOR}
    TJS_VERSION_MINOR=${TJS_VERSION_MINOR}
    TJS_VERSION_PATCH=${TJS_VERSION_PATCH}
)

if (TJS_ROOT)
    target_compile_definitions(core PRIVATE TJS_ROOT="${TJS_ROOT}")
endif ()

if (BUILD_REPL)
    target_compile_definitions(core PRIVATE CONFIG_TJS_REPL)
endif ()

if (BUILD_APP_JS)
    target_compile_definitions(core PRIVATE CONFIG_TJS_APPJS)
endif ()

# tjs execute

set(TJS_SOURCES ${CORE_DIR}/src/cli.c)

add_executable(tjs ${TJS_SOURCES})
target_include_directories(tjs PRIVATE ${CORE_DIR}/src)

if (BUILD_WITH_MINGW)
    target_link_libraries(tjs core mbedtls miniz mqtt http_parser uv quickjs)
else ()
    target_link_libraries(tjs core mbedtls miniz mqtt http_parser uv quickjs dl rt pthread m)
endif ()

if (BUILD_APP_JS)
    target_compile_definitions(tjs PRIVATE CONFIG_TJS_APPJS)
endif ()
