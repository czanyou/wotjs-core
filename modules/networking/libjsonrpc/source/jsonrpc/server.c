#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>

#include <uv.h>

#include "jsonrpc/server.h"
#include "util/log.h"

/**
 * @brief 实现 JSONRPC 2.0 协议服务器
 *
 */

// JSONRPC 服务器支持的最大并发用户数
#define MAX_CLIENT_COUNT 10

typedef struct jsonrpc_session_s jsonrpc_session_t;

struct jsonrpc_server_s {
    char name[255];
    uint32_t port;
    uint32_t max_client_count;
    uint32_t next_session_id;
    uv_loop_t* loop;
    uv_tcp_t* server_socket;
    jsonrpc_session_t* sessions[MAX_CLIENT_COUNT];
    jsonrpc_request_handler request_handler;
};

struct jsonrpc_session_s {
    jsonrpc_server_t* server;
    uv_stream_t* stream;
    void* data;
    char* read_buffer;
    uint32_t read_size;
    uint32_t read_buffer_size;
    uint32_t id;
};

typedef struct rpc_write_req_s {
    uv_write_t req;
    uv_buf_t buf;
} jsonrpc_write_req_t;

static int jsonrpc_server_remove_session(jsonrpc_server_t* server, jsonrpc_session_t* session);
static cJSON* jsonrpc_server_on_invoke(jsonrpc_server_t* server, const char* method, cJSON* params);

static void jsonrpc_free_write_request(uv_write_t* req)
{
    jsonrpc_write_req_t* request = (jsonrpc_write_req_t*)req;
    free(request->buf.base);
    free(request);
}

static void jsonrpc_on_write(uv_write_t* req, int status)
{
    if (status < 0) {
        fprintf(stderr, "Write error %s\n", uv_err_name(status));
    }

    jsonrpc_free_write_request(req);
}

/**
 * @brief 发送指定的消息
 *
 * @param session
 * @param message 消息内容
 * @param size 消息长度
 */
static int jsonrpc_connection_send_message(jsonrpc_session_t* session, char* message, ssize_t size)
{
    if (session == NULL) {
        return -1;

    } else if (message == NULL || size <= 0) {
        return -1;
    }

    jsonrpc_write_req_t* req = (jsonrpc_write_req_t*)malloc(sizeof(jsonrpc_write_req_t));
    char* buffer = malloc(size + 32);

    // message header
    ssize_t offset = sprintf(buffer, "%X\r\n", (uint32_t)size);
    memcpy(buffer + offset, message, size);
    offset += size;
    sprintf(buffer + offset, "\r\n");
    offset += 2;
    buffer[offset] = '\0';
    // LOG_I("jsonrpc: send: %s", buffer);

    uv_stream_t* stream = session->stream;
    req->buf = uv_buf_init(buffer, offset);
    int ret = uv_write((uv_write_t*)req, stream, &req->buf, 1, jsonrpc_on_write);
    if (ret != 0) {
        jsonrpc_free_write_request((uv_write_t*)req);
        return 0;
    }

    return 0;
}

/**
 * @brief 发送指定的通知消息
 *
 * @param session
 * @param method 方法名称
 * @param params 消息参数
 */
static void jsonrpc_connection_notify(jsonrpc_session_t* session, const char* method, cJSON* params)
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
        jsonrpc_connection_send_message(session, message, size);
        free(message);
    }

    cJSON_Delete(request);
}

static int jsonrpc_connection_reply(jsonrpc_session_t* session, cJSON* request, cJSON* result)
{
    assert(session != NULL);

    int id = -1;
    cJSON* idItem = cJSON_GetObjectItem(request, "id");
    if (idItem) {
        id = idItem->valueint;
    }

    // response
    cJSON* response = cJSON_CreateObject();
    cJSON_AddItemToObject(response, "id", cJSON_CreateNumber(id));
    cJSON_AddItemToObject(response, "jsonrpc", cJSON_CreateString("2.0"));

    if (result) {
        cJSON_AddItemToObject(response, "result", result);
    }

    char* data = cJSON_PrintUnformatted(response);
    if (data) {
        size_t size = strlen(data);
        jsonrpc_connection_send_message(session, data, size);
        free(data);
    }

    cJSON_Delete(response);
}

