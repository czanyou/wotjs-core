cmake_minimum_required(VERSION 3.12)

set(LIBUV_DIR ${CMAKE_CURRENT_LIST_DIR}/uv)

include(CheckTypeSize)

set(SOURCES
    ${LIBUV_DIR}/include/uv.h
    ${LIBUV_DIR}/include/uv/tree.h
    ${LIBUV_DIR}/include/uv/errno.h
    ${LIBUV_DIR}/include/uv/threadpool.h
    ${LIBUV_DIR}/include/uv/version.h
    ${LIBUV_DIR}/src/fs-poll.c
    ${LIBUV_DIR}/src/heap-inl.h
    ${LIBUV_DIR}/src/idna.c
    ${LIBUV_DIR}/src/inet.c
    ${LIBUV_DIR}/src/queue.h
    ${LIBUV_DIR}/src/random.c
    ${LIBUV_DIR}/src/strtok.c
    ${LIBUV_DIR}/src/strscpy.c
    ${LIBUV_DIR}/src/threadpool.c
    ${LIBUV_DIR}/src/timer.c
    ${LIBUV_DIR}/src/uv-common.c
    ${LIBUV_DIR}/src/uv-common.h
    ${LIBUV_DIR}/src/uv-data-getter-setters.c
    ${LIBUV_DIR}/src/version.c
)

if (CMAKE_SYSTEM_NAME STREQUAL "Windows")
    set(SOURCES ${SOURCES}
        ${LIBUV_DIR}/src/win/async.c
        ${LIBUV_DIR}/src/win/core.c
        ${LIBUV_DIR}/src/win/detect-wakeup.c
        ${LIBUV_DIR}/src/win/dl.c
        ${LIBUV_DIR}/src/win/error.c
        ${LIBUV_DIR}/src/win/fs-event.c
        ${LIBUV_DIR}/src/win/fs.c
        ${LIBUV_DIR}/src/win/getaddrinfo.c
        ${LIBUV_DIR}/src/win/getnameinfo.c
        ${LIBUV_DIR}/src/win/handle.c
        ${LIBUV_DIR}/src/win/loop-watcher.c
        ${LIBUV_DIR}/src/win/pipe.c
        ${LIBUV_DIR}/src/win/poll.c
        ${LIBUV_DIR}/src/win/process-stdio.c
        ${LIBUV_DIR}/src/win/process.c
        ${LIBUV_DIR}/src/win/signal.c
        ${LIBUV_DIR}/src/win/snprintf.c
        ${LIBUV_DIR}/src/win/stream.c
        ${LIBUV_DIR}/src/win/tcp.c
        ${LIBUV_DIR}/src/win/thread.c
        ${LIBUV_DIR}/src/win/tty.c
        ${LIBUV_DIR}/src/win/udp.c
        ${LIBUV_DIR}/src/win/util.c
        ${LIBUV_DIR}/src/win/winapi.c
        ${LIBUV_DIR}/src/win/winsock.c
    )
else ()
    set(SOURCES ${SOURCES}
        ${LIBUV_DIR}/src/unix/async.c
        ${LIBUV_DIR}/src/unix/core.c
        ${LIBUV_DIR}/src/unix/dl.c
        ${LIBUV_DIR}/src/unix/fs.c
        ${LIBUV_DIR}/src/unix/getaddrinfo.c
        ${LIBUV_DIR}/src/unix/getnameinfo.c
        ${LIBUV_DIR}/src/unix/loop.c
        ${LIBUV_DIR}/src/unix/loop-watcher.c
        ${LIBUV_DIR}/src/unix/pipe.c
        ${LIBUV_DIR}/src/unix/poll.c
        ${LIBUV_DIR}/src/unix/process.c
        ${LIBUV_DIR}/src/unix/random-devurandom.c
        ${LIBUV_DIR}/src/unix/random-getentropy.c
        ${LIBUV_DIR}/src/unix/random-getrandom.c
        ${LIBUV_DIR}/src/unix/signal.c
        ${LIBUV_DIR}/src/unix/stream.c
        ${LIBUV_DIR}/src/unix/tcp.c
        ${LIBUV_DIR}/src/unix/thread.c
        ${LIBUV_DIR}/src/unix/tty.c
        ${LIBUV_DIR}/src/unix/udp.c
    )
