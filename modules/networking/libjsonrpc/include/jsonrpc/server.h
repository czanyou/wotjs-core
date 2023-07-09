#ifndef _JSONRPC_SERVER_H
#define _JSONRPC_SERVER_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>

#include <uv.h>

#include "cJSON.h"

typedef struct jsonrpc_server_s jsonrpc_server_t;

/**
 * RPC 方法处理函数
 */
typedef cJSON* (*jsonrpc_request_handler)(const char* method, cJSON* params);

/**
 * 创建一个 JSON-RPC 服务器对象
 * @param name JSON-RPC 服务名称
 * @return 返回创建的对象
 */
jsonrpc_server_t* jsonrpc_server_init(uv_loop_t* loop, const char* name, int port);

/**
 * 启动 RPC 服务
 * 
 * @return 如果成功则返回 0
 */
int jsonrpc_server_start(jsonrpc_server_t* server, jsonrpc_request_handler handler);

/**
 * 停止 RPC 服务
 * 
 * @return 如果成功则返回 0
 */
int jsonrpc_server_stop(jsonrpc_server_t* server);

/**
 * 发布通知消息
 * - 所有客户端都会收到通知消息
 * - message 内存需要调用者自行释放
 * @param method 消息的方法名
 * @param message 消息内容
 * @return 如果成功则返回 0
 */
int jsonrpc_server_notify(jsonrpc_server_t* server, const char* method, cJSON* message);

#endif // _JSONRPC_SERVER_H
