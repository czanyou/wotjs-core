// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import * as dns from '@tjs/dns';
import * as tls from '@tjs/tls';

import { defineEventAttribute, EventTarget } from '@tjs/event-target';

/* global MessageEvent Event ErrorEvent */

const mqtt = native.mqtt;

// ////////////////////////////////////////////////////////////
// MQTT Store

export class Store {
    constructor(options) {
        this._options = options;
    }

    put(packet, callback) {

    }

    del(packet, cb) {

    }

    close(cb) {

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
 * @typedef MQTTClientOptions
 * @property {boolean} secure
 * @property {string} host the address of the messaging server
 * @property {number} port the port number to connect to
 * @property {string} clientId the Messaging client identifier, between 1 and 23 characters in length.
 * @property {string} username Authentication username for this connection.
 * @property {string} password Authentication password for this connection.
 * @property {boolean} clean if true(default) the client and server persistent state is deleted on successful connect.
 * @property {boolean} reschedulePings
 * @property {number} connectTimeout If the connect has not succeeded within this number of seconds, it is deemed to have failed 
 * @property {number} keepalive the server disconnects this client if there is no activity for this number of seconds. 
 * @property {number} reconnectPeriod Sets whether the client will automatically attempt to reconnect to the server if the connection is lost.
 */

/**
 * @typedef MQTTPublishOptions
 * @property {number} qos QoS level
 * @property {number} retained retain flag
 * @property {number} dup  mark as duplicate flag
 * @property {string} topic
 * @property {any} payload
 * @property {number} pid
 */

/**
 * @typedef {{type: number}} MQTTMessage
 */

/**
 * The MQTTClient class wraps a client connection to an MQTT broker over an arbitrary transport method.
 */
export class MQTTClient extends EventTarget {

    /**
     * @param {string} url
     * @param {MQTTClientOptions} options 
     */
    constructor(url, options) {
        super();

        options = Object.assign({}, options);
        if (url) {
            const uri = new URL(url);
            options.host = uri.hostname;

            if (uri.port) {
                options.port = Number.parseInt(uri.port);
            }

            if (uri.protocol == 'mqtts:') {
                options.secure = true;
            }
        }

        this.url = url;
        this.reconnecting = false;
        this.readyState = MQTTClient.CLOSED;
        this.authorized = false;
        this.authorizationError = null;

        this._lastMessageId = 0;
        this._options = options;
        this._parser = new mqtt.Parser();
        this._queue = [];
        this._socket = null;
        this._topics = {};

        if (!options.host) {
            options.host = '127.0.0.1';
        }

        function parseInt(value) {
            if (typeof value == 'number') {
                return value;
            } else {
                return Number.parseInt(value);
            }
        }

        options.port = parseInt(options.port);
        if (!options.port || isNaN(options.port)) {
            options.port = 1883;
        }

        if (!options.clientId) {
            options.clientId = 'wotjs_' + Math.random().toString(16).substr(2, 8);
        }

        const reconnectPeriod = parseInt(options.reconnectPeriod);
        if (reconnectPeriod == null || isNaN(reconnectPeriod)) {
            options.reconnectPeriod = 1000;
        }

        const connectTimeout = parseInt(options.connectTimeout);
        if (connectTimeout == null || isNaN(connectTimeout)) {
            options.connectTimeout = 30 * 1000;
        }

        const keepalive = parseInt(options.keepalive);
        if (keepalive == null || isNaN(keepalive)) {
            options.keepalive = 60;
        }

        if (options.reschedulePings == null) {
            options.reschedulePings = true;
        }

        if (options.clean == null) {
            options.clean = true;
        }

        const self = this;
        this._parser.onMessage = function onMessage(message) {
            self._dispatchMessage(message);
        };
    }

    get [Symbol.toStringTag]() {
        return 'MQTTClient';
    }

    /**
     * Close the client
     * @param {number} [code] 
     * @param {string} [reason ]
     */
    async close(code, reason) {
        if (this.readyState != MQTTClient.CLOSED) {
            this.readyState = MQTTClient.CLOSED;

            await this._sendDisconnectMessage();

            // Emitted when mqtt.MQTTClient#close() is called. 
            const event = new CloseEvent('close', { code, reason });
            this.dispatchEvent(event);
        }

        if (this._mqttTimer) {
            clearInterval(this._mqttTimer);
            this._mqttTimer = null;
        }

        setTimeout(() => {
            if (this._socket) {
                this._socket.close();
                this._socket = null;
            }

            this._onSocketClose();
        }, 0);
    }

    async connect() {
        if (this._socket) {
            console.log('mqtt: socket is not null');
            return;
        }

        try {
            this.readyState = MQTTClient.CONNECTING;
            const options = this._options;

            // lookup
            const address = await dns.lookup(options.host, { family: 4 });
            if (Array.isArray(address)) {
                return;
            }

            const event = new Event('lookup');
            // @ts-ignore
            event.address = address;
            this.dispatchEvent(event);

            // create
            let socket = null;
            if (options.secure) {
                socket = new native.TLS({ cacert: tls.rootCertificates.join('') });
                address.port = options.port || 8883;

            } else {
                socket = new native.TCP();
                address.port = options.port || 1883;
            }

            this._setSocket(socket);
            this.reconnecting = true;

            this._connectTimeoutTimer = setTimeout(() => {
                this._onError('Connect timeout');
                socket.close();
                this.close();

            }, options.connectTimeout);

            // connect
            await socket.connect(address);
            this.dispatchEvent(new Event('connect'));

            await this._sendConnectMessage();

        } catch (error) {
            this.readyState = MQTTClient.CLOSED;
            this.reconnecting = false;
            this._onError(error);
            this.close();
        }
    }

    getLastMessageId() {
        return this._lastMessageId;
    }

    /**
     * @param {MQTTMessage} message 
     */
    handleMessage(message) {
        this.dispatchEvent(new MessageEvent('message', { data: message }));
    }

    /**
     * Publish a message to the consumers
     * @param {string} topic  is the topic to publish to
     * @param {string|ArrayBuffer} payload is the message to publish
     * @param {MQTTPublishOptions} options  is the options to publish with
     * @returns 
     */
    async publish(topic, payload, options) {
        const message = Object.assign({}, options);
        message.topic = topic;
        message.payload = payload;
        message.qos = message.qos >>> 0;
        message.pid = this._nextMessageId();

        if (this.readyState != MQTTClient.OPEN) {
            this._queue.push(message);
            return;
        }

        return this._sendPublishMessage(message);
    }

    /**
     * Connect again using the same options as connect()
     */
    async reconnect() {

    }

    async start() {
        if (this._mqttTimer) {
            return;
        }

        this._mqttTimer = setInterval(() => {
            this._onTimer();
        }, 1000);
    }

    /**
     * Subscribe for messages
     * @param {string} topic 
     * @param {*} options 
     * @returns 
     */
    async subscribe(topic, options) {
        if (!topic) {
            return;
        }

        if (!this._socket) {
            this._topics[topic] = 1;
            return;
        }

        this._topics[topic] = 1;

        options = options || {};
        options.pid = this._nextMessageId();
        const packet = mqtt.encodeSubscribe(topic, options.dup, options.pid);
        await this._sendPacket(packet);
    }

    /**
     * Unsubscribe for messages
     * @param {string} topic 
     * @returns 
     */
    async unsubscribe(topic, options) {
        if (!topic) {
            return;
        }

        delete this._topics[topic];

        if (!this._socket) {
            return;
        }

        options = options || {};
        options.pid = this._nextMessageId();
        const packet = mqtt.encodeUnsubscribe(topic);
        await this._sendPacket(packet);
    }

    /**
     * 
     * @param {MQTTMessage} message 
     */
    async _dispatchMessage(message) {
        // console.log(message, mqtt.CONNACK);

        const type = message.type;

        if (type == mqtt.PINGRESP) {
            this._lastPongTime = Date.now();

            // console.log('pong');

        } else if (type == mqtt.CONNACK) {
            this._onConnectAck(message);

        } else if (type == mqtt.SUBACK) {
            // const ret = mqtt.parseConnack(data);

        } else if (type == mqtt.PUBLISH) {
            this.handleMessage(message);

        } else if (type == mqtt.PUBACK) {
            // 
        }
    }

    _nextMessageId() {
        this._lastMessageId++;
        const nextMessageId = this._lastMessageId;
        if (this._lastMessageId >= 65536) {
            this._lastMessageId = 1;
        }

        return nextMessageId;
    }

    /**
     * @param {*} conack 
     */
    async _onConnectAck(conack) {
        const options = this._options;

        if (this._connectTimeoutTimer) {
            clearTimeout(this._connectTimeoutTimer);
            this._connectTimeoutTimer = null;
        }

        this.reconnecting = false;
        this._lastPongTime = Date.now();

        if (this.readyState != MQTTClient.OPEN) {
            this.readyState = MQTTClient.OPEN;

            this.dispatchEvent(new MessageEvent('open', { data: conack }));
        }

        if (!this._pingTimer) {
            const interval = options.keepalive / 2;
            this._pingTimer = setInterval(() => {
                this._sendPingMessage();
            }, 1000 * interval);
        }

        for (const topic in this._topics) {
            await this.subscribe(topic);
        }

        const queue = this._queue;
        // eslint-disable-next-line no-unmodified-loop-condition
        while (queue) {
            const message = queue.shift();
            if (!message) {
                break;
            }

            await this._sendPublishMessage(message);
        }
    }

    async _onError(error) {
        // Emitted when the client cannot connect(i.e.connack rc != 0) or when a parsing error occurs.
        this.dispatchEvent(new ErrorEvent('error', { error }));

        this._onSocketClose();
    }

    async _onKeepAliveTimeout() {
        this._onSocketClose();
    }

    async _onSocketClose() {
        if (this._socket) {
            this._socket = null;
        }

        if (this._pingTimer) {
            clearInterval(this._pingTimer);
            this._pingTimer = null;
        }

        if (this._connectTimeoutTimer) {
            clearTimeout(this._connectTimeoutTimer);
            this._connectTimeoutTimer = null;
        }

        if (this.readyState == MQTTClient.OPEN) {
            this.readyState = MQTTClient.CONNECTING;

            // Emitted when the client goes offline.
            this.dispatchEvent(new Event('offline'));
        }
    }

    async _onTimer() {
        const now = Date.now();

        if (this.readyState == MQTTClient.OPEN) {
            const lastPongTime = this._lastPongTime || 0;
            const span = (now - lastPongTime) / 1000;
            const keepalive = this._options.keepalive;
            if (span > keepalive) {
                await this._onKeepAliveTimeout();
            }

            // eslint-disable-next-line no-empty
        } else if (this.reconnecting) {

        } else {
            const lastConnectTime = this._lastConnectTime || 0;
            const span = (now - lastConnectTime);
            const reconnectPeriod = this._options.reconnectPeriod;
            if (span > reconnectPeriod) {
                this._lastConnectTime = now;
                await this.connect();
            }
        }
    }

    async _sendConnectMessage() {
        if (!this._socket) {
            return;
        }

        const options = this._options;
        const message = mqtt.encodeConnect(options);
        await this._sendPacket(message);
    }

    /**
     * Normal disconnect of this Messaging client from its server.
     * @returns 
     */
    async _sendDisconnectMessage() {
        if (!this._socket) {
            return;
        }

        const packet = mqtt.encodeDisconnect();
        await this._sendPacket(packet);
    }

    async _sendPacket(message) {
        // console.log('_sendPacket', message);
        await this._socket.write(message);
    }

    async _sendPingMessage() {
        if (!this._socket) {
            console.log('mqtt: ping failed');
            clearInterval(this._pingTimer);
            this._pingTimer = null;
            return;
        }

        // console.log('ping');
        const packet = mqtt.encodePing();
        await this._sendPacket(packet);
    }

    async _sendPublishMessage(message) {
        if (!this._socket) {
            return;
        }

        const packet = mqtt.encodePublish(message.topic, message.payload, message.dup, message.qos, message.retained, message.pid);
        await this._sendPacket(packet);
    }

    _setSocket(socket) {
        this._socket = socket;

        const self = this;
        socket.onmessage = function (message) {
            // console.log('onmessage', message);

            if (message == null) {
                self._onSocketClose();
                return;
            }

            // console.log('onmessage', message);

            const parser = self._parser;
            parser.execute(message);

            if (parser.offset() > 128 * 1024) {
                parser.compact();
            }

            // 收到的数据包过大，超过 512KB
            const MAX_BUFFER_SIZE = 512 * 1024;
            if (parser.capacity() >= MAX_BUFFER_SIZE) {
                parser.reset();

                self._onSocketClose();
            }
        };

        socket.onconnect = function (status) {
            // console.log('onconnect', status);
        };

        socket.onopen = function (status) {
            // console.log('onopen', status);
            if (status && status.error) {
                self.authorized = false;
                self.authorizationError = status.error;

            } else {
                self.authorized = true;
                self.authorizationError = null;
            }
        };

        socket.onclose = function () {
            // console.log('onclose', status);
        };

        socket.onerror = function (error) {
            self.dispatchEvent(new ErrorEvent('error', { error }));
        };
    }
}

/** 正在连接中 */
MQTTClient.CONNECTING = 0;

/** 已连接 */
MQTTClient.OPEN = 1;

/** 正在关闭连接 */
MQTTClient.CLOSING = 2;

/** 连接已关闭 */
MQTTClient.CLOSED = 3;

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
 * Connects to the broker specified by the given url and options and returns a MQTTClient.
 * @param {string} url 
 * @param {object} options For all MQTT-related options, see the MQTTClient constructor.
 * @returns {MQTTClient}
 */
export function connect(url, options) {
    if (typeof url == 'object') {
        options = url;
        url = null;
    }

    const client = new MQTTClient(url, options);
    setTimeout(() => {
        client.start();
    }, 0);

    return client;
}
