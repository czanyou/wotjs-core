/**
 * wotjs 内置网络模块
 */

/**
 * The dns module enables name resolution. For example, use it to look up IP addresses of host names.
 */
declare module '@tjs/dns' {
    /** 
     * Limits returned address types to the types of non-loopback addresses configured on the system. 
     * For example, IPv4 addresses are only returned if the current system has at least one IPv4 address configured. 
     */
    const ADDRCONFIG: number;

    /** If the IPv6 family was specified, but no IPv6 addresses were found, then return IPv4 mapped IPv6 addresses. */
    const V4MAPPED: number;

    export interface LookupOptions {
        /** 
         * The record family. Must be 4, 6, or 0. 
         * The value 0 indicates that IPv4 and IPv6 addresses are both returned. 
         * Default: 0. 
         */
        family?: number;

        /** One or more supported getaddrinfo flags. Multiple flags may be passed by bitwise ORing their values. */
        flags?: number;

        /** 
         * When true, the callback returns all resolved addresses in an array. 
         * Otherwise, returns a single address. 
         * Default: false. 
         */
        all?: boolean;
    }

    export interface AddressInfo {
        /** 4 or 6, denoting the family of address or 0 if the address is not an IPv4 or IPv6 address.  */
        family?: number;

        /** A string representation of an IPv4 or IPv6 address. */
        address?: string;

        host?: string;

        port?: number;
    }

    /**
     * Resolves a host name (e.g. 'nodejs.org') into the first found A (IPv4) or AAAA (IPv6) record. 
     * @param hostname 
     * @param options All option properties are optional. If options is an integer, then it must be 4 or 6
     */
    export function lookup(hostname: string, options?: number | LookupOptions): Promise<AddressInfo | AddressInfo[]>
}

declare module '@tjs/fetch' {
    /**
     * 客户端连接
     */
    export interface FetchConnection {
        /** 相关的 Socket */
        readonly socket: any;

        /** 当前连接状态 */
        readonly readyState: number;
    }

    /**
     * 客户端连接池管理器
     */
    export interface FetchManager {
        /** 连接池 */
        readonly connections: Map<number, FetchConnection>;

        /** 关闭并释放所有的资源 */
        close(): void;

        /** 关闭已过期的连接 */
        closeExpiredConnections(): void;

        /** 关闭所有空闲的连接 */
        closeIdleConnections(): void;

        /**
         * 返回指定名称的连接
         * @param host 
         */
        get(host: string): FetchConnection;

        /**
         * 打开指定的连接
         * @param request 
         * @param options 
         */
        open(request: Request, options: RequestInit): FetchConnection;
    }

    /**
     * 关闭并释放相关的资源
     */
    export function close(): void;

    /**
     * 执行 fetch 方法
     * @param input 
     * @param init 
     */
    export function fetch(input: URL | RequestInfo, init: RequestInit): Promise<Response | undefined>;

    /**
     * 返回连接池管理器
     */
    export function getManager(): FetchManager;
}

/**
 * HTTP 1.1 server
 */
declare module '@tjs/http' {

    /**
     * 用来解析 Header 值
     */
    export class HeaderValue {
        /**
         * @param value value;param1=value1;param2=value2
         */
        constructor(value: string);

        readonly value: string;

        readonly params: { [key: string]: string }
    }

    /**
     * 表示服务器收到的请求消息
     */
    export class IncomingMessage {
        constructor(messageInit: any);

        /** A ReadableStream of the body contents. */
        readonly body: ReadableStream;

        /** 
         * Returns a Headers object consisting of the headers associated with request. 
         * Note that headers added in the network layer by the user agent will not be 
         * accounted for in this object, e.g., the "Host" header. 
         */
        readonly headers: Headers;

        /** Returns request's HTTP method, which is "GET" by default. */
        readonly method: string;

        /** Returns the path of request as a string. */
        readonly path: string;

        /** Returns the query parameters of request. */
        readonly query: { [key: string]: any }

        /** Returns the URL of request as a URL. */
        readonly uri: URL;

        /** Returns the URL of request as a string. */
        readonly url: string;

