#ifndef _HTTP_CLIENT_H
#define _HTTP_CLIENT_H

#include <uv.h>

#include <stdint.h>

typedef struct http_client_s http_client_t;

typedef struct http_header_t {
    const char* name;
    const char* value;
} http_header_t;

enum http_client_state_e {
    HTTP_CLIENT_STATE_UNSENT = 0,
    HTTP_CLIENT_STATE_OPENED = 1,
    HTTP_CLIENT_STATE_HEADERS_RECEIVED = 2,
    HTTP_CLIENT_STATE_LOADING = 3,
    HTTP_CLIENT_STATE_DONE = 4
};

/// HTTP response callback(on recevied response http header), use http_client_read to read response content
/// @param[in] code 0-ok, other-error
/// @param[in] status_code http response status code
/// @param[in] content_length -1-chunked, >=0-content length, other-undefined
typedef void (*http_response_event_handler)(void* param, int ready_state, int status_code, int64_t content_length, const uint8_t* data);

/**
 * 创建一个 HTTP 客户端
 * @param loop
 *
 * @return 返回创建的对象
 */
http_client_t* http_client_create(uv_loop_t* loop);

/**
 * @brief 返回 HTTP 应答消息所有头域
 *
 * @param client HTTP 客户端
 * @param count 返回头域总数
 * @return 所有头域
 */
http_header_t* http_client_get_headers(http_client_t* client, int* count);

/**
 * @brief 返回 HTTP 应答消息状态字符串
 *
 * @param client HTTP 客户端
 * @return 状态字符串
 */
const char* http_client_get_status_text(http_client_t* client);

uint32_t http_client_get_status_code(http_client_t* client);

/**
 * @brief 查询指定名称的 HTTP 应答消息头域的值
 *
 * @param client HTTP 客户端
 * @param name 应答消息头域的名称
 * @return 头域的值
 */
const char* http_client_get_header(http_client_t* client, const char* name);

/**
 * 关闭 HTTP 客户端
 *
 * @param client HTTP 客户端
 * @return 如果成功则返回 0
 */
int http_client_destroy(http_client_t* client);

/**
 * @brief 发送 GET 请求
 *
 * @param client HTTP 客户端
 * @param url 要访问的 URL 地址
 * @param headers 要设置的头域
 * @param count 要设置的头域的数量
 * @param handler 回调函数
 * @param param 回调参数
 * @return 如果成功则返回 0
 */
int http_client_get(http_client_t* client, const char* url, const http_header_t* headers,
    uint32_t count, http_response_event_handler handler, void* param);

/**
 * @brief 发送 POST 请求
 *
 * @param client HTTP 客户端
 * @param url 要访问的 URL 地址
 * @param headers 要设置的头域
 * @param count 要设置的头域的数量
 * @param data 消息体内容
 * @param bytes 消息体长度
 * @param handler 回调函数
 * @param param 回调参数
 * @return 如果成功则返回 0
 */
int http_client_post(http_client_t* client, const char* url, const http_header_t* headers,
    uint32_t count, const uint8_t* data, uint32_t bytes, http_response_event_handler handler, void* param);

/**
 * @brief 初始化 HTTP 客户端
 *
 * @param client HTTP 客户端
 * @param method HTTP 方法
 * @param url 要访问的 URL 地址
 * @return 如果成功则返回 0
 */
int http_client_init(http_client_t* client, const char* method, const char* url);

/**
 * @brief 设置 HTTP 请求消息头域
 *
 * @param client HTTP 客户端
 * @param headers 要设置的头域
 * @param count 要设置的头域的数量
 * @return 如果成功则返回 0
 */
int http_client_set_headers(http_client_t* client, const http_header_t* headers, uint32_t count);

/**
 * @brief 设置 HTTP 应答回调函数
 *
 * @param client HTTP 客户端
 * @param handler 回调函数
 * @param param 回调参数
 * @return 如果成功则返回 0
 */
int http_client_set_callback(http_client_t* client, http_response_event_handler handler, void* param);

/**
 * @brief
 *
 * @param client
 * @param timeout
 */
int http_client_set_timeout(http_client_t* client, uint32_t timeout);

/**
 * @brief 设置 HTTP 请求消息体
 *
 * @param client HTTP 客户端
 * @param data 消息体内容
 * @param bytes 消息体长度
 * @param type 消息体 MIME 类型，如 'image/jpeg'
 * @return 如果成功则返回 0
 */
int http_client_set_body(http_client_t* client, const uint8_t* data, uint32_t bytes, const char* type);

/**
 * @brief 设置要上传的文件内容
 *
 * @param client HTTP 客户端
 * @param name 文件字段名
 * @param filename 文件名
 * @param data 文件内容
 * @param bytes 文件长度
 * @param type 文件 MIME 类型，如 'image/jpeg'
 * @return 如果成功则返回 0
 */
int http_client_set_file(http_client_t* client, const char* name, const char* filename,
    const uint8_t* data, uint32_t bytes, const char* type);

/**
 * @brief 发起 HTTP 请求
 *
 * @param client HTTP 客户端
 * @return 如果成功则返回 0
 */
int http_client_send(http_client_t* client);

#endif