endif ()

## Linux
if (CMAKE_SYSTEM_NAME STREQUAL "Linux")
    set(SOURCES ${SOURCES}
        ${LIBUV_DIR}/src/unix/linux-core.c
        ${LIBUV_DIR}/src/unix/linux-inotify.c
        ${LIBUV_DIR}/src/unix/linux-syscalls.c
        ${LIBUV_DIR}/src/unix/procfs-exepath.c
        ${LIBUV_DIR}/src/unix/epoll.c
        ${LIBUV_DIR}/src/unix/proctitle.c
        ${LIBUV_DIR}/src/unix/sysinfo-loadavg.c
        ${LIBUV_DIR}/src/unix/sysinfo-memory.c
        ${LIBUV_DIR}/src/unix/pthread-fixes.c
        ${LIBUV_DIR}/src/unix/random-sysctl-linux.c
    )
endif ()

if (CMAKE_SYSTEM_NAME STREQUAL "Android")
    set(SOURCES ${SOURCES}
        ${LIBUV_DIR}/src/unix/android-ifaddrs.c
        ${LIBUV_DIR}/src/unix/linux-core.c
        ${LIBUV_DIR}/src/unix/linux-inotify.c
        ${LIBUV_DIR}/src/unix/linux-syscalls.c
        ${LIBUV_DIR}/src/unix/procfs-exepath.c
        ${LIBUV_DIR}/src/unix/epoll.c
        ${LIBUV_DIR}/src/unix/proctitle.c
        ${LIBUV_DIR}/src/unix/sysinfo-loadavg.c
        ${LIBUV_DIR}/src/unix/sysinfo-memory.c
        ${LIBUV_DIR}/src/unix/pthread-fixes.c
    )
endif ()

## Darwin
if (CMAKE_SYSTEM_NAME STREQUAL "Darwin")
    set(SOURCES ${SOURCES}
        ${LIBUV_DIR}/src/unix/bsd-ifaddrs.c
        ${LIBUV_DIR}/src/unix/darwin-proctitle.c
        ${LIBUV_DIR}/src/unix/darwin.c
        ${LIBUV_DIR}/src/unix/fsevents.c
        ${LIBUV_DIR}/src/unix/kqueue.c
        ${LIBUV_DIR}/src/unix/proctitle.c
    )
endif ()

add_library(tjs_uv STATIC ${SOURCES})
set_property(TARGET tjs_uv PROPERTY POSITION_INDEPENDENT_CODE ON)

target_include_directories(tjs_uv PRIVATE ${LIBUV_DIR}/src)
target_include_directories(tjs_uv PUBLIC ${LIBUV_DIR}/include)

check_type_size("void*" SIZEOF_VOID_P)
if (SIZEOF_VOID_P EQUAL 8)
    target_compile_definitions(tjs_uv PRIVATE _FILE_OFFSET_BITS=64 _LARGEFILE_SOURCE)
endif ()

if (CMAKE_SYSTEM_NAME STREQUAL "Windows")
    target_compile_definitions(tjs_uv PRIVATE _WIN32_WINNT=0x0600 _CRT_SECURE_NO_WARNINGS _GNU_SOURCE)
    target_link_libraries(tjs_uv ws2_32 shell32 psapi iphlpapi advapi32 userenv)

else ()
    target_compile_definitions(tjs_uv PRIVATE _GNU_SOURCE)
    target_include_directories(tjs_uv PRIVATE ${LIBUV_DIR}/src/unix)
endif ()

if (CMAKE_SYSTEM_NAME STREQUAL "Darwin")
    target_compile_definitions(tjs_uv PRIVATE _DARWIN_USE_64_BIT_INODE)
    find_library(FOUNDATION_LIBRARY Foundation)
    find_library(CORESERVICES_LIBRARY CoreServices)
    find_library(APPLICATION_SERVICES_LIBRARY ApplicationServices)
    target_link_libraries(tjs_uv ${FOUNDATION_LIBRARY} ${CORESERVICES_LIBRARY} ${APPLICATION_SERVICES_LIBRARY})
endif ()
