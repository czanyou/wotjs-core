#include "net-transport.h"
#include "tcp-transport.h"
#include "tls-transport.h"
#include "util/log.h"

#include <stdlib.h>

#define TLS_TRANSPORT 1

struct net_transport_s {
    int type;
    tls_transport_t tls_transport;
    tcp_transport_t tcp_transport;
};

net_transport_t* net_transport_create(int type)
{
    net_transport_t* transport = malloc(sizeof(struct net_transport_s));
    transport->type = type;
    return transport;
}

int net_transport_init(net_transport_t* transport, uv_loop_t* loop, void* param, net_transport_on_event event, net_transport_on_input input)
{
    if (transport == NULL) {
        return 0;
    }

    int ret = 0;
    if (transport->type == TLS_TRANSPORT) {
        ret = tls_transport_init(&transport->tls_transport, loop, param);
        transport->tls_transport.loop = loop;
        transport->tls_transport.data = param;
        transport->tls_transport.on_input = input;
        transport->tls_transport.on_event = event;

    } else {
        ret = tcp_transport_init(&transport->tcp_transport, loop, param);
        transport->tcp_transport.loop = loop;
        transport->tcp_transport.data = param;
        transport->tcp_transport.on_input = input;
        transport->tcp_transport.on_event = event;
    }

    return ret;
}

int net_transport_connect(net_transport_t* transport, const char* host, int port)
{
    if (transport == NULL) {
        return 0;
    }

    if (transport->type == TLS_TRANSPORT) {
        return tls_transport_connect(&transport->tls_transport, host, port);

    } else {
        return tcp_transport_connect(&transport->tcp_transport, host, port);
    }

    return 0;
}

int net_transport_destroy(net_transport_t* transport)
{
    if (transport == NULL) {
        return 0;
    }

    if (transport->type == TLS_TRANSPORT) {
        return tls_transport_destroy(&transport->tls_transport);

    } else {
        return tcp_transport_destroy(&transport->tcp_transport);
    }

    return 0;
}

int net_transport_is_ready(net_transport_t* transport)
{
    if (transport == NULL) {
        return 0;
    }

    if (transport->type == TLS_TRANSPORT) {
        return tls_transport_is_ready(&transport->tls_transport);

    } else {
        return tcp_transport_is_ready(&transport->tcp_transport);
    }

    return 0;
}

int net_transport_write(net_transport_t* transport, const uint8_t* data, size_t len)
{
    if (transport == NULL) {
        return 0;
    }

    if (transport->type == TLS_TRANSPORT) {
        return tls_transport_write(&transport->tls_transport, data, len);

    } else {
        return tcp_transport_write(&transport->tcp_transport, data, len);
    }

    return 0;
}