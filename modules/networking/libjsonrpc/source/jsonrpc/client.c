#include "jsonrpc/client.h"
#include "util/log.h"

#define TAG "josnrpc-client"

/**
 * @brief 代表一个 JSON-RPC 客户端
 * 
 */
struct jsonrpc_client_s {
    char name[255]; // 要连接的地址
    uint32_t port; // 要连接的端口
    uint32_t connected; // 是否已连接
    uint32_t next_id; // 下一个请求消息 ID
    uv_loop_t* loop;
    uv_tcp_t* client_socket; // 相关的 Socket
    jsonrpc_event_handler handler; // 注册的回调函数
};

jsonrpc_client_t* jsonrpc_client_init(uv_loop_t* loop, int port, const char* name)
{
    jsonrpc_client_t* client = malloc(sizeof(jsonrpc_client_t));
    memset(client, 0, sizeof(jsonrpc_client_t));

    client->port = (port < 0) ? 8800 : port;
    client->loop = loop;
    strncpy(client->name, name ? name : "127.0.0.1", sizeof(client->name));
    return client;
}

static void jsonrpc_client_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    *buf = uv_buf_init((char*)malloc(suggested_size), suggested_size);
}

/**
 * @brief 处理收到的消息
 * 
 * @param client 客户端
 * @param message 消息内容
 * @param nread 消息长度
 * @return 0 表示成功 
 */
static int jsonrpc_client_process_message(jsonrpc_client_t* client, const char* message, ssize_t nread)
{
    if (client == NULL) {
        return -1;

    } else if (message == NULL || nread <= 0) {
        return -2;
    }

    cJSON* response = cJSON_Parse(message);
    if (response == NULL) {
        return -3;

    } else if (response->type != cJSON_Object) {
        cJSON_Delete(response);
        return -4;
    }

    cJSON* idItem = cJSON_GetObjectItem(response, "id");
    cJSON* jsonrpcItem = cJSON_GetObjectItem(response, "jsonrpc");
    cJSON* result = cJSON_GetObjectItem(response, "result");
    cJSON* error = cJSON_GetObjectItem(response, "error");

    int id = -1;
    if (idItem) {
        id = idItem->valueint;
    }

    if (client->handler) {
        client->handler(JSONRPC_EVENT_RESPONSE, id, result, error);
    }

    cJSON_Delete(response);
    return 0;
}

/**
 * @brief 处理收到的数据
 * 
 * @param client 客户端
 * @param data 消息数据
 * @param nread 数据长度
 */
static void jsonrpc_client_process_data(jsonrpc_client_t* client, const char* data, ssize_t nread)
{
    if (data == NULL || nread <= 0) {
        return;
    }

    size_t leftover = nread;
    while (leftover > 0) {
        // 读取消息的长度
        char* next = NULL;
        size_t length = strtol(data, &next, 16);
        if (next == NULL) {
            break;
        }

        if (*next != '\r') {
            break;
        }

        next++;
        next++;

        // 读取消息内容
        size_t needSize = (next - data) + length + 2;
        if (needSize < leftover) {
            break;
        }

        next[length] = '\0';

        // 处理消息
        jsonrpc_client_process_message(client, next, length);
        leftover -= needSize;
        data += needSize;
    }
}

/**
 * @brief 读取数据回调
 * 
 * @param stream 
 * @param nread 读到的数据长度
 * @param buf 存放数据的缓存区
 */
static void jsonrpc_client_on_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf)
{
    jsonrpc_client_t* client = (jsonrpc_client_t*)stream->data;
    if (client == NULL) {
        return;
    }

    uv_tcp_t* client_socket = client->client_socket;
    if (client_socket == NULL) {
        return;
    }

    if (nread < 0) {
        if (nread == UV_EOF) {
            // end of file
            // uv_close((uv_handle_t*)client_socket, NULL);
        }

        if (client->handler) {
            client->handler(JSONRPC_EVENT_CLOSE, nread, NULL, NULL);
        }

        jsonrpc_client_close(client);

    } else if (nread > 0) {
        buf->base[nread] = 0;
        // LOGT_I("%ld", nread);
        jsonrpc_client_process_data(client, buf->base, nread);
    }

    // OK to free buffer as write_data copies it.
    if (buf->base) {
        free(buf->base);
    }
}

/**
 * @brief 连接回调
 * 
 * @param req 连接请求
 * @param status 连接状态
 */
