cmake_minimum_required(VERSION 2.8)

set(MINIZ_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(SOURCES
    ${MINIZ_DIR}/src/miniz.c
    ${MINIZ_DIR}/src/miniz_tdef.c
    ${MINIZ_DIR}/src/miniz_tinfl.c
    ${MINIZ_DIR}/src/miniz_zip.c
    ${MINIZ_DIR}/miniz-js.c
)

add_library(miniz STATIC ${SOURCES})

target_include_directories(miniz PRIVATE
    ${MINIZ_DIR}/include/
)
