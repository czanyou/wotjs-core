
#include "http-client.h"
#include "http-request.h"
#include "http_parser.h"
#include "tcp-transport.h"
#include "tls-transport.h"

#include "url/uri-parser.h"

#include "util/log.h"
#include "util/path.h"

#include <uv.h>

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define HTTP_CLIENT_MAX_HEADER_COUNT 100

typedef struct http_client_write_req_s {
    uv_write_t req;
    uv_buf_t buf;
} http_client_write_req_t;

struct http_client_s {
    tcp_transport_t tcp_transport;
    tls_transport_t tls_transport;
    char* status_text;
    char* value;
    dbuffer_t response_body;
    http_header_t headers[HTTP_CLIENT_MAX_HEADER_COUNT];
    http_parser parser;
    http_response_event_handler response_handler;
    size_t content_length;
    struct uri_t* url;
    uint32_t closed;
    uint32_t header_count;
    uint32_t is_secure; // 是否使用 TLS 传输协议
    uint32_t method;
    uint32_t ready_state;
    uint32_t status_code;
    uint32_t timeout;
    uv_buf_t request_body;
    void* data;
    void* request;
};

// ////////////////////////////////////////////////////////////////////////////
// HTTP parser

static char* http_parser_strdup(const char* at, size_t length)
{
    if (at == NULL || length == 0) {
        return NULL;
    }

    char* buffer = malloc(length + 1);
    memcpy(buffer, at, length);
    buffer[length] = '\0';
    return buffer;
}

static int http_parser_on_message_begin(http_parser* parser)
{
    return 0;
}

static int http_parser_on_headers_complete(http_parser* parser)
{
    http_client_t* http_client = (http_client_t*)parser->data;
    if (http_client == NULL) {
        return -1;
    }

    char* value = http_client->value;
    http_client->value = NULL;
    if (value) {
        free((char*)value);
    }

    http_client->ready_state = HTTP_CLIENT_STATE_HEADERS_RECEIVED;
    http_response_event_handler handler = http_client->response_handler;
    if (!handler) {
        return 0;
    }

    http_client->status_code = parser->status_code;
    http_client->content_length = parser->content_length;

    handler(http_client->data, http_client->ready_state, parser->status_code, parser->content_length, NULL);
    return 0;
}

static int http_parser_on_message_complete(http_parser* parser)
{
    http_client_t* http_client = (http_client_t*)parser->data;
    if (http_client == NULL) {
        return -1;
    }

    http_client->ready_state = HTTP_CLIENT_STATE_DONE;
    http_response_event_handler handler = http_client->response_handler;
    if (!handler) {
        return 0;
    }

    handler(http_client->data, http_client->ready_state, parser->status_code, parser->content_length, NULL);
    return 0;
}

static int http_parser_on_status(http_parser* parser, const char* at, size_t length)
{
    http_client_t* http_client = (http_client_t*)parser->data;
    if (http_client == NULL) {
        return -1;
    }

    char* status_text = http_client->status_text;
    http_client->status_text = NULL;
    if (status_text) {
        free(status_text);
    }

    http_client->status_text = http_parser_strdup(at, length);
    return 0;
}

static int http_parser_on_header_field(http_parser* parser, const char* at, size_t length)
{
    http_client_t* http_client = (http_client_t*)parser->data;
    if (http_client == NULL) {
        return -1;
    }

    http_client->value = http_parser_strdup(at, length);

    return 0;
}

static int http_parser_on_header_value(http_parser* parser, const char* at, size_t length)
{
    http_client_t* http_client = (http_client_t*)parser->data;
    if (http_client == NULL) {
        return -1;
    }

    char* name = http_client->value;
    http_client->value = NULL;
    if (name == NULL) {
        return -1;
    }

    char* value = http_parser_strdup(at, length);
    if (value == NULL) {
        free((char*)name);
        return -1;
    }
    // LOG_I("%s: %s", http_client->value, value);

    int index = http_client->header_count;
    if (index < HTTP_CLIENT_MAX_HEADER_COUNT - 1) {
        http_client->headers[index].name = name;
        http_client->headers[index].value = value;
        http_client->header_count++;
    }

    return 0;
}

static int http_parser_on_body(http_parser* parser, const char* at, size_t length)
{
    http_client_t* http_client = (http_client_t*)parser->data;
    if (http_client == NULL) {
        return -1;
    }

    http_response_event_handler handler = http_client->response_handler;
    if (!handler) {
        return 0;
    }

    http_client->ready_state = HTTP_CLIENT_STATE_LOADING;
    handler(http_client->data, http_client->ready_state, 0, length, at);

    return 0;
}

