// @ts-check
/// <reference path ="../../types/index.d.ts" />
/// <reference path ="./index.d.ts" />
import * as native from '@tjs/native';
import * as dns from '@tjs/dns';
import * as tls from '@tjs/tls';
import { defineEventAttribute } from '@tjs/event-target';

/**
 * @typedef {import('@tjs/mqtt').MQTTClient} BaseClient
 * @typedef {import('@tjs/mqtt').MQTTClientOptions} MQTTClientOptions
 * @typedef {import('@tjs/mqtt').MQTTPublishOptions} MQTTPublishOptions
 * @typedef {(error?:Error, result?:any) => void} PromiseCallback
 */

const mqtt = native.mqtt;

const TAG = 'mqtt:';

// ////////////////////////////////////////////////////////////
// MQTT Store

export class MQTTStore {
    /**
     * @param {any=} options 
     */
    constructor(options) {
        this._options = { ...options };

        /** @type MQTTRequest[] */
        this._sendQueue = [];
    }

    clear() {
        this._sendQueue.splice(0);
    }

    pop() {
        return this._sendQueue.shift();
    }

    /**
     * @param {MQTTRequest} packet 
     */
    put(packet) {
        const sendQueue = this._sendQueue;
        sendQueue.push(packet);
    }

    size() {
        return this._sendQueue.length;
    }

}

// ////////////////////////////////////////////////////////////
// MQTT Client

export const ERRORS = {
    0: 'OK',
    1: 'Unacceptable protocol version',
    2: 'Identifier rejected',
    3: 'Server unavailable',
    4: 'Bad username or password',
    5: 'Not authorized',
    16: 'No matching subscribers',
    17: 'No subscription existed',
    128: 'Unspecified error',
    129: 'Malformed Packet',
    130: 'Protocol Error',
    131: 'Implementation specific error',
    132: 'Unsupported Protocol Version',
    133: 'Client Identifier not valid',
    134: 'Bad User Name or Password',
    135: 'Not authorized',
    136: 'Server unavailable',
    137: 'Server busy',
    138: 'Banned',
    139: 'Server shutting down',
    140: 'Bad authentication method',
    141: 'Keep Alive timeout',
    142: 'Session taken over',
    143: 'Topic Filter invalid',
    144: 'Topic Name invalid',
    145: 'Packet identifier in use',
    146: 'Packet Identifier not found',
    147: 'Receive Maximum exceeded',
    148: 'Topic Alias invalid',
    149: 'Packet too large',
    150: 'Message rate too high',
    151: 'Quota exceeded',
    152: 'Administrative action',
    153: 'Payload format invalid',
    154: 'Retain not supported',
    155: 'QoS not supported',
    156: 'Use another server',
    157: 'Server moved',
    158: 'Shared Subscriptions not supported',
    159: 'Connection rate exceeded',
    160: 'Maximum connect time',
    161: 'Subscription Identifiers not supported',
    162: 'Wildcard Subscriptions not supported'
};

/**
 * @param {any} value
 * @return {number}
 */
function parseInt(value) {
    if (value == null) {
        return value;

    } else if (typeof value === 'number') {
        return value;

    } else {
        return Number.parseInt(value);
    }
}

/**
 * The MQTTClient class wraps a client connection to an MQTT broker over an arbitrary transport method.
 * @implements BaseClient
 */
export class MQTTClient extends EventTarget {

    /** */
    constructor() {
        super();

        /** @type boolean 指出是否已认证 */
        this.authorized = false;

        /** @type string | undefined */
        this.authorizationError = undefined;

        /** @type number 当前连接状态 */
        this.readyState = MQTTClient.INIT;

        /** @type {MQTTStore=} 用来在断网时缓存 QoS 为 0 的消息 */
        this._cacheStore = undefined;

        /** @type any */
        this._checkTimer = undefined;

        /** @type number 最后一次重连时间 */
        this._lastConnectTime = 0;

        /** @type number 最后一次分配的消息 ID */
        this._lastMessageId = 0;

        /** @type number 最后一次发送 PING 消息的时间 */
        this._lastPingTime = 0;

        /** @type number 最后一次收到 PONG 消息的时间 */
        this._lastPongTime = 0;

        /** @type {native.mqtt.Parser=} MQTT 消息解析器 */
        this._mqttParser = undefined;

        /** @type MQTTClientOptions */
        this._options = {};

        /** @type Object<string,PromiseCallback> */
        this._outgoingPromises = {};

        this._readyPromise = {
            /** @type {boolean} */
            pending: false,

            /** @type {Promise=} */
            promise: undefined
        };

        /** @type number 连接重试次数 */
        this._retryCount = 0;

        /** @type native.TCP | native.TLS | undefined */
        this._socket = undefined;

        /** @type any */
        this._statInfo = {
            _retryCount: 0
        };

        /** @type {{[key: string]: number}} 记录订阅的主题，重连后可自动重新订阅 */
        this._subscribeTopics = {};

        /** @type string MQTT 服务器地址 */
        this.url = '';

    }

