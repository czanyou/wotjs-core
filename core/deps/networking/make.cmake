cmake_minimum_required(VERSION 3.12)

# 网络相关工具模块

set(LIBUVNET_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(UVNET_SOURCES
  ${LIBUVNET_DIR}/src/url/uri-parser.c
  ${LIBUVNET_DIR}/src/url/url-codec.c
  ${LIBUVNET_DIR}/src/net-transport.c
  ${LIBUVNET_DIR}/src/tcp-transport.c
  ${LIBUVNET_DIR}/src/udp-transport.c
)

# mbedtls
if (BUILD_MBEDTLS)
  set(UVNET_SOURCES ${UVNET_SOURCES}
      ${LIBUVNET_DIR}/src/tls/tls-context.c 
      ${LIBUVNET_DIR}/src/tls/uv-tls.c
      ${LIBUVNET_DIR}/src/tls-transport.c
  )
endif ()

add_library(tjs_networking STATIC ${UVNET_SOURCES})
target_link_libraries(tjs_networking tjs_util tjs_uv)
target_include_directories(tjs_networking PUBLIC ${LIBUVNET_DIR}/include/)

# mbedtls
if (BUILD_MBEDTLS)
  target_link_libraries(tjs_networking tjs_mbedtls)
endif ()