static int jsonrpc_connection_process_request(jsonrpc_session_t* session, cJSON* request)
{
    assert(session != NULL);

    jsonrpc_server_t* server = session->server;

    if (request == NULL) {
        return -1;

    } else if (request->type != cJSON_Object) {
        cJSON_Delete(request);
        return -1;
    }

    cJSON* methodItem = cJSON_GetObjectItem(request, "method");
    cJSON* jsonrpcItem = cJSON_GetObjectItem(request, "jsonrpc");
    cJSON* params = cJSON_GetObjectItem(request, "params");

    const char* method = NULL;
    const char* jsonrpc = NULL;

    if (methodItem) {
        method = methodItem->valuestring;
    }

    if (jsonrpcItem) {
        jsonrpc = jsonrpcItem->valuestring;
    }

    cJSON* result = jsonrpc_server_on_invoke(server, method, params);
    jsonrpc_connection_reply(session, request, result);

    cJSON_Delete(request);
    return 0;
}

/**
 * @brief 处理收到的客户端请求消息
 *
 * @param client
 * @param message 消息内容
 * @param nread 消息长度
 */
static int jsonrpc_connection_process_message(jsonrpc_session_t* session, const char* message, ssize_t nread)
{
    if (message == NULL || nread <= 0) {
        return -1;
    }

    // jsonrpc_session_t* session = (jsonrpc_session_t*)client->data;
    if (session == NULL || session->server == NULL) {
        return -1;
    }

    cJSON* request = cJSON_Parse(message);
    return jsonrpc_connection_process_request(session, request);
}

static void jsonrpc_connection_process_buffer(jsonrpc_session_t* session, const char* message, ssize_t nread)
{
    if (message == NULL || nread <= 0) {
        return;
    }

    size_t leftover = nread;
    while (leftover > 0) {
        char* next = NULL;
        size_t length = strtol(message, &next, 16);
        if (next == NULL) {
            break;
        }

        if (*next != '\r') {
            break;
        }

        next++;
        next++;

        size_t needSize = (next - message) + length + 2;
        if (needSize < leftover) {
            break;
        }

        next[length] = '\0';

        jsonrpc_connection_process_message(session, next, length);
        leftover -= needSize;
        message += needSize;
    }
}

static void jsonrpc_connection_close(jsonrpc_session_t* session)
{
    if (session == NULL) {
        return;
    }

    jsonrpc_server_t* server = session->server;
    jsonrpc_server_remove_session(server, session);

    uv_stream_t* stream = session->stream;
    if (stream) {
        session->stream = NULL;
        stream->data = NULL;
        uv_close((uv_handle_t*)stream, NULL);
    }

    if (session->read_buffer) {
        free(session->read_buffer);
    }

    free(session);
}

static void jsonrpc_connection_on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf)
{
    assert(stream != NULL);
    jsonrpc_session_t* session = (jsonrpc_session_t*)stream->data;

    if (nread > 0) {
        buf->base[nread] = '\0';
        jsonrpc_connection_process_buffer(session, buf->base, nread);
        free(buf->base);
        return;
    }

    if (nread < 0) {
        if (nread != UV_EOF) {
            fprintf(stderr, "Read error %s\n", uv_err_name(nread));
        }

        jsonrpc_connection_close(session);
    }

    free(buf->base);
}

static void jsonrpc_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    buf->base = (char*)malloc(suggested_size);
    buf->len = suggested_size;
}

static int jsonrpc_server_remove_session(jsonrpc_server_t* server, jsonrpc_session_t* session)
{
    if (server == NULL) {
        return -1;
    }

    int i = 0;
    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        if (server->sessions[i] == session) {
            server->sessions[i] = NULL;
        }
    }

    return 0;
}

static int jsonrpc_server_add_session(jsonrpc_server_t* server, jsonrpc_session_t* session)
{
    assert(server != NULL);

    int i = 0;
    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        if (server->sessions[i] == NULL) {
            server->sessions[i] = session;
            break;
        }
    }
}