    get [Symbol.toStringTag]() {
        return 'MQTTClient';
    }

    get ready() {
        return this._readyPromise.promise;
    }

    get retryCount() {
        return this._retryCount;
    }

    get store() {
        return this._cacheStore;
    }

    /**
     * Close the client
     */
    async close() {
        // 清除所有 pending 的 Promise
        const promises = this._outgoingPromises;
        for (const key in promises) {
            const callback = promises[key];
            delete promises[key];

            const error = new Error('Client is closed');
            callback(error);
        }

        // parser
        const mqttParser = this._mqttParser;
        if (mqttParser) {
            this._mqttParser = undefined;
            mqttParser.onmessage = undefined;
            mqttParser.reset();
        }

        // 状态
        const readyState = this.readyState;
        if (readyState != MQTTClient.CLOSED) {
            if (readyState == MQTTClient.OPEN) {
                await this.sendDisconnect();
            }

            this.setReadyState(MQTTClient.CLOSED);

            // Emitted when mqtt.MQTTClient#close() is called. 
            const event = new CloseEvent('close', {});
            this.dispatchEvent(event);
        }

        // Clear cache
        const cacheStore = this._cacheStore;
        if (cacheStore) {
            this._cacheStore = undefined;
            cacheStore.clear();
        }

        // 关闭重连定时器
        const checkTimer = this._checkTimer;
        if (checkTimer) {
            clearInterval(checkTimer);
            this._checkTimer = undefined;
        }

        // 关闭 Socket
        setTimeout(() => {
            this._onSocketClose();
        }, 0);

        this.removeAllEventListeners();
    }

    /**
     * 开始连接
     * @returns 
     */
    async connect() {
        const self = this;

        /**
         * @param {string} host 
         * @returns {Promise<dns.AddressInfo|undefined>}
         */
        async function lookup(host) {
            const result = await dns.lookup(host, { family: 4 });
            const address = /** @type dns.AddressInfo */(result);
            if (self.readyState != MQTTClient.CONNECTING) {
                // 如果连接被取消了
                return;
            }

            const event = new Event('lookup');
            // @ts-ignore
            event.address = address;
            self.dispatchEvent(event);
            return address;
        }

        /**
         * 
         * @returns 
         */
        function createSocket() {
            const options = self._options;

            let socket = null;
            if (options.secure) {
                socket = new native.TLS({ cacert: tls.rootCertificates.join('') });

            } else {
                socket = new native.TCP();
            }

            self.setSocket(socket);

            return socket;
        }

        try {
            const options = this._options;
            // console.log(TAG, 'options:', options);

            const host = options.host;
            if (!host) {
                return;
            }

            const readyState = this.readyState;
            if (readyState == MQTTClient.CONNECTING || readyState == MQTTClient.OPEN) {
                return;
            }

            // console.log('connect:', host);
            this._retryCount++;
            this.setReadyState(MQTTClient.CONNECTING);

            // 0. set timeout timer
            // const connectTimeout = options.connectTimeout || 10 * 1000;

            do {
                // 1. lookup
                const address = await lookup(host);
                if (address == null) {
                    break;
                }

                // 2. create socket
                const socket = createSocket();

                // 3. connect
                // console.log('connect:', address);
                address.port = options.port || (options.secure ? 8883 : 1883);
                await socket.connect(address);
                if (this.readyState != MQTTClient.CONNECTING) {
                    break; // 如果连接被取消了
                }

                this.dispatchEvent(new Event('connect'));

                // 4. send connect message
                await this.sendConnect();
                if (this.readyState != MQTTClient.CONNECTING) {
                    break; // 如果连接被取消了
                }

                // 5. connected
                await this._onConnected();

                // ready promise
                this._readyPromise.pending = false;
                this._resolvePromise('ready', undefined);

            } while (false);

        } catch (error) {
            // ready promise
            this._readyPromise.pending = false;
            this._resolvePromise('ready', undefined, error);

            // 5. 连接中发生错误
            // - lookup, socket, timeout
            // console.log('connect: error:', error);
            this._onError(error);
            this._onSocketClose();
            this.setReadyState(MQTTClient.CLOSED);
        }
    }

