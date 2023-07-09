#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>

#include <uv.h>

#include "http-server.h"
#include "http_parser.h"

#include "util/dbuffer.h"
#include "util/log.h"
#include "util/path.h"

#define HTTP_HEADER_CAPACITY (2 * 1024)
#define TAG "http-server"

/**
 * @brief 实现 HTTP 服务器
 *
 */

enum http_client_state_e {
    HTTP_SERVER_STATE_UNSENT = 0,
    HTTP_SERVER_STATE_OPENED = 1,
    HTTP_SERVER_STATE_HEADERS_RECEIVED = 2,
    HTTP_SERVER_STATE_LOADING = 3,
    HTTP_SERVER_STATE_DONE = 4
};

typedef struct http_header_offset {
    uint32_t name;
    uint32_t value;
} http_header_offset;

/** HTTP 应答对象 */
struct http_response_s {
    http_connection_t* connection; // 相关的 HTTP 连接
    http_response_event_handler handler;

    char* buffer; // 数据缓存区
    size_t buffer_capacity; // 这个缓存区的容量
    uint32_t buffer_size; // 这个缓存区内的数据大小
    uint32_t connection_id; // 相关的 HTTP 连接 ID

    uint32_t content_length;
    uint32_t content_length_flag;
    uint32_t content_length_sent;

    void* data;
};

/** HTTP 请求对象 */
struct http_request_s {
    uint32_t method;
    uint32_t connection_id;
    uint32_t header_count;
    http_header_t headers[HTTP_HEADER_MAX];

    dbuffer_t url;
    dbuffer_t body;
    dbuffer_t header_buffer;

    void* data;
};

struct http_connection_s {
    uv_tcp_t* connection;
    http_server_t* http_server;
    http_parser parser;
    http_request_t request;
    http_response_t response;

    uint32_t closed;
    uint32_t connection_id;
    uint32_t ready_state;
    uint32_t parser_state;
    uint32_t header_offsets[HTTP_HEADER_MAX * 2];
    uint32_t header_offset;

    void* data;
};

struct http_server_s {
    uv_loop_t* loop;
    uv_tcp_t* server_socket;
    uint32_t next_connection_id;
    http_connection_t* connections[HTTP_CLIENT_MAX];
    http_server_event_handler method_handler;
    char address[255];
    char root_path[PATH_MAX];
    int port;
    void* data;
};

const char* http_request_get_url(http_request_t* request)
{
    assert(request != NULL);
    return request->url.buf;
}

uint32_t http_request_get_method(http_request_t* request)
{
    assert(request != NULL);
    return request->method;
}

http_header_t* http_request_get_headers(http_request_t* request, uint32_t* header_count)
{
    assert(request != NULL);

    if (header_count) {
        *header_count = request->header_count;
    }

    return request->headers;
}

static int http_server_remove_connection(http_server_t* server, http_connection_t* connection);
static int http_server_process_request(http_server_t* self, http_request_t* request, http_response_t* response);
static int http_connection_reset_request(http_connection_t* http_connection);

uint8_t* http_server_read_file(const char* filename, size_t* length)
{
    FILE* file = fopen(filename, "rb");
    if (file == NULL) {
        return NULL;
    }

    fseek(file, 0, SEEK_END);
    size_t file_length = ftell(file);
    fseek(file, 0, SEEK_SET);

    if (file_length <= 0) {
        fclose(file);
        return NULL;
    }

    uint8_t* file_data = malloc(file_length);
    size_t file_size = fread(file_data, 1, file_length, file);
    fclose(file);

    if (length) {
        *length = file_size;
    }

    return file_data;
}

// ////////////////////////////////////////////////////////////////////////////
// HTTP parser

int http_parser_on_message_begin(http_parser* parser)
{
    http_connection_t* http_connection = (http_connection_t*)parser->data;
    if (http_connection == NULL) {
        return -1;
    }

    http_connection_reset_request(http_connection);

    http_connection->parser_state = 0;
    http_connection->header_offset = 0;
    http_connection->ready_state = HTTP_SERVER_STATE_OPENED;
    memset(http_connection->header_offsets, 0, sizeof(http_connection->header_offsets));

    return 0;
}