        /** Returns a promise that resolves with an ArrayBuffer representation of the response body. */
        arrayBuffer(): Promise<ArrayBuffer>;

        /** Returns a promise that resolves with a FormData representation of the response body. */
        formData(): Promise<FormData>;

        /** Returns a promise that resolves with a URLSearchParams representation of the response body. */
        form(): Promise<URLSearchParams>;

        /** Returns a promise that resolves with the result of parsing the response body text as JSON. */
        json(): Promise<any>;

        /** Returns a promise that resolves with a text representation of the response body. */
        text(): Promise<string>;

        parseBody(): Promise<ArrayBuffer | FormData | URLSearchParams | string | any>;
    }

    /**
     * 表示服务器返回给客户端的应答消息
     */
    export class ServerResponse {
        /** A ReadableStream of the body contents. */
        readonly body: ArrayBuffer;

        /** Stores a boolean value that declares whether the body has been used in a response yet. */
        readonly bodyUsed: boolean;

        /** The Headers object associated with the response. */
        readonly headers: Headers;

        /** The status code of the response. (This will be 200 for a success). */
        readonly status: number;

        /** The status message corresponding to the status code. (e.g., OK for 200). */
        readonly statusText: string;

        /**
         * 重定向
         * @param status 
         * @param path 
         */
        redirect(status: number, path: string): Promise<void>;

        /**
         * 发送这个应答
         * @param data 
         */
        send(data: object | string | ArrayBuffer | ArrayBufferView): Promise<any>;

        /**
         * 设置状态码和消息
         * @param statusCode 
         * @param statusText 
         */
        setStatus(statusCode: number, statusText?: string): void;

        /**
         * 设置消息内容类型
         * @param type 
         */
        type(type: string): void;

        /**
         * 发送内容
         * @param data 
         */
        write(data: ArrayBuffer | string): Promise<any>;

        /**
         * 发送消息头
         */
        writeHead(): Promise<any>;

        /**
         * 结束这个消息
         */
        end(): Promise<any>;
    }

    /**
     * HTTP 服务器选项
     */
    export interface ServerOptions {
        /** 侦听端口 */
        port?: number;

        /** 侦听地址 */
        host?: string;

        backlog?: number;
    }

    /**
     * 代表一个 HTTP 服务器
     */
    export class Server extends EventTarget {
        /**
         * 关闭服务
         */
        close(): void;

        /**
         * 开始服务
         */
        start(): Promise<void>;

        /**
         * 发生错误
         */
        onerror?(error: Error): void;
    }

    /**
     * HTTP 请求事件侦听器
     */
    export type RequestListener = (request: IncomingMessage, response: ServerResponse) => Promise<any>;

    /**
     * 创建一个 HTTP 服务器
     * @param options 
     * @param requestListener 
     */
    export function createServer(options: ServerOptions, requestListener: RequestListener): Server;
}

/**
 * JSON-RPC 2.0 client and server
 * 
 * Let your client and server talk over function calls under JSON-RPC 2.0
 */
declare module '@tjs/jsonrpc' {

    // jsonrpc

    /**
     * JSON-RPC 错误
     */
    export interface JsonrpcError {
        /** 错误码 */
        code?: number;

        /** 错误消息 */
        message?: string;

        /** 详细数据 */
        data?: any;
    }

    /**
     * JSON-RPC 请求
     */
    export interface JsonrpcRequest {
        /** 请求 ID */
        id?: number;

        /** 版本号 */
        jsonrpc?: string;

        /** 方法 */
        method?: string;

        /** 请求参数 */
        params?: any[] | { [key: string]: any };
    }

    /**
     * JSON-RPC 应答
     */
    export interface JsonrpcResponse {
        /** 请求 ID */
        id?: number;

        /** 版本号 */
        jsonrpc?: string;

        /** 执行结果 */
        result?: any;

        /** 错误信息 */
        error?: JsonrpcError;
    }

    /**
     * JSON-RPC 事件
     */
    export interface JsonrpcEvent extends Event {
        /** 状态 */
        state?: number;
    }

