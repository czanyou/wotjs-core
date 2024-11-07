cmake_minimum_required(VERSION 3.12)

set(MDNS_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(LIBMDNS_SOURCES
  ${MDNS_DIR}/src/libmdnsd/1035.c
  ${MDNS_DIR}/src/libmdnsd/log.c
  ${MDNS_DIR}/src/libmdnsd/mdnsd.c
  ${MDNS_DIR}/src/libmdnsd/pidfile.c
  ${MDNS_DIR}/src/libmdnsd/sdtxt.c
  ${MDNS_DIR}/src/libmdnsd/strlcpy.c
  ${MDNS_DIR}/src/libmdnsd/utimensat.c
  ${MDNS_DIR}/src/libmdnsd/xht.c
)

set(MDNSD_SOURCES
  ${MDNS_DIR}/src/addr.c
  ${MDNS_DIR}/src/conf.c
  ${MDNS_DIR}/src/mdnsd.c
)

set(MSCAN_SOURCES
  ${MDNS_DIR}/src/addr.c
  ${MDNS_DIR}/src/conf.c
  ${MDNS_DIR}/src/mquery.c
)

add_library(mdns SHARED ${LIBMDNS_SOURCES})

# 需要添加这个选项才能通过一些和 POSIX 兼容性相关的编译
target_compile_definitions(mdns PRIVATE _GNU_SOURCE)

# mdnsd 服务端
add_executable(mdnsd ${MDNSD_SOURCES})
target_link_libraries(mdnsd mdns)
target_include_directories(mdnsd PRIVATE ${MDNS_DIR}/src/)

# mscan 客户端
add_executable(mscan ${MSCAN_SOURCES})
target_link_libraries(mscan mdns)
target_include_directories(mscan PRIVATE ${MDNS_DIR}/src/)
