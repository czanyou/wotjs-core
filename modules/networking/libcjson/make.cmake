cmake_minimum_required(VERSION 3.12)

set(CJSON_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(CJSON_SOURCES
  ${CJSON_DIR}/src/cJSON.c
)

add_library(tjs_cjson STATIC ${CJSON_SOURCES})
target_include_directories(tjs_cjson PUBLIC ${CJSON_DIR}/include/)
