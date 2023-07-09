cmake_minimum_required(VERSION 3.12)

set(LIBHTTP_PARSER_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(SOURCES
    ${LIBHTTP_PARSER_DIR}/src/http_parser.c
)

add_library(tjs_http_parser STATIC ${SOURCES})

target_include_directories(tjs_http_parser PUBLIC ${LIBHTTP_PARSER_DIR}/src)