    /** JSON-RPC 请求处理函数 */
    export type JsonrpcHandler = (...args: any) => Promise<any>;
    export type JsonrpcHandlerMap = { [key: string]: JsonrpcHandler };

    export interface JsonrpcServerOptions {
        port?: number;
        host?: string;
        path?: string;
    }

    /**
     * JSON-RPC 服务端
     */
    export class JsonrpcServer extends EventTarget {
        constructor(options: JsonrpcServerOptions);

        /** 关闭这个服务 */
        close(): void;

        /**
         * 暴露本地方法
         * @param name 暴露的方法名
         * @param handler 要暴露的方法，当 handler 是一个 object 时，可以通过 `$name.$key` 名称来调用相应的子命令
         */
        expose(name: string, handler: JsonrpcHandler | JsonrpcHandlerMap): void;

        /**
         * 发送通知消息
         * @param id 客户端 ID
         * @param method 方法名
         * @param params 参数
         */
        notify(id: string, method: string, params: any): Promise<void>;

        /** 打开服务器 */
        start(): Promise<void>;

        /** 当服务器关闭 */
        onclose?(): void;

        /** 当发生错误 */
        onerror?(error?: Error): void;
    }

    /**
     * JSON-RPC 客户端
     */
    export class JsonrpcClient extends EventTarget {
        /**
         * @param name 
         */
        constructor(name: string);

        /**
         * 
         */
        connected: Promise<void> | undefined;

        /** 连接状态 */
        readyState: number;

        /**
         * 远程过程调用
         * @param name 
         * @param params 
         * @param timeout 
         */
        call(name: string, params?: any[] | { [key: string]: any }, timeout?: number): Promise<any>;

        /** 关闭这个客户端，后续不能再发送请求消息 */
        close(): void;

        /** 开始连接 */
        connect(): Promise<void>;

        /**
         * 暴露本地方法
         * @param name 方法名
         * @param handler 处理函数
         */
        expose(name: string, handler: Function | object): void;

        /**
         * 封装一个方法
         * @param name 
         */
        method(name: string): Function;

        /** 重连 */
        reconnect(): Promise<void>;

        /** 当连接关闭 */
        onclose?(event: Event): void;

        /** 当连接打开 */
        onopen?(event: Event): void;

        /** 正在连接 */
        static CONNECTING: number;

        /** 已连接 */
        static OPEN: number;

        /** 正在关闭 */
        static CLOSING: number;

        /** 已关闭 */
        static CLOSED: number;
    }

    /**
     * JSON-RPC 客户端连接池管理器
     */
    export interface JsonrpcManager {
        /** 客户端连接池 */
        readonly connections: Map<string, JsonrpcClient>;

        /** 是否打印调试信息 */
        debug: boolean;

        /**
         * 关闭并释放所有的资源
         */
        close(): void;

        /**
         * 关闭已过期的连接
         */
        closeExpiredConnections(): void;

        /**
         * 返回指定的名称的连接
         * @param name 
         */
        get(name: string): JsonrpcClient;

        /**
         * 打开指定名称的连接
         * @param name 
         */
        open(name: string): JsonrpcClient;
    }

    /** 
     * 调用远程方法
     * @param name 服务名
     * @param method 方法名
     * @param args 参数列表
     * @returns
     */
    export function call(name: string, method: string, ...args: any): Promise<any>;

    /**
     * 关闭连接池中的所有客户端并释放相关的资源
     */
    export function close(): void;

    /**
     * 创建一个客户端
     * @param name 名称，TCP: 'tcp://$address:$port', Pipe: 'name'
     */
    export function connect(name: string): JsonrpcClient;
    export function connect(port: number, host?: string): JsonrpcClient;

    /**
     * 创建一个服务端
     * @param path 名称，TCP: 'tcp://$address:$port', Pipe: 'name'
     * @param handlers 
     */
    export function createServer(path: string, handlers: JsonrpcHandlerMap): JsonrpcServer;
    export function createServer(port: number, host: string, handlers: JsonrpcHandlerMap): JsonrpcServer;
    export function createServer(options: JsonrpcServerOptions, handlers: JsonrpcHandlerMap): JsonrpcServer;

