#ifndef _uv_udp_transport_h_
#define _uv_udp_transport_h_

#include <uv.h>

enum udp_transport_event_t {
    UDP_TRANSPORT_EVENT_UNKNOWN = 0,
    UDP_TRANSPORT_EVENT_LOOKUP,
    UDP_TRANSPORT_EVENT_CONNECTED,
    UDP_TRANSPORT_EVENT_READY,
    UDP_TRANSPORT_EVENT_ERROR,
};

typedef struct uv_udp_transport_s uv_udp_transport_t;

/**
 * @brief 当建立连接时调用这个方法
 * 
 */
typedef void (*udp_transport_on_event)(void* param, int event, int status, void* data);

/**
 * @brief 当收到网络层的数据时调用这个方法
 * 
 */
typedef void (*udp_transport_on_input)(void* param, const char* data, ssize_t nread);

struct uv_udp_transport_s {
    uv_udp_t* socket;
    uv_loop_t* loop;
    udp_transport_on_event on_event;
    udp_transport_on_input on_input;
    void* data;
    uint32_t closed;
};

/**
 * @brief 初始化 TCP 传输模块
 * 
 * @param transport 
 * @param loop 
 * @param param 
 * @return 如果成功则返回 0 
 */
int uv_udp_transport_init(uv_udp_transport_t* transport, uv_loop_t* loop, void* param);

/**
 * @brief 发起连接
 * 
 * @param transport 
 * @param host 
 * @param port 
 * @return 如果成功则返回 0   
 */
int uv_udp_transport_bind(uv_udp_transport_t* transport, const char* host, int port);

/**
 * @brief 销毁这个对象
 * 
 * @param transport 
 * @return 如果成功则返回 0   
 */
int uv_udp_transport_destroy(uv_udp_transport_t* transport);

/**
 * @brief 发送数据
 * 
 * @param transport 
 * @param data 
 * @param len 
 * @return 如果成功则返回 0  
 */
int uv_udp_transport_send(uv_udp_transport_t* transport, const char* address, int port, const uint8_t* data, size_t len);

#endif