    /**
     * 
     * @param {ArrayBuffer} buffer 
     */
    decode(buffer) {

    }

    /**
     * 分发收到的 MQTT 消息
     * - 消息解析器解析出消息后会调用这个方法
     * @param {MQTTPacket} packet 
     */
    async dispatchPacket(packet) {
        // console.log('mqtt:', 'message:', message);
        const type = packet.type;

        if (type == mqtt.PINGRESP) {
            this.handlePong(packet);

        } else if (type == mqtt.CONNACK) {
            this.handleConnectAck(packet);

        } else if (type == mqtt.PUBACK) {
            this.handlePublishAck(packet);

        } else if (type == mqtt.SUBACK) {
            this.handleSubscribeAck(packet);

        } else if (type == mqtt.UNSUBACK) {
            this.handleUnsubscribeAck(packet);

        } else if (type == mqtt.PUBLISH) {
            this.handleMessage(packet);
        }
    }

    /**
     * 编码
     * @param {MQTTPacket} options 
     * @returns {ArrayBuffer=}
     */
    encode(options) {
        const type = options?.type;
        switch (type) {
            case mqtt.SUBSCRIBE:
                return mqtt.encodeSubscribe(options.topic || '', options.dup || 0, options.packetId || 0);
        }
    }

    getStats() {
        return this._statInfo;
    }

    /**
     * 处理收到的 Publish 消息
     * @param {MQTTPacket} message 
     */
    handleMessage(message) {
        this.dispatchEvent(new MessageEvent('message', { data: message }));
    }

    /**
     * 收到连接应答消息
     * @param {MQTTPacket} conack 
     */
    async handleConnectAck(conack) {
        // console.log('mqtt:', 'conack:', conack);

        // - 0x01: 不支持的协议版本
        // - 0x02: 不合格的客户端标识符
        // - 0x03: 服务端不可用
        // - 0x04: 无效的用户名或密码
        // - 0x05: 未授权
        const returnCode = conack.returnCode;

        // 如果连接被拒绝
        if (returnCode !== 0) {
            const error = new Error('Connect rejected: ' + returnCode);
            error.code = returnCode || -1;
            this._resolvePromise('connect', conack, error);
            return;
        }

        const now = Date.now();
        this._lastPingTime = now;
        this._lastPongTime = now;

        // 连接成功
        this._resolvePromise('connect', conack);
    }

    /**
     * 收到 Ping 应答消息
     * @param {MQTTPacket} message 
     */
    handlePong(message) {
        this._lastPongTime = Date.now();
    }

    /**
     * 收到 Publish 应答消息
     * @param {MQTTPacket} message 
     */
    handlePublishAck(message) {
        // console.log('mqtt:', '_onPublishAck:', message);
        // @ts-ignore
        const pid = message.packetId || 0;
        this._resolvePromise('publish:' + pid, message);
    }

    /**
     * 收到订阅 ACK 应答消息
     * @param {MQTTPacket} message 
     */
    handleSubscribeAck(message) {
        // console.log(TAG, '_onSubscribeAck:', message);
        const pid = message.packetId || 0;
        this._resolvePromise('subscribe:' + pid, message);
    }

    /**
     * 收到取消订阅 ACK 应答消息
     * @param {MQTTPacket} message 
     */
    handleUnsubscribeAck(message) {
        // console.log(TAG, '_onUnsubscribeAck:', message);
        const pid = message.packetId || 0;
        this._resolvePromise('unsubscribe:' + pid, message);
    }