    /**
     * 返回指定的错误
     * @param code 错误码
     * @param message 错误消息
     */
    export function error(code: number, message: string): JsonrpcError;

    /**
     * 返回连接池管理器
     * - 连接池用来管理客户端连接，实现连接复用等
     */
    export function getManager(): JsonrpcManager;

    /**
     * 创建一个代理器
     * @param name 名称，TCP: 'tcp://$address:$port', Pipe: 'name'
     */
    export function proxy(name: string, options?: any): { [key: string]: Function };
}

/**
 * A library for the MQTT protocol
 */
declare module '@tjs/mqtt' {
    export interface MQTTClientOptions {
        /** Client ID */
        clientId?: string;

        /** default 1000 milliseconds, interval between two reconnections. Disable auto reconnect by setting to 0. */
        reconnectPeriod?: number;

        /** default 30 * 1000 milliseconds, time to wait before a CONNACK is received */
        connectTimeout?: number;

        /** default 60 seconds, set to 0 to disable */
        keepalive?: number;

        /** set to false to receive QoS 1 and 2 messages while offline */
        clean?: boolean;

        port?: number;

        host?: string;

        username?: string;

        password?: string;

        secure?: boolean;

        reschedulePings?: boolean;
    }

    export interface MQTTPublishOptions {
        topic?: string,
        qos?: number
    }

    export interface MQTTSubscribeOptions {

    }

    export interface MQTTRequest {

    }

    /**
     * 消息缓存
     */
    export interface MQTTStore {
        /** 清除所有缓存的消息 */
        clear(): void;

        /** 弹出一个缓存的消息 */
        pop(): MQTTRequest | undefined;

        /** 缓存指定的消息 */
        put(packet: MQTTRequest): void;

        /** 返回缓存的消息数量 */
        size(): number;
    }

    /**
     * The MQTTClient class wraps a client connection to an MQTT broker over an arbitrary transport method 
     */
    export class MQTTClient extends EventTarget {
        static readonly CONNECTING: number;
        static readonly OPEN: number;
        static readonly CLOSING: number;
        static readonly CLOSED: number;
        static readonly FAILED: number;

        /**
         * 指出 TLS 是否认证成功
         */
        readonly authorized: boolean;

        /**
         * TLS 认证错误信息
         */
        readonly authorizationError: any;

        /**
         * 应用程序可以能过这个 promise 来侦听是否成功连接到服务器
         * A promise fulfilled when the associated MQTT Client gets established, 
         * or rejected if the establishment process failed.
         */
        readonly ready: Promise<void> | undefined;

        /** Returns the state of the MQTTClient object's connection. It can have the values described below. */
        readonly readyState: number;

        /** 累记重连尝试次数，每次连接成功后会置 0。 */
        readonly retryCount: number;

        /** Returns the URL that was used to establish the MQTTClient connection. */
        readonly url: string;

        readonly store: MQTTStore | undefined;

        /**
         * Close the client, accepts the following options:
         */
        close(): Promise<void>;

        getStats(): { retryCount: number };

        /**
         * Handle messages with backpressure support, one at a time. 
         * Override at will, but always call callback, or the client will hang.
         * @param message 
         */
        handleMessage(message: any): void;

        /**
         * 
         * @param url 
         * @param options 
         */
        open(url?: string, options?: MQTTClientOptions): void;

        /**
         * Publish a message to a topic
         * @param topic  is the topic to publish to
         * @param payload  is the message to publish
         * @param options is the options to publish with
         */
        publish(topic: string, payload: string | ArrayBuffer, options?: MQTTPublishOptions): Promise<any>;

        /**
         * Subscribe to a topic or topics
         * @param topic is a String topic to subscribe to or an Array of topics to subscribe to.
         * @param options 
         */
        subscribe(topic: string, options?: MQTTSubscribeOptions): Promise<any>;

        /**
         * Unsubscribe from a topic or topics
         * @param topic is a String topic or an array of topics to unsubscribe from
         * @param options 
         */
        unsubscribe(topic: string, options?: MQTTSubscribeOptions): Promise<any>;

        /** Emitted after a disconnection. */
        onclose?(event: Event): void;

