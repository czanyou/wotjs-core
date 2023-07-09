#include "http-server.h"
#include "util/log.h"

#include <assert.h>

#define TAG "httpd"

static http_server_t* http_server = NULL;
static int32_t total_length = 0;
static int32_t count1 = 0;
static int32_t count2 = 0;

static int http_server_flush(http_response_t* response)
{
    char buffer[400] = { 0 };

    while (1) {
        int length = sizeof(buffer);

        if (total_length <= 0) {
            http_response_close(response);
            return 0;
        }

        if (length > total_length) {
            length = total_length;
        }

        count1++;
        int ret = http_response_send(response, buffer, length);
        total_length -= length;

        if (ret) {
            break;
        }
    }

    return 0;
}

static int http_server_response_handler(http_response_t* response, int event, int status, void* data)
{
    if (event == HTTP_RESPONSE_EVENT_READY) {
        count2++;
        http_server_flush(response);
        return 0;

    } else {
        LOGT_I("event: %d (%x) %d (%d-%d)", event, status, total_length, count1, count2);
    }

    return 0;
}

static int http_server_response_test(http_response_t* response)
{
    total_length = 1024 * 1024 * 16;

    http_response_set_status_code(response, 200, "OK");
    http_response_set_content_type(response, "text/html");
    http_response_set_content_length(response, total_length);
    http_response_set_event_handler(response, http_server_response_handler, NULL);
    http_response_send(response, NULL, 0);

    http_server_flush(response);
}

static int http_server_request_handler(http_server_t* http_server, http_request_t* request, http_response_t* response)
{
    const char* url_string = http_request_get_url(request);

    char filename[1024] = { 0 };
    strncpy(filename, url_string, sizeof(filename) - 1);

    uint32_t header_count = 0;
    http_header_t* headers = http_request_get_headers(request, &header_count);
    for (int i = 0; i < header_count; i++) {
        LOGT_I("%s=%s", headers[i].name, headers[i].value);
    }

    LOGT_I("filename=%s", filename);
    char* p = strchr(filename, '?');
    if (p) {
        *p = '\0';
    }

    if (strcmp(filename, "/test") == 0) {
        http_server_response_test(response);
        return 0;
    }

    return http_response_send_file(response, filename);
}

int http_daemon_start(uv_loop_t* loop, int port)
{
    if (port <= 0) {
        port = 80;
    }

    http_server = http_server_init(loop);
    http_server_start(http_server, port, http_server_request_handler);

    return 0;
}

int main(int argc, char** argv)
{
    int c = 0;

    int flags_version = 0;
    char* option_home = NULL;
    char* option_port = NULL;

    while ((c = getopt(argc, argv, "h:p:v")) != EOF) {
        switch (c) {
        case 'v':
            flags_version = 1;
            break;

        case 'h':
            option_home = optarg;
            break;

        case 'p':
            option_port = optarg;
            break;
        }
    }

    int port = 0;
    if (option_port) {
        port = atoi(option_port);
    }

    uv_loop_t* loop = uv_default_loop();

    http_daemon_start(loop, port);

    if (option_home == NULL) {
        option_home = "./";
    }

    http_server_set_root_path(http_server, option_home);

    uv_run(loop, UV_RUN_DEFAULT);

    return 0;
}
