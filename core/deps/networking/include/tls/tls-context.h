#ifndef _TLS_CONTEXT_H__
#define _TLS_CONTEXT_H__

#include <assert.h>
#include <string.h>

#if !defined(MBEDTLS_CONFIG_FILE)
#include "mbedtls/config.h"
#else
#include MBEDTLS_CONFIG_FILE
#endif

#if defined(MBEDTLS_PLATFORM_C)
#include "mbedtls/platform.h"
#else
#include <stdio.h>
#include <stdlib.h>
#endif

#include "mbedtls/ctr_drbg.h"
#include "mbedtls/debug.h"
#include "mbedtls/entropy.h"
#include "mbedtls/error.h"

#include "mbedtls/net_sockets.h"
#include "mbedtls/ssl.h"

enum uv_tls_state {
    STATE_INIT = 0x0,
    STATE_HANDSHAKING = 0x1,
    STATE_IO = 0x2, // read or write mode
    STATE_CLOSING = 0x4 // This means closed state also
};

typedef struct tls_context_s {
    mbedtls_entropy_context entropy;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_ssl_context ssl;
    mbedtls_ssl_config conf;
    mbedtls_x509_crt cacert;
} tls_context_t;

int tls_print_error(int errcode, char* buffer, size_t buffer_size);

int tls_client_init(tls_context_t* context);
int tls_client_destroy(tls_context_t* context);
int tls_client_write(tls_context_t* context, const uint8_t* data, size_t size);

int tls_client_set_cacerts(tls_context_t* context, const char* certs, size_t certs_size);
int tls_client_setup(tls_context_t* context, const char* hostname);

int tls_server_setup(tls_context_t* context);
int tls_server_init(tls_context_t* context);

#endif