        /** 
         * Emitted on successful (re)connection (i.e. connack rc=0). 
         * @param event.connack
         */
        onconnect?(event: Event): void;

        /** Emitted after receiving disconnect packet from broker. MQTT 5.0 feature. */
        ondisconnect?(event: Event): void;

        /** Emitted when the client cannot connect (i.e. connack rc != 0) or when a parsing error occurs. */
        onerror?(event: ErrorEvent): void;

        /**
         * Emitted when the client sends any packet. 
         * This includes .published() packets as well as packets used by MQTT for managing subscriptions and connections
         * @param event.data
         */
        onmessage?(event: MessageEvent): void;

        /** Emitted when the client goes offline. */
        onoffline?(event: Event): void;

        /** Emitted after opened. */
        onopen?(event: Event): void;

        /** 
         * Emitted when the client receives any packet.  
         * @param event.packet
         */
        onpacketsend?(event: Event): void;

        /** 
         * Emitted when the client receives any packet. 
         * @param event.packet
         */
        onpacketreceive?(event: Event): void;
    }

    /**
     * Connects to the broker specified by the given url and options and returns a Client.
     * @param url 
     * @param options 
     */
    export function connect(url: string | URL, options?: MQTTClientOptions): MQTTClient;

    /**
     * Connects to the broker specified by the given url and options and returns a Client.
     * @param options 
     */
    export function connect(options?: MQTTClientOptions): MQTTClient;
}

/**
 * The net module provides an asynchronous network API for creating stream-based 
 * TCP or IPC servers (net.createServer()) and clients (net.connect()).
 */
declare module '@tjs/net' {
    interface ConnectionEvent extends Event {
        connection: Socket
    }

    interface LookupEvent extends Event {
        address: SocketAddress
    }

    interface UDPMessageEvent extends MessageEvent {
        data: any;
        address: SocketAddress
    }

    interface ConnectOptions {
        /** 本地 Pipe 管道名称 */
        path?: string;

        /** 主机地址 */
        host?: string;

        /** 端口 */
        port?: number;
    }

    /**
     * This class is an abstraction of a TCP socket or a streaming IPC endpoint
     */
    export class Socket extends EventTarget {
        /**
         * Socket has been created. The connection is not yet open.
         */
        static readonly CONNECTING: number;

        /**
         * The connection is open and ready to communicate.
         */
        static readonly OPEN: number;

        /**
         * The connection is in the process of closing.
         */
        static readonly CLOSING: number;

        /**
         * The connection is closed or couldn't be opened.
         */
        static readonly CLOSED: number;

        /** The amount of received bytes. */
        bytesRead: number;

        /** The amount of bytes sent. */
        bytesWritten: number;

        /**
         * 表示是否已连接的 promise
         */
        connected: Promise<void> | undefined;

        /**
         * This property represents the state of the connection as a number.
         */
        readyState: number;

        /**
         * The socket timeout in milliseconds as set by socket.setTimeout(). 
         * It is undefined if a timeout has not been set.
         */
        timeout: number;

        /**
         * Initiate a connection on a given socket.
         * @param port 
         * @param host 默认为 `127.0.0.1`
         */
        connect(port: number, host?: string): Promise<void>;

        /**
         * Initiate a connection on a given socket.
         * @param path 
         */
        connect(path: string): Promise<void>;

        /**
         * Initiate a connection on a given socket.
         * @param options 
         */
        connect(options: ConnectOptions): Promise<void>;

        /**
         * Ensures that no more I/O activity happens on this socket. 
         * Destroys the stream and closes the connection.
         */
        close(): void;

        /**
         * Returns the bound address, the address family name and port of the 
         * socket as reported by the operating system: { port: 12346, family: 'IPv4', address: '127.0.0.1' }
         */
        localAddress(): SocketAddress;

        /**
         * Returns an object containing the address, family, and port of the remote endpoint. 
         */
        remoteAddress(): SocketAddress;

        /**
         * Make the connection block the event loop from finishing.
         * Note: the connection blocks the event loop from finishing by default. 
         * This method is only meaningful after .unref() is called.
         */
        ref(): void;

