#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>

#include <uv.h>

#include "jsonrpc/socket.h"
#include "util/log.h"

/**
 * @brief 实现 JSONRPC 2.0 协议服务器
 *
 */

// JSONRPC 服务器支持的最大并发用户数
#define MAX_CLIENT_COUNT 10

typedef struct sockaddr jsonrpc_address_t;

typedef struct jsonrpc_session_s {
    char address[32];
    int port;
} jsonrpc_session_t;

struct jsonrpc_socket_s {
    char name[255];
    int port;
    int max_client_count;
    int next_request_id;
    uv_loop_t* loop;
    uv_udp_t* rpc_socket;
    jsonrpc_session_t* rpc_sessions[MAX_CLIENT_COUNT];
    jsonrpc_request_handler request_handler;
    jsonrpc_response_handler response_handler;
};

typedef struct jsonrpc_send_s {
    uv_udp_send_t req;
    size_t size;
    char data[];
} jsonrpc_send_t;

static void rpc_socket_on_send(uv_udp_send_t* req, int status)
{
    if (status < 0) {
        fprintf(stderr, "Write error %s\n", uv_err_name(status));
    }

    jsonrpc_send_t* request = req->data;
    free(request);
}

static int rpc_socket_get_name(const jsonrpc_address_t* remote, jsonrpc_session_t* session)
{
    if (remote == NULL || session == NULL) {
        return -1;
    }

    memset(session->address, 0, sizeof(session->address));

    switch (remote->sa_family) {
    case AF_INET: {
        struct sockaddr_in* addr4 = (struct sockaddr_in*)remote;
        uv_ip4_name(addr4, session->address, sizeof(session->address));
        session->port = ntohs(addr4->sin_port);
        break;
    }
    case AF_INET6: {
        struct sockaddr_in6* addr6 = (struct sockaddr_in6*)remote;
        uv_ip6_name(addr6, session->address, sizeof(session->address));
        session->port = ntohs(addr6->sin6_port);
        break;
    }
    }

    return 0;
}

/**
 * @brief 发送指定的消息
 *
 * @param socket
 * @param message 消息内容
 * @param size 消息长度
 */
static int rpc_socket_send_message(jsonrpc_socket_t* server, const jsonrpc_address_t* remote, char* message, ssize_t size)
{
    if (server == NULL || remote == NULL) {
        return -1;

    } else if (message == NULL || size <= 0) {
        return -1;
    }

    uv_udp_t* socket = server->rpc_socket;
    if (socket == NULL) {
        return -1;
    }

    jsonrpc_send_t* request = malloc(size + sizeof(jsonrpc_send_t));
    memset(request, 0, sizeof(*request));
    memcpy(request->data, message, size);
    request->req.data = request;

    uv_buf_t send_buffer = uv_buf_init(request->data, size);
    int ret = uv_udp_send(&request->req, socket, &send_buffer, 1, remote, rpc_socket_on_send);

    // jsonrpc_session_t session = { 0 };
    // rpc_socket_get_name(remote, &session);
    // printf("rpc_socket_send_message: (%d)->(%s:%d): %ld=%s\r\n", server->port, session.address, session.port, size, message);
    return ret;
}

/**
 * @brief 发送指定的通知消息
 *
 * @param socket
 * @param method 方法名称
 * @param params 消息参数
 */
static void rpc_socket_send_notify(jsonrpc_socket_t* server, const jsonrpc_address_t* remote, const char* method, cJSON* params)
{
    // request
    cJSON* request = cJSON_CreateObject();
    cJSON_AddItemToObject(request, "jsonrpc", cJSON_CreateString("2.0"));
    cJSON_AddItemToObject(request, "method", cJSON_CreateString(method));

    if (params) {
        cJSON_AddItemToObject(request, "params", params);
    }

    char* message = cJSON_PrintUnformatted(request);
    if (message) {
        size_t size = strlen(message);
        rpc_socket_send_message(server, remote, message, size);
        free(message);
    }

    cJSON_Delete(request);
}

/**
 * @brief 发送指定的通知消息
 *
 * @param socket
 * @param method 方法名称
 * @param params 消息参数
 */
static int rpc_socket_send_request(jsonrpc_socket_t* server, const jsonrpc_address_t* remote, const char* method, cJSON* params)
{
    int request_id = server->next_request_id;
    server->next_request_id++;

    // request
    cJSON* request = cJSON_CreateObject();
    cJSON_AddItemToObject(request, "jsonrpc", cJSON_CreateString("2.0"));
    cJSON_AddItemToObject(request, "method", cJSON_CreateString(method));
    cJSON_AddNumberToObject(request, "id", request_id);

    if (params) {
        cJSON_AddItemToObject(request, "params", params);
    }

    char* message = cJSON_PrintUnformatted(request);
    if (message) {
        size_t size = strlen(message);
        rpc_socket_send_message(server, remote, message, size);
        free(message);
    }

    cJSON_Delete(request);

    return request_id;
}

