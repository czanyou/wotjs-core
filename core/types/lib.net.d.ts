
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

declare module '@tjs/http' {
    export type RequestListener = (request: Request, response: Response) => Promise<any>;

    export interface Request {
        readonly method: string;
        readonly url: string;
    }

    export class Headers {
        constructor(init: any);
    }

    export interface RequestConfig {
        params?: {[key: string]: any};
        headers?: {[key: string]: any};
        ondata?(data: ArrayBuffer): void;
        onprogress?(readed: number, total: number): void;
    }

    export interface Response {
        status: number;
        statusText: string;
        data: any;

        write(data: string | ArrayBuffer): Promise<void>;
        end(): Promise<void>;
    }

    export interface ResponseResult {
        status: any;
        headers: any;
        data: any;
    }

    export interface IncomingMessage {
        body: ArrayBuffer;
        headers: any;
        method: string;
        path: string;
        query: {[key: string]: any}
        uri: URL;
        url: string;

        arrayBuffer(): Promise<ArrayBuffer>;
        get(name: string): string;
        json(): Promise<any>;
        text(): Promise<string>;
    }

    export interface ServerResponse {
        body: ArrayBuffer;
        headers: any;
        status: number;
        statusText: string;

        get(name: string): string;
        send(data: object | string | ArrayBuffer | ArrayBufferView): Promise<any>;
        set(name: string, value: string): void;
        setStatus(statusCode: number, statusText?: string): void;
        type(type:string): void;
        write(data: ArrayBuffer): Promise<any>;
        writeHead(): Promise<any>;
    }

    export interface ServerOptions { }

    export interface Server {
        close(): void;
        onerror(): void;
    }

    export class HeaderValue {
        constructor(value: string);

        value: string;
        params: {[key: string]: string}
    }

    export function request(config: RequestConfig): Promise<Response>;
    export function get(url: string | URL, config?: RequestConfig): Promise<Response>;
    export function post(url: string | URL, data: string | object, config?: RequestConfig): Promise<Response>;
    export function del(url: string | URL, config?: RequestConfig): Promise<Response>;
    export function put(url: string | URL, data: string | object, config?: RequestConfig): Promise<Response>;
    export function download(url: string | URL, config?: RequestConfig): Promise<Response>;
    export function upload(url: string | URL, data: any, config?: RequestConfig): Promise<ResponseResult>;
    export function createServer(options: ServerOptions, requestListener: RequestListener): Server;
}

declare module '@tjs/mqtt' {
    export interface MQTTClientOptions {
        /** Client ID */
        clientId?: string;

        /** 1000 milliseconds, interval between two reconnections. Disable auto reconnect by setting to 0. */
        reconnectPeriod?: number;

        /** 30 * 1000 milliseconds, time to wait before a CONNACK is received */
        connectTimeout?: number;

        /** 60 seconds, set to 0 to disable */
        keepalive?: number;

        /** set to false to receive QoS 1 and 2 messages while offline */
        clean?: boolean;
        port?: number;
        host?: string;

        username?: string;

        password?: string;
    }

    export interface MQTTPublishOptions {
        topic: string
    }

    export interface MQTTSubscribeOptions {

    }

    /**
     * The MQTTClient class wraps a client connection to an MQTT broker over an arbitrary transport method 
     */
    export class MQTTClient extends EventTarget {
        static readonly CONNECTING: number;
        static readonly OPEN: number;
        static readonly CLOSING: number;
        static readonly CLOSED: number;

        /** set to true if the client is trying to reconnect to the server. false otherwise. */
        reconnecting: boolean;

        /** Returns the state of the MQTTClient object's connection. It can have the values described below. */
        readonly readyState: number;

        /** Returns the URL that was used to establish the MQTTClient connection. */
        readonly url: string;

        readonly authorized: boolean;

        readonly authorizationError: any;

        /**
         * Initiate a connection
         */
        connect(): Promise<void>;

        /**
         * Close the client, accepts the following options:
         */
        close(code?: number, reason?: string): Promise<void>;

        /** get last message id. This is for sent messages only. */
        getLastMessageId(): number;

        /**
         * Handle messages with backpressure support, one at a time. 
         * Override at will, but always call callback, or the client will hang.
         * @param message 
         */
        handleMessage(message: object): void;

