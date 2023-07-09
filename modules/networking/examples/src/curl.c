#include "http-client.h"
#include "http_parser.h"

#include "util/dbuffer.h"

#include <uv.h>

#include <getopt.h>
#include <stdlib.h>
#include <string.h>

static http_client_t* http_client = NULL;

static int http_content_length = 0;
static FILE* http_output_file = NULL;
static dbuffer_t http_body = { 0 };

void http_client_on_response(void* param, int ready_state, int status_code, int64_t content_length, const uint8_t* data)
{
    if (ready_state == HTTP_CLIENT_STATE_HEADERS_RECEIVED) {
        http_content_length = content_length;
        // printf("response: %d %s (content-length: %ld)\r\n", status_code, http_client_get_status_text(http_client), content_length);
        // printf("\r\n");

    } else if (ready_state == HTTP_CLIENT_STATE_LOADING) {
        if (http_content_length > 0) {
            http_content_length -= content_length;
        }

        if (http_output_file) {
            fwrite(data, content_length, 1, http_output_file);

        } else {
            // printf("%s", data);
            // http_client_process_message(data, content_length);
            dbuffer_put(&http_body, data, content_length);
        }

    } else if (ready_state == HTTP_CLIENT_STATE_DONE) {
        int count = 0;

        uint32_t status_code = http_client_get_status_code(http_client);
        const char* status_text = http_client_get_status_text(http_client);

        printf("response: %d %s\r\n", status_code, status_text);

        if (!http_output_file) { 
            http_header_t* headers = http_client_get_headers(http_client, &count);
            for (int i = 0; i < count; i++) {
                printf("%s: %s\r\n", headers[i].name, headers[i].value);
            }
        }

        http_body.buf[http_body.size] = '\0';
        printf("body:\r\n%s\r\n", http_body.buf);

        http_client_destroy(http_client);
        http_client = NULL;

        if (http_output_file) {
            fclose(http_output_file);
            http_output_file = NULL;
        }
    }
}

static void print_help()
{
    printf("curl 1.0, a non-interactive network retriever.\r\n");
    printf("Usage: curl [OPTION]... [URL]...\r\n");
}

typedef struct curl_options_s
{
    int flags_version;
    char* output;
    char* data;
    char* file;
    char* headers;
    char* type;    
} curl_options_t;

int main(int argc, char** argv)
{
    int flags_version = 0;
    int c = 0;
    curl_options_t options = { 0 };

    while ((c = getopt(argc, argv, "a:d:f:hH:o:t:v")) != EOF) {
        switch (c) {
        case 'v':
            flags_version = 1;
            break;

        case 'h':
            flags_version = 1;
            break;

        case 'H':
            options.headers = optarg;
            break;

        case 'd':
            options.data = optarg;
            break;

        case 'f':
            options.file = optarg;
            break;

        case 't':
            options.type = optarg;
            break;

        case 'o':
            options.output = optarg;
            break;
        }
    }

    if (flags_version) {
        print_help();
        return 0;
    }

    const char* url = NULL;
    if (optind < argc) {
        url = argv[optind];
    }

    if (url == NULL) {
        print_help();
        return 0;
    }

    uv_loop_t* loop = uv_default_loop();

    http_client = http_client_create(loop);

    http_header_t headers[10];
    headers[0].name = "User-Agent";
    headers[0].value = "WoT.js/19.8.0";

    headers[1].name = "Accept";
    headers[1].value = "*/*";

    headers[2].name = "Connection";
    headers[2].value = "keep-alive";

    dbuffer_init(&http_body);

    if (options.output) {
        FILE* file = fopen(options.output, "wb");
        if (file != NULL) {
            http_output_file = file;
        }
    }

    if (options.data) {
        int ret = http_client_init(http_client, "POST", url);
        if (ret < 0) {
            return ret;
        }

        size_t bytes = strlen(options.data);

        http_client_set_headers(http_client, headers, 2);
        http_client_set_body(http_client, options.data, bytes, options.type);

    } else if (options.file) {
        int ret = http_client_init(http_client, "POST", url);
        if (ret < 0) {
            return ret;
        }

        FILE* file = fopen(options.file, "rb");
        if (file == NULL) {
            return 0;
        }

        fseek(file, 0, SEEK_END);
        size_t file_length = ftell(file);
        fseek(file, 0, SEEK_SET);

        if (file_length <= 0) {
            fclose(file);
            return 0;
        }

        uint8_t* file_data = malloc(file_length);
        size_t file_size = fread(file_data, 1, file_length, file);
        fclose(file);

        http_client_set_headers(http_client, headers, 1);
        http_client_set_file(http_client, "file", options.file, file_data, file_size, options.type);

        free(file_data);

    } else {
        int ret = http_client_init(http_client, "GET", url);
        if (ret < 0) {
            return ret;
        }

        http_client_set_headers(http_client, headers, 1);
    }

    http_client_set_callback(http_client, http_client_on_response, NULL);
    http_client_send(http_client);
    uv_run(loop, UV_RUN_DEFAULT);

    if (http_client) {
        http_client_destroy(http_client);
        http_client = NULL;
    }

    return 0;
}