static void rpc_socket_process_response(jsonrpc_socket_t* server, const jsonrpc_address_t* remote, cJSON* request)
{
    jsonrpc_response_handler handler = server->response_handler;
    if (handler == NULL) {
        return;
    }

    cJSON* methodItem = cJSON_GetObjectItem(request, "method");
    cJSON* idItem = cJSON_GetObjectItem(request, "id");
    cJSON* error = cJSON_GetObjectItem(request, "error");
    cJSON* result = cJSON_GetObjectItem(request, "result");
    int id = -1;
    if (idItem) {
        id = idItem->valueint;
    }

    handler(id, result, error);
}

static void rpc_socket_process_subscribe(jsonrpc_socket_t* server, const jsonrpc_address_t* remote, cJSON* request, int subscribe)
{
    jsonrpc_session_t session = { 0 };
    rpc_socket_get_name(remote, &session);

    // LOG_W("jsonrpc: session: %d - %s", session.port, session.address);

    int i = 0;
    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        jsonrpc_session_t* item = server->rpc_sessions[i];
        if (!item) {
            continue;
        }

        if (item->port == session.port) {
            if (!subscribe) {
                server->rpc_sessions[i] = NULL;
                free(item);
            }

            return;
        }
    }

    if (!subscribe) {
        return;
    }

    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        jsonrpc_session_t* item = server->rpc_sessions[i];
        if (item) {
            continue;
        }

        server->rpc_sessions[i] = malloc(sizeof(jsonrpc_session_t));
        memcpy(server->rpc_sessions[i], &session, sizeof(jsonrpc_session_t));

        // printf("rpc_socket_process_subscribe: %s:%d\r\n", session.address, session.port);
        break;
    }
}

static void rpc_socket_process_request(jsonrpc_socket_t* server, const jsonrpc_address_t* remote, cJSON* request)
{
    jsonrpc_request_handler handler = server->request_handler;
    if (handler == NULL) {
        return;
    }

    cJSON* methodItem = cJSON_GetObjectItem(request, "method");
    cJSON* idItem = cJSON_GetObjectItem(request, "id");
    cJSON* jsonrpcItem = cJSON_GetObjectItem(request, "jsonrpc");
    cJSON* params = cJSON_GetObjectItem(request, "params");

    const char* method = NULL;
    const char* jsonrpc = NULL;
    int id = -1;

    if (methodItem) {
        method = methodItem->valuestring;
    }

    if (idItem) {
        id = idItem->valueint;
    }

    if (jsonrpcItem) {
        jsonrpc = jsonrpcItem->valuestring;
    }

    // LOG_W("jsonrpc: request %d - %s", id, method);
    if (method) {
        if (strcmp(method, "jsonrpc.subscribe") == 0) {
            rpc_socket_process_subscribe(server, remote, request, 1);

        } else if (strcmp(method, "jsonrpc.unsubscribe") == 0) {
            rpc_socket_process_subscribe(server, remote, request, 0);
        }
    }

    cJSON* result = handler(method, params);

    if (id <= 0) {
        if (result) {
            cJSON_Delete(result);
        }

        return;
    }

    // response
    cJSON* response = cJSON_CreateObject();
    cJSON_AddItemToObject(response, "id", cJSON_CreateNumber(id));
    cJSON_AddItemToObject(response, "jsonrpc", cJSON_CreateString("2.0"));

    if (result) {
        cJSON_AddItemToObject(response, "result", result);
    }

    char* data = cJSON_PrintUnformatted(response);
    // LOG_W("jsonrpc: response %s", data);

    if (data) {
        size_t size = strlen(data);
        rpc_socket_send_message(server, remote, data, size);
        free(data);
    }

    cJSON_Delete(response);
}

/**
 * @brief 处理收到的客户端请求消息
 *
 * @param socket
 * @param message 消息内容
 * @param nread 消息长度
 */
static void rpc_socket_process_message(jsonrpc_socket_t* server, const jsonrpc_address_t* remote, const char* message, ssize_t nread)
{
    if (message == NULL || nread <= 0) {
        return;
    }

    cJSON* request = cJSON_Parse(message);
    if (request == NULL) {
        return;
        
    } else if (request->type != cJSON_Object) {
        cJSON_Delete(request);
        return;
    }

    // LOG_W("jsonrpc: request %ld: %s", nread, message);

    cJSON* method = cJSON_GetObjectItem(request, "method");
    if (method) {
        rpc_socket_process_request(server, remote, request);

    } else {
        rpc_socket_process_response(server, remote, request);
    }

    cJSON_Delete(request);
}

