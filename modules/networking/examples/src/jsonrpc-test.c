#include "jsonrpc/client.h"
#include "util/log.h"

#define TAG "jsonrpc-test"

static jsonrpc_client_t* client = NULL;

int rpc_send_notify(const char* params)
{
    cJSON* data = cJSON_CreateObject();
    cJSON_AddStringToObject(data, "topics", params);
    int id = jsonrpc_client_send(client, "test", data);
    LOGT_I("send=%d", id);
    return 0;
}

int rpc_response_handler(int event, int id, cJSON* result, cJSON* error)
{
    LOGT_I("event=%d, id=%d", event, id);
    if (event == JSONRPC_EVENT_CONNECT) {
        rpc_send_notify("jsonrpc.test");

    } else if (event == JSONRPC_EVENT_RESPONSE) {
        char* message = cJSON_PrintUnformatted(result);
        if (message) {
            LOGT_I("result: %s", message);
            free(message);
        }

        jsonrpc_client_close(client);
        client = NULL;
    }

    return 0;
}

int main(int argc, char** argv)
{
    uv_loop_t* loop = uv_default_loop();

    client = jsonrpc_client_init(loop, 8002, NULL);
    jsonrpc_client_start(client, rpc_response_handler);

    LOGT_I("started");

    uv_run(loop, UV_RUN_DEFAULT);
    return 0;
}
