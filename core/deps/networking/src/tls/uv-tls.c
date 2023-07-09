#include "uv.h"

#include "tls/tls-context.h"
#include "tls/uv-tls.h"

typedef struct uv_tls_write_req_s {
    uv_write_t req;
    uv_buf_t buf;
    void* data;
} uv_tls_write_req_t;

int uv_tls_init(uv_tls_t* uvtls)
{
    assert(uvtls != NULL);

    uvtls->socket.data = uvtls;

    uvtls->tls_context = malloc(sizeof(tls_context_t));
    tls_client_init(uvtls->tls_context);

    uvtls->read_buffer = uv_buf_init(NULL, 0);
    uvtls->read_head = 0;
    uvtls->read_tail = 0;

    uvtls->ready_state = STATE_INIT;

    uvtls->write_buffer = NULL;
    uvtls->write_handler = NULL;

    return 0;
}

// shutdown the ssl uvtls then stream
int uv_tls_destroy(uv_tls_t* uvtls)
{
    if (uvtls == NULL) {
        return -1;
    }

    uvtls->ready_state = STATE_CLOSING;

    // free read buffer
    if (uvtls->read_buffer.base) {
        free(uvtls->read_buffer.base);
        uvtls->read_buffer.base = NULL;
    }

    // free (mbed) tls context
    tls_context_t* context = uvtls->tls_context;
    if (context) {
        uvtls->tls_context = NULL;

        tls_client_destroy(context);
        free(context);
    }

    return 0;
}

int uv_tls_handshake(uv_tls_t* uvtls)
{
    assert(uvtls != NULL);

    tls_context_t* context = uvtls->tls_context;
    if (context == NULL) {
        return -1;
    }

    int ret = mbedtls_ssl_handshake(&context->ssl);
    // printf("uv_tls_handshake: %d\r\n", ret);
    if (ret != 0) {
        uvtls->ready_state = STATE_HANDSHAKING;
        return 0;
    }

    uvtls->ready_state = STATE_IO;
    return 1;
}

int uv_tls_get_verify_result(uv_tls_t* uvtls, char* message, size_t messageSize)
{
    assert(uvtls != NULL);

    tls_context_t* context = uvtls->tls_context;
    if (context == NULL) {
        return -1;
    }

    int status = mbedtls_ssl_get_verify_result(&context->ssl);
    if (status && message) {
        mbedtls_x509_crt_verify_info(message, messageSize, "", status);
    }

    return status;
}

int uv_tls_encode(uv_tls_t* uvtls, const uint8_t* data, size_t size, dbuffer_t* buffer)
{
    assert(uvtls != NULL);

    tls_context_t* context = uvtls->tls_context;
    if (context == NULL) {
        return -1;
    }

    uvtls->write_buffer = buffer;
    int result = tls_client_write(context, data, size);
    uvtls->write_buffer = NULL;

    return result;
}

int uv_tls_write(uv_tls_t* uvtls, const uint8_t* data, size_t size, uv_tls_write_cb handler)
{
    assert(uvtls != NULL);

    tls_context_t* context = uvtls->tls_context;
    if (context == NULL) {
        return -1;
    }

    uvtls->write_handler = handler;
    int result = tls_client_write(context, data, size);
    return result;
}