static void rpc_socket_on_close(jsonrpc_socket_t* server)
{
    uv_udp_t* socket = server->rpc_socket;

    int i = 0;
    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        if (server->rpc_sessions[i] != NULL) {
            free(server->rpc_sessions[i]);
            server->rpc_sessions[i] = NULL;
        }
    }

    socket->data = NULL;
    uv_close((uv_handle_t*)socket, NULL);
}

static void rpc_socket_on_read(uv_udp_t* socket, ssize_t nread, const uv_buf_t* buf, const jsonrpc_address_t* remote, unsigned flags)
{
    jsonrpc_socket_t* server = (jsonrpc_socket_t*)socket->data;
    if (server == NULL) {
        return;
    }

    if (remote == NULL) {
        return;
    }

    // jsonrpc_session_t session = { 0 };
    // rpc_socket_get_name(remote, &session);
    // printf("rpc_socket_on_read: (%s:%d)->(%d): %s\r\n", session.address, session.port, server->port, buf->base);
    // LOG_W("jsonrpc: read %d:%s", nread, buf->base);

    if (nread > 0) {
        buf->base[nread] = '\0';
        rpc_socket_process_message(server, remote, buf->base, nread);
        free(buf->base);
        return;
    }

    if (nread < 0) {
        if (nread != UV_EOF) {
            fprintf(stderr, "Read error %s\n", uv_err_name(nread));
        }

        rpc_socket_on_close(server);
    }

    free(buf->base);
}

static void rpc_socket_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    buf->base = (char*)malloc(suggested_size);
    buf->len = suggested_size;
}

// ////////////////////////////////////////////////////////////////////////////
//

jsonrpc_socket_t* jsonrpc_socket_init(uv_loop_t* loop, int port)
{
    jsonrpc_socket_t* server = malloc(sizeof(jsonrpc_socket_t));
    memset(server, 0, sizeof(jsonrpc_socket_t));

    server->port = port;
    server->loop = loop;

    return server;
}

int jsonrpc_socket_start(jsonrpc_socket_t* server, jsonrpc_request_handler request_handler, jsonrpc_response_handler response_handler)
{
    if (server == NULL) {
        return -1;
    }

    int i = 0;
    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        server->rpc_sessions[i] = NULL;
    }

    server->request_handler = request_handler;
    server->response_handler = response_handler;
    server->next_request_id = 1;

    server->rpc_socket = malloc(sizeof(uv_udp_t));
    uv_udp_t* socket = server->rpc_socket;
    socket->data = server;

    uv_udp_init(server->loop, socket);

    int ret;
    struct sockaddr_in bind_addr;
    uv_ip4_addr("127.0.0.1", server->port, &bind_addr);
    ret = uv_udp_bind(socket, (const struct sockaddr*)&bind_addr, UV_UDP_REUSEADDR);
    if (ret) {
        LOG_W("jsonrpc: Bind error %s at %d", uv_err_name(ret), server->port);
        return -1;
    }

    ret = uv_udp_recv_start(socket, rpc_socket_alloc_buffer, rpc_socket_on_read);
    if (ret) {
        LOG_W("jsonrpc: Listen error %s", uv_err_name(ret));
        return -2;
    }

    LOG_I("jsonrpc: Starting RPC server at %d", server->port);
    return 0;
}

int jsonrpc_socket_stop(jsonrpc_socket_t* server)
{
    if (server == NULL) {
        return -1;
    }

    uv_udp_t* rpc_socket = server->rpc_socket;
    if (!rpc_socket) {
        return 0;
    }

    server->rpc_socket = NULL;
    uv_close((uv_handle_t*)rpc_socket, NULL);
    return 0;
}

int jsonrpc_socket_notify(jsonrpc_socket_t* server, const char* method, cJSON* message)
{
    if (server == NULL) {
        return -1;

    } else if (!method || !method[0]) {
        return -1;

    } else if (!message) {
        return -1;
    }

    int i = 0;
    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        jsonrpc_session_t* session = server->rpc_sessions[i];
        if (!session) {
            continue;
        }

        cJSON* data = cJSON_Duplicate(message, 1);

        struct sockaddr_in socket_address;
        uv_ip4_addr(session->address, session->port, &socket_address);
        // printf("jsonrpc_socket_notify: %s:%d\r\n", session->address, session->port);
        rpc_socket_send_notify(server, (jsonrpc_address_t*)&socket_address, method, data);
    }

    return 0;
}

int jsonrpc_socket_send(jsonrpc_socket_t* server, const char* method, cJSON* message, const char* address, int port)
{
    struct sockaddr_in remote_address;
    uv_ip4_addr(address, port, &remote_address);

    cJSON* data = cJSON_Duplicate(message, 1);
    int ret = rpc_socket_send_request(server, (jsonrpc_address_t*)&remote_address, method, data);
    return ret;
}
