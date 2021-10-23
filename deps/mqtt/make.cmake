cmake_minimum_required(VERSION 2.8)

set(MQTT_DIR ${CMAKE_CURRENT_LIST_DIR}/)

set(SOURCES
    ${MQTT_DIR}/src/mqtt-packet/MQTTConnectClient.c
    ${MQTT_DIR}/src/mqtt-packet/MQTTDeserializePublish.c
    ${MQTT_DIR}/src/mqtt-packet/MQTTFormat.c
    ${MQTT_DIR}/src/mqtt-packet/MQTTPacket.c
    ${MQTT_DIR}/src/mqtt-packet/MQTTSerializePublish.c
    ${MQTT_DIR}/src/mqtt-packet/MQTTSubscribeClient.c
    ${MQTT_DIR}/src/mqtt-packet/MQTTUnsubscribeClient.c
    ${MQTT_DIR}/src/mqtt-js.c
)

add_library(mqtt STATIC ${SOURCES})

target_include_directories(mqtt PRIVATE
    ${MQTT_DIR}/include/
)