        /**
         * Enable/disable keep-alive functionality, and optionally set the initial 
         * delay before the first keepalive probe is sent on an idle socket.
         * @param keepAlive 
         * @param timeout 
         */
        setKeepAlive(keepAlive: boolean, timeout: number): void;

        /**
         * Enable/disable the use of Nagle's algorithm.
         * @param noDelay 
         */
        setNoDelay(noDelay: boolean): void;

        /**
         * Sets the socket to timeout after timeout milliseconds of inactivity on the socket. 
         * By default net.Socket do not have a timeout.
         * @param timeout 
         */
        setTimeout(timeout: number): void;

        /**
         * Half-closes the socket. i.e., it sends a FIN packet. 
         * It is possible the server will still send some data.
         */
        shutdown(): Promise<void>;

        /**
         * Make the connection not block the event loop from finishing.
         */
        unref(): void;

        /**
         * Sends data on the socket. 
         * The second parameter specifies the encoding in the case of a string. 
         * It defaults to UTF8 encoding.
         * @param data 
         * @param encoding 
         */
        write(data: string | ArrayBuffer, encoding?: string): Promise<void>;

        /**
         * Emitted once the socket is fully closed. 
         * The argument hadError is a boolean which says if the socket was closed due to a transmission error.
         * @param event 
         */
        onclose?(event: Event): void;

        /**
         * Emitted when a socket connection is successfully established. 
         * - See net.connect().
         * @param event 
         */
        onconnect?(event: Event): void;

        /**
         * Emitted when an error occurs. 
         * The 'close' event will be called directly following this event.
         * @param event 
         */
        onerror?(event: ErrorEvent): void;

        /**
         * Emitted after resolving the host name but before connecting. 
         * - Not applicable to Unix sockets.
         * @param event 
         */
        onlookup?(event: LookupEvent): void;

        /**
         * Emitted when data is received. The argument data will be a Buffer or String. 
         * - Encoding of data is set by socket.setEncoding().
         * @param event 
         */
        onmessage?(event: MessageEvent): void;

        /**
         * Emitted when a socket is ready to be used.
         * - Triggered immediately after 'connect'.
         * @param event 
         */
        onopen?(event: Event): void;
    }

    /**
     * This class is used to create a TCP or IPC server.
     */
    export class Server extends EventTarget {
        /**
         * Indicates whether or not the server is listening for connections.
         */
        readonly listening: boolean;

        /**
         * Returns the bound address
         */
        address(): SocketAddress;

        /**
         * Stops the server from accepting new connections and keeps existing connections. 
         * @param error 
         */
        close(): void;

        /**
         * Start a server listening for connections. A net.Server can be a TCP 
         * or an IPC server depending on what it listens to.
         * @param path Path the server should listen to.
         * @param options 
         * @param backlog 
         */
        listen(path: string, backlog?: number): void;
        listen(options: SocketAddress, backlog?: number): void;

        /**
         * Emitted when the server closes. If connections exist, this event is 
         * not emitted until all connections are ended.
         * @param event 
         */
        onclose?(event: Event): void;

        /**
         * Emitted when a new connection is made. socket is an instance of net.Socket.
         * @param event 
         */
        onconnection?(event: ConnectionEvent): void;

        /**
         * Emitted when an error occurs. Unlike net.Socket, the 'close' event will not 
         * be emitted directly following this event unless server.close() is manually called. 
         * @param event 
         */
        onerror?(event: ErrorEvent): void;

        /**
         * Emitted when the server has been bound after calling server.listen().
         * @param event 
         */
        onlistening?(event: Event): void;
    }

    /**
     * This class is an abstraction of a UDP socket
     */
    export class UDPSocket extends EventTarget {
        /**
         * Returns the bound address, the address family name and port of the 
         * socket as reported by the operating system: { port: 12346, family: 'IPv4', address: '127.0.0.1' }
         */
        address(): SocketAddress;

        bind(address: SocketAddress, flags?: number): void;

        bind(port: number, host?: string, flags?: number): void;

        /**
         * Ensures that no more I/O activity happens on this socket. 
         */
        close(): Promise<void>;

