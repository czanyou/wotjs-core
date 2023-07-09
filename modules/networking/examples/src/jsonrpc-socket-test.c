#include "jsonrpc/socket.h"
#include "util/log.h"

static jsonrpc_socket_t* socket1 = NULL;
static jsonrpc_socket_t* socket2 = NULL;

int rpc_send_subscribe(const char* method)
{
    cJSON* message = cJSON_CreateObject();
    cJSON_AddNumberToObject(message, "type", 1);
    cJSON_AddNumberToObject(message, "topics", 300);
    int ret = jsonrpc_socket_send(socket1, method, message, "127.0.0.1", 8002);
    cJSON_Delete(message);

    printf("rpc_send_subscribe: %d=%s\r\n", ret, method);
    return 0;
}

cJSON* rpc_request_handler1(const char* method, cJSON* params)
{
    printf("request-1: %s\r\n", method);
    rpc_send_subscribe("jsonrpc.unsubscribe");

    return NULL;
}

cJSON* rpc_response_handler1(int id, cJSON* result, cJSON* error)
{
    char* message = cJSON_PrintUnformatted(result);
    printf("response-1: %d: %s\r\n", id, message);

    if (message) {
        free(message);
    }

    if (id == 2) {
        jsonrpc_socket_stop(socket1);
        jsonrpc_socket_stop(socket2);
    }

    return NULL;
}

int rpc_send_notify(int id)
{
    cJSON* data = cJSON_CreateObject();
    cJSON_AddNumberToObject(data, "topics", id);
    jsonrpc_socket_notify(socket2, "status", data);

    return 0;
}

cJSON* rpc_request_handler2(const char* method, cJSON* params)
{
    char* message = cJSON_PrintUnformatted(params);
    printf("request-2: %s=%s\r\n", method, message);

    if (message) {
        free(message);
    }

    rpc_send_notify(2);

    cJSON* result = cJSON_CreateObject();
    cJSON_AddNumberToObject(result, "type", 1);
    cJSON_AddNumberToObject(result, "data", 200);

    return result;
}

int main(int argc, char** argv)
{
    uv_loop_t* loop = uv_default_loop();

    socket1 = jsonrpc_socket_init(loop, 8001);
    jsonrpc_socket_start(socket1, rpc_request_handler1, rpc_response_handler1);

    socket2 = jsonrpc_socket_init(loop, 8002);
    jsonrpc_socket_start(socket2, rpc_request_handler2, NULL);

    LOG_I("rtc-test: start");
    rpc_send_subscribe("jsonrpc.subscribe");

    uv_run(loop, UV_RUN_DEFAULT);
    return 0;
}