int http_parser_on_headers_complete(http_parser* parser)
{
    http_connection_t* http_connection = (http_connection_t*)parser->data;
    if (http_connection == NULL) {
        return -1;
    }

    http_request_t* request = &http_connection->request;

    dbuffer_t* buffer = &request->header_buffer;
    dbuffer_putc(buffer, 0);

    uint32_t* offsets = http_connection->header_offsets;

    const char* base = buffer->buf;
    for (int i = 0; i < http_connection->header_offset; i += 2) {
        int index = i / 2;
        request->headers[index].name = base + offsets[i];
        request->headers[index].value = base + offsets[i + 1];
        request->header_count++;
    }

    http_connection->parser_state = 4;
    http_connection->ready_state = HTTP_SERVER_STATE_HEADERS_RECEIVED;
    return 0;
}

int http_parser_on_message_complete(http_parser* parser)
{
    http_connection_t* http_connection = (http_connection_t*)parser->data;
    if (http_connection == NULL) {
        return -1;
    }

    http_request_t* request = &http_connection->request;
    http_response_t* response = &http_connection->response;

    request->method = parser->method;
    request->connection_id = http_connection->connection_id;
    response->connection_id = http_connection->connection_id;

    http_server_t* http_server = http_connection->http_server;
    http_server_process_request(http_server, request, response);

    http_connection->parser_state = 6;
    http_connection->ready_state = HTTP_SERVER_STATE_DONE;
    return 0;
}

int http_parser_on_url(http_parser* parser, const char* at, size_t length)
{
    http_connection_t* http_connection = (http_connection_t*)parser->data;
    http_request_t* request = &http_connection->request;

    dbuffer_put(&request->url, at, length);
    request->url.buf[request->url.size] = '\0';

    http_connection->parser_state = 1;
    return 0;
}

int http_parser_on_header_field(http_parser* parser, const char* at, size_t length)
{
    http_connection_t* http_connection = (http_connection_t*)parser->data;

    http_request_t* request = &http_connection->request;
    dbuffer_t* buffer = &request->header_buffer;
    if (http_connection->parser_state != 2) {
        dbuffer_putc(buffer, 0);

        int index = http_connection->header_offset;
        if (index < HTTP_HEADER_MAX * 2) {
            http_connection->header_offset++;
            http_connection->header_offsets[index] = buffer->size;
        }
    }

    dbuffer_put(buffer, at, length);

    http_connection->parser_state = 2;
    return 0;
}

int http_parser_on_header_value(http_parser* parser, const char* at, size_t length)
{
    http_connection_t* http_connection = (http_connection_t*)parser->data;
    http_request_t* request = &http_connection->request;

    dbuffer_t* buffer = &request->header_buffer;
    if (http_connection->parser_state != 3) {
        dbuffer_putc(buffer, 0);

        int index = http_connection->header_offset;
        if (index < HTTP_HEADER_MAX * 2) {
            http_connection->header_offset++;
            http_connection->header_offsets[index] = buffer->size;
        }
    }

    dbuffer_put(buffer, at, length);

    http_connection->parser_state = 3;
    return 0;
}

int http_parser_on_body(http_parser* parser, const char* at, size_t length)
{
    http_connection_t* http_connection = (http_connection_t*)parser->data;

    http_connection->parser_state = 5;
    http_connection->ready_state = HTTP_SERVER_STATE_LOADING;
    return 0;
}

const struct http_parser_settings http_parser_settings_s = {
    http_parser_on_message_begin,
    http_parser_on_url,
    NULL, // http_parser_on_status,
    http_parser_on_header_field,
    http_parser_on_header_value,
    http_parser_on_headers_complete,
    http_parser_on_body,
    http_parser_on_message_complete,
    NULL, /* on_chunk_header */
    NULL, /* on_chunk_complete */
};

// ////////////////////////////////////////////////////////////////////////////
// HTTP connection

typedef struct http_write_req_s {
    uv_write_t req;
    uv_buf_t buf;
} http_write_req_t;

static void http_connection_on_close(uv_handle_t* handle)
{
    assert(handle != NULL);

    http_connection_t* http_connection = (http_connection_t*)handle->data;
    if (http_connection == NULL) {
        return;
    }

    if (http_connection->closed == 0) {
        http_connection->closed = 1;
    }

    http_request_t* request = &http_connection->request;
    dbuffer_free(&request->url);
    dbuffer_free(&request->header_buffer);
    dbuffer_free(&request->body);

    free(http_connection);
}

