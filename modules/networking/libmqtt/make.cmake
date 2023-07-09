cmake_minimum_required(VERSION 3.12)

# 网络相关工具模块

set(LIBMQTTC_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(MQTTC_SOURCES
  ${LIBMQTTC_DIR}/source/mqtt/mqtt-client.c
)

add_library(tjs_mqtt STATIC ${MQTTC_SOURCES})
target_link_libraries(tjs_mqtt tjs_mqtt_packet tjs_networking_util)
target_include_directories(tjs_mqtt PUBLIC ${LIBMQTTC_DIR}/include/)