static const struct http_parser_settings http_parser_settings_s = {
    http_parser_on_message_begin,
    NULL,
    http_parser_on_status,
    http_parser_on_header_field,
    http_parser_on_header_value,
    http_parser_on_headers_complete,
    http_parser_on_body,
    http_parser_on_message_complete,
    NULL, /* on_chunk_header */
    NULL, /* on_chunk_complete */
};

// ////////////////////////////////////////////////////////////////////////////
// HTTP client

static int http_client_write(http_client_t* self, const uint8_t* data, size_t len)
{
    assert(self != NULL);

#ifdef CONFIG_MBEDTLS
    // LOG_I("http-client: send\r\n%s", data);
    if (self->is_secure) {
        return tls_transport_write(&self->tls_transport, data, len);
    }
#endif

    return tcp_transport_write(&self->tcp_transport, data, len);
}

static int http_client_reset(http_client_t* self)
{
    assert(self != NULL);

    // request
    void* request = self->request;
    if (request) {
        self->request = NULL;
        http_request_destroy(request);
    }

    // url
    if (self->url) {
        uri_free(self->url);
        self->url = NULL;
    }

    // body
    uv_buf_t* body = &self->request_body;
    if (body->base) {
        free(body->base);
        body->base = NULL;
        body->len = 0;
    }

    // status text
    char* status_text = self->status_text;
    self->status_text = NULL;
    if (status_text) {
        free(status_text);
    }

    // value
    char* value = self->value;
    self->value = NULL;
    if (value) {
        free((char*)value);
    }

    // headers
    for (int i = 0; i < self->header_count; i++) {
        http_header_t* header = &self->headers[i];
        if (header->name) {
            free((char*)header->name);
            header->name = NULL;
        }

        if (header->value) {
            free((char*)header->value);
            header->value = NULL;
        }
    }

    memset(self->headers, 0, sizeof(self->headers));

    self->header_count = 0;
    self->content_length = 0;
    self->status_code = 0;
    self->method = 0;
    self->ready_state = HTTP_CLIENT_STATE_UNSENT;

    return 0;
}

int http_client_destroy(http_client_t* self)
{
    assert(self != NULL);
    if (self == NULL) {
        return 0;

    } else if (self->closed) {
        return 0;
    }

    // LOG_I("http-client: destroy");

    self->closed = 1;
    self->response_handler = NULL;

    http_client_reset(self);

#ifdef CONFIG_MBEDTLS
    tls_transport_destroy(&self->tls_transport);
#endif

    tcp_transport_destroy(&self->tcp_transport);
    return 0;
}

static void http_client_on_connected(http_client_t* self)
{
    if (self == NULL) {
        return;
    }

    // LOG_I("http-client: connected");

    http_parser_init(&self->parser, HTTP_BOTH);
    self->parser.data = self;

    uv_buf_t* body = &self->request_body;
    if (body->base && body->len > 0) {
        http_request_set_content_lenth(self->request, body->len);
    }

    int len = 0;
    const char* headers = http_request_get(self->request, &len);
    http_client_write(self, headers, len);

    if (body->base && body->len > 0) {
        http_client_write(self, body->base, body->len);
    }

    self->ready_state = HTTP_CLIENT_STATE_OPENED;
    http_response_event_handler handler = self->response_handler;
    if (handler) {
        handler(self->data, self->ready_state, 0, 0, NULL);
    }

    // LOG_I("http-client: send:\r\n%s", headers);
}

static void http_client_on_error(http_client_t* http_client, int code, const char* message)
{
    LOG_I("http-client: error: %d: %s", code, message);

    if (http_client == NULL) {
        return;
    }

    http_client_destroy(http_client);
}

static void http_client_on_transport_event(void* transport, int event, int status, void* data)
{
    http_client_t* self = (http_client_t*)transport;
    if (self == NULL) {
        return;
    }

    if (event == TCP_TRANSPORT_EVENT_CONNECTED) {
        http_client_on_connected(self);

    } else if (event == TCP_TRANSPORT_EVENT_ERROR) {
        http_client_on_error(self, status, data);
    }
}

