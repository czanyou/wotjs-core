#include "tls-transport.h"
#include "tls/uv-tls.h"
#include "util/log.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

static void tls_transport_on_error(tls_transport_t* transport, const char* method, int status)
{
    assert(transport != NULL);
    tls_transport_on_event on_event = transport->on_event;
    if (on_event) {
        on_event(transport->data, TLS_TRANSPORT_EVENT_ERROR, status, (void*)method);
    }
}

static void tls_transport_on_write(void* param, int status)
{
    tls_transport_t* transport = (tls_transport_t*)param;
    int is_ready = tls_transport_is_ready(transport);
    if (is_ready) {
        tls_transport_on_event on_event = transport->on_event;
        if (on_event) {
            on_event(transport->data, TLS_TRANSPORT_EVENT_READY, 0, NULL);
        }
    }
}

int tls_transport_write(tls_transport_t* transport, const uint8_t* data, size_t len)
{
    assert(transport != NULL);

    if (data == NULL || len <= 0) {
        return -1;
    }

    uv_tls_t* socket = transport->socket;
    assert(socket != NULL);

    return uv_tls_write(socket, data, len, tls_transport_on_write);
}

static void tls_transport_alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf)
{
    assert(handle != NULL);
    assert(buf != NULL);
    assert(suggested_size > 0);

    buf->base = malloc(suggested_size);
    buf->len = suggested_size;
}

static void tls_transport_read_callback(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf)
{
    assert(handle != NULL);
    assert(buf != NULL);

    if (nread == 0) {
        return;
    }

    tls_transport_t* transport = (tls_transport_t*)handle->data;
    assert(transport != NULL);

    tls_transport_on_input on_input = transport->on_input;
    if (on_input) {
        on_input(transport->data, buf->base, nread);
    }

    free(buf->base);
}

static void tls_transport_on_read(uv_stream_t* socket, ssize_t nread, const uv_buf_t* buf)
{
    assert(socket != NULL);

    tls_transport_t* transport = (tls_transport_t*)socket->data;
    assert(transport != NULL);

    if (nread > 0) {
        buf->base[nread] = '\0';

        uv_tls_t* socket = transport->socket;
        uv_tls_push(socket, buf->base, nread);

        // handshake
        if (socket->ready_state != 2) { // STATE_IO = 2
            // recheck if handshake is complete now
            free(buf->base);
            return;
        }

        transport->ready_state = TLS_TRANSPORT_STATE_OPEN;
        tls_transport_on_event on_event = transport->on_event;
        if (on_event) {
            on_event(transport->data, TLS_TRANSPORT_EVENT_CONNECTED, 0, NULL);
            transport->on_event = NULL;
        }

        uv_tls_read(socket, tls_transport_alloc_buffer, tls_transport_read_callback);

    } else if (nread < 0) {
        if (nread != UV_EOF) {
            tls_transport_on_error(transport, "read", nread);
        }
    }

    // LOG_I("tls-transport: on_read: %ld\n", nread);
    free(buf->base);
}

static void tls_transport_on_connect(uv_connect_t* request, int status)
{
    assert(request != NULL);

    tls_transport_t* transport = (tls_transport_t*)request->data;
    assert(transport != NULL);
    assert(transport->socket != NULL);

    free(request);

    // LOG_I("transport: connected: %d", status);

    if (status < 0) {
        tls_transport_on_error(transport, "connect", status);
        return;
    }

    uv_read_start((uv_stream_t*)request->handle, tls_transport_alloc_buffer, tls_transport_on_read);

    uv_tls_handshake(transport->socket);
}

