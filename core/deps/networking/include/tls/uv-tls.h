#ifndef __UV_TLS_H__
#define __UV_TLS_H__

#include "uv.h"
#include "util/dbuffer.h"

typedef struct uv_tls_s uv_tls_t;
typedef struct tls_context_s tls_context_t;

typedef void (*uv_tls_alloc_cb)(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
typedef void (*uv_tls_read_cb)(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf);
typedef void (*uv_tls_write_cb)(void* handle, int status);

// Most used members are put first
struct uv_tls_s {
    uv_tcp_t socket; // handle that encapsulate the socket
    tls_context_t* tls_context; // the tls engine representation
    uv_buf_t read_buffer;
    uv_tls_read_cb read_handler;
    uv_tls_write_cb write_handler;
    dbuffer_t* write_buffer;
    void* data;
    int read_head;
    int read_tail;
    int ready_state; // ready state
};

/**
 * @brief 关闭长下文
 * 
 * @param socket 长下文
 * @return 如果成功则返回 0
 */
int uv_tls_destroy(uv_tls_t* socket);

/**
 * @brief 对要发送的数据进行编码和加密
 * - 在发送数据时调用
 * - 将 buffer 中的数据发送到网络层
 * 
 * @param socket 上下文
 * @param data 要加密的数据
 * @param size 要加密的数据长度
 * @param buffer 用来接收加密后的数据
 * @return 如果成功则返回 0
 */
int uv_tls_encode(uv_tls_t* socket, const uint8_t* data, size_t size, dbuffer_t* buffer);

/**
 * @brief 
 * 
 * @param socket 上下文
 * @param data 要加密的数据
 * @param size 要加密的数据长度
 * @param handler 
 * @return
 */
int uv_tls_write(uv_tls_t* socket, const uint8_t* data, size_t size, uv_tls_write_cb handler);

/**
 * @brief 返回身份验证结果
 * 
 * @param socket 长下文
 * @param buffer 用于接收验证错误消息的缓存区
 * @param buffer_size 缓存区大小
 * @return 如果成功则返回 0
 */
int uv_tls_get_verify_result(uv_tls_t* socket, char* buffer, size_t buffer_size);

/**
 * @brief 建立握手
 * - 在未建立握手前，收到网络层的数据后调用这个方法
 * 
 * @param socket 长下文
 * @return 如果成功则返回 1, 否则返回 0
 */
int uv_tls_handshake(uv_tls_t* socket);

/**
 * @brief 初始化长下文
 * - 在初始化 TCP 后调用
 * 
 * @param socket 长下文
 * @return 如果成功则返回 0
 */
int uv_tls_init(uv_tls_t* socket);

/**
 * @brief 这个方法用于将来自网络层的数据推入内部的 buffer
 * - 当收到来自网络层的数据时调用
 * 
 * @param socket 长下文
 * @param data 要推入的数据
 * @param bytes 数据的长度
 * @return 如果成功则返回 0
 */
int uv_tls_push(uv_tls_t* socket, const uint8_t* data, ssize_t bytes);

/**
 * @brief 从内部的 buffer 中读取数据
 * - 当收到来自网络层的数据时调用
 * 
 * @param socket 长下文
 * @param alloc_cb
 * @param read_cb
 * @return 如果成功则返回 0
 */
int uv_tls_read(uv_tls_t* socket, uv_tls_alloc_cb alloc_cb, uv_tls_read_cb read_cb);

/**
 * @brief 设置 TLS 客户端连接上下文
 * - 在发起网络连接前调用
 * 
 * @param socket 上下文
 * @param hostname 服务器名称
 * @return 如果成功则返回 0
 */
int uv_tls_setup_client(uv_tls_t* socket, const char* hostname);

/**
 * @brief 设置 TLS 服务端连接上下文
 * 
 * @param socket 上下文
 * @return 如果成功则返回 0
 */
int uv_tls_setup_server(uv_tls_t* socket);

/**
 * @brief 
 * 
 * @param socket 上下文
 * @param certs 证书列表
 * @return 如果成功则返回 0
 */
int uv_tls_set_cacerts(uv_tls_t* socket, const char* certs);

#endif