        /**
         * Publish a message to a topic
         * @param topic  is the topic to publish to
         * @param payload  is the message to publish
         * @param options is the options to publish with
         */
        publish(topic: string, payload: string | ArrayBuffer, options?: MQTTPublishOptions): Promise<void>;

        /**
         * Connect again using the same options as connect()
         */
        reconnect(): Promise<void>;

        /**
         * Subscribe to a topic or topics
         * @param topic is a String topic to subscribe to or an Array of topics to subscribe to.
         * @param options 
         */
        subscribe(topic: string, options?: MQTTSubscribeOptions): Promise<void>;

        /**
         * Unsubscribe from a topic or topics
         * @param topic is a String topic or an array of topics to unsubscribe from
         * @param options 
         */
        unsubscribe(topic: string, options?: MQTTSubscribeOptions): Promise<void>;

        /** 
         * Emitted on successful (re)connection (i.e. connack rc=0). 
         * @param event.connack
         */
        onconnect(event: Event): void;

        onopen(event: Event): void;

        /** Emitted when a reconnect starts. */
        onreconnect(event: Event): void;

        /** Emitted after a disconnection. */
        onclose(event: Event): void;

        /** Emitted after receiving disconnect packet from broker. MQTT 5.0 feature. */
        ondisconnect(event: Event): void;

        /** Emitted when the client goes offline. */
        onoffline(event: Event): void;

        /** Emitted when the client cannot connect (i.e. connack rc != 0) or when a parsing error occurs. */
        onerror(event: ErrorEvent): void;

        /** 
         * Emitted when mqtt.Client#end() is called. 
         * If a callback was passed to mqtt.Client#end(), this event is emitted once the callback returns. 
         */
        onend(event: Event): void;

        /**
         * Emitted when the client sends any packet. 
         * This includes .published() packets as well as packets used by MQTT for managing subscriptions and connections
         * @param event.data
         */
        onmessage(event: MessageEvent): void;

        /** 
         * Emitted when the client receives any packet.  
         * @param event.packet
         */
        onpacketsend(event: Event): void;

        /** 
         * Emitted when the client receives any packet. 
         * @param event.packet
         */
        onpacketreceive(event: Event): void;
    }

    /**
     * Connects to the broker specified by the given url and options and returns a Client.
     * @param url 
     * @param options 
     */
    export function connect(url: string | URL, options?: MQTTClientOptions): MQTTClient;
    export function connect(options?: MQTTClientOptions): MQTTClient;
}

declare module '@tjs/net' {
    interface ConnectionEvent extends Event {
        connection: TCPSocket
    }

    interface LookupEvent extends Event {
        address: SocketAddress
    }

    interface UDPMessageEvent extends MessageEvent {
        data: any;
        address: SocketAddress
    }

    export class TCPSocket extends EventTarget {
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
         * If true, socket.connect() was called and has not yet finished. 
         * It will stay true until the socket becomes connected, 
         * then it is set to false and the 'connect' event is emitted.
         */
        connecting: boolean;

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
         * Returns the bound address, the address family name and port of the 
         * socket as reported by the operating system: { port: 12346, family: 'IPv4', address: '127.0.0.1' }
         */
        address(): SocketAddress;

        /**
         * Initiate a connection on a given socket.
         * @param port 
         * @param host 
         */
        connect(port: number, host?: string): Promise<void>;
        connect(path: string): Promise<void>;
        connect(options: object): Promise<void>;

        /**
         * Ensures that no more I/O activity happens on this socket. 
         * Destroys the stream and closes the connection.
         * @param error 
         */
        close(error?: object): Promise<void>;

        /**
         * Half-closes the socket. i.e., it sends a FIN packet. 
         * It is possible the server will still send some data.
         * @param data 
         * @param encoding 
         */
        end(data?: string | ArrayBuffer, encoding?: string): Promise<void>;

        /**
         * Returns an object containing the address, family, and port of the remote endpoint. 
         */
        remoteAddress(): SocketAddress;

        /**
         * Enable/disable the use of Nagle's algorithm.
         * @param noDelay 
         */
        setNoDelay(noDelay: boolean): void;

