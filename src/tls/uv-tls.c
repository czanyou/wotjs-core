#include "uv.h"

#include "uv-tls.h"

typedef struct uv_tls_write_req_s {
    uv_write_t req;
    uv_buf_t buf;
    void* data;
} uv_tls_write_req_t;

uv_stream_t* uv_tls_get_stream(uv_tls_t* uvtls)
{
    return (uv_stream_t*)uvtls;
}

uv_handle_t* uv_tls_get_handle(uv_tls_t* uvtls)
{
    return (uv_handle_t*)uvtls;
}

int uv_tls_init(uv_tls_t* uvtls)
{
    uvtls->tcp_socket.data = uvtls;

    uv_tls_port_t* tls = &(uvtls->tls_engine);
    uv_tls_port_init_client(tls);

    uvtls->read_buffer = uv_buf_init(NULL, 0);
    uvtls->read_buffer_head = 0;
    uvtls->read_buffer_tail = 0;

    uvtls->ready_state = STATE_INIT;
    uvtls->write_buffer = NULL;

    return 0;
}

// shutdown the ssl uvtls then stream
int uv_tls_close(uv_tls_t* uvtls)
{
    uvtls->ready_state = STATE_CLOSING;

    // free readBuffer
    if (uvtls->read_buffer.base) {
        free(uvtls->read_buffer.base);
        uvtls->read_buffer.base = NULL;
    }

    // free tls port
    uv_tls_port_free(&uvtls->tls_engine);

    return 0;
}

int uv_tls_handshake(uv_tls_t* uvtls)
{
    int ret = mbedtls_ssl_handshake(&uvtls->tls_engine.ssl);
    if (ret != 0) {
        uvtls->ready_state = STATE_HANDSHAKING;
        return 0;
    }

    uvtls->ready_state = STATE_IO;
    return 1;
}

int uv_tls_get_verify_result(uv_tls_t* uvtls, char* message, size_t messageSize) 
{
    int status = mbedtls_ssl_get_verify_result(&uvtls->tls_engine.ssl);
    if (status && message) {
        mbedtls_x509_crt_verify_info(message, messageSize, "", status);
    }

    return status;
}

int uv_tls_encode(uv_tls_t* uvtls, uint8_t* data, size_t size, DynBuf* buffer)
{
    uv_tls_port_t* tls = &(uvtls->tls_engine);
    uvtls->write_buffer = buffer;

    int leftover = size;
    int offset = 0;
    int result = 0;
    while (leftover > 0) {
        int ret = mbedtls_ssl_write(&tls->ssl, data + offset, leftover);
        if (ret <= 0) {
            uv_tls_print_error(ret, "mbedtls_ssl_write");
            result = -1;
            break;

        } else if (ret > 0) {
            leftover -= ret;
            offset += ret;
        }
    }

    uvtls->write_buffer = NULL;
    return result;
}

int uv_tls_read(uv_tls_t* uvtls, uv_tls_alloc_cb alloc_cb, uv_tls_read_cb read_cb)
{
    // handshake
    if (uvtls->ready_state != STATE_IO) {
        return 0;
    }

    uv_stream_t* stream = uv_tls_get_stream(uvtls);

    if (!alloc_cb || !read_cb) {
        return 0;
    }

    int kDefaultSize = 64 * 1024;
    while (1) {
        int read_buffer_size = uvtls->read_buffer_tail - uvtls->read_buffer_head;
        if (read_buffer_size <= 0) {
            return 0;
        }

        uv_buf_t buffer = uv_buf_init(NULL, 0);
        alloc_cb(uv_tls_get_handle(uvtls), kDefaultSize, &buffer);
        int ret = mbedtls_ssl_read(&uvtls->tls_engine.ssl, (unsigned char*)buffer.base, buffer.len);
        if (ret > 0) {
            read_cb(stream, ret, &buffer);
            continue;

        } else if (ret == MBEDTLS_ERR_SSL_WANT_READ || ret == MBEDTLS_ERR_SSL_WANT_WRITE) {
            read_cb(stream, 0, &buffer);
            return ret;
        }

        if (ret == MBEDTLS_ERR_SSL_PEER_CLOSE_NOTIFY) {
            ret = UV_EOF;

        } else if (ret == 0) {
            ret = UV_EOF;
        }

        read_cb(stream, ret, &buffer);
        break;
    }

    mbedtls_ssl_close_notify(&uvtls->tls_engine.ssl);
    return 0;
}

int uv_tls_push(uv_tls_t* uvtls, ssize_t nread, const uv_buf_t* buf)
{
    // alloc
    int kDefaultSize = 64 * 1024;
    if (!uvtls->read_buffer.base) {
        uvtls->read_buffer.len = kDefaultSize;
        uvtls->read_buffer.base = malloc(kDefaultSize + 1);
    }

    uint8_t* buffer = uvtls->read_buffer.base + uvtls->read_buffer_tail;
    int free_size = uvtls->read_buffer.len - uvtls->read_buffer_tail;
    if (free_size < nread) {
        return 0;
    }

    // put
    memcpy(buffer, buf->base, nread);
    uvtls->read_buffer_tail += nread;
    return 0;
}