static void tls_transport_on_resolved(uv_getaddrinfo_t* resolver, int status, struct addrinfo* address_info)
{
    assert(resolver != NULL);
    uv_tls_t* socket = NULL;

    tls_transport_t* transport = (tls_transport_t*)resolver->data;
    assert(transport != NULL);
    assert(transport->hostname != NULL);

    if (transport == NULL) {
        goto exit;
    }

    uv_loop_t* loop = transport->loop;
    if (loop == NULL) {
        goto exit;
    }

    if (status < 0) {
        tls_transport_on_error(transport, "lookup", status);
        goto exit;
    }

    char address[17] = { '\0' };
    struct sockaddr_in* socket_address = (struct sockaddr_in*)address_info->ai_addr;
    uv_ip4_name(socket_address, address, 16);

    // LOG_I("transport: %s:%d", address, ntohs(socket_address->sin_port));

    // socket
    socket = malloc(sizeof(uv_tls_t));
    assert(socket != NULL);

    int ret = uv_tcp_init(loop, (uv_tcp_t*)socket);
    if (ret) {
        tls_transport_on_error(transport, "init", ret);
        goto exit;
    }

    ret = uv_tls_init(socket);
    if (ret) {
        tls_transport_on_error(transport, "tls-init", ret);
        goto exit;
    }

    ret = uv_tls_setup_client(socket, transport->hostname);
    if (ret) {
        tls_transport_on_error(transport, "tls-setup", ret);
        uv_tls_destroy(socket);
        goto exit;
    }

    socket->data = transport;
    socket->socket.data = transport;
    transport->socket = socket;

    // connect
    uv_connect_t* connect_request = malloc(sizeof(uv_connect_t));
    connect_request->data = transport;
    ret = uv_tcp_connect(connect_request, (uv_tcp_t*)socket, (const struct sockaddr*)address_info->ai_addr, tls_transport_on_connect);
    if (ret) {
        tls_transport_on_error(transport, "connect", ret);
    }

    socket = NULL;

exit:
    uv_freeaddrinfo(address_info);
    free(resolver);

    if (socket) {
        free(socket);
    }
}

int tls_transport_init(tls_transport_t* transport, uv_loop_t* loop, void* param)
{
    assert(transport != NULL);
    memset(transport, 0, sizeof(tls_transport_t));

    transport->loop = loop;
    transport->data = param;
    return 0;
    return 0;
}

int tls_transport_connect(tls_transport_t* transport, const char* host, int port)
{
    assert(transport != NULL);
    if (host == NULL || port <= 0 || port > 65535) {
        return -1;
    }

    uv_loop_t* loop = transport->loop;
    if (loop == NULL) {
        return -1;
    }

    // LOG_I("transport: %s:%d is...", host, port);
    transport->hostname = strdup(host);
    transport->port = port;

    struct addrinfo hints;
    hints.ai_family = PF_INET;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;
    hints.ai_flags = 0;

    uv_getaddrinfo_t* resolver = malloc(sizeof(uv_getaddrinfo_t));
    resolver->data = transport;

    char ports[16] = { 0 };
    snprintf(ports, sizeof(ports), "%d", port);

    int ret = uv_getaddrinfo(loop, resolver, tls_transport_on_resolved, host, ports, &hints);
    if (ret) {
        tls_transport_on_error(transport, "lookup", ret);
        return ret;
    }

    return 0;
}

int tls_transport_is_ready(tls_transport_t* transport)
{
    assert(transport != NULL);
    uv_stream_t* socket = (uv_stream_t*)transport->socket;
    if (socket == NULL) {
        return 0;
    }

    size_t queue_size = uv_stream_get_write_queue_size(socket);
    return queue_size <= 0 ? 1 : 0;
}

static void tls_transport_on_close(uv_handle_t* handle)
{
    uv_tls_t* socket = (uv_tls_t*)handle;
    if (socket) {
        free(socket);
    }
}

int tls_transport_destroy(tls_transport_t* transport)
{
    if (transport == NULL) {
        return -1;
    }

    // socket
    uv_tls_t* socket = transport->socket;
    if (socket) {
        transport->ready_state = TLS_TRANSPORT_STATE_CLOSING;
        transport->socket = NULL;

        uv_tls_destroy(socket);

        if (!uv_is_closing((uv_handle_t*)socket)) {
            uv_close((uv_handle_t*)socket, tls_transport_on_close);

        } else {
            free(socket);
        }
    }

    transport->ready_state = TLS_TRANSPORT_STATE_CLOSED;
    transport->on_event = NULL;
    transport->on_input = NULL;
    transport->loop = NULL;
    transport->data = NULL;

    return 0;
}
