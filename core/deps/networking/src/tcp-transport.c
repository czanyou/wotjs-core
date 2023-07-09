#include "tcp-transport.h"
#include "util/log.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

#define TAG "tcp-transport"

typedef struct tcp_transport_write_req_s {
    uv_write_t req;
    uv_buf_t buf;
} tcp_transport_write_req_t;

/**
 * @brief 表示这个传输对象发生了严重错误，连接已关闭
 * - 客户端需要释放相关的资源
 * @param transport 
 * @param method 
 * @param status 
 */
static void tcp_transport_on_error(tcp_transport_t* self, const char* method, int status)
{
    assert(self != NULL);
    tcp_transport_on_event on_event = self->on_event;
    if (on_event) {
        on_event(self->data, TCP_TRANSPORT_EVENT_ERROR, status, (void*)method);
    }

    self->ready_state = TCP_TRANSPORT_STATE_CLOSED;
}

int tcp_transport_is_ready(tcp_transport_t* self)
{
    assert(self != NULL);
    uv_tcp_t* socket = self->socket;
    if (socket == NULL) {
        return 0;
    }

    size_t queue_size = uv_stream_get_write_queue_size((uv_stream_t*)socket);
    return queue_size <= 0 ? 1 : 0;
}

static void tcp_transport_free_write_request(uv_write_t* req)
{
    tcp_transport_write_req_t* request = (tcp_transport_write_req_t*)req;
    free(request->buf.base);
    free(request);
}

static void tcp_transport_on_write(uv_write_t* req, int status)
{
    assert(req != NULL);
    tcp_transport_t* self = (tcp_transport_t*)req->data;
    assert(self != NULL);

    tcp_transport_free_write_request(req);

    int is_ready = tcp_transport_is_ready(self);
    if (is_ready) {
        tcp_transport_on_event on_event = self->on_event;
        if (on_event) {
            on_event(self->data, TCP_TRANSPORT_EVENT_READY, 0, NULL);
        }
    }
}

int tcp_transport_write(tcp_transport_t* self, const uint8_t* data, size_t length)
{
    assert(self != NULL);
    if (data == NULL || length <= 0) {
        return UV_EINVAL;
    }

    uv_stream_t* socket = (uv_stream_t*)self->socket;
    if (socket == NULL) {
        return UV_EINVAL;
    }

    // try write
    uv_buf_t uv_buffer = uv_buf_init((char*)data, length);
    int ret = uv_try_write(socket, &uv_buffer, 1);
    if (ret == length) {
        return 0;
    }

    if (ret >= 0) {
        data += ret;
        length -= ret;
    }

    // enqueue write
    tcp_transport_write_req_t* request = malloc(sizeof(tcp_transport_write_req_t));
    memset(request, 0, sizeof(tcp_transport_write_req_t));
    request->req.data = self;
    request->buf = uv_buf_init(malloc(length), length);
    memcpy(request->buf.base, data, length);

    ret = uv_write((uv_write_t*)request, socket, &request->buf, 1, tcp_transport_on_write);
    if (ret != 0) {
        tcp_transport_free_write_request((uv_write_t*)request);
        return ret;
    }

    return 1;
}

static void tcp_transport_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    buf->base = malloc(suggested_size);
    buf->len = suggested_size;
}

static void tcp_transport_on_read(uv_stream_t* socket, ssize_t nread, const uv_buf_t* buf)
{
    assert(socket != NULL);
    tcp_transport_t* self = (tcp_transport_t*)socket->data;
    assert(self != NULL);

    if (nread < 0) {
        tcp_transport_on_error(self, "read", nread);
    }

    tcp_transport_on_input on_input = self->on_input;
    if (on_input) {
        on_input(self->data, buf->base, nread);
    }

    // fprintf(stderr, "tcp_transport_on_read: %ld\n", nread);
    free(buf->base);
}

static void tcp_transport_on_connect(uv_connect_t* request, int status)
{
    assert(request != NULL);
    tcp_transport_t* self = (tcp_transport_t*)request->data;
    assert(self != NULL);

    free(request);

    // LOG_I("self: connected: %d", status);
    if (status < 0) {
        tcp_transport_on_error(self, "connect", status);
        return;
    }

    tcp_transport_on_event on_event = self->on_event;
    if (on_event) {
        on_event(self->data, TCP_TRANSPORT_EVENT_CONNECTED, 0, NULL);
    }

    uv_stream_t* socket = (uv_stream_t*)self->socket;
    assert(socket != NULL);

    uv_read_start(socket, tcp_transport_alloc_buffer, tcp_transport_on_read);
    self->ready_state = TCP_TRANSPORT_STATE_OPEN;
}