static cJSON* jsonrpc_server_on_invoke(jsonrpc_server_t* server, const char* method, cJSON* params)
{
    assert(server != NULL);

    jsonrpc_request_handler handler = server->request_handler;
    if (handler == NULL) {
        return NULL;
    }

    cJSON* result = handler(method, params);
    return result;
}

static void jsonrpc_server_on_connection(uv_stream_t* server_socket, int status)
{
    if (status == -1) {
        // error!
        return;
    }

    jsonrpc_server_t* server = (jsonrpc_server_t*)server_socket->data;
    if (server == NULL) {
        return;
    }

    // client socket
    uv_tcp_t* client = (uv_tcp_t*)malloc(sizeof(uv_tcp_t));
    uv_tcp_init(server->loop, client);
    if (uv_accept(server_socket, (uv_stream_t*)client) != 0) {
        uv_close((uv_handle_t*)client, NULL);
        return;
    }

    // socket data
    jsonrpc_session_t* session = (jsonrpc_session_t*)malloc(sizeof(jsonrpc_session_t));
    memset(session, 0, sizeof(jsonrpc_session_t));
    session->server = server;
    session->stream = (uv_stream_t*)client;
    session->id = server->next_session_id++;
    client->data = session;

    uv_read_start((uv_stream_t*)client, jsonrpc_alloc_buffer, jsonrpc_connection_on_read);

    jsonrpc_server_add_session(server, session);
}

// ////////////////////////////////////////////////////////////////////////////
//

jsonrpc_server_t* jsonrpc_server_init(uv_loop_t* loop, const char* name, int port)
{
    jsonrpc_server_t* server = malloc(sizeof(jsonrpc_server_t));
    memset(server, 0, sizeof(jsonrpc_server_t));

    if (port < 0) {
        port = 8800;
    }

    server->port = port;
    server->loop = loop;
    server->next_session_id = 1;

    if (name) {
        snprintf(server->name, sizeof(server->name), "tcp:127.0.0.1:%d", server->port);
    }

    return server;
}

int jsonrpc_server_start(jsonrpc_server_t* server, jsonrpc_request_handler handler)
{
    if (server == NULL) {
        return -1;
    }

    int i = 0;
    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        server->sessions[i] = NULL;
    }

    server->request_handler = handler;

    server->server_socket = malloc(sizeof(uv_tcp_t));
    uv_tcp_t* server_socket = server->server_socket;
    server_socket->data = server;

    // uv_pipe_init(server->loop, server_socket, 0);
    uv_tcp_init(server->loop, server_socket);

    // uv_fs_t req;
    // uv_fs_unlink(server->loop, &req, server->name, NULL);
    // remove(server->name);

    int ret;
    struct sockaddr_in bind_addr;
    uv_ip4_addr("0.0.0.0", server->port, &bind_addr);
    ret = uv_tcp_bind(server_socket, (const struct sockaddr*)&bind_addr, 0);
    if (ret) {
        LOG_W("jsonrpc: Bind error %s at %d", uv_err_name(ret), server->port);
        return -1;
    }

    ret = uv_listen((uv_stream_t*)server_socket, 128, jsonrpc_server_on_connection);
    if (ret) {
        LOG_W("jsonrpc: Listen error %s", uv_err_name(ret));
        return -2;
    }

    LOG_I("jsonrpc: Starting RPC server at %d", server->port);
    return 0;
}

int jsonrpc_server_stop(jsonrpc_server_t* server)
{
    if (server == NULL) {
        return -1;
    }

    int i = 0;
    for (i = 0; i < MAX_CLIENT_COUNT; i++) {
        jsonrpc_session_t* session = server->sessions[i];
        server->sessions[i] = NULL;

        if (session) {
            jsonrpc_connection_close(session);
        }
    }

    uv_tcp_t* socket = server->server_socket;
    if (!socket) {
        return 0;
    }

    server->server_socket = NULL;
    uv_close((uv_handle_t*)socket, NULL);
    return 0;
}

int jsonrpc_server_notify(jsonrpc_server_t* server, const char* method, cJSON* message)
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
        jsonrpc_session_t* session = server->sessions[i];
        if (!session) {
            continue;
        }

        cJSON* data = cJSON_Duplicate(message, 1);
        jsonrpc_connection_notify(session, method, data);
    }

    return 0;
}
