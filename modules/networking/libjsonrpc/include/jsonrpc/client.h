#ifndef _JSONRPC_CLIENT_H
#define _JSONRPC_CLIENT_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>

#include <uv.h>

#include "cJSON.h"

typedef struct jsonrpc_client_s jsonrpc_client_t;

#define JSONRPC_EVENT_CONNECT 1 // 当连接已建立
#define JSONRPC_EVENT_RESPONSE 2 // 当收到应答省
#define JSONRPC_EVENT_CLOSE 3 // 当连接已关闭

/**
 * RPC 方法处理函数
 * @param event 事件类型
 * @param id 应答消息 ID / 错误码
 * @param result 应答结果
 * @param error 应答错误
 */
typedef int (*jsonrpc_event_handler)(int event, int id, cJSON* result, cJSON* error);

/**
 * 创建一个 JSON-RPC 服务器对象
 * @param name JSON-RPC 服务名称
 * @return 返回创建的对象
 */
jsonrpc_client_t* jsonrpc_client_init(uv_loop_t* loop, int port, const char* name);

/**
 * 启动 RPC 服务
 * 
 * @return 如果成功则返回 0
 */
int jsonrpc_client_start(jsonrpc_client_t* server, jsonrpc_event_handler handler);

/**
 * 停止 RPC 服务
 * 
 * @return 如果成功则返回 0
 */
int jsonrpc_client_close(jsonrpc_client_t* server);

/**
 * 发布通知消息
 * - 所有客户端都会收到通知消息
 * - message 内存需要调用者自行释放
 * @param method 消息的方法名
 * @param message 消息内容
 * @return 如果成功则返回请求消息的 ID，失败则返回小于 0 的错误码
 */
int jsonrpc_client_send(jsonrpc_client_t* server, const char* method, cJSON* message);

#endif
