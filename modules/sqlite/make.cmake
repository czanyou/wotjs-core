cmake_minimum_required(VERSION 3.12)

set(LIBSQLITE_DIR ${CMAKE_CURRENT_LIST_DIR}/)

# libsqlite3js

set(SQLITEJS_SOURCES
  ${LIBSQLITE_DIR}/src/sqlite3.c
  ${LIBSQLITE_DIR}/src/sqlite3-js.c
)

add_library(tjs_sqlite3 STATIC ${SQLITEJS_SOURCES})
target_include_directories(tjs_sqlite3 PUBLIC ${LIBSQLITE_DIR}/include/)
target_include_directories(tjs_sqlite3 PRIVATE ${LIBSQLITE_DIR}/include/)
target_link_libraries(tjs_sqlite3 tjs_quickjs)
