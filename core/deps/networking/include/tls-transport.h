#ifndef _tls_transport_h_
#define _tls_transport_h_

#include "tls/uv-tls.h"

#include <uv.h>

typedef struct tls_transport_s tls_transport_t;

enum tls_transport_event_t {
    TLS_TRANSPORT_EVENT_UNKNOWN = 0,
    TLS_TRANSPORT_EVENT_LOOKUP,
    TLS_TRANSPORT_EVENT_CONNECTED,
    TLS_TRANSPORT_EVENT_READY,
    TLS_TRANSPORT_EVENT_ERROR,
};

enum tls_transport_state_t {
    TLS_TRANSPORT_STATE_CONNECTING = 0,
    TLS_TRANSPORT_STATE_OPEN,
    TLS_TRANSPORT_STATE_CLOSING,
    TLS_TRANSPORT_STATE_CLOSED
};

typedef void (*tls_transport_on_event)(void* param, int event, int status, void* data);
typedef void (*tls_transport_on_input)(void* transport, const char* data, ssize_t nread);

struct tls_transport_s {
    uv_tls_t* socket;
    uv_loop_t* loop;
    tls_transport_on_event on_event;
    tls_transport_on_input on_input;
    void* data;
    char* hostname;
    uint32_t port;
    uint32_t ready_state;
};

int tls_transport_init(tls_transport_t* transport, uv_loop_t* loop, void* param);

int tls_transport_connect(tls_transport_t* transport, const char* host, int port);

int tls_transport_destroy(tls_transport_t* transport);

int tls_transport_is_ready(tls_transport_t* transport);

int tls_transport_write(tls_transport_t* transport, const uint8_t* data, size_t len);

#endif
