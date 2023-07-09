cmake_minimum_required(VERSION 2.8)

set(HTTP_PARSER_DIR ${CMAKE_CURRENT_LIST_DIR}/http)

set(SOURCES
    ${HTTP_PARSER_DIR}/http_parser.c
)

add_library(http_parser STATIC ${SOURCES})

target_include_directories(http_parser PRIVATE ${HTTP_PARSER_DIR}/)