static void http_client_on_input(void* transport, const char* data, ssize_t nread)
{
    http_client_t* http_client = (http_client_t*)transport;
    if (http_client == NULL) {
        return;
    }

    if (data == NULL || nread <= 0) {
        LOG_I("http-client: error: %ld", nread);
        http_client_destroy(http_client);
        return;
    }

    // LOG_I("http-client: data: %ld: %s", nread, data);

    size_t nparsed = http_parser_execute(&http_client->parser, &http_parser_settings_s, data, nread);
}

http_header_t* http_client_get_headers(http_client_t* self, int* len)
{
    assert(self != NULL);

    if (len) {
        *len = self->header_count;
    }

    return self->headers;
}

const char* http_client_get_header(http_client_t* self, const char* name)
{
    assert(self != NULL);

    if (name == NULL) {
        return NULL;
    }

    int count = self->header_count;
    http_header_t* headers = self->headers;
    for (int i = 0; i < count; i++) {
        if (strcasecmp(headers[i].name, name) == 0) {
            return headers[i].value;
        }
    }

    return NULL;
}

uint32_t http_client_get_status_code(http_client_t* self)
{
    assert(self != NULL);
    return self->status_code;
}

const char* http_client_get_status_text(http_client_t* self)
{
    assert(self != NULL);
    return self->status_text;
}

http_client_t* http_client_create(uv_loop_t* loop)
{
    assert(loop != NULL);

    http_client_t* self = malloc(sizeof(http_client_t));
    memset(self, 0, sizeof(http_client_t));

    // tls
    tls_transport_t* tls_transport = &self->tls_transport;
    tls_transport->loop = loop;
    tls_transport->data = self;
    tls_transport->on_event = http_client_on_transport_event;
    tls_transport->on_input = http_client_on_input;

    // tcp
    tcp_transport_t* tcp_transport = &self->tcp_transport;
    tcp_transport->loop = loop;
    tcp_transport->data = self;
    tcp_transport->on_event = http_client_on_transport_event;
    tcp_transport->on_input = http_client_on_input;

    return self;
}

int http_client_init(http_client_t* self, const char* method, const char* url)
{
    assert(self != NULL);

    // request
    void* request = self->request;
    if (request) {
        return -1;
    }

    if (url == NULL) {
        return -1;
    }

    int url_length = strlen(url);
    struct uri_t* uri = uri_parse(url, url_length);
    if (uri == NULL) {
        return -1;
    }

    char* request_url = malloc(url_length);
    uri_path(uri, request_url, url_length);

    // LOG_I("http-client: %s: %s", request_url, url);

    self->method = HTTP_GET;
    self->url = uri;
    self->request = http_request_create(HTTP_1_1);

    if (method) {
        if (strcasecmp(method, "POST") == 0) {
            self->method = HTTP_POST;
        }
    }

    // LOG_I("http-client: method=%d", self->method);
    http_request_set_uri(self->request, self->method, request_url);

    free(request_url);
    return 0;
}

int http_client_set_headers(http_client_t* self, const http_header_t* headers, uint32_t count)
{
    assert(self != NULL);

    // headers
    if (!headers || count <= 0) {
        return -1;
    }

    void* request = self->request;
    if (request == NULL) {
        return -1;
    }

    for (int i = 0; i < count; i++) {
        if (headers[i].name == NULL) {
            continue;

        } else if (headers[i].value == NULL) {
            continue;
        }

        http_request_set_header(request, headers[i].name, headers[i].value);
    }

    return 0;
}

int http_client_set_body(http_client_t* self, const uint8_t* data, uint32_t bytes, const char* type)
{
    assert(self != NULL);

    void* request = self->request;
    if (request == NULL) {
        return -1;
    }

    if (type) {
        http_request_set_content_type(request, type);
    }

    // body
    if (data && bytes) {
        uint8_t* buffer = malloc(bytes);
        memcpy(buffer, data, bytes);
        self->request_body = uv_buf_init(buffer, bytes);
    }

    return 0;
}

int http_client_set_callback(http_client_t* self, http_response_event_handler handler, void* param)
{
    assert(self != NULL);

    self->response_handler = handler;
    self->data = param;

    return 0;
}

int http_client_set_timeout(http_client_t* self, uint32_t timeout)
{
    assert(self != NULL);
    self->timeout = timeout;

    return 0;
}