static int http_connection_close(http_connection_t* self)
{
    assert(self != NULL);
    if (self == NULL) {
        return 0;
    }

    LOGT_W("close: connection=%d", self->connection_id);

    uv_handle_t* connection = (uv_handle_t*)self->connection;
    self->connection = NULL;

    http_response_t* response = &self->response;
    http_response_event_handler handler = response->handler;
    if (handler) {
        response->handler = NULL;
        handler(response, HTTP_RESPONSE_EVENT_CLOSED, 0, response->data);
    }

    http_server_t* http_server = self->http_server;
    http_server_remove_connection(http_server, self);

    if (connection && !uv_is_closing(connection)) {
        uv_close(connection, http_connection_on_close);
    }

    return 0;
}

static void http_connection_free_write_request(uv_write_t* req)
{
    assert(req != NULL);
    http_write_req_t* request = (http_write_req_t*)req;
    free(request->buf.base);
    free(request);
}

static void http_connection_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    assert(buf != NULL);
    buf->base = (char*)malloc(suggested_size);
    buf->len = suggested_size;
}

static void http_connection_on_write(uv_write_t* req, int status)
{
    assert(req != NULL);
    if (status < 0) {
        LOGT_I("write error %s", uv_err_name(status));
    }

    uv_stream_t* connection = req->handle;
    if (connection == NULL) {
        http_connection_free_write_request(req);
        return;
    }

    // fprintf(stderr, "Write %ld\n", queue_size);

    http_connection_t* http_connection = (http_connection_t*)connection->data;
    if (http_connection == NULL) {
        http_connection_free_write_request(req);
        return;
    }

    http_connection_free_write_request(req);

    size_t queue_size = uv_stream_get_write_queue_size(connection);
    if (queue_size <= 0) {
        http_response_t* response = &http_connection->response;
        http_response_event_handler handler = response->handler;
        if (handler) {
            handler(response, HTTP_RESPONSE_EVENT_READY, status, response->data);
        }
    }
}

static void http_connection_on_data(http_connection_t* self, const char* data, ssize_t nread)
{
    assert(self != NULL);

    if (data == NULL || nread <= 0) {
        return;
    }

    // LOG_I("data: %ld: %s", nread, data);
    size_t nparsed = http_parser_execute(&self->parser, &http_parser_settings_s, data, nread);
}

static void http_connection_on_read(uv_stream_t* connection, ssize_t nread, const uv_buf_t* buf)
{
    assert(connection != NULL);
    http_connection_t* http_connection = (http_connection_t*)connection->data;
    if (http_connection == NULL) {
        LOGT_W("http_connection is null");
        free(buf->base);
        return;
    }

    if (nread < 0) {
        if (nread != UV_EOF) {
            LOGT_I("read error %s", uv_err_name(nread));
        }

        http_connection_close(http_connection);
        free(buf->base);
        return;
    }

    if (nread > 0) {
        buf->base[nread] = '\0';
        http_connection_on_data(http_connection, buf->base, nread);
    }

    free(buf->base);
}

static int http_connection_reset_request(http_connection_t* self)
{
    assert(self != NULL);
    http_request_t* request = &self->request;

    dbuffer_free(&request->url);
    dbuffer_free(&request->header_buffer);
    dbuffer_free(&request->body);

    dbuffer_init(&request->url);
    dbuffer_init(&request->header_buffer);
    dbuffer_init(&request->body);

    memset(request->headers, 0, sizeof(request->headers));

    request->header_count = 0;
    request->method = 0;
    request->data = NULL;

    return 0;
}

static void http_connection_init(http_connection_t* self, uv_tcp_t* connection, http_server_t* http_server)
{
    assert(self != NULL);

    memset(self, 0, sizeof(http_connection_t));

    http_parser_init(&self->parser, HTTP_REQUEST);

    self->http_server = http_server;
    self->connection = connection;
    self->parser.data = self;
    self->response.connection = self;
}

