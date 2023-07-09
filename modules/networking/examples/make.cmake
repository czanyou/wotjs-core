cmake_minimum_required(VERSION 3.12)

set(NET_EXAMPLES_DIR ${CMAKE_CURRENT_LIST_DIR}/)

# curl

set(HTTP_CURL_SOURCES
  ${NET_EXAMPLES_DIR}/src/curl.c
)

add_executable(curl ${HTTP_CURL_SOURCES})
target_link_libraries(curl tjs_http m)

# httpd

set(HTTP_CURL_SOURCES
  ${NET_EXAMPLES_DIR}/src/httpd.c
)

add_executable(httpd ${HTTP_CURL_SOURCES})
target_link_libraries(httpd tjs_http m)

# mqtt_test

set(MQTT_TEST_SOURCES
  ${NET_EXAMPLES_DIR}/src/mqtt-test.c
)

add_executable(mqtt_test ${MQTT_TEST_SOURCES})
target_link_libraries(mqtt_test tjs_mqtt tjs_cjson tjs_uv m)

# jsonrpc_test

set(RPC_TEST_SOURCES
  ${NET_EXAMPLES_DIR}/src/jsonrpc-test.c
)

add_executable(jsonrpc_test ${RPC_TEST_SOURCES})
target_link_libraries(jsonrpc_test tjs_jsonrpc tjs_cjson tjs_uv m)

# pipe_sub

set(PIPE_SUB_SOURCES
  ${NET_EXAMPLES_DIR}/src/pipe-sub.c
)

#add_executable(pipe_sub ${PIPE_SUB_SOURCES})
#target_link_libraries(pipe_sub tjs_uv m)
#target_include_directories(pipe_sub PRIVATE ${LIBUV_DIR}/include/)

# pipe_main

set(PIPE_MAIN_SOURCES
  ${NET_EXAMPLES_DIR}/src/pipe-main.c
)

#add_executable(pipe_main ${PIPE_MAIN_SOURCES})
#target_link_libraries(pipe_main tjs_uv m)
#target_include_directories(pipe_main PRIVATE ${LIBUV_DIR}/include/)