int uv_tls_bio_recv(void* ctx, unsigned char* buffer, size_t len)
{
    uv_tls_t* uvtls = (uv_tls_t*)ctx;

    int read_buffer_size = uvtls->read_buffer_tail - uvtls->read_buffer_head;
    if (!uvtls->read_buffer.base || read_buffer_size <= 0) {
        return MBEDTLS_ERR_SSL_WANT_READ;
    }

    // mbedtls_printf("uv_tls_bio_recv: to(%d-%d) -> %ld...\n", uvtls->read_buffer_head, read_buffer_size, len);
    if (read_buffer_size < len) {
        len = read_buffer_size;
    }

    uint8_t* source = uvtls->read_buffer.base + uvtls->read_buffer_head;
    memcpy(buffer, source, len);

    uvtls->read_buffer_head += len;
    if (uvtls->read_buffer_head == uvtls->read_buffer_tail) {
        uvtls->read_buffer_head = 0;
        uvtls->read_buffer_tail = 0;
    }

    return len;
}

static void uv__tls_tcp_write_cb(uv_write_t* req, int status)
{
    uv_tls_write_req_t* uwreq = req->data;
    uv_tls_t* uvtls = (uv_tls_t*)req->handle;

    free(uwreq->buf.base);
    free(uwreq);
}

int uv_tls_bio_send(void* ctx, const unsigned char* data, size_t size)
{
    // mbedtls_printf("uv_tls_bio_send(%ld)...\n", size);
    uv_tls_t* uvtls = (uv_tls_t*)ctx;

    if (uvtls->write_buffer) {
        dbuf_put(uvtls->write_buffer, data, size);
        return size;
    }

    // 直接发送到网络层
    uv_tls_write_req_t* uwreq = malloc(sizeof(uv_tls_write_req_t));
    uwreq->req.data = uwreq;
    uwreq->buf = uv_buf_init(NULL, 0);
    uwreq->buf.len = size;
    uwreq->buf.base = malloc(size);
    memcpy(uwreq->buf.base, data, size);

    uv_write(&uwreq->req, uv_tls_get_stream(uvtls), &uwreq->buf, 1, uv__tls_tcp_write_cb);
    return size;
}

int uv_tls_setup_client(uv_tls_t* uvtls, const char* host)
{
    uv_tls_port_t* tls = &(uvtls->tls_engine);
    mbedtls_ssl_context ctx = tls->ssl;

    int ret;
    int endpoint = MBEDTLS_SSL_IS_CLIENT;
    int transport = MBEDTLS_SSL_TRANSPORT_STREAM;
    int preset = MBEDTLS_SSL_PRESET_DEFAULT;
    ret = mbedtls_ssl_config_defaults(&tls->conf, endpoint, transport, preset);
    if (ret != 0) {
        uv_tls_print_error(ret, "mbedtls_ssl_config_defaults");
        return ret;
    }

    /* OPTIONAL is not optimal for security,
     * but makes interop easier in this simplified example */
    mbedtls_ssl_conf_authmode(&tls->conf, MBEDTLS_SSL_VERIFY_OPTIONAL);
    mbedtls_ssl_conf_ca_chain(&tls->conf, &tls->cacert, NULL);
    mbedtls_ssl_conf_rng(&tls->conf, mbedtls_ctr_drbg_random, &tls->ctr_drbg);
    ret = mbedtls_ssl_setup(&tls->ssl, &tls->conf);
    if (ret != 0) {
        uv_tls_print_error(ret, "mbedtls_ssl_setup");
        return ret;
    }

    ret = mbedtls_ssl_set_hostname(&tls->ssl, host);
    if (ret != 0) {
        return ret;
    }

    mbedtls_ssl_set_bio(&tls->ssl, uvtls, uv_tls_bio_send, uv_tls_bio_recv, NULL);
    return ERR_TLS_OK;
}

int uv_tls_setup_server(uv_tls_t* uvtls)
{
    uv_tls_port_t* tls = &(uvtls->tls_engine);

    int ret;
    int endpoint = MBEDTLS_SSL_IS_SERVER;
    int transport = MBEDTLS_SSL_TRANSPORT_STREAM;
    int preset = MBEDTLS_SSL_PRESET_DEFAULT;
    ret = mbedtls_ssl_config_defaults(&tls->conf, endpoint, transport, preset);
    if (ret != 0) {
        uv_tls_print_error(ret, "mbedtls_ssl_config_defaults");
        return ret;
    }

    mbedtls_ssl_conf_rng(&tls->conf, mbedtls_ctr_drbg_random, &tls->ctr_drbg);
    mbedtls_ssl_conf_ca_chain(&tls->conf, &tls->cacert, NULL);
    // ret = mbedtls_ssl_conf_own_cert( &conf, &srvcert, &pkey);

    ret = mbedtls_ssl_setup(&tls->ssl, &tls->conf);
    if (ret != 0) {
        uv_tls_print_error(ret, "mbedtls_ssl_setup");
        return ret;
    }

    mbedtls_ssl_session_reset(&tls->ssl);

    mbedtls_ssl_set_bio(&tls->ssl, uvtls, uv_tls_bio_send, uv_tls_bio_recv, NULL);
    return ERR_TLS_OK;
}