int http_client_send(http_client_t* self)
{
    assert(self != NULL);

    void* request = self->request;
    if (request == NULL) {
        return -1;
    }

    // host
    struct uri_t* uri = self->url;
    if (uri == NULL) {
        return -1;
    }

    int port = uri->port;
    const char* host = uri->host;
    if (host == NULL) {
        return -1;
    }

    http_request_set_header(request, "Host", host);
    // LOG_I("http-client: connect: %s:%d (%s)", scheme, self->is_secure, host);

#ifdef CONFIG_MBEDTLS
    // scheme
    const char* scheme = uri->scheme;
    if (scheme && strcmp(scheme, "https") == 0) {
        self->is_secure = 1;

        if (port <= 0) {
            port = 443;
        }

        tls_transport_connect(&self->tls_transport, host, port);
        return 0;
    }

#endif
    // port
    if (port <= 0) {
        port = 80;
    }

    tcp_transport_connect(&self->tcp_transport, host, port);
    return 0;
}

int http_client_get(http_client_t* self, const char* url, const http_header_t* headers,
    uint32_t count, http_response_event_handler handler, void* param)
{
    assert(self != NULL);

    http_client_set_callback(self, handler, param);
    int ret = http_client_init(self, "GET", url);
    if (ret < 0) {
        return ret;
    }

    http_client_set_headers(self, headers, count);
    http_client_send(self);
    return 0;
}

int http_client_post(http_client_t* self, const char* url, const http_header_t* headers,
    uint32_t count, const uint8_t* data, uint32_t bytes, http_response_event_handler handler, void* param)
{
    assert(self != NULL);

    http_client_set_callback(self, handler, param);
    int ret = http_client_init(self, "POST", url);
    if (ret < 0) {
        return ret;
    }

    http_client_set_headers(self, headers, count);
    http_client_set_body(self, data, bytes, NULL);
    http_client_send(self);
    return 0;
}

typedef struct form_data_t {
    char* data;
    size_t size;
    size_t len;
    const char* boundary;
} form_data_t;

int form_data_init(form_data_t* form_data, size_t size)
{
    memset(form_data, 0, sizeof(form_data_t));

    form_data->size = size;
    form_data->data = malloc(form_data->size);

    form_data->boundary = "--form-data-kjsdfb934klg342042348";
    return 0;
}

int form_data_add_file(form_data_t* form_data, const char* name, const char* filename, const char* type, const uint8_t* data, size_t size)
{
    char* offset = form_data->data + form_data->len;
    size_t limit = form_data->size - form_data->len;
    int len = snprintf(offset, limit,
        "%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n",
        form_data->boundary, name, filename, type);
    form_data->len += len;

    offset = form_data->data + form_data->len;
    limit = form_data->size - form_data->len;

    if (data && limit > size + 2) {
        memcpy(offset, data, size);
        form_data->len += size;
        offset += size;

        memcpy(offset, "\r\n", 2);
        form_data->len += 2;
    }

    return 0;
}

int form_data_add_value(form_data_t* form_data, const char* name, const char* value)
{
    char* offset = form_data->data + form_data->len;
    size_t limit = form_data->size - form_data->len;
    int len = snprintf(offset, limit,
        "%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n", form_data->boundary, name, value);
    form_data->len += len;
    return 0;
}

int form_data_end(form_data_t* form_data)
{
    char* offset = form_data->data + form_data->len;
    size_t limit = form_data->size - form_data->len;
    int len = snprintf(offset, limit, "%s--\r\n", form_data->boundary);
    form_data->len += len;
    return 0;
}

int form_data_destroy(form_data_t* form_data)
{
    free(form_data->data);
    free(form_data);
    return 0;
}

int http_client_set_file(http_client_t* self, const char* name, const char* filename,
    const uint8_t* data, uint32_t bytes, const char* type)
{
    assert(self != NULL);

    void* request = self->request;
    if (request == NULL) {
        return -1;
    }

    if (name == NULL) {
        name = "file";
    }

    if (filename == NULL) {
        filename = "file";
    }

    if (type == NULL) {
        type = "application/octet-stream";
    }

    filename = path_basename(filename);

    form_data_t* form_data = malloc(sizeof(form_data_t));
    form_data_init(form_data, 255 + bytes);
    // form_data_add_value(form_data, "name", "test");
    form_data_add_file(form_data, name, filename, type, data, bytes);
    form_data_end(form_data);

    uint8_t* buffer = form_data->data;
    size_t len = form_data->len;

    form_data->data = NULL;

    const char* content_type = "multipart/form-data; boundary=form-data-kjsdfb934klg342042348";
    http_request_set_content_type(request, content_type);

    self->request_body = uv_buf_init(buffer, len);

    form_data_destroy(form_data);
    return 0;
}
