cmake_minimum_required(VERSION 3.12)

# WoT.js core native module cmake file

set(CORE_DIR ${CMAKE_CURRENT_LIST_DIR})

###############################################################################

string(TOLOWER ${CMAKE_SYSTEM_NAME} TJS_PLATFORM)

message(STATUS "== Core Configuration:")
message(STATUS ".. QJS_VERSION_STR ............. [${QJS_VERSION_STR}]")
message(STATUS ".. TJS_COMPILER ................ [${TJS_COMPILER}]")
message(STATUS ".. TJS_PLATFORM ................ [${TJS_PLATFORM}]")
message(STATUS ".. TJS_ARCH .................... [${TJS_ARCH}]")
message(STATUS ".. TJS_ROOT .................... [${TJS_ROOT}]")
message(STATUS ".. TJS_BOARD ................... [${TJS_BOARD}]")
message(STATUS ".. TJS_VERSION ................. [${TJS_VERSION}]")

###############################################################################
# tjsc compiler execute

set(QJSC_SOURCES ${CORE_DIR}/src/tjsc.c)

add_executable(tjsc ${QJSC_SOURCES})
target_compile_definitions(tjsc PRIVATE CONFIG_BIGNUM QJS_VERSION_STR="${QJS_VERSION_STR}")
target_include_directories(tjsc PRIVATE ${QUICKJS_DIR}/include/)

if (BUILD_WITH_MINGW)
    target_link_libraries(tjsc tjs_quickjs)
else ()
    target_link_libraries(tjsc tjs_quickjs dl m)
endif ()

###############################################################################
# tjs core library

set(SOURCES
    ${CORE_DIR}/src/bootstrap.c
    ${CORE_DIR}/src/cli.c
    ${CORE_DIR}/src/dns.c
    ${CORE_DIR}/src/error.c
    ${CORE_DIR}/src/fs.c
    ${CORE_DIR}/src/gzip.c
    ${CORE_DIR}/src/hal.c
    ${CORE_DIR}/src/http.c
    ${CORE_DIR}/src/internal_modules.c
    ${CORE_DIR}/src/miniz.c
    ${CORE_DIR}/src/misc.c
    ${CORE_DIR}/src/modules.c
    ${CORE_DIR}/src/mqtt.c
    ${CORE_DIR}/src/os.c
    ${CORE_DIR}/src/process.c
    ${CORE_DIR}/src/signals.c
    ${CORE_DIR}/src/std.c
    ${CORE_DIR}/src/streams_pipe.c
    ${CORE_DIR}/src/streams_tcp.c
    ${CORE_DIR}/src/streams_tty.c
    ${CORE_DIR}/src/streams.c
    ${CORE_DIR}/src/timers.c
    ${CORE_DIR}/src/uart.c
    ${CORE_DIR}/src/udp.c
    ${CORE_DIR}/src/util.c
    ${CORE_DIR}/src/utils.c
    ${CORE_DIR}/src/version.c
    ${CORE_DIR}/src/vm.c
    ${CORE_DIR}/src/worker.c
    ${CMAKE_CURRENT_BINARY_DIR}/tjs-js.c
)

if (BUILD_MBEDTLS)
    message(STATUS "Build with mbedtls module.")
    set(SOURCES ${SOURCES} ${CORE_DIR}/src/streams_tls.c ${CORE_DIR}/src/tls.c ${CORE_DIR}/src/crypto.c)
endif ()

configure_file(${CORE_DIR}/src/version.h.in ${CMAKE_BINARY_DIR}/version.h @ONLY)

add_library(tjs_core STATIC ${SOURCES})
set_property(TARGET tjs_core PROPERTY CONFIG_BIGNUM VERSION ${TJS_VERSION} SOVERSION ${TJS_VERSION_MAJOR})

target_link_libraries(tjs_core tjs_miniz tjs_mqtt_packet tjs_http_parser tjs_quickjs tjs_networking tjs_util tjs_uv)

if (BUILD_STATIC_LIBS)
    target_link_libraries(tjs_core -static)
endif ()

target_include_directories(tjs_core PRIVATE ${CORE_DIR}/src/ )
target_include_directories(tjs_core PUBLIC ${CORE_DIR}/include/)
target_include_directories(tjs_core PUBLIC ${CMAKE_BINARY_DIR}/)

if (BUILD_APP_JS)
    target_compile_definitions(tjs_core PUBLIC BUILD_APP_JS)
endif ()

###############################################################################
# tjs execute

set(TJS_SOURCES ${CORE_DIR}/src/main.c)

if (BUILD_APP_JS)
    # 将应用程序脚本字节码和原生模块打包成一个单独的可执行文件
    message(STATUS "Build app.js modules.")
    set(TJS_SOURCES ${TJS_SOURCES} ${CMAKE_CURRENT_BINARY_DIR}/app-js.c)
endif ()

add_executable(tjs ${TJS_SOURCES})
target_link_libraries(tjs tjs_core)

# system libs
if (BUILD_WITH_ANDROID)
    target_link_libraries(tjs_uv dl m)

elseif (BUILD_WITH_MINGW)
    target_link_libraries(tjs_quickjs pthread)

elseif (LINUX)
    target_link_libraries(tjs_uv dl pthread rt m)
    
else ()
    target_link_libraries(tjs_uv dl pthread m)
endif ()

# sqlite3.js
if (BUILD_SQLITE_JS)
    message(STATUS "Build sqlite module.")
    target_link_libraries(tjs sqlite3js)
    target_compile_definitions(tjs_core PRIVATE BUILD_SQLITE_JS)
endif ()

# redis.js
if (BUILD_REDIS_JS)
    message(STATUS "Build redis module.")
    target_link_libraries(tjs redisjs)
    target_compile_definitions(tjs_core PRIVATE BUILD_REDIS_JS)
endif ()

if (BUILD_GPIO)
    add_definitions(-DCONFIG_USE_GPIO)
    target_link_libraries(tjs gpio)
endif ()
