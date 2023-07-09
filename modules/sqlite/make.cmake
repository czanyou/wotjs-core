cmake_minimum_required(VERSION 3.12)

set(LIBSQLITE_DIR ${CMAKE_CURRENT_LIST_DIR}/)

# libsqlite3

set(SQLITE_SOURCES
  ${LIBSQLITE_DIR}/src/sqlite3.c
)

add_library(sqlite3 STATIC ${SQLITE_SOURCES})
target_include_directories(sqlite3 PRIVATE ${LIBSQLITE_DIR}/include/)

# libsqlite3js

if (BUILD_QUICKJS)

  set(SQLITEJS_SOURCES
    ${LIBSQLITE_DIR}/src/sqlite3-js.c
  )

  add_library(sqlite3js STATIC ${SQLITEJS_SOURCES})
  target_include_directories(sqlite3js PUBLIC ${LIBSQLITE_DIR}/include/)

  target_link_libraries(sqlite3js tjs_quickjs sqlite3)

endif ()