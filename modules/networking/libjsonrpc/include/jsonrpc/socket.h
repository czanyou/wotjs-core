#ifndef _JSONRPC_SOCKET_H
#define _JSONRPC_SOCKET_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>

#include <uv.h>

#include "cJSON.h"

typedef struct jsonrpc_socket_s jsonrpc_socket_t;

/**
 * RPC 方法处理函数
 */
typedef cJSON* (*jsonrpc_request_handler)(const char* method, cJSON* params);
typedef cJSON* (*jsonrpc_response_handler)(int id, cJSON* result, cJSON* error);

/**
 * 创建一个 JSON-RPC 服务器对象
 * @param name JSON-RPC 服务名称
 * @return 返回创建的对象
 */
jsonrpc_socket_t* jsonrpc_socket_init(uv_loop_t* loop, int port);

/**
 * 启动 RPC 服务
 * 
 * @return 如果成功则返回 0
 */
int jsonrpc_socket_start(jsonrpc_socket_t* server, jsonrpc_request_handler request_handler, jsonrpc_response_handler response_handler);

/**
 * 停止 RPC 服务
 * 
 * @return 如果成功则返回 0
 */
int jsonrpc_socket_stop(jsonrpc_socket_t* server);

/**
 * 发布通知消息
 * - 所有客户端都会收到通知消息
 * - message 内存需要调用者自行释放
 * @param method 消息的方法名
 * @param message 消息内容
 * @return 如果成功则返回 0
 */
int jsonrpc_socket_notify(jsonrpc_socket_t* server, const char* method, cJSON* message);

/**
 * @brief 
 * 
 * @param server 
 * @param method 
 * @param message 
 * @param address 
 * @param port 
 * @return int 
 */
int jsonrpc_socket_send(jsonrpc_socket_t* server, const char* method, cJSON* message, const char* address, int port);

#endif // _JSONRPC_SOCKET_H
