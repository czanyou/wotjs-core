cmake_minimum_required(VERSION 3.12)

set(LIBMINIZ_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(SOURCES
    ${LIBMINIZ_DIR}/src/miniz.c
    ${LIBMINIZ_DIR}/src/miniz_tdef.c
    ${LIBMINIZ_DIR}/src/miniz_tinfl.c
    ${LIBMINIZ_DIR}/src/miniz_zip.c
)

add_library(tjs_miniz STATIC ${SOURCES})

target_include_directories(tjs_miniz PUBLIC ${LIBMINIZ_DIR}/include/)