static void tcp_transport_on_resolved(uv_getaddrinfo_t* resolver, int status, struct addrinfo* address_info)
{
    uv_tcp_t* socket = NULL;

    assert(resolver != NULL);
    tcp_transport_t* transport = (tcp_transport_t*)resolver->data;
    assert(transport != NULL);
    if (transport == NULL) {
        LOG_W("transport: transport is NULL");
        goto exit;
    }

    uv_loop_t* loop = transport->loop;
    if (loop == NULL) {
        LOG_W("transport: loop is NULL");
        goto exit;
    }

    if (status < 0) {
        tcp_transport_on_error(transport, "lookup", status);
        goto exit;
    }

    char address[17] = { '\0' };
    struct sockaddr_in* socket_address = (struct sockaddr_in*)address_info->ai_addr;
    uv_ip4_name(socket_address, address, 16);
    // LOG_I("transport: %s:%d", address, ntohs(socket_address->sin_port));

    // socket
    socket = malloc(sizeof(uv_tcp_t));

    int ret = uv_tcp_init(loop, socket);
    if (ret) {
        tcp_transport_on_error(transport, "init", ret);
        goto exit;
    }

    socket->data = transport;
    transport->socket = socket;

    // connect
    uv_connect_t* connect_request = malloc(sizeof(uv_connect_t));
    connect_request->data = transport;
    ret = uv_tcp_connect(connect_request, socket, (const struct sockaddr*)address_info->ai_addr, tcp_transport_on_connect);
    if (ret) {
        tcp_transport_on_error(transport, "connect", ret);
    }

    socket = NULL;

exit:
    // free
    uv_freeaddrinfo(address_info);
    free(resolver);

    if (socket) {
        free(socket);
    }
}

int tcp_transport_init(tcp_transport_t* self, uv_loop_t* loop, void* param)
{
    assert(self != NULL);
    memset(self, 0, sizeof(tcp_transport_t));

    self->loop = loop;
    self->data = param;
    return 0;
}

int tcp_transport_connect(tcp_transport_t* self, const char* host, int port)
{
    assert(self != NULL);
    assert(host != NULL);
    if (host == NULL) {
        return -1;
    }

    uv_loop_t* loop = self->loop;
    if (loop == NULL) {
        return -1;
    }

    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    
    hints.ai_family = PF_INET;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;
    hints.ai_flags = 0;

    uv_getaddrinfo_t* resolver = malloc(sizeof(uv_getaddrinfo_t));
    resolver->data = self;

    // LOG_I("self: lookup=%s:%d", host, port);

    char ports[16] = { 0 };
    snprintf(ports, sizeof(ports), "%d", port);

    int ret = uv_getaddrinfo(loop, resolver, tcp_transport_on_resolved, host, ports, &hints);
    if (ret) {
        tcp_transport_on_error(self, "lookup", ret);
        return ret;
    }

    return 0;
}

void tcp_transport_on_close(uv_handle_t* handle)
{
    uv_tcp_t* socket = (uv_tcp_t*)handle;
    if (socket) {
        free(socket);
    }
}

int tcp_transport_destroy(tcp_transport_t* self)
{
    assert(self != NULL);
    // LOGT_I("destroy");

    // socket
    uv_tcp_t* socket = self->socket;
    self->socket = NULL;
    if (socket) {
        self->ready_state = TCP_TRANSPORT_STATE_CLOSING;
        if (!uv_is_closing((uv_handle_t*)socket)) {
            uv_close((uv_handle_t*)socket, tcp_transport_on_close);

        } else {
            free(socket);
        }
    }

    if (self->ready_state != TCP_TRANSPORT_STATE_CLOSED) {
        self->ready_state = TCP_TRANSPORT_STATE_CLOSED;

        LOGT_I("destroy");
    }

    self->on_event = NULL;
    self->on_input = NULL;
    self->loop = NULL;
    self->data = NULL;

    return 0;
}