static void jsonrpc_client_on_connect(uv_connect_t* req, int status)
{
    jsonrpc_client_t* client = (jsonrpc_client_t*)req->data;
    if (client == NULL) {
        free(req);
        return;
    }

    uv_tcp_t* client_socket = client->client_socket;
    if (client_socket == NULL) {
        free(req);
        return;
    }

    if (status >= 0) {
        // LOGT_I("connected");
        uv_read_start((uv_stream_t*)client_socket, jsonrpc_client_alloc_buffer, jsonrpc_client_on_read);
        client->connected = 1;

    } else {
        // LOGT_I("connect failed: %d", status);
        client->connected = 0;
    }

    if (client->handler) {
        client->handler(JSONRPC_EVENT_CONNECT, status, NULL, NULL);
    }

    free(req);
}

int jsonrpc_client_start(jsonrpc_client_t* client, jsonrpc_event_handler handler)
{
    if (client == NULL) {
        return -1;

    } else if (client->client_socket) {
        return -2;
    }

    client->handler = handler;

    client->client_socket = malloc(sizeof(uv_tcp_t));
    uv_tcp_t* client_socket = client->client_socket;
    client_socket->data = client;

    struct sockaddr_in socket_address;
    uv_ip4_addr(client->name, client->port, &socket_address);
    uv_tcp_init(client->loop, client_socket);

    uv_connect_t* req = malloc(sizeof(uv_connect_t));
    req->data = client;
    int ret = uv_tcp_connect(req, client_socket, (const struct sockaddr*)&socket_address, jsonrpc_client_on_connect);
    if (ret < 0) {
        free(req);

        jsonrpc_client_close(client);
        return ret;
    }

    return 0;
}

int jsonrpc_client_close(jsonrpc_client_t* client)
{
    if (client == NULL) {
        return -1;
    }

    client->connected = 0;
    client->loop = NULL;
    client->handler = NULL;

    uv_tcp_t* socket = client->client_socket;
    if (!socket) {
        return 0;
    }

    client->client_socket = NULL;
    uv_close((uv_handle_t*)socket, NULL);
    return 0;
}

typedef struct jsonrpc_write_req_s {
    uv_write_t req;
    uv_buf_t buf;
} jsonrpc_write_req_t;

static void jsonrpc_free_write_request(uv_write_t* req)
{
    jsonrpc_write_req_t* request = (jsonrpc_write_req_t*)req;
    free(request->buf.base);
    free(request);
}

static void jsonrpc_client_on_write(uv_write_t* req, int status)
{
    if (status < 0) {
        fprintf(stderr, "Write error %s\n", uv_err_name(status));
    }

    jsonrpc_free_write_request(req);
}

/**
 * @brief 发送消息
 * 
 * @param client 客户端
 * @param message 消息内容
 * @param size 消息长度
 * @return 0 表示成功 
 */
static int jsonrpc_client_send_message(jsonrpc_client_t* client, char* message, ssize_t size)
{
    if (client == NULL) {
        return -1;

    } else if (message == NULL || size <= 0) {
        return -2;
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

    // send
    // LOGT_I("send: %s", buffer);
    uv_stream_t* stream = (uv_stream_t*)client->client_socket;
    req->buf = uv_buf_init(buffer, offset);
    int ret = uv_write((uv_write_t*)req, stream, &req->buf, 1, jsonrpc_client_on_write);
    if (ret != 0) {
        jsonrpc_free_write_request((uv_write_t*)req);
        return 0;
    }

    return 0;
}

int jsonrpc_client_send(jsonrpc_client_t* client, const char* method, cJSON* params)
{
    if (client == NULL) {
        cJSON_Delete(params);
        return -1;

    } else if (!method || !method[0]) {
        cJSON_Delete(params);
        return -2;
    }

    client->next_id++;
    int id = client->next_id;

    // request
    cJSON* request = cJSON_CreateObject();
    cJSON_AddStringToObject(request, "jsonrpc", "2.0");
    cJSON_AddStringToObject(request, "method", method);
    cJSON_AddNumberToObject(request, "id", id);

    if (params) {
        cJSON_AddItemToObject(request, "params", params);
    }

    char* message = cJSON_PrintUnformatted(request);
    if (message) {
        size_t size = strlen(message);
        jsonrpc_client_send_message(client, message, size);
        free(message);
    }

    cJSON_Delete(request);
    return id;
}