        /**
         * Enable/disable keep-alive functionality, and optionally set the initial 
         * delay before the first keepalive probe is sent on an idle socket.
         * @param keepAlive 
         * @param timeout 
         */
        setKeepAlive(keepAlive: boolean, timeout: number): void;

        /**
         * Sets the socket to timeout after timeout milliseconds of inactivity on the socket. 
         * By default net.Socket do not have a timeout.
         * @param timeout 
         */
        setTimeout(timeout: number): void;

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
         * - See net.createConnection().
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

        /**
         * Emitted if the socket times out from inactivity. 
         * This is only to notify that the socket has been idle. 
         * The user must manually close the connection.
         * @param event 
         */
        ontimeout(event: Event): void;
    }
    export class TCPServer extends EventTarget {
        /**
         * Returns the bound address
         */
        address(): SocketAddress;

        /**
         * Stops the server from accepting new connections and keeps existing connections. 
         * @param error 
         */
        close(): Promise<void>;

        /**
         * Start a server listening for connections. A net.Server can be a TCP 
         * or an IPC server depending on what it listens to.
         * @param options 
         * @param backlog 
         */
        listen(options: string | SocketAddress, backlog?: number): void;

        /**
         * Emitted when the server closes. If connections exist, this event is 
         * not emitted until all connections are ended.
         * @param event 
         */
        onclose(event: Event): void;

        /**
         * Emitted when a new connection is made. socket is an instance of net.Socket.
         * @param event 
         */
        onconnection(event: ConnectionEvent): void;

        /**
         * Emitted when an error occurs. Unlike net.Socket, the 'close' event will not 
         * be emitted directly following this event unless server.close() is manually called. 
         * @param event 
         */
        onerror(event: ErrorEvent): void;

        /**
         * Emitted when the server has been bound after calling server.listen().
         * @param event 
         */
        onlistening(event: Event): void;
    }

    export class UDPSocket extends EventTarget {
        address(): SocketAddress;
        bind(address: SocketAddress, flags?: number): void;
        bind(port: number, host?: string, flags?: number): void;
        close(): Promise<void>;
        connect(address: SocketAddress): void;
        disconnect(): void;
        remoteAddress(): SocketAddress;
        send(data: string | ArrayBuffer, address?: SocketAddress): Promise<void>;

        onclose(event: Event): void;
        onerror(event: ErrorEvent): void;
        onmessage(event: UDPMessageEvent): void;
    }

    export interface ClientOptions { }
    export interface ServerOptions { }
    export interface SocketOptions { }
    export interface SocketAddress {
        address?: string,
        port?: number,
        family?: number
    }

    export function connect(port: number, host: string): TCPSocket;
    export function connect(path: string): TCPSocket;
    export function connect(options: ClientOptions): TCPSocket;
    export function createConnection(port: number | string | ClientOptions, host: string): TCPSocket;
    export function createServer(options?: ServerOptions): TCPServer;
    export function createSocket(options?: SocketOptions): UDPSocket;
}

declare module '@tjs/tls' {
    export const rootCertificates: string[];

    interface LookupEvent extends Event {
        address: SocketAddress
    }

    export class TLSSocket extends EventTarget {
        static readonly CONNECTING: number;
        static readonly OPEN: number;
        static readonly CLOSING: number;
        static readonly CLOSED: number;

        /** The amount of received bytes. */
        bytesRead: number;

        /** The amount of bytes sent. */
        bytesWritten: number;

        /** 
         * If true, socket.connect() was called and has not yet finished. 
         * It will stay true until the socket becomes connected, 
         * then it is set to false and the 'connect' event is emitted.
         */
        connecting: boolean;

        /**
         * This property represents the state of the connection as a string.
         */
        readyState: number;

        /**
         * The socket timeout in milliseconds as set by socket.setTimeout(). 
         * It is undefined if a timeout has not been set.
         */
        timeout: number;

        /**
         * Returns the bound address, the address family name and port of the 
         * socket as reported by the operating system: { port: 12346, family: 'IPv4', address: '127.0.0.1' }
         */
        address(): SocketAddress;

        /**
         * Initiate a connection on a given socket.
         * @param port 
         * @param host 
         */
        connect(port: number, host?: string): void;
        connect(path: string): void;
        connect(options: object): void;