        connect(address: SocketAddress): void;

        disconnect(): void;

        /**
         * Returns an object containing the address, family, and port of the remote endpoint. 
         */
        remoteAddress(): SocketAddress;

        /**
         * Make the connection block the event loop from finishing.
         * Note: the connection blocks the event loop from finishing by default. 
         * This method is only meaningful after .unref() is called.
         */
        ref(): void;

        /**
         * Sends data on the socket. 
         * The second parameter specifies the encoding in the case of a string. 
         * It defaults to UTF8 encoding.
         * @param data 
         * @param encoding 
         */
        send(data: string | ArrayBuffer, address?: SocketAddress): Promise<void>;

        /**
         * Make the connection not block the event loop from finishing.
         */
        unref(): void;

        onclose(event: Event): void;
        onerror(event: ErrorEvent): void;
        onmessage(event: UDPMessageEvent): void;
    }

    export interface SocketAddress {
        /** 
         * The network address as either an IPv4 or IPv6 string. 
         * Default: '127.0.0.1' if family is 'ipv4'; '::' if family is 'ipv6'. 
         */
        address?: string,

        /**
         * An IP port.
         */
        port?: number,

        /**
         * One of either '4(ipv4)' or '6(ipv6)'. Default: '4(ipv4)'.
         */
        family?: number
    }

    /**
     * Initiate a TCP connection on the given socket.
     * @param port Port the client should connect to.
     * @param host Host the client should connect to.
     */
    export function connect(port: number, host: string): Socket;

    /**
     * Initiate an IPC connection on the given socket.
     * @param path ath the client should connect to. 
     */
    export function connect(path: string): Socket;

    /**
     * Initiate a TCP connection on the given socket.
     * @param options 
     */
    export function connect(options: ConnectOptions): Socket;

    export interface ServerOptions { }

    /**
     * Creates a new TCP or IPC server.
     * @param options 
     */
    export function createServer(options?: ServerOptions): Server;

    export interface SocketOptions { }

    /**
     * Create a new UDP socket
     * @param options 
     */
    export function createSocket(options?: SocketOptions): UDPSocket;
}

/**
 * The tls module provides an implementation of the Transport Layer Security (TLS) 
 * and Secure Socket Layer (SSL) protocols that is built on top of mbedTLS.
 */
declare module '@tjs/tls' {
    import { SocketAddress } from '@tjs/net';

    export const rootCertificates: string[];

    interface LookupEvent extends Event {
        address: SocketAddress
    }

    export interface ConnectOptions {
        isServer: boolean,
        server: Server,
        requestCert: boolean,
        rejectUnauthorized: boolean,
    }

    export class TLSSocket extends EventTarget {
        static readonly CONNECTING: number;
        static readonly OPEN: number;
        static readonly CLOSING: number;
        static readonly CLOSED: number;

        /**
         * Returns the reason why the peer's certificate was not been verified. 
         * This property is set only when tlsSocket.authorized === false.
         */
        readonly authorizationError: any;

        /** 
         * This property is true if the peer certificate was signed by one of 
         * the CAs specified when creating the tls.TLSSocket instance, otherwise false. 
         */
        readonly authorized: boolean;

        /** The amount of received bytes. */
        readonly bytesRead: number;

        /** The amount of bytes sent. */
        readonly bytesWritten: number;

        /**
         * 
         */
        connected: Promise<void> | undefined;

        /**
         * This property represents the state of the connection as a string.
         */
        readonly readyState: number;

        /**
         * The socket timeout in milliseconds as set by socket.setTimeout(). 
         * It is undefined if a timeout has not been set.
         */
        readonly timeout: number;

        /**
         * Initiate a connection on a given socket.
         * @param port 
         * @param host 
         */
        connect(port: number, host?: string): void;

        /**
         * Initiate a connection on a given socket.
         * @param path 
         */
        connect(path: string): void;

        /**
         * Initiate a connection on a given socket.
         * @param options 
         */
        connect(options: ConnectOptions): void;

        /**
         * Ensures that no more I/O activity happens on this socket. 
         * Destroys the stream and closes the connection.
         */
        close(): Promise<void>;