static int http_connection_write(http_connection_t* self, const char* data, ssize_t length)
{
    assert(self != NULL);
    if (self == NULL) {
        return -1;

    } else if (data == NULL || length <= 0) {
        return -1;
    }

    uv_stream_t* stream = (uv_stream_t*)self->connection;
    if (stream == NULL || stream->data == NULL) {
        return -1;
    }

    // try write
    uv_buf_t uv_buffer = uv_buf_init((char*)data, length);
    int ret = uv_try_write(stream, &uv_buffer, 1);
    if (ret == length) {
        return 0;
    }

    if (ret >= 0) {
        data += ret;
        length -= ret;
    }

    // enqueue write
    http_write_req_t* req = (http_write_req_t*)malloc(sizeof(http_write_req_t));
    char* buffer = malloc(length + 32);

    memcpy(buffer, data, length);
    ssize_t offset = length;

    req->buf = uv_buf_init(buffer, offset);
    ret = uv_write((uv_write_t*)req, stream, &req->buf, 1, http_connection_on_write);
    if (ret < 0) {
        http_connection_free_write_request((uv_write_t*)req);
        return ret;
    }

    return 1;
}

int http_response_set_status_code(http_response_t* self, int status_code, const char* status_text)
{
    assert(self != NULL);

    if (status_text == NULL) {
        status_text = "";
    }

    if (self->buffer) {
        return -1;
    }

    // 初始化缓存区
    size_t capacity = 512 + strlen(status_text);
    self->buffer = malloc(capacity);
    self->buffer_capacity = capacity;
    self->buffer_size = 0;

    // Start line
    int offset = snprintf(self->buffer, capacity, "HTTP/1.1 %d %s\r\n\r\n", status_code, status_text);
    self->buffer_size = offset;
    return 0;
}

int http_response_set_header(http_response_t* self, const char* name, const char* value)
{
    assert(self != NULL);

    if (name == NULL || value == NULL) {
        return -1;

    } else if (self->buffer == NULL) {
        return -1;
    }

    size_t capacity = self->buffer_size;
    capacity += strlen(name);
    capacity += strlen(value);
    capacity += 8;

    if (capacity < self->buffer_capacity) {
        capacity += 512;
        self->buffer = realloc(self->buffer, capacity);
        self->buffer_capacity = capacity;
    }

    int offset = self->buffer_size - 2; // \r\n
    int ret = snprintf(self->buffer + offset, capacity - offset, "%s: %s\r\n\r\n", name, value);
    self->buffer_size = offset + ret;
    return 0;
}

int http_response_close(http_response_t* self)
{
    if (self == NULL) {
        return 0;
    }

    // LOGT_I("close (response=%d, connection=%p) ", self->connection_id, self->connection);
    if (self->connection == NULL) {
        return 0;
    }

    return http_connection_close(self->connection);
}

int http_response_get_id(http_response_t* self, uint32_t* connection_id)
{
    assert(self != NULL);
    if (self == NULL) {
        return 0;
    }

    if (connection_id) {
        *connection_id = self->connection_id;
        return 0;
    }

    return 0;
}

int http_response_set_header_int(http_response_t* self, const char* name, int value)
{
    assert(self != NULL);
    if (name == NULL) {
        return -1;
    }

    char buffer[16];
    snprintf(buffer, sizeof(buffer), "%d", value);
    return http_response_set_header(self, name, buffer);
}

int http_response_set_content_type(http_response_t* self, const char* value)
{
    assert(self != NULL);
    return http_response_set_header(self, "Content-Type", value);
}

int http_response_set_content_length(http_response_t* self, size_t content_length)
{
    assert(self != NULL);
    char buffer[16];
    snprintf(buffer, sizeof(buffer), "%ld", content_length);
    return http_response_set_header(self, "Content-Length", buffer);
}

int http_response_set_event_handler(http_response_t* self, http_response_event_handler handler, void* param)
{
    assert(self != NULL);
    self->handler = handler;
    self->data = param;
    return 0;
}

int http_response_reset(http_response_t* self)
{
    assert(self != NULL);
    return 0;
}

int http_response_send(http_response_t* self, const uint8_t* data, ssize_t length)
{
    assert(self != NULL);
    http_connection_t* http_connection = self->connection;

    // send headers
    char* buffer = self->buffer;
    if (buffer) {
        if (data && length > 0) {
            http_response_set_content_length(self, length);
        }

        http_response_set_header(self, "Server", "WoT.js/1.0");

        char* data = self->buffer;
        uint32_t size = self->buffer_size;

        self->buffer = NULL;
        self->buffer_capacity = 0;
        self->buffer_size = 0;

        // message header
        int ret = http_connection_write(http_connection, data, size);
        free(data);

        if (ret < 0) {
            return ret;
        }
    }

    // message body
    if (data && length > 0) {
        return http_connection_write(http_connection, data, length);
    }

    return 0;
}