        /**
         * Ensures that no more I/O activity happens on this socket. 
         * Destroys the stream and closes the connection.
         * @param error 
         */
        close(error?: object): Promise<void>;

        /**
         * Half-closes the socket. i.e., it sends a FIN packet. 
         * It is possible the server will still send some data.
         * @param data 
         * @param encoding 
         */
        end(data: string | ArrayBuffer, encoding?: string): Promise<void>;

        /**
         * Returns an object containing the address, family, and port of the remote endpoint. 
         */
        remoteAddress(): SocketAddress;

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
         * - See net.createConnection().
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

        /**
         * Emitted if the socket times out from inactivity. 
         * This is only to notify that the socket has been idle. 
         * The user must manually close the connection.
         * @param event 
         */
        ontimeout(event: Event): void;
    }
    export class TLSServer extends EventTarget {
        accept(): Promise<TLSSocket>;
        address(): SocketAddress;
        bind(options: TLSServerOptions): void;
        close(): Promise<void>;
        listen(backlog?: number): void;

        onclose(event: Event): void;
        onconnection(event: Event): void;
        onerror(event: ErrorEvent): void;
        onlistening(event: Event): void;
    }

    export class DTLSSocket extends EventTarget {
        address(): SocketAddress;
        connect(port: number, host?: string): void;
        close(): Promise<void>;
        write(data: string | ArrayBuffer): void;
        bind(port: number, host?: string): void;

        onclose(event: Event): void;
        onerror(event: ErrorEvent): void;
        onmessage(event: MessageEvent): void;
    }

    export interface TLSSocketOptions {
        isServer: boolean,
        server: TLSServer,
        requestCert: boolean,
        rejectUnauthorized: boolean,

    }
    export interface TLSServerOptions { }
    export interface DTLSSocketOptions { }
    export interface SocketAddress {
        address: string,
        port: number,
        family: number
    }

    export function connect(port: number | string | TLSSocketOptions, host: string): Promise<TLSSocket>;
    export function createConnection(port: number | string | TLSSocketOptions, host: string): Promise<TLSSocket>;
    export function createServer(options: TLSServerOptions): TLSServer;
    export function createSocket(options: DTLSSocketOptions): DTLSSocket;
}

declare module '@tjs/wot' {
    export type DataSchemaValue = null | boolean | number | string | any[] | object;

    export type ThingDiscovery = any;

    /**
     * Dictionary that represents the constraints for discovering Things as key-value pairs. 
     */
    export interface ThingFilter {
        /**
         * The method field represents the discovery type that should be used in the discovery process. The possible values are defined by the DiscoveryMethod enumeration that can be extended by string values defined by solutions (with no guarantee of interoperability). 
         */
        method?: DiscoveryMethod | string; // default value "any", DOMString
        /**
         * The url field represents additional information for the discovery method, such as the URL of the target entity serving the discovery request, such as a Thing Directory or a Thing.
         */
        url?: string;
        /**
         * The query field represents a query string accepted by the implementation, for instance a SPARQL query. 
         */
        query?: string;
        /**
         * The fragment field represents a template object used for matching against discovered Things.
         */
        fragment?: object;
    }

    /** The DiscoveryMethod enumeration represents the discovery type to be used */
    export enum DiscoveryMethod {
        /** does not restrict */
        "any",
        /** for discovering Things defined in the same Servient */
        "local",
        /** for discovery based on a service provided by a Thing Directory */
        "directory",
        /** for discovering Things in the same/reachable network by using a supported multicast protocol */
        "multicast"
    }

    export interface InteractionOptions {
        formIndex?: number;
        uriVariables?: object;
        skipHandler?: boolean;
    }

    /**
     * WoT provides a unified representation for data exchange between Things, standardized in the Wot Things Description specification.
     * In this version of the API, Thing Descriptions is expected to be a parsed JSON object.
     */
    export type ThingDescription = { [key: string]: any; };


    export type PropertyValueMap = object | { [key: string]: any; };

    export interface InteractionData {
        data?: DataView;
        mediaType?: string;
        encoding?: string;
        lang?: string;
        dataSchema?: DataSchema;
    }

    export type DataSchema = { [key: string]: any; };

    /** 操作处理函数 */
    export type ActionHandler = (params: DataSchemaValue, options?: InteractionOptions) => Promise<DataSchemaValue>;