        /**
         * Returns the bound address, the address family name and port of the 
         * socket as reported by the operating system: { port: 12346, family: 'IPv4', address: '127.0.0.1' }
         */
        localAddress(): SocketAddress;

        /**
         * Returns an object containing the address, family, and port of the remote endpoint. 
         */
        remoteAddress(): SocketAddress;

        /**
         * Make the connection block the event loop from finishing.
         * Note: the connection blocks the event loop from finishing by default. 
         * This method is only meaningful after .unref() is called.
         */
        ref(): void;

        /**
         * Half-closes the socket. i.e., it sends a FIN packet. 
         * It is possible the server will still send some data.
         */
        shutdown(): void;

        /**
         * Make the connection not block the event loop from finishing.
         */
        unref(): void;

        /**
         * Sends data on the socket. 
         * The second parameter specifies the encoding in the case of a string. 
         * It defaults to UTF8 encoding.
         * @param data 
         * @param encoding 
         */
        write(data: string | ArrayBuffer, encoding?: string): Promise<void>;

        /**
         * Emitted once the socket is fully closed. 
         * The argument hadError is a boolean which says if the socket was closed due to a transmission error.
         * @param event 
         */
        onclose(event: Event): void;

        /**
         * Emitted when a socket connection is successfully established. 
         * - See net.connect().
         * @param event 
         */
        onconnect(event: Event): void;

        /**
         * Emitted when an error occurs. 
         * The 'close' event will be called directly following this event.
         * @param event 
         */
        onerror(event: ErrorEvent): void;

        /**
         * Emitted after resolving the host name but before connecting. 
         * - Not applicable to Unix sockets.
         * @param event 
         */
        onlookup(event: LookupEvent): void;

        /**
         * Emitted when data is received. The argument data will be a Buffer or String. 
         * - Encoding of data is set by socket.setEncoding().
         * @param event 
         */
        onmessage(event: MessageEvent): void;

        /**
         * Emitted when a socket is ready to be used.
         * - Triggered immediately after 'connect'.
         * @param event 
         */
        onopen(event: Event): void;
    }

    /**
     * Accepts encrypted connections using TLS or SSL.
     * - 暂时没有实现
     */
    export class Server extends EventTarget {
        accept(): Promise<TLSSocket>;
        address(): SocketAddress;
        bind(options: ServerOptions): void;
        close(): Promise<void>;
        listen(backlog?: number): void;

        onclose?(event: Event): void;
        onconnection?(event: Event): void;
        onerror?(event: ErrorEvent): void;
        onlistening?(event: Event): void;
    }

    /**
     * - 暂时没有实现
     */
    export class DTLSSocket extends EventTarget {
        /**
         * Returns the bound address, the address family name, and port of the
         * underlying socket as reported by the operating system: 
         * { port: 12346, family: 'IPv4', address: '127.0.0.1' }.
         */
        address(): SocketAddress;
        bind(port: number, host?: string): void;
        close(): Promise<void>;
        connect(port: number, host?: string): void;
        write(data: string | ArrayBuffer): void;

        onclose?(event: Event): void;
        onerror?(event: ErrorEvent): void;
        onmessage?(event: MessageEvent): void;
    }

    export interface ServerOptions { }

    export interface DTLSSocketOptions { }

    /**
     * Create a TLS connection.
     * @param options 
     */
    export function connect(options: ConnectOptions): TLSSocket;

    /**
     * Same as tls.connect() except that path can be provided as an argument instead of an option.
     * @param path Default value for options.path.
     */
    export function connect(path: string): TLSSocket;

    /**
     * Same as tls.connect() except that port and host can be provided as arguments instead of options.
     * @param port Default value for options.port.
     * @param host Default value for options.host.
     */
    export function connect(port: number, host: string): TLSSocket;

    /**
     * Creates a new tls.Server
     * - 暂时没有实现
     * @param options 
     */
    export function createServer(options: ServerOptions): Server;

    /**
     * Creates a new tls.DTLSSocket
     * - 暂时没有实现
     * @param options 
     */
    export function createSocket(options: DTLSSocketOptions): DTLSSocket;
}
