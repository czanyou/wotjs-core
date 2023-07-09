# RPC 协议

## 概述

本文描述了物联网设备通用 RPC (远程过程调用) 通信协议相关规范和数据格式。

## 远程过程调用

在物联网设备上经常需要在模块和模块，设备和设备以及进程和进程之间进行通信。本文定义了一个通用的远程过程调用规范，统一了不同通信方式下的通信协议，目前常用的通信方式有:

- RPC over MQTT (和云端通信)
- RPC over HTTP (Rest API)
- RPC over Pipe (进程间通信)
- RPC over GATT (蓝牙通信)
- RPC over UART (串口通信)
- RPC over UDP (UDP 网络通信)
- RPC over TCP (TCP 网络通信)
- RPC over TUYA DataPoint (通过涂鸦云通信) 

### 数据格式

本协议采用的是和 JSON-RPC 2.0 相似的协议，使用 JSON 数据格式。足够简单和易于实现。

关于什么是 JSON-RPC 请参考:

> https://www.jsonrpc.org/

### 请求消息

RPC 协议为典型的 C/S 模式，通常是由客户端主动向服务端发送请求消息，服务端处理后返回应答消息

请求消息格式:

```json
{
    "method": "<name>",
    "id": 1,
    "params": {}
}
```

- `method` 必要的，要调用的方法名，如 `wifi.connect`
- `id` 必要的，消息 ID
- `params` 可选，方法参数，一般为一个 JSON Object

### 应答消息

服务端处理完后必须返回一个应答消息

应答消息格式:

```json
{
    "id": 1,
    "result": true
}
```

或者:

```json
{
    "id": 1,
    "error": {
        "code": -32600,
        "message": "Bad request",
        "data": null
    }
}
```

- `id` 必要的，消息 ID
- `result` 执行成功时必须包含，可以是任意类型
- `error` 执行失败时必须包含
    - `code` 必要的，错误码
    - `message` 必要的，错误消息
    - `data` 可选，具体错误数据

### 通知消息

服务端也可以主动向客户端发送通知消息，通知消息不需要应答

```json
{
    "method": "<name>",
    "params": {}
}
```

- `method` 必要的，要通知的事件名，如 `wifi.connect`
- `params` 可选，事件参数，一般为一个 JSON Object

## 通信方式

> 因为通信方式和 MCU 性能限制，物联网设备 RPC 协议不建议用来传输大数据，所以除了蓝牙外消息大小一般限制在 1KB 内比较好。如果有需要传输大数据一般建议优先考虑 HTTP 协议或者另外实现分包传输机制。

### RPC over MQTT

> TODO: 待实现

主要用于设备和云端或者 APP 端和设备端通信

数据包长度一般不超过 4KB 字节

每个 RPC 消息为一个数据包

- 请求消息主题: /path/to/rpc
- 应答消息主题: /path/to/rpc/response

### RPC over HTTP

> TODO: 待实现

数据包长度没有限制

- URL 地址: `https://<host:port>/path/to/rpc`

通过 POST 方法发送请求消息，消息内容类型为 `application/json`

可以通过 SSE 的方式接收通知消息

### RPC over Pipe

主要用于进程和进程间通信

数据包长度一般不超过 64KB 字节

#### 服务器端

每个进程创建名为 `/var/run/<name>-jsonrpc.socket` 的管道服务器。

每个 RPC 消息为一个数据包

### RPC over GATT

主要用于 APP 端和蓝牙配件之间通信

数据包长度一般不超过 220 字节

#### RPC 服务

在 GATT 中定义一个 UUID 为 `55535343-fe7d-4ae5-8fa9-9fafd205e455` 的服务，包含如下两个特征值:

- `tx` '49535343-8841-43f4-a8d4-ecbe34729bb3' 发送数据
- `rx` '49535343-1e4d-4bd9-ba61-23c647249616' 接收数据，可以通过通知方式接收数据

每个 RPC 消息为一个数据包

### RPC over UART 

主要用于 MCU 和模组之间通信

数据包长度一般不超过 1024 字节

#### 涂鸦串口协议

RPC over UART 是在涂鸦串口协议基础上扩展出来的协议：

> https://developer.tuya.com/cn/docs/iot/tuya-cloud-universal-serial-port-access-protocol?id=K9hhi0xxtn9cb

帧格式

| 字段     | 字节数 | 说明                                          |
| -------- | ------ | --------------------------------------------- |
| 帧头     | 2      | 固定为 0x55aa                                 |
| 版本     | 1      | 升级扩展用                                    |
| 命令字   | 1      | 具体帧类型                                    |
| 数据长度 | 2      | 大端                                          |
| 数据     | N      | 实体数据                                      |
| 校验和   | 1      | 从帧头开始，按字节求和，得出的结果对 256 求余 |

#### RPC 命令

命令字为 0xFE

每个 RPC 消息为一个数据包

### RPC over Tuya DataPoint

主要用于 APP 端或云端和涂鸦设备之间通信

数据包长度一般不超过 255 字节

采用 PDID 为 232 的自定义数据点

DataPoint 请参考相关的涂鸦开发者文档

> https://developer.tuya.com/cn/docs/iot/tuya-cloud-universal-serial-port-access-protocol?id=K9hhi0xxtn9cb

| 数据段 | 字节数 | 说明                                  |
| ------ | ------ | ------------------------------------- |
| dpid   | 1      | datapoint 序号, 232 表示 RPC 消息     |
| type   | 1      | 值为 0x03，表示 String 类型数据       |
| len    | 2      | 长度对应 value 的字节数               |
| value  | N      | JSON 字符串 |


0x03	String	N	对应于具体字符串

#### 命令下发

“命令下发”可含多个datapoint“状态数据单元”

“命令下发”为异步处理协议，通常下发数据解析完成后，MCU会根据datapoint数据执行对应功能，若datapoint状态发生改变，MCU还需使用状态上报命令

模组发送：

| 字段     | 字节数 | 说明                                          |
| -------- | ------ | --------------------------------------------- |
| 帧头     | 2      | 0x55aa                                        |
| 版本     | 1      | 0x00                                          |
| 命令字   | 1      | 0x06                                          |
| 数据长度 | 2      | 取决于“命令数据单元”类型以及个数              |
| 数据     | N      | “状态数据单元”组                              |
| 校验和   | 1      | 从帧头开始，按字节求和，得出的结果对 256 求余 |

#### 状态上报

MCU 发送：

| 字段     | 字节数 | 说明                                          |
| -------- | ------ | --------------------------------------------- |
| 帧头     | 2      | 0x55aa                                        |
| 版本     | 1      | 0x03                                          |
| 命令字   | 1      | 0x07                                          |
| 数据长度 | 2      | 取决于“状态数据单元”类型以及个数              |
| 数据     | N      | “状态数据单元”组                              |
| 校验和   | 1      | 从帧头开始，按字节求和，得出的结果对 256 求余 |

### RPC over UDP 

主要用于局域网内设备之间通信

数据包长度一般不超过 1400 字节

服务端在 8805 UDP 端口侦听

每个 RPC 消息为一个数据包

## 安全考虑

在开放的网络传输时需要考虑加密和认证

## 内置服务

下面一个常用的 RPC 服务接口定义

### Wi-Fi

#### wifi.scan 

```js
function wifi.scan(): { ssid: string, rssi: number }[];
```

#### wifi.connect

```js
function wifi.connect({ ssid: string, psk: string }): void;
```

#### wifi.disconnect

```js
function wifi.disconnect(): void;
```

#### wifi.status

```js
function wifi.status(): { ssid: string, state: number, signal: number };
```
