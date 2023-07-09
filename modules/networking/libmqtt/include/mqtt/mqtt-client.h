#ifndef _MQTT_CLIENT_H
#define _MQTT_CLIENT_H

#include <uv.h>

enum mqtt_client_qos_t {
    MQTT_CLIENT_QOS0,
    MQTT_CLIENT_QOS1,
    MQTT_CLIENT_QOS2,
    MQTT_CLIENT_SUBFAIL = 0x80
};

/**
 * @brief MQTT 客户端事件类型
 * 
 */
enum mqtt_client_event_t {
    MQTT_CLIENT_EVENT_MESSAGE,
    MQTT_CLIENT_EVENT_PUBLISH,
    MQTT_CLIENT_EVENT_ERROR,
    MQTT_CLIENT_EVENT_READY,
    MQTT_CLIENT_EVENT_STATE_CHANGE
};

enum mqtt_client_state_t {
    MQTT_CLIENT_STATE_UNKNOWN,
    MQTT_CLIENT_STATE_OPENDING,
    MQTT_CLIENT_STATE_OPEN,
    MQTT_CLIENT_STATE_CLOSING,
    MQTT_CLIENT_STATE_CLOSED,
};

/**
 * @brief MQTT 客户端
 *
 */
typedef struct mqtt_client_s mqtt_client_t;

/**
 * @brief MQTT 客户端选项
 * 
 */
typedef struct mqtt_client_settings {
    const char* client_id;
    const char* username;
    const char* password;
    uint32_t clean_session;
    uint32_t keep_alive;
} mqtt_client_settings_t;

/**
 * @brief Publish 数据内容
 * 
 */
typedef struct mqtt_publish_data_s {
    char* topic;
    uint8_t* payload;
    uint32_t payload_size;
    uint8_t dup;
    int qos;
    uint8_t retained;
} mqtt_publish_data_t;

/**
 * @brief MQTT 事件回调函数
 * 
 */
typedef void (*mqtt_client_event_handler)(mqtt_client_t* client, int event, int type, const void* data, void* param);

/**
 * @brief 创建一个 MQTT 客户端
 *
 * @param loop
 * @return mqtt_client_t*
 */
mqtt_client_t* mqtt_client_create(uv_loop_t* loop);

/**
 * @brief 打开指定的地址
 *
 * @param client
 * @param url
 * @return int
 */
int mqtt_client_open(mqtt_client_t* client, const char* url, mqtt_client_settings_t* settings);

/**
 * @brief 设置回调函数
 *
 * @param client
 * @param handler
 * @param data
 * @return int
 */
int mqtt_client_set_handler(mqtt_client_t* client, mqtt_client_event_handler handler, void* data);

/**
 * @brief 发送连接 (connect) 命令
 *
 * @param client
 * @return int
 */
int mqtt_client_connect(mqtt_client_t* client);

/**
 * @brief 发送队列是否为空，是否可以继续发送数据
 * 
 * @param client 
 * @return 1 表示就绪，0 表示待发送队列不为空
 */
int mqtt_client_is_ready(mqtt_client_t* client);

/**
 * @brief 发送发布 (publish) 命令
 *
 * @param client
 * @param topics
 * @param data
 * @param length
 * @return int
 */
int mqtt_client_publish(mqtt_client_t* client, const char* topic, const uint8_t* data, uint32_t length, uint32_t qos, uint32_t dup, uint32_t retained);

/**
 * @brief 发送订阅 (subscribe) 命令
 *
 * @param client
 * @param topic
 * @return int
 */
int mqtt_client_subscribe(mqtt_client_t* client, const char* topic, uint32_t qos, uint32_t dup);

/**
 * @brief 发送取消订阅 (unsubscribe) 命令
 *
 * @param client
 * @param topic
 * @return int
 */
int mqtt_client_unsubscribe(mqtt_client_t* client, const char* topic, uint32_t dup);

/**
 * @brief 发送心跳 (ping) 命令
 *
 * @param client
 * @return int
 */
int mqtt_client_ping(mqtt_client_t* client);

/**
 * @brief 发送断开连接 (disconnect) 命令
 *
 * @param client
 * @return int
 */
int mqtt_client_disconnect(mqtt_client_t* client);

/**
 * @brief 关闭这个客户端，并释放相关的资源
 *
 * @param client
 * @return int
 */
int mqtt_client_close(mqtt_client_t* client);

#endif