const char* http_response_get_mime_type(http_response_t* self, const char* filename)
{
    if (filename == NULL) {
        return "text/html";
    }

    const char* extname = strrchr(filename, '.');
    if (extname == NULL) {
        return "text/html";

    } else if (strcmp(extname, ".js") == 0) {
        return "text/javascript";

    } else if (strcmp(extname, ".json") == 0) {
        return "application/json";

    } else if (strcmp(extname, ".css") == 0) {
        return "text/css";

    } else if (strcmp(extname, ".jpg") == 0) {
        return "image/jpg";

    } else if (strcmp(extname, ".png") == 0) {
        return "image/png";

    } else if (strcmp(extname, ".gif") == 0) {
        return "image/gif";
    }

    return "text/html";
}

int http_response_send_file(http_response_t* self, const char* filename)
{
    assert(self != NULL);
    if (filename == NULL) {
        return -1;
    }

    if (self == NULL) {
        return -1;
    }

    http_connection_t* http_connection = self->connection;
    http_server_t* http_server = http_connection->http_server;
    // LOGT_I("root=%s, filename=%s", self->root_path, filename);

    // bad request
    if (http_server->root_path[0] == 0) {
        const char* data = "400 Bad request";

        http_response_set_status_code(self, 400, "Bad request");
        http_response_set_content_type(self, "text/html");
        return http_response_send(self, data, strlen(data));
    }

    // filename
    char fullname[PATH_MAX] = { 0 };
    path_concat(filename, http_server->root_path, fullname);
    LOGT_I("Send file: fullname=%s", fullname);

    // not found
    size_t length = 0;
    uint8_t* file_data = http_server_read_file(fullname, &length);
    if (file_data == NULL) {
        snprintf(fullname, PATH_MAX, "<h1>Not Found</h1><p>The request URL '%s' was not found on this server</p>", filename);
        uint8_t* data = fullname;

        http_response_set_status_code(self, 404, "Not found");
        http_response_set_content_type(self, "text/html");
        return http_response_send(self, data, strlen(data));
    }

    // send file
    http_response_set_status_code(self, 200, "OK");
    http_response_set_content_type(self, http_response_get_mime_type(self, filename));
    int ret = http_response_send(self, file_data, length);
    free(file_data);

    return ret;
}

int http_response_push(http_response_t* self, int status)
{
    assert(self != NULL);
    if (self == NULL) {
        return -1;
    }

    http_response_event_handler handler = self->handler;
    if (handler == NULL) {
        return -1;
    }

    http_connection_t* http_connection = self->connection;
    uv_tcp_t* stream = http_connection->connection;
    size_t queue_size = uv_stream_get_write_queue_size((uv_stream_t*)stream);
    if (queue_size <= 0) {
        handler(self, HTTP_RESPONSE_EVENT_READY, 0, self->data);
    }

    return 0;
}

int http_response_free(http_response_t* response)
{
    return 0;
}

// ////////////////////////////////////////////////////////////////////////////
// HTTP server connection

static int http_server_process_request(http_server_t* self, http_request_t* request, http_response_t* response)
{
    assert(self != NULL);
    if (self == NULL) {
        return -1;
    }

    const http_server_event_handler handler = self->method_handler;
    if (handler) {
        handler(self, request, response);
    }

    return 0;
}

http_connection_t* http_server_get_connection(http_server_t* self, uint32_t connection_id)
{
    assert(self != NULL);
    if (self == NULL) {
        return NULL;

    } else if (connection_id == 0) {
        return NULL;
    }

    int i = 0;
    for (i = 0; i < HTTP_CLIENT_MAX; i++) {
        http_connection_t* connection = self->connections[i];
        if (connection && connection->connection_id == connection_id) {
            return connection;
        }
    }

    return NULL;
}

http_response_t* http_server_get_response(http_server_t* self, uint32_t connection_id)
{
    assert(self != NULL);
    if (self == NULL) {
        return NULL;

    } else if (connection_id == 0) {
        return NULL;
    }

    http_connection_t* connection = http_server_get_connection(self, connection_id);
    if (connection) {
        return &connection->response;
    }

    return NULL;
}