    /**
     * 开始 MQTT 连接
     * - 定时发生心跳
     * - 断线自动重连
     * - 可通过 close 方法关闭连接并不再自动重连
     * @param {string=} url
     * @param {MQTTClientOptions=} options
     * @returns {void}
     */
    open(url, options) {
        if (this._checkTimer) {
            return;
        }

        this._cacheStore = new MQTTStore();

        if (url) {
            this.setURL(url);
        }

        this.setOptions(options || {});

        this.startParser();
        this.startTimer();

        this.reconnect();
    }

    /**
     * Publish a message to the consumers
     * @param {string} topic  is the topic to publish to
     * @param {string|ArrayBuffer} payload is the message to publish
     * @param {MQTTPublishOptions} options  is the options to publish with
     * @returns {Promise<any>}
     */
    async publish(topic, payload, options) {
        /** @type MQTTRequest */
        const message = { ...options };
        message.topic = topic;
        message.payload = payload;
        message.qos = (message.qos || 0) >>> 0;
        message.pid = this._getNextMessageId();

        if (this.readyState != MQTTClient.OPEN) {
            // 断网时，缓存到队列
            const cacheStore = this._cacheStore;
            if (cacheStore && cacheStore.size() > 100) {
                throw new Error('Request cache store is full.');
            }

            cacheStore?.put(message);
            return true;

        } else {
            return this.sendPublish(message);
        }
    }

    /**
     * Connect again using the same options as connect()
     */
    reconnect() {
        const now = Date.now();
        this._lastConnectTime = now;

        // ready
        const readyPromise = this._readyPromise;
        if (readyPromise.pending == false) {
            const promise = this._createPromise('ready');
            readyPromise.pending = true;
            readyPromise.promise = promise;
        }

        setTimeout(() => {
            this.connect();
        });
    }

