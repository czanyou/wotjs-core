/*
 * @Author: Wangs
 * @Date: 2021-07-08 10:27:59
 * @LastEditors: Wangs
 * @LastEditTime: 2021-07-12 15:35:57
 * @Description: 
 */

/*//////////////////////////////////////////////////////////////////////////////

 * Copyright (c) 2015 libuv-tls contributors

 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
**/
///////////////////////////////////////////////////////////////////////////*/

#ifndef __UV_TLS_H__
#define __UV_TLS_H__

#ifdef __cplusplus
extern "C" {
#endif

#include "assert.h"
#include "stdio.h"
#include "stdlib.h"
#include "unistd.h"

#include "uv.h"
#include "uv-tls-port.h"
#include "wotjs.h"

#define MBEDTLS_OK 0

typedef struct uv_tls_s uv_tls_t;

typedef void (*uv_tls_alloc_cb)(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
typedef void (*uv_tls_read_cb)(uv_stream_t* handle, ssize_t nread, const uv_buf_t* buf);
typedef void (*uv_tls_close_cb)(uv_tls_t* handle);
typedef void (*uv_tls_connect_cb)(uv_connect_t* req, int status);

// Most used members are put first
struct uv_tls_s {
    uv_tcp_t tcp_socket; // handle that encapsulate the socket
    uv_tls_port_t tls_engine; // the tls engine representation
    uv_buf_t read_buffer;
    DynBuf* write_buffer;
    void* data;
    int read_buffer_head;
    int read_buffer_tail;
    int ready_state; // ready state
};

/**
 * @brief 关闭长下文
 * 
 * @param uvtls 长下文
 * @return int 
 */
int uv_tls_close(uv_tls_t* uvtls);

/**
 * @brief 对要发送的数据进行编码和加密
 * 
 * @param uvtls 上下文
 * @param data 要加密的数据
 * @param buffer 用来接收加密后的数据
 * @return int 
 */
int uv_tls_encode(uv_tls_t* uvtls, uint8_t* data, size_t size, DynBuf* buffer);

/**
 * @brief 返回身份验证结果
 * 
 * @param uvtls 长下文
 * @param buffer 用于接收验证错误消息的缓存区
 * @param bufferSize 缓存区大小
 * @return int 
 */
int uv_tls_get_verify_result(uv_tls_t* uvtls, char* buffer, size_t bufferSize);

/**
 * @brief 建立握手
 * 
 * @param uvtls 长下文
 * @return int 
 */
int uv_tls_handshake(uv_tls_t* uvtls);

/**
 * @brief 初始化长下文
 * 
 * @param uvtls 
 * @return int 
 */
int uv_tls_init(uv_tls_t* uvtls);

/**
 * @brief push 方法用于将内容推入内部的 buffer
 * 
 * @param uvtls 长下文
 * @param nread 数据的长度
 * @param buf 要推入的数据
 * @return int 
 */
int uv_tls_push(uv_tls_t* uvtls, ssize_t nread, const uv_buf_t* buf);

/**
 * @brief 从内部的 buffer 中读取数据
 * 
 * @param uvtls 长下文
 * @return int 
 */
int uv_tls_read(uv_tls_t* uvtls, uv_tls_alloc_cb alloc_cb, uv_tls_read_cb read_cb);

/**
 * @brief 设置客户端上下文
 * 
 * @param uvtls 上下文
 * @param server_name 服务器名称
 * @return int 
 */
int uv_tls_setup_client(uv_tls_t* uvtls, const char* server_name);

/**
 * @brief 设置服务端上下文
 * 
 * @param uvtls 上下文
 * @return int 
 */
int uv_tls_setup_server(uv_tls_t* uvtls);

#ifdef __cplusplus
}
#endif

#endif
