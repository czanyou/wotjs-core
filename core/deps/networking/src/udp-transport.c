#include "udp-transport.h"
#include "util/log.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

#define TAG "udp-transport"

typedef struct sockaddr socket_address_t;

static void uv_udp_transport_on_error(uv_udp_transport_t* transport, const char* method, int status)
{
    assert(transport != NULL);
    udp_transport_on_event on_event = transport->on_event;
    if (on_event) {
        on_event(transport->data, UDP_TRANSPORT_EVENT_ERROR, status, (void*)method);
    }
}

static void uv_udp_transport_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    buf->base = malloc(suggested_size);
    buf->len = suggested_size;
}

static void uv_udp_transport_on_read(uv_udp_t* socket, ssize_t nread, const uv_buf_t* buf, const socket_address_t* remote, unsigned flags)
{
    uv_udp_transport_t* transport = (uv_udp_transport_t*)socket->data;

    if (nread > 0) {
        buf->base[nread] = '\0';

        udp_transport_on_input on_input = transport->on_input;
        if (on_input) {
            on_input(transport->data, buf->base, nread);
        }

    } else if (nread < 0) {
        if (nread != UV_EOF) {
            uv_udp_transport_on_error(transport, "read", nread);
        }

        // uv_udp_transport_destroy(transport);
    }

    // fprintf(stderr, "uv_udp_transport_on_read: %ld\n", nread);
    free(buf->base);
}

int uv_udp_transport_init(uv_udp_transport_t* transport, uv_loop_t* loop, void* param)
{
    assert(transport != NULL);
    memset(transport, 0, sizeof(uv_udp_transport_t));

    transport->loop = loop;
    transport->data = param;
    return 0;
}

int uv_udp_transport_bind(uv_udp_transport_t* transport, const char* host, int port)
{
    assert(transport != NULL);

    if (host == NULL) {
        host = "0.0.0.0";
    }

    struct sockaddr_in bind_address;
    int ret = uv_ip4_addr(host, port, &bind_address);
    if (ret) {
        return ret;
    }

    transport->socket = malloc(sizeof(uv_udp_t));
    uv_udp_t* socket = transport->socket;
    socket->data = transport;

    uv_udp_init(transport->loop, socket);

    ret = uv_udp_bind(socket, (const struct sockaddr*)&bind_address, UV_UDP_REUSEADDR);
    if (ret) {
        LOG_W("udp-transport: bind error %s at %d", uv_err_name(ret), port);
        return -1;
    }

    ret = uv_udp_recv_start(socket, uv_udp_transport_alloc_buffer, uv_udp_transport_on_read);
    if (ret) {
        LOG_W("udp-transport: recv error %s", uv_err_name(ret));
        return -2;
    }

    return 0;
}

void uv_udp_transport_close_cb(uv_handle_t* handle)
{
    uv_udp_t* socket = (uv_udp_t*)handle->data;
    if (socket) {
        free(socket);
    }
}

int uv_udp_transport_destroy(uv_udp_transport_t* transport)
{
    assert(transport != NULL);

    // socket
    uv_udp_t* socket = transport->socket;
    transport->socket = NULL;
    if (socket) {
        if (!uv_is_closing((uv_handle_t*)socket)) {
            uv_close((uv_handle_t*)socket, uv_udp_transport_close_cb);
        }
    }

    transport->closed = 1;
    transport->loop = NULL;
    return 0;
}

typedef struct udp_transport_send_s {
    uv_udp_send_t req;
    size_t size;
    char data[];
} udp_transport_send_t;

static void uv_udp_transport_free_send_request(uv_udp_send_t* req)
{
    assert(req != NULL);

    udp_transport_send_t* request = req->data;
    if (request) {
        free(request);
    }
}

static void uv_udp_transport_on_send(uv_udp_send_t* req, int status)
{
    if (status < 0) {
        fprintf(stderr, "Write error %s\n", uv_err_name(status));
    }

    uv_udp_transport_free_send_request(req);
}

int uv_udp_transport_send(uv_udp_transport_t* transport, const char* address, int port, const uint8_t* data, size_t size)
{
    assert(transport != NULL);

    uv_udp_t* socket = transport->socket;
    if (socket == NULL) {
        return -1;

    } else if (address == NULL || port <= 0 || port > 65535) {
        return -1;

    } else if (data == NULL || size <= 0) {
        return -1;
    }

    struct sockaddr_in remote_address;
    int ret = uv_ip4_addr(address, port, &remote_address);
    if (ret) {
        return ret;
    }

    udp_transport_send_t* request = malloc(size + sizeof(udp_transport_send_t));
    memset(request, 0, sizeof(*request));
    memcpy(request->data, data, size);
    request->req.data = request;

    // send
    uv_buf_t buffer = uv_buf_init(request->data, size);
    ret = uv_udp_send(&request->req, socket, &buffer, 1, (socket_address_t*)&remote_address, uv_udp_transport_on_send);
    if (ret < 0) {
        uv_udp_transport_free_send_request(&request->req);
    }

    return 0;
}
