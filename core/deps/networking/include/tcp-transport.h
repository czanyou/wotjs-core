#ifndef _tcp_transport_h_
#define _tcp_transport_h_

#include <uv.h>

typedef struct tcp_transport_s tcp_transport_t;

enum tcp_transport_event_t {
    TCP_TRANSPORT_EVENT_UNKNOWN = 0,
    TCP_TRANSPORT_EVENT_LOOKUP,
    TCP_TRANSPORT_EVENT_CONNECTED,
    TCP_TRANSPORT_EVENT_READY,
    TCP_TRANSPORT_EVENT_ERROR,
};

enum tcp_transport_state_t {
    TCP_TRANSPORT_STATE_CONNECTING = 0,
    TCP_TRANSPORT_STATE_OPEN,
    TCP_TRANSPORT_STATE_CLOSING,
    TCP_TRANSPORT_STATE_CLOSED
};

/**
 * @brief 当建立连接时调用这个方法
 * 
 */
typedef void (*tcp_transport_on_event)(void* param, int event, int status, void* data);

/**
 * @brief 当收到网络层的数据时调用这个方法
 * 
 */
typedef void (*tcp_transport_on_input)(void* param, const char* data, ssize_t nread);

struct tcp_transport_s {
    uv_tcp_t* socket;
    uv_loop_t* loop;
    tcp_transport_on_event on_event;
    tcp_transport_on_input on_input;
    void* data;
    uint32_t ready_state;
};

/**
 * @brief 初始化 TCP 传输模块
 * 
 * @param transport 
 * @param loop 
 * @param param 
 * @return 如果成功则返回 0 
 */
int tcp_transport_init(tcp_transport_t* transport, uv_loop_t* loop, void* param);

/**
 * @brief 发起连接
 * 
 * @param transport 
 * @param host 
 * @param port 
 * @return 如果成功则返回 0   
 */
int tcp_transport_connect(tcp_transport_t* transport, const char* host, int port);

/**
 * @brief 销毁这个对象
 * 
 * @param transport 
 * @return 如果成功则返回 0   
 */
int tcp_transport_destroy(tcp_transport_t* transport);

/**
 * @brief 指出是否可以发送数据（即发送队列为空）
 * 
 * @param transport 
 * @return 0 表示不为空，1 表示为空 
 */
int tcp_transport_is_ready(tcp_transport_t* transport);

/**
 * @brief 发送数据
 * - 当返回 1 时，不建议继续发送以免缓存过多数据，可以等待 TCP_TRANSPORT_EVENT_READY 事件后再发送
 * 
 * @param transport 
 * @param data 
 * @param len 
 * @return 如果发生错误则返回小于 0 的负数，1 表示数据已放入发送队列，0 表示已立即发送
 */
int tcp_transport_write(tcp_transport_t* transport, const uint8_t* data, size_t len);

#endif
