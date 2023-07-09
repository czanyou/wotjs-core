cmake_minimum_required(VERSION 3.12)

set(LIBMQTT_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(SOURCES
    ${LIBMQTT_DIR}/src/MQTTConnectClient.c
    ${LIBMQTT_DIR}/src/MQTTDeserializePublish.c
    ${LIBMQTT_DIR}/src/MQTTFormat.c
    ${LIBMQTT_DIR}/src/MQTTPacket.c
    ${LIBMQTT_DIR}/src/MQTTSerializePublish.c
    ${LIBMQTT_DIR}/src/MQTTSubscribeClient.c
    ${LIBMQTT_DIR}/src/MQTTUnsubscribeClient.c
)

add_library(tjs_mqtt_packet STATIC ${SOURCES})

target_include_directories(tjs_mqtt_packet PUBLIC ${LIBMQTT_DIR}/include/)

