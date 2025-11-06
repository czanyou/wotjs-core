cmake_minimum_required(VERSION 3.12)

# 网络相关工具模块

set(LIB_NETWORKING_DIR ${CMAKE_CURRENT_LIST_DIR}/networking)

set(LIB_NETWORKING_SOURCES
  ${LIB_NETWORKING_DIR}/src/url/uri-parser.c
  ${LIB_NETWORKING_DIR}/src/url/url-codec.c
  ${LIB_NETWORKING_DIR}/src/net-transport.c
  ${LIB_NETWORKING_DIR}/src/tcp-transport.c
  ${LIB_NETWORKING_DIR}/src/udp-transport.c
)

# mbedtls
if (BUILD_MBEDTLS)
  set(LIB_NETWORKING_SOURCES ${LIB_NETWORKING_SOURCES}
      ${LIB_NETWORKING_DIR}/src/tls/tls-context.c 
      ${LIB_NETWORKING_DIR}/src/tls/uv-tls.c
      ${LIB_NETWORKING_DIR}/src/tls-transport.c
  )
endif ()

# http
set(LIB_HTTP_DIR ${CMAKE_CURRENT_LIST_DIR}/http)

set(LIB_NETWORKING_SOURCES ${LIB_NETWORKING_SOURCES}
  ${LIB_HTTP_DIR}/src/http_parser.c 
)

# mqtt
set(LIB_MQTT_DIR ${CMAKE_CURRENT_LIST_DIR}/mqtt)

set(LIB_NETWORKING_SOURCES ${LIB_NETWORKING_SOURCES}
    ${LIB_MQTT_DIR}/src/MQTTConnectClient.c
    ${LIB_MQTT_DIR}/src/MQTTDeserializePublish.c
    ${LIB_MQTT_DIR}/src/MQTTFormat.c
    ${LIB_MQTT_DIR}/src/MQTTPacket.c
    ${LIB_MQTT_DIR}/src/MQTTSerializePublish.c
    ${LIB_MQTT_DIR}/src/MQTTSubscribeClient.c
    ${LIB_MQTT_DIR}/src/MQTTUnsubscribeClient.c
)

add_library(tjs_networking STATIC ${LIB_NETWORKING_SOURCES})
target_link_libraries(tjs_networking tjs_util tjs_uv)
target_include_directories(tjs_networking PUBLIC ${LIB_NETWORKING_DIR}/include)
target_include_directories(tjs_networking PUBLIC ${LIB_HTTP_DIR}/src)
target_include_directories(tjs_networking PUBLIC ${LIB_MQTT_DIR}/include)

# mbedtls
if (BUILD_MBEDTLS)
  target_link_libraries(tjs_networking tjs_mbedtls)
endif ()