    /**
     * 创建一个 Promise
     * @param {string} type `subscribe`, `unsubscribe`, `connect`, `publish`
     * @param {number=} timeout 
     * @returns Promise<any>
     */
    _createPromise(type, timeout) {
        if (!type) {
            return;
        }

        // console.log('mqtt:', '_createPromise:', type, timeout);

        return new Promise((resolve, reject) => {
            /** @type any */
            let timeoutTimer;

            // timeout
            if (timeout && timeout > 0) {
                timeoutTimer = setTimeout(() => {
                    timeoutTimer = null;
                    const error = new Error(type + ' timeout');
                    error.code = 'ETIMEOUT';
                    reject(error);
                }, timeout);
            }

            /** @type PromiseCallback */
            const callback = (err, result) => {
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }

                if (err != null) {
                    reject(err);

                } else {
                    resolve(result);
                }
            };

            // callback
            this._outgoingPromises[type] = callback;
        });
    }

    /**
     * 返回下一个消息 ID
     * @return {number} 1~65535
     */
    _getNextMessageId() {
        this._lastMessageId++;
        const nextMessageId = this._lastMessageId;
        if (this._lastMessageId >= 65536) {
            this._lastMessageId = 1;
        }

        return nextMessageId;
    }

    async _onCheckKeepAlive() {
        const now = Date.now();
        const options = this._options;

        // Keep alive
        const keepAlive = options.keepalive != null ? options.keepalive : 60;
        if (keepAlive > 0) {
            const lastPongTime = this._lastPongTime || 0;
            const lastPingTime = this._lastPingTime || 0;

            // 检查心跳是否超时
            let span = (now - lastPongTime) / 1000;
            if (span > keepAlive) {
                this._onKeepAliveTimeout();
                return;
            }

            // 定时发送心跳
            span = (now - lastPingTime) / 1000;
            if (span > keepAlive / 2) {
                await this.sendPing();
            }
        }
    }

    async _onCheckReconnect() {
        const now = Date.now();
        const options = this._options;

        // 定时重连
        const reconnectPeriod = options.reconnectPeriod != null ? options.reconnectPeriod : 1000;
        const lastConnectTime = this._lastConnectTime || 0;
        if (reconnectPeriod > 0) {
            const span = (now - lastConnectTime);
            // console.log(TAG, span, '>', reconnectPeriod);

            if (span >= reconnectPeriod) {
                this.reconnect();
            }
        }
    }

    /**
     * 每 2 秒调用一次
     */
    async _onCheckTimer() {
        if (this.readyState == MQTTClient.OPEN) {
            await this._onCheckKeepAlive();

        } else if (this.readyState == MQTTClient.CONNECTING) {
            // TODO: 
            // 检查连接超时

        } else {
            this._onCheckReconnect();
        }
    }

    /**
     * 发生网络或消息解析错误
     * - ECONNREFUSED
     * - ECONNRESET
     * - EADDRINUSE
     * - ENOTFOUND
     * @param {Error} error 
     */
    _onError(error) {
        // Emitted when the client cannot connect(i.e.connack rc != 0) or when a parsing error occurs.
        this.dispatchEvent(new ErrorEvent('error', { error }));
    }

    /**
     * 发生保活超时
     */
    _onKeepAliveTimeout() {
        const error = new Error('Keep alive timeout');
        error.code = 'EKEEPALIVE_TIMEOUT';
        this._onError(error);
        this._onSocketClose();
    }

    /**
     * 当网络连接成功
     * - 自动重新订阅
     * - 发送缓存的消息
     */
    async _onConnected() {
        this._retryCount = 0;

        if (this.readyState != MQTTClient.OPEN) {
            this.setReadyState(MQTTClient.OPEN);

            this.dispatchEvent(new MessageEvent('open', {}));
        }

        // 自动重新订阅
        for (const topic in this._subscribeTopics) {
            if (this.readyState == MQTTClient.OPEN) {
                await this.subscribe(topic);
            }
        }

        // 发送缓存的消息
        const cacheStore = this._cacheStore;
        while (this.readyState == MQTTClient.OPEN) {
            const message = cacheStore?.pop();
            if (!message) {
                break;
            }

            await this.sendPublish(message);
        }
    }

    /**
     * 主动或被动关闭相关的 Socket, 并释放相应的资源
     */
    _onSocketClose() {
        const socket = this._socket;
        if (socket) {
            this._socket = undefined;

            socket.onclose = undefined;
            socket.onconnect = undefined;
            socket.onerror = undefined;
            socket.onmessage = undefined;
            socket.onopen = undefined;
            socket.close();
        }

        if (this.readyState == MQTTClient.OPEN) {
            this.setReadyState(MQTTClient.CLOSED);

            // Emitted when the client goes offline.
            this.dispatchEvent(new Event('offline'));

        } else {
            this.setReadyState(MQTTClient.CLOSED);
        }
    }

    /**
     * 处理从网络收到的数据
     * @param {ArrayBuffer} message 
     */
    _onSocketMessage(message) {
        // console.log('onmessage', message);
        this.dispatchEvent(new Event('packetreceive'));

        const mqttParser = this._mqttParser;
        if (mqttParser == null) {
            return;
        }

        mqttParser.execute(message);

        if (mqttParser.offset() > 128 * 1024) {
            mqttParser.compact();
        }

        // 收到的数据包过大，超过 512KB
        const MAX_BUFFER_SIZE = 512 * 1024;
        if (mqttParser.capacity() >= MAX_BUFFER_SIZE) {
            mqttParser.reset();

            const error = new Error('Read buffer is full');
            error.code = 'EBUFFER_IS_FULL';
            this._onError(error);
            this._onSocketClose();
        }
    }

    /**
     * 
     * @param {*} status 
     */
    _onSocketOpen(status) {
        // console.log(TAG, 'onopen', status);
        if (status?.error) {
            this.authorized = false;
            this.authorizationError = status.error;

        } else {
            this.authorized = true;
            this.authorizationError = undefined;
        }
    }

    /**
     * 解决指定的类型的 Promise
     * @param {string} type 
     * @param {any=} result 
     * @param {Error=} error
     */
    _resolvePromise(type, result, error) {
        const callback = this._outgoingPromises[type];
        // console.log('mqtt:', '_resolvePromise:', type, err, result, callback);

        if (callback) {
            delete this._outgoingPromises[type];
            callback(error, result);
        }
    }

    /**
     * 发送 Connect 消息
     * @returns 
     */
    async sendConnect() {
        const connectTimeout = this._options.connectTimeout || 10 * 1000;

        // console.log(TAG, '_sendConnectMessage:');
        const options = this._options;
        const message = mqtt.encodeConnect(options);
        await this.write(message);

        const connected = this._createPromise('connect', connectTimeout);
        return connected;
    }

    /**
     * 发送 Disconnect 消息
     * Normal disconnect of this Messaging client from its server.
     * @returns 
     */
    async sendDisconnect() {
        try {
            const packet = mqtt.encodeDisconnect();
            await this.write(packet);

        } catch (e) {
            console.log(TAG, '_sendDisconnectMessage:', e);
        }
    }

    async sendPing() {
        // console.log('ping');
        this._lastPingTime = Date.now();
        const packet = mqtt.encodePing();
        await this.write(packet);
    }

    /**
     * 发送 Publish 消息
     * - 如果 QoS 为 1 及以上，将等到 PUBACK 或者超时才返回
     * @param {MQTTRequest} message 要发送的消息
     * @returns {Promise<MQTTPacket|undefined>}
     */
    async sendPublish(message) {
        const topic = message.topic;
        if (!topic) {
            return;
        }

        const payload = message.payload;
        const dup = message.dup || 0;
        const qos = message.qos || 0;
        const retained = message.retained || 0;
        const pid = message.pid || 0;

        const packet = mqtt.encodePublish(topic, payload, dup, qos, retained, pid);
        await this.write(packet);

        if (qos >= 1) {
            const timeout = 2000;
            return this._createPromise('publish:' + pid, timeout);
        }
    }

    /**
     * 设置连接状态
     * @param {number} state 
     */
    setReadyState(state) {
        if (this.readyState != state) {
            // console.log(TAG, 'state changed: ', this.readyState, '->', readyState);
            this.readyState = state;

            this.dispatchEvent(new Event('statechange'));
        }
    }

    /**
     * 设置客户端选项
     * @param {MQTTClientOptions=} params 
     */
    setOptions(params) {
        const options = this._options;

        // host
        if (params?.host != null) {
            options.host = params.host;
        }

        if (!options.host) {
            options.host = '127.0.0.1';
        }

        // port
        if (params?.port != null) {
            options.port = parseInt(params.port);
        }

        const port = options.port;
        if (!port || isNaN(port)) {
            options.port = 1883;
        }

        // clientId
        if (params?.clientId != null) {
            options.clientId = params.clientId;
        }

        if (!options.clientId) {
            options.clientId = 'wotjs_' + Math.random().toString(16).substring(2, 10);
        }

        // reconnectPeriod
        if (params?.reconnectPeriod != null) {
            options.reconnectPeriod = parseInt(params.reconnectPeriod);
        }

        const reconnectPeriod = options.reconnectPeriod;
        if (reconnectPeriod == null || isNaN(reconnectPeriod)) {
            options.reconnectPeriod = 1000;
        }

        // connectTimeout
        if (params?.connectTimeout != null) {
            options.connectTimeout = parseInt(params.connectTimeout);
        }

        const connectTimeout = options.connectTimeout;
        if (connectTimeout == null || isNaN(connectTimeout)) {
            options.connectTimeout = 10 * 1000;
        }

        // keepalive
        if (params?.keepalive != null) {
            options.keepalive = parseInt(params.keepalive);
        }

        const keepalive = options.keepalive;
        if (keepalive == null || isNaN(keepalive)) {
            options.keepalive = 60;
        }

        // reschedulePings
        if (params?.reschedulePings != null) {
            options.reschedulePings = params.reschedulePings;
        }

        if (options.reschedulePings == null) {
            options.reschedulePings = true;
        }

        // clean
        if (params?.clean != null) {
            options.clean = params.clean;
        }

        if (options.clean == null) {
            options.clean = true;
        }

        // username
        if (params?.username != null) {
            options.username = params.username;
        }

        // password
        if (params?.password != null) {
            options.password = params.password;
        }

        // secure
        if (params?.secure != null) {
            options.secure = params.secure;
        }
    }

    /**
     * 当创建了新的 Socket
     * @param {native.TCP|native.TLS} socket 
     */
    setSocket(socket) {
        this._socket = socket;

        socket.onerror = (error) => {
            // console.log(TAG, 'onerror', error);
            this._onError(error);
        };

        socket.onmessage = (message) => {
            // console.log(TAG, 'onmessage', message);
            if (message == null) {
                this._onSocketClose();

            } else {
                this._onSocketMessage(message);
            }
        };

        socket.onopen = (status) => {
            this._onSocketOpen(status);
        };
    }

    /**
     * 设备和解析要连接的 URL
     * @param {string} url 
     */
    setURL(url) {
        this.url = url;

        const uri = new URL(url);
        // console.log('uri:', uri.hostname, uri.host, uri.port);

        const options = this._options;
        options.host = uri.hostname;
        options.port = parseInt(uri.port);
        options.secure = (uri.protocol == 'mqtts:');
    }

    /**
     * 创建 MQTT 消息解析器
     * @returns 
     */
    startParser() {
        if (this._mqttParser) {
            return;
        }

        const mqttParser = new mqtt.Parser();
        mqttParser.onmessage = async (message) => {
            try {
                await this.dispatchPacket(message);

            } catch (e) {
                console.log('mqtt:', 'message:', e);
            }
        };

        this._mqttParser = mqttParser;
    }

    startTimer() {
        const interval = 2;
        this._checkTimer = setInterval(() => {
            this._onCheckTimer();
        }, interval * 1000);
    }

    /**
     * Subscribe for messages
     * @param {string} topic 
     * @param {{dup?: number}} [options] 
     * @returns {Promise<MQTTPacket|undefined>}
     */
    async subscribe(topic, options) {
        if (!topic) {
            return;
        }

        if (this.readyState != MQTTClient.OPEN) {
            this._subscribeTopics[topic] = 1;
            return;
        }

        this._subscribeTopics[topic] = 1;

        const dup = options?.dup || 0;
        const pid = this._getNextMessageId();
        const packet = mqtt.encodeSubscribe(topic, dup, pid);
        // console.log('mqtt:', 'subscribe:', topic);

        await this.write(packet);

        const timeout = 2000;
        const promise = this._createPromise('subscribe:' + pid, timeout);
        return promise;
    }

    /**
     * Unsubscribe for messages
     * @param {string} topic 
     * @param {{dup?: number}} options 
     * @returns {Promise<MQTTPacket|undefined>}
     */
    async unsubscribe(topic, options) {
        if (!topic) {
            return;
        }

        delete this._subscribeTopics[topic];

        if (this.readyState != MQTTClient.OPEN) {
            return;
        }

        const dup = options?.dup || 0;
        const pid = this._getNextMessageId();
        const packet = mqtt.encodeUnsubscribe(topic, dup, pid);

        await this.write(packet);

        const timeout = 2000;
        const promise = this._createPromise('unsubscribe:' + pid, timeout);
        return promise;
    }

    /**
     * 发送指定的消息
     * @param {ArrayBuffer} packet 
     */
    async write(packet) {
        // console.log('_sendMessage', message);
        this.dispatchEvent(new Event('packetsend'));
        await this._socket?.write(packet);
    }
}

