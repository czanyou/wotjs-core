cmake_minimum_required(VERSION 3.12)

set(LIBHTTP_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(LIBHTTP_SOURCES
  ${LIBHTTP_DIR}/src/http-client.c
  ${LIBHTTP_DIR}/src/http-header-auth.c
  ${LIBHTTP_DIR}/src/http-header-authorization.c
  ${LIBHTTP_DIR}/src/http-header-content-type.c
  ${LIBHTTP_DIR}/src/http-header-expires.c
  ${LIBHTTP_DIR}/src/http-header-host.c
  ${LIBHTTP_DIR}/src/http-header-range.c
  ${LIBHTTP_DIR}/src/http-header-www-authenticate.c
  ${LIBHTTP_DIR}/src/http-reason.c
  ${LIBHTTP_DIR}/src/http-request.c
  ${LIBHTTP_DIR}/src/http-server.c
  ${LIBHTTP_DIR}/src/http-parser.c
  ${LIBHTTP_DIR}/src/rfc822-datetime.c
)

add_library(tjs_http STATIC ${LIBHTTP_SOURCES})
target_link_libraries(tjs_http tjs_http_parser tjs_networking_util tjs_uv)

target_include_directories(tjs_http PUBLIC ${LIBHTTP_DIR}/include/)
target_include_directories(tjs_http PRIVATE ${LIBUV_DIR}/include/)
target_include_directories(tjs_http PRIVATE ${LIBUVTLS_DIR}/include/)