    /** 事件处理函数 */
    export type EventListenerHandler = () => Promise<DataSchemaValue>;

    /** 事件订阅处理函数 */
    export type EventSubscriptionHandler = (options?: InteractionOptions) => Promise<void>;

    /** 属性处理函数 */
    export type PropertyReadHandler = (options?: InteractionOptions) => Promise<DataSchemaValue>;

    /** 属性处理函数 */
    export type PropertyWriteHandler = (value: DataSchemaValue, options?: InteractionOptions) => Promise<void>;

    /** 错误回调函数 */
    export type ErrorListener = (error: Error) => void;

    /** 交互回调函数 */
    export type InteractionListener = (data: DataSchemaValue) => void;

    export interface Subscription {
        active: boolean;

        /** 停止订阅 */
        stop(options?: InteractionOptions): Promise<void>;
    }

    /**
     * Consumed Web thing
     */
    export interface ConsumedThing extends EventTarget {

        /** 返回事物描述 */
        getThingDescription(): ThingDescription;

        /** 执行指定的名称操作 */
        invokeAction(name: string, params: DataSchemaValue, options?: InteractionOptions): Promise<DataSchemaValue>;

        /** 读取指定名称的属性值 */
        readProperty(name: string, options?: InteractionOptions): Promise<DataSchemaValue>;

        /** 读取所有的属性值 */
        readAllProperties(options?: InteractionOptions): Promise<PropertyValueMap>;

        /** 读取多个指定名称的属性值 */
        readMultipleProperties(names: string[], options?: InteractionOptions): Promise<PropertyValueMap>;

        /** 观察属性 */
        observeProperty(name: string, listner: InteractionListener, onerror?: ErrorListener, options?: InteractionOptions): Promise<Subscription>;

        /** 订阅事件 */
        subscribeEvent(name: string, listner: InteractionListener, onerror?: ErrorListener, options?: InteractionOptions): Promise<Subscription>;

        /** 修改指定名称的属性值 */
        writeProperty(name: string, value: DataSchemaValue, options?: InteractionOptions): Promise<void>;

        /** 修改多个指定名称的属性值 */
        writeMultipleProperties(valueMap: PropertyValueMap, options?: InteractionOptions): Promise<void>;
    }

    /**
     * Exposed Web thing
     */
    export interface ExposedThing extends ConsumedThing {
        actions: object;
        events: object;
        properties: object;
        metadata: any;

        /** 暴露这个 Web thing, 用于被其他应用调用 */
        expose(): Promise<void>;

        /** 销毁这个 Web thing */
        destroy(): Promise<void>;

        /** 发布事件 */
        emitEvent(name: string, data: DataSchemaValue): Promise<void>;

        /** 发布属性状态改变 */
        emitPropertyChange(name: string | string[]): Promise<void>;

        /** 设置 Action 处理函数 */
        setActionHandler(name: string, handler: ActionHandler): Promise<void>;

        /** 设置 Event 事件处理函数 */
        setEventHandler(name: string, handler: EventListenerHandler): Promise<void>;
        setEventSubscribeHandler(name: string, handler: EventSubscriptionHandler): Promise<void>;
        setEventUnsubscribeHandler(name: string, handler: EventSubscriptionHandler): Promise<void>;

        /** 设置属性读取操作处理函数 */
        setPropertyReadHandler(name: string, handler: PropertyReadHandler): Promise<void>;

        /** 设置属性修改操作处理函数 */
        setPropertyWriteHandler(name: string, handler: PropertyWriteHandler): Promise<void>;
    }

    /** 使用指定的 Web Thing */
    export function consume(td: ThingDescription): Promise<ConsumedThing>;

    /** 创建一个 Web Thing */
    export function produce(td: ThingDescription): Promise<ExposedThing>;

    /** 发现 Web Things */
    export function discover(filter?: ThingFilter): Promise<ThingDiscovery>;

    export class Servient extends EventTarget {
        destroy(): Promise<this>;
 
        addThing(thing: ExposedThing): boolean;
        destroyThing(thingId: string): Promise<boolean>;
        getThing(id: string): ExposedThing;
        getThings(): object;
        isConnected(): boolean;

        start(options: any): Promise<this>;
    }

    export function servient(): Servient;
}