/** 初始状态 */
MQTTClient.INIT = -1;

/** 正在连接中 */
MQTTClient.CONNECTING = 0;

/** 已连接 */
MQTTClient.OPEN = 1;

/** 正在关闭连接 */
MQTTClient.CLOSING = 2;

/** 连接已关闭 */
MQTTClient.CLOSED = 3;

/** 连接失败 */
MQTTClient.FAILED = 4;

defineEventAttribute(MQTTClient.prototype, 'close');
defineEventAttribute(MQTTClient.prototype, 'connect');
defineEventAttribute(MQTTClient.prototype, 'error');
defineEventAttribute(MQTTClient.prototype, 'lookup');
defineEventAttribute(MQTTClient.prototype, 'message');
defineEventAttribute(MQTTClient.prototype, 'offline');
defineEventAttribute(MQTTClient.prototype, 'open');
defineEventAttribute(MQTTClient.prototype, 'packetreceive');
defineEventAttribute(MQTTClient.prototype, 'packetsend');

// ////////////////////////////////////////////////////////////
// MQTT

/**
 * Connects to the broker specified by the given url and options and returns a client.
 * @param {string} [url] MQTT url: `mqtt://host:port`
 * @param {object} [options] For all MQTT-related options, see the MQTTClient constructor.
 * @returns {MQTTClient|undefined}
 */
export function connect(url, options) {
    if (typeof url == 'object') {
        options = url;
        url = undefined;
    }

    const client = new MQTTClient();

    client.open(url, options);

    return client;
}
