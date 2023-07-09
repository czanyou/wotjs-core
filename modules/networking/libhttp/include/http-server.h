#ifndef _HTTP_SERVER_H
#define _HTTP_SERVER_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>

#include <uv.h>

// HTTP 服务器支持的最大消息头数
#ifndef HTTP_HEADER_MAX
#define HTTP_HEADER_MAX 64
#endif

// HTTP 服务器支持的最大并发用户数
#ifndef HTTP_CLIENT_MAX
#define HTTP_CLIENT_MAX 100
#endif

typedef struct http_header_t {
    const char* name;
    const char* value;
} http_header_t;

typedef struct http_request_s http_request_t;

/**
 * @brief 返回请求 URL
 * 
 * @param request 
 * @return 请求 URL
 */
const char* http_request_get_url(http_request_t* request);

/**
 * @brief 返回请求方法
 * 
 * @param request 
 * @return 请求方法 
 */
uint32_t http_request_get_method(http_request_t* request);

/**
 * @brief 返回所有的头域
 * 
 * @param request 
 * @param header_count 返回的头域的数量
 * @return 所有的头域
 */
http_header_t* http_request_get_headers(http_request_t* request, uint32_t* header_count);

typedef struct http_connection_s http_connection_t;
typedef struct http_response_s http_response_t;

// ////////////////////////////////////////////////////////////////////////////
// server

typedef struct http_server_s http_server_t;

/**
 * HTTP 请求处理函数
 * @param server 
 * @param request 
 * @param response 
 */
typedef int (*http_server_event_handler)(http_server_t* server, http_request_t* request, http_response_t* response);

/**
 * @brief 返回指定的 ID 的 HTTP 应答
 * 
 * @param server 
 * @param connection_id 应答 的 ID
 * @return 应答
 */
http_response_t* http_server_get_response(http_server_t* server, uint32_t connection_id);

/**
 * 创建一个 HTTP 服务器对象
 * @return 返回创建的对象
 */
http_server_t* http_server_init(uv_loop_t* loop);

/**
 * @brief 设置根目录
 * 
 * @param server 
 * @param root_path 根目录
 * @return 如果成功则返回 0 
 */
int http_server_set_root_path(http_server_t* server, const char* root_path);

/**
 * 启动 HTTP 服务
 * 
 * @param server 
 * @param port 端口号
 * @param handler 请求处理回调函数
 * @return 如果成功则返回 0
 */
int http_server_start(http_server_t* server, int port, http_server_event_handler handler);

/**
 * 停止 HTTP 服务
 * 
 * @return 如果成功则返回 0
 */
int http_server_stop(http_server_t* server);

// ////////////////////////////////////////////////////////////////////////////
// response

enum http_response_event_t {
    HTTP_RESPONSE_EVENT_UNKOWN = 0,

    /** 连接已关闭 */
    HTTP_RESPONSE_EVENT_CLOSED,

    /** 发送缓存区已准备就绪 */
    HTTP_RESPONSE_EVENT_READY,
};

/**
 * @brief 事件处理函数
 * @param response 相关的 response
 * @param event 事件类型
 * @param status 事件值
 * @param data 事件数据
 */
typedef int (*http_response_event_handler)(http_response_t* response, int event, int status, void* data);

/**
 * @brief 设置事件处理函数
 * 
 * @param response 
 * @param handler 处理函数
 * @param param 
 * @return 如果成功则返回 0 
 */
int http_response_set_event_handler(http_response_t* response, http_response_event_handler handler, void* param);

/**
 * @brief 设置状态码
 * 
 * @param response 
 * @param status_code 状态码
 * @param status_text 状态短语
 * @return 如果成功则返回 0 
 */
int http_response_set_status_code(http_response_t* response, int status_code, const char* status_text);

/**
 * @brief 设置要发送的消息体的类型
 * 
 * @param response 
 * @param content_type 类型
 * @return 如果成功则返回 0 
 */
int http_response_set_content_type(http_response_t* response, const char* content_type);

/**
 * @brief 设置要发送的消息体的长度
 * 
 * @param response 
 * @param content_length 
 * @return 如果成功则返回 0 
 */
int http_response_set_content_length(http_response_t* response, size_t content_length);

/**
 * @brief 设置消息头域
 * 
 * @param response 
 * @param name 名称
 * @param value 值
 * @return 如果成功则返回 0 
 */
int http_response_set_header(http_response_t* response, const char* name, const char* value);

/**
 * @brief 返回相关的 ID
 * 
 * @param response 
 * @param connection_id 
 * @return 如果成功则返回 0 
 */
int http_response_get_id(http_response_t* response, uint32_t* connection_id);

/**
 * @brief 关闭并释放相关的资源
 * 
 * @param response 
 * @return 如果成功则返回 0 
 */
int http_response_close(http_response_t* response);

/**
 * @brief 释放相关的资源
 * 
 * @param response 
 * @return 如果成功则返回 0 
 */
int http_response_free(http_response_t* response);

/**
 * @brief 发送数据
 * 
 * @param response 
 * @param data 要发送的数据
 * @param size 要发送的数据的长度
 * @return 如果成功则返回 0
 */
int http_response_send(http_response_t* response, const uint8_t* data, ssize_t length);

/**
 * @brief 发送文件
 * 
 * @param response 
 * @param filename 要发送的文件的名称
 * @return 如果成功则返回 0
 */
int http_response_send_file(http_response_t* response, const char* filename);

/**
 * @brief 通知拉取数据
 * - 当数据源有更多的数据可以发送时，通知相关的 response 拉取并发送数据
 * @param response 
 * @param status 总是为 0
 * @return 如果成功则返回 0 
 */
int http_response_push(http_response_t* response, int status);

#endif // _HTTP_SERVER_H
