#ifndef _net_transport_h_
#define _net_transport_h_

#include <uv.h>

typedef struct net_transport_s net_transport_t;

enum net_transport_event_t {
    NET_TRANSPORT_EVENT_UNKNOWN = 0,
    NET_TRANSPORT_EVENT_LOOKUP,
    NET_TRANSPORT_EVENT_CONNECTED,
    NET_TRANSPORT_EVENT_READY,
    NET_TRANSPORT_EVENT_ERROR,
};

enum net_transport_state_t {
    NET_TRANSPORT_STATE_CONNECTING = 0,
    NET_TRANSPORT_STATE_OPEN,
    NET_TRANSPORT_STATE_CLOSING,
    NET_TRANSPORT_STATE_CLOSED
};

/**
 * @brief 当建立连接时调用这个方法
 * 
 */
typedef void (*net_transport_on_event)(void* param, int event, int status, void* data);

/**
 * @brief 当收到网络层的数据时调用这个方法
 * 
 */
typedef void (*net_transport_on_input)(void* param, const char* data, ssize_t nread);

/**
 * @brief 
 * 
 * @return net_transport_t* 
 */
net_transport_t* net_transport_create(int type);

/**
 * @brief 初始化 TCP 传输模块
 * 
 * @param transport 
 * @param loop 
 * @param param 
 * @return 如果成功则返回 0 
 */
int net_transport_init(net_transport_t* transport, uv_loop_t* loop, void* param, net_transport_on_event event, net_transport_on_input input);

/**
 * @brief 发起连接
 * 
 * @param transport 
 * @param host 
 * @param port 
 * @return 如果成功则返回 0   
 */
int net_transport_connect(net_transport_t* transport, const char* host, int port);

/**
 * @brief 销毁这个对象
 * 
 * @param transport 
 * @return 如果成功则返回 0   
 */
int net_transport_destroy(net_transport_t* transport);

/**
 * @brief 指出是否可以发送数据（即发送队列为空）
 * 
 * @param transport 
 * @return 0 表示不为空，1 表示为空 
 */
int net_transport_is_ready(net_transport_t* transport);

/**
 * @brief 发送数据
 * - 当返回 1 时，不建议继续发送以免缓存过多数据，可以等待 NET_TRANSPORT_EVENT_READY 事件后再发送
 * 
 * @param transport 
 * @param data 
 * @param len 
 * @return 如果发生错误则返回小于 0 的负数，1 表示数据已放入发送队列，0 表示已立即发送
 */
int net_transport_write(net_transport_t* transport, const uint8_t* data, size_t len);

#endif
