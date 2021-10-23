/*
 * @Author: Wangs
 * @Date: 2021-07-08 14:44:43
 * @LastEditors: Wangs
 * @LastEditTime: 2021-07-09 11:33:14
 * @Description: 
 */

#ifndef __UV_TLS_ENGINE_H__
#define __UV_TLS_ENGINE_H__

#ifdef __cplusplus
extern "C" {
#endif

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
#define mbedtls_time time
#define mbedtls_time_t time_t
#define mbedtls_fprintf fprintf
#define mbedtls_printf __log
#endif

#include "mbedtls/certs.h"
#include "mbedtls/ctr_drbg.h"
#include "mbedtls/debug.h"
#include "mbedtls/entropy.h"
#include "mbedtls/error.h"
#include "mbedtls/net.h"
#include "mbedtls/net_sockets.h"
#include "mbedtls/ssl.h"

enum uv_tls_state {
    STATE_INIT = 0x0,
    STATE_HANDSHAKING = 0x1,
    STATE_IO = 0x2, // read or write mode
    STATE_CLOSING = 0x4 // This means closed state also
};

enum uv_tls_error {
    ERR_TLS_ERROR = -1,
    ERR_TLS_OK
};

typedef struct uv_tls_port_s {
    mbedtls_entropy_context entropy;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_ssl_context ssl;
    mbedtls_ssl_config conf;
    mbedtls_x509_crt cacert;
} uv_tls_port_t;

int uv_tls_print_error(int errcode, const char* func);
int uv_tls_port_init_client(uv_tls_port_t* tls);
int uv_tls_port_init_server(uv_tls_port_t* tls);
int uv_tls_port_set_cacerts(uv_tls_port_t* tls, const char* certs, size_t certs_size);
int uv_tls_port_free(uv_tls_port_t* tls);

#ifdef __cplusplus
}
#endif

#endif