static int http_server_add_connection(http_server_t* self, http_connection_t* connection)
{
    assert(self != NULL);
    if (self == NULL) {
        return -1;
    }

    connection->connection_id = self->next_connection_id;
    self->next_connection_id++;

    int i = 0;
    for (i = 0; i < HTTP_CLIENT_MAX; i++) {
        if (self->connections[i] == NULL) {
            self->connections[i] = connection;
            LOGT_I("Add: connection=%d", i);
            return 0;
        }
    }

    return -1;
}

static int http_server_remove_connection(http_server_t* self, http_connection_t* connection)
{
    assert(self != NULL);
    if (self == NULL) {
        return -1;
    }

    int i = 0;
    for (i = 0; i < HTTP_CLIENT_MAX; i++) {
        if (self->connections[i] == connection) {
            self->connections[i] = NULL;
            LOGT_I("Remove: connection=%d", i);
            return 0;
        }
    }

    return -1;
}

static void http_server_on_connection(uv_stream_t* server_socket, int status)
{
    assert(server_socket != NULL);
    if (status == -1) {
        // error!
        return;
    }

    http_server_t* http_server = (http_server_t*)server_socket->data;
    if (http_server == NULL) {
        return;
    }

    // connection socket
    uv_tcp_t* connection = (uv_tcp_t*)malloc(sizeof(uv_tcp_t));
    uv_tcp_init(http_server->loop, connection);
    if (uv_accept(server_socket, (uv_stream_t*)connection) != 0) {
        uv_close((uv_handle_t*)connection, NULL);
        return;
    }

    // LOGT_I("connection: %lx", (uint64_t)connection);

    // socket data
    http_connection_t* http_connection = malloc(sizeof(http_connection_t));
    http_connection_init(http_connection, connection, http_server);
    connection->data = http_connection;

    int ret = http_server_add_connection(http_server, http_connection);
    if (ret < 0) {
        http_connection_close(http_connection);
        return;
    }

    uv_read_start((uv_stream_t*)connection, http_connection_alloc_buffer, http_connection_on_read);
}

// ////////////////////////////////////////////////////////////////////////////
// server

http_server_t* http_server_init(uv_loop_t* loop)
{
    assert(loop != NULL);
    http_server_t* http_server = malloc(sizeof(http_server_t));
    memset(http_server, 0, sizeof(http_server_t));

    http_server->loop = loop;
    http_server->next_connection_id = 1;

    int i = 0;
    for (i = 0; i < HTTP_CLIENT_MAX; i++) {
        http_server->connections[i] = NULL;
    }

    return http_server;
}

int http_server_start(http_server_t* self, int port, http_server_event_handler handler)
{
    assert(self != NULL);
    if (self == NULL) {
        return -1;
    }

    if (self->server_socket != NULL) {
        return -2;
    }

    self->method_handler = handler;

    self->port = port;
    strcpy(self->address, "0.0.0.0");

    self->server_socket = malloc(sizeof(uv_tcp_t));
    uv_tcp_t* server_socket = self->server_socket;
    server_socket->data = self;

    uv_tcp_init(self->loop, server_socket);

    int ret;
    struct sockaddr_in bind_addr;
    uv_ip4_addr(self->address, self->port, &bind_addr);
    ret = uv_tcp_bind(server_socket, (const struct sockaddr*)&bind_addr, 0);
    if (ret) {
        LOGT_W("Bind error %s at %d", uv_err_name(ret), self->port);
        return -1;
    }

    ret = uv_listen((uv_stream_t*)server_socket, 128, http_server_on_connection);
    if (ret) {
        LOGT_W("Listen error %s", uv_err_name(ret));
        return -2;
    }

    LOGT_I("Starting at %d", self->port);
    return 0;
}

int http_server_set_root_path(http_server_t* self, const char* root_path)
{
    assert(self != NULL);
    if (root_path == NULL) {
        return -1;
    }

    path_realpath(root_path, self->root_path);

    LOGT_I("root=%s", self->root_path);
    return 0;
}

int http_server_stop(http_server_t* self)
{
    if (self == NULL) {
        return -1;
    }

    uv_tcp_t* server_socket = self->server_socket;
    if (!server_socket) {
        return 0;
    }

    self->server_socket = NULL;

    int i = 0;
    for (i = 0; i < HTTP_CLIENT_MAX; i++) {
        http_connection_t* http_connection = self->connections[i];
        self->connections[i] = NULL;
        if (http_connection) {
            http_connection_close(http_connection);
        }
    }

    uv_close((uv_handle_t*)server_socket, NULL);
    return 0;
}