int uv_tls_read(uv_tls_t* uvtls, uv_tls_alloc_cb alloc_cb, uv_tls_read_cb read_cb)
{
    assert(uvtls != NULL);

    // handshake
    if (uvtls->ready_state != STATE_IO) {
        return 0;
    }

    uv_stream_t* stream = (uv_stream_t*)uvtls;

    if (!alloc_cb || !read_cb) {
        return 0;
    }

    int kDefaultSize = 64 * 1024;
    while (1) {
        int read_buffer_size = uvtls->read_tail - uvtls->read_head;
        if (read_buffer_size <= 0) {
            return 0;
        }

        tls_context_t* context = uvtls->tls_context;
        if (context == NULL) {
            return -1;
        }

        uv_buf_t buffer = uv_buf_init(NULL, 0);
        alloc_cb((uv_handle_t*)uvtls, kDefaultSize, &buffer);
        int ret = mbedtls_ssl_read(&context->ssl, (unsigned char*)buffer.base, buffer.len);
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

    if (uvtls->tls_context) {
        mbedtls_ssl_close_notify(&uvtls->tls_context->ssl);
    }

    return 0;
}

int uv_tls_push(uv_tls_t* uvtls, const uint8_t* data, ssize_t bytes)
{
    assert(uvtls != NULL);

    if (data == NULL || bytes <= 0) {
        return -1;
    }

    uv_buf_t* read_buffer = &uvtls->read_buffer;

    // alloc
    int kDefaultSize = 64 * 1024;
    if (read_buffer->base == NULL) {
        read_buffer->len = kDefaultSize;
        read_buffer->base = malloc(kDefaultSize + 1);
    }

    uint8_t* buffer = read_buffer->base + uvtls->read_tail;
    int free_size = read_buffer->len - uvtls->read_tail;
    if (free_size < bytes) {
        return -1;
    }

    // put
    memcpy(buffer, data, bytes);
    uvtls->read_tail += bytes;

    // handshake
    if (uvtls->ready_state != STATE_IO) {
        uv_tls_handshake(uvtls);
    }

    return 0;
}

int uv_tls_bio_recv(void* param, unsigned char* buffer, size_t len)
{
    uv_tls_t* uvtls = (uv_tls_t*)param;
    assert(uvtls != NULL);

    int read_buffer_size = uvtls->read_tail - uvtls->read_head;
    if (!uvtls->read_buffer.base || read_buffer_size <= 0) {
        return MBEDTLS_ERR_SSL_WANT_READ;
    }

    // mbedtls_printf("uv_tls_bio_recv: to(%d-%d) -> %ld...\n", uvtls->read_head, read_buffer_size, len);
    if (read_buffer_size < len) {
        len = read_buffer_size;
    }

    uint8_t* source = uvtls->read_buffer.base + uvtls->read_head;
    memcpy(buffer, source, len);

    uvtls->read_head += len;
    if (uvtls->read_head == uvtls->read_tail) {
        uvtls->read_head = 0;
        uvtls->read_tail = 0;
    }

    return len;
}

static void uv_tls_on_write(uv_write_t* req, int status)
{
    uv_tls_write_req_t* request = req->data;
    uv_tls_t* uvtls = (uv_tls_t*)req->handle;

    free(request->buf.base);
    free(request);

    if (uvtls->write_handler) {
        uvtls->write_handler(uvtls->data, status);
    }
}

int uv_tls_bio_send(void* ctx, const uint8_t* data, size_t length)
{
    // mbedtls_printf("uv_tls_bio_send(%ld)...\n", length);
    uv_tls_t* uvtls = (uv_tls_t*)ctx;

    if (uvtls->write_buffer) {
        dbuffer_put(uvtls->write_buffer, data, length);
        return length;
    }

    // try write
    uv_buf_t uv_buffer = uv_buf_init((char*)data, length);
    int ret = uv_try_write((uv_stream_t*)uvtls, &uv_buffer, 1);
    if (ret == length) {
        return length;
    }

    if (ret >= 0) {
        data += ret;
        length -= ret;
    }

    // 发送到网络层
    uv_tls_write_req_t* request = malloc(sizeof(uv_tls_write_req_t));
    request->req.data = request;
    request->buf = uv_buf_init(malloc(length), length);
    memcpy(request->buf.base, data, length);

    ret = uv_write(&request->req, (uv_stream_t*)uvtls, &request->buf, 1, uv_tls_on_write);
    if (ret != 0) {
        free(request->buf.base);
        free(request);
    }

    return length;
}

int uv_tls_setup_client(uv_tls_t* uvtls, const char* hostname)
{
    assert(uvtls != NULL);

    tls_context_t* context = uvtls->tls_context;
    if (context == NULL) {
        return -1;
    }

    int ret = tls_client_setup(context, hostname);
    if (ret != 0) {
        return ret;
    }

    mbedtls_ssl_set_bio(&context->ssl, uvtls, uv_tls_bio_send, uv_tls_bio_recv, NULL);
    return 0;
}

int uv_tls_setup_server(uv_tls_t* uvtls)
{
    assert(uvtls != NULL);

    tls_context_t* context = uvtls->tls_context;
    if (context == NULL) {
        return -1;
    }

    int ret = tls_server_setup(context);
    if (ret != 0) {
        return ret;
    }

    mbedtls_ssl_set_bio(&context->ssl, uvtls, uv_tls_bio_send, uv_tls_bio_recv, NULL);
    return 0;
}

int uv_tls_set_cacerts(uv_tls_t* uvtls, const char* cacert)
{
    if (cacert == NULL) {
        return -1;
    }

    tls_context_t* context = uvtls->tls_context;
    if (context == NULL) {
        return -1;
    }

    tls_client_set_cacerts(context, cacert, strlen(cacert) + 1); // 证书必须包含结尾 `\0`
    return 0;
}
