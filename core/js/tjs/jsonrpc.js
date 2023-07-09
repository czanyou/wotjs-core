// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as net from '@tjs/net';
import * as fs from '@tjs/fs';
import * as os from '@tjs/os';
import * as process from '@tjs/process';

import { defineEventAttribute } from '@tjs/event-target';

const TAG = 'jsonrpc:';

/**
 * @typedef JsonrpcResponse
 * @property {number=} id
 * @property {string=} jsonrpc
 * @property {{code?: number, message?: string, data?: any}=} error
 * @property {any=} result
 *
 * @typedef JsonrpcRequest
 * @property {number=} id
 * @property {string=} jsonrpc
 * @property {string=} method
 * @property {any=} params
 *
 * @typedef {(...args: any) => Promise<any>} JsonrpcHandler
 * @typedef {{[key: string]: JsonrpcHandler}} JsonrpcHandlerMap
 * @typedef {{path?: string, host?: string, port?: number}} JsonrpcServerOptions
 */

/*
- -32700 Parse error
- -32600 Invalid request
- -32601 Method not found
- -32602 Invalid params
- -32603 Internal error
- -32000 Server error
*/

const kJsonrpcEventTarget = Symbol('kJsonrpcEventTarget');
const kJsonrpcEventState = Symbol('kJsonrpcEventState');

export class JsonrpcError extends Error {
    /**
     * @param {number} code 
     * @param {string} message 
     */
    constructor(code, message) {
        super(message);

        this.code = code;
    }

    /**
     * @param {number} code 
     * @param {string} message 
     * @returns 
     */
    static error(code, message) {
        return { code, message };
    }

    get [Symbol.toStringTag]() {
        return 'JsonrpcError';
    }
}

JsonrpcError.ParseError = -32700;
JsonrpcError.InvalidRequest = -32600;
JsonrpcError.MethodNotFound = -32601;
JsonrpcError.InvalidParameters = -32602;
JsonrpcError.InternalError = -32603;
JsonrpcError.ServerError = -32000;

// ////////////////////////////////////////////////////////////
// JsonrpcClient

export class JsonrpcEvent extends Event {
    constructor(name, eventInit) {
        super(name, eventInit);

        if (eventInit) {
            this[kJsonrpcEventTarget] = eventInit.currentTarget;
            this[kJsonrpcEventState] = eventInit.state;
        }
    }

    get [Symbol.toStringTag]() {
        return 'JsonrpcEvent';
    }

    get currentTarget() {
        return this[kJsonrpcEventTarget];
    }

    get state() {
        return this[kJsonrpcEventState];
    }
}

/** @typedef {{id: number, message: any, updated: number, callback: Function}} JsonrpcQueueRequest */

/**
 * 代表一个 JSON-RPC 客户端或服务端连接
 */
export class JsonrpcSession extends EventTarget {
    constructor() {
        super();

        /** @type {Promise<void>=} 表示是否已连接 */
        this.connected = undefined;

        /** @type number 这个会话的 ID */
        this.id = 0;

        /** @type string 这个会话的名称 */
        this.name = '';

        /** @type any 内部定时器，1 秒一次。 */
        this._checkTimer = null;

        /** @type any 发送请求定时器，每次只执行一次 */
        this._checkQueueTimer = null;

        /** @type number 下一次请求的 ID */
        this._nextRequestId = 1;

        /** @type {string=} 读缓存区 */
        this._readBuffer = undefined;

        /** @type {Map<number, JsonrpcQueueRequest>} 已经发送但还未收到应答的请求 */
        this._requestMap = new Map();

        /** @type JsonrpcQueueRequest[] 等待发送的请求 */
        this._requestQueue = [];

        /** @type {net.Socket=} 相关的 Socket */
        this._socket = undefined;

        /** @type number 当前连接状态 */
        this.readyState = JsonrpcSession.INIT;

        /** @type JsonrpcHandlerMap 请求处理函数 */
        this.handlers = {};

        /** @type {Object<string,number>} 订阅者列表 */
        this.subscribers = {};

        /** @type number 最后更新时间 */
        this.updated = Date.now();
    }

    get [Symbol.toStringTag]() {
        return 'JsonrpcSession';
    }

    /**
     * 执行指定的远程方法，并返回结果
     * @param {string} method 方法名
     * @param {any[]|{[key:string]: any}} params 参数
     * @param {number} [timeout]
     */
    async call(method, params, timeout) {
        if (this.readyState != JsonrpcSession.OPEN) {
            await this.reconnect();
        }

        const id = this._nextRequestId++;
        const message = { id, method, params, jsonrpc: JsonrpcClient.JSONRPC_VERSION };

        timeout = timeout || JsonrpcClient.DEFAULT_REQUEST_TIMEOUT;
        const queue = this._requestQueue;
        if (queue.length > 100) {
            console.log(TAG, 'Request queue is busy:', queue.length);
            return Promise.reject(new Error('Request queue is busy'));
        }

        return new Promise((resolve, reject) => {

            /**
             * @param {JsonrpcResponse} response 
             */
            const callback = (response) => {
                const error = response.error;

                if (error) {
                    reject(error);

                } else {
                    resolve(response.result);
                }
            };

            const updated = os.uptime();

            /** @type {JsonrpcQueueRequest} */
            const request = { id, message, updated, callback };
            this.enqueueRequest(request);
        });
    }

    /**
     * 取消指定的请求
     * @param {JsonrpcQueueRequest} request 
     * @param {string} [message] 
     */
    cancelRequest(request, message) {
        const callback = request?.callback;
        if (callback) {
            const error = new Error(message || 'timeout');
            const result = { error };
            callback(result);
        }
    }

    /**
     * 主动关闭这个连接
     */
    close() {
        console.log(TAG, 'close');

        this.connected = undefined;
        this._readBuffer = undefined;

        // checkTimer - 关闭相关的定时器
        const checkTimer = this._checkTimer;
        if (checkTimer) {
            this._checkTimer = null;

            clearInterval(checkTimer);
        }

        // queueTimer - 
        const queueTimer = this._checkQueueTimer;
        if (queueTimer) {
            this._checkQueueTimer = null;

            clearTimeout(queueTimer);
        }

        // socket - 关闭相关的 Socket
        const socket = this._socket;
        if (socket) {
            this._socket = undefined;
            this.setReadyState(JsonrpcClient.CLOSING);

            socket.onopen = undefined;
            socket.onmessage = undefined;
            socket.onclose = undefined;

            socket.close();
        }

        // 取消所有未发送或还未收到应答的请求
        if (this.readyState != JsonrpcClient.CLOSED) {
            this.setReadyState(JsonrpcClient.CLOSED);

            // 1. cancel request queue
            const requestQueue = this._requestQueue;
            while (requestQueue.length > 0) {
                const request = requestQueue.shift();
                if (request) {
                    this.cancelRequest(request, 'cancel request');
                }
            }
            requestQueue.length = 0;

            // 2. cancel requests
            const requests = this._requestMap;
            for (const request of requests.values()) {
                this.cancelRequest(request, 'cancel request');
            }

            requests.clear();
        }

        this.removeAllEventListeners();
    }

    /**
     * 连接
     */
    async connect() {

    }

    /**
     * 将指定的请求加入待处理队列
     * @param {JsonrpcQueueRequest} request 
     * @returns {void}
     */
    enqueueRequest(request) {
        const requestQueue = this._requestQueue;
        requestQueue.push(request);

        this._socket?.ref();

        if (this._checkQueueTimer) {
            return;
        }

        this._checkQueueTimer = setTimeout(async () => {
            this._checkQueueTimer = null;
            this._onCheckRequestQueue();
        }, 0);
    }

    /**
     * 发送队列中的请求
     * @returns {Promise<void>}
     */
    async flushRequestQueue() {
        const MAX_WAIT_REQUESTS = 50;
        const requestMap = this._requestMap;
        const requestQueue = this._requestQueue;

        while (true) {
            if (this.readyState != JsonrpcClient.OPEN) {
                break; // 无效的状态：连接已断开
            }

            if (requestMap.size >= MAX_WAIT_REQUESTS) {
                console.log(TAG, 'Request map is busy:', requestMap.size);
                break; // 请求并发数超过 5
            }

            const request = requestQueue.shift();
            if (!request) {
                break;
            }

            if (request.id) {
                requestMap.set(request.id, request);
            }

            // 发送到网络层
            await this.sendMessage(request.message);
        }
    }

    /**
     * 执行指定的请求
     * @private
     * @param {string} name 方法名
     * @param {any[] | { [key: string]: any }} [params] 
     * @returns {Promise<JsonrpcResponse>}
     */
    async invokeRequest(name, params) {
        /** @type JsonrpcResponse */
        const response = {};

        if (!name || typeof name != 'string') {
            response.error = { code: JsonrpcError.InvalidRequest, message: 'Invalid Request' };
            return response;
        }

        const args = Array.isArray(params) ? params : [params];

        // 处理 JSON-RPC 内置方法
        if (name == 'jsonrpc.subscribe') {
            const result = await this.processSubscribe(1, args);
            response.result = result;
            return response;

        } else if (name == 'jsonrpc.unsubscribe') {
            const result = await this.processSubscribe(0, args);
            response.result = result;
            return response;

        } else if (name == 'jsonrpc.ping') {
            response.result = { code: 0 };
            return response;
        }

        // 处理注册的方法
        const handlers = this.handlers;
        const handler = handlers[name];
        if (!handler || (typeof handler != 'function')) {
            response.error = { code: JsonrpcError.MethodNotFound, message: 'Method not found' };
            return response;
        }

        const result = await handler.apply(this, args);
        if (result != null) {
            response.result = result;

        } else {
            response.result = -500;
        }

        return response;
    }

    isIdle() {
        return (this._requestMap.size == 0 && this._requestQueue.length == 0);
    }

    /**
     * 重连
     */
    async reconnect() {

    }

    /**
     * 处理收到的消息
     * @param {string} data 
     */
    processMessage(data) {
        this.updated = Date.now();

        try {
            const message = JSON.parse(data);
            if (!message) {
                return;
            }

            if (message.method) {
                this.processRequest(message);

            } else {
                this.processResponse(message);
            }

        } catch (error) {
            console.log(TAG, 'onmessage error:', error);
        }
    }

    /**
     * 处理收到的请求消息
     * @param {JsonrpcRequest} request 
     * @returns {Promise<void>}
     */
    async processRequest(request) {
        if (!request) {
            return;
        }

        if (Array.isArray(request)) {
            for (const submessage of request) {
                const messageId = submessage.id;
                try {
                    const method = submessage.method;
                    const response = await this.invokeRequest(method, submessage.params);
                    await this.sendResponse(messageId, response.result, response.error);

                } catch (err) {
                    const error = { code: err.code, message: err.message };
                    await this.sendResponse(messageId, null, error);
                }
            }

        } else {
            const messageId = request.id || 0;
            try {
                const method = request.method;
                if (method) {
                    const response = await this.invokeRequest(method, request.params);
                    await this.sendResponse(messageId, response.result, response.error);
                }

            } catch (err) {
                const error = { code: err.code, message: err.message };
                await this.sendResponse(messageId, null, error);
            }
        }
    }

    /**
     * 处理收到的应答消息
     * @param {JsonrpcResponse} response 
     * @returns 
     */
    processResponse(response) {
        if (!response) {
            return;
        }

        const id = response.id;
        if (!id) {
            return;
        }

        const requestMap = this._requestMap;
        const request = requestMap.get(id);
        if (!request) {
            return;
        }

        requestMap.delete(id);
        request.callback(response);

        if (this.isIdle()) {
            // Set to idle
            // @ts-ignore
            this._socket?.unref();
        }
    }

    /**
     * 处理订阅请求
     * @param {number} subscribe 是否订阅
     * @param {any[]} args 
     * @returns {Promise<any>}
     */
    async processSubscribe(subscribe, args) {
        let path = args[0] ? String(args[0]) : null;
        const name = args[1] ? String(args[1]) : null;
        console.log(TAG, '@subscribe', path, name);

        if (!path) {
            return { code: -1 };
        }

        if (name) {
            path += '/' + name;
        }

        if (subscribe) {
            this.subscribers[path] = 1;

        } else {
            delete this.subscribers[path];
        }

        return { code: 0 };
    }

    /**
     * 发送 JSON-RPC 消息
     * @param {*} message 
     * @returns 
     */
    async sendMessage(message) {
        const socket = this._socket;
        if (!socket) {
            return;
        }

        let packet = JSON.stringify(message);
        packet = packet.length.toString(16) + '\r\n' + packet + '\r\n';
        await socket.write(packet);
    }

    /**
     * 发送通知消息
     * @param {string} method 
     * @param {*} params 
     */
    async sendNotify(method, params) {
        let request = null;
        request = { method, params, jsonrpc: JsonrpcClient.JSONRPC_VERSION };
        await this.sendMessage(request);
    }

    /**
     * 发送应答消息
     * @param {number} id 
     * @param {any} result 
     * @param {any} error 
     */
    async sendResponse(id, result, error) {
        if (!id) {
            return;
        }

        let response = null;
        if (error) {
            response = { id, error, jsonrpc: JsonrpcClient.JSONRPC_VERSION };

        } else {
            response = { id, result, jsonrpc: JsonrpcClient.JSONRPC_VERSION };
        }

        await this.sendMessage(response);
    }

    /**
     * 设置连接状态
     * @param {number} state 
     */
    setReadyState(state) {
        if (this.readyState == state) {
            return;
        }

        this.readyState = state;

        if (this.name) {
            console.log(TAG, 'setReadyState:', state, 'name:', this.name);
        }

        if (state == JsonrpcClient.OPEN) {
            this.flushRequestQueue();
        }

        const event = new JsonrpcEvent('statechange', { currentTarget: this, state });
        this.dispatchEvent(event);
    }

    /**
     * 绑定指定的 Socket
     * @param {net.Socket} socket 
     */
    setSocket(socket) {
        socket.onerror = (event) => {
            this._onSocketError(event.error);
        };

        socket.onmessage = async (event) => {
            const data = event?.data;

            if (data == null) {
                this._onSocketClose();

            } else {
                this._onSocketData(data);
            }
        };

        socket.onopen = (event) => {
            this._onSocketOpen();
        };

        this._socket = socket;
    }

    startTimer() {
        if (!this._checkTimer) {
            const interval = 1000;
            this._checkTimer = setInterval(() => {
                this._onCheckTimer();
            }, interval);

            this._checkTimer.unref();
        }
    }

    /**
     * 检查发送队列
     * - 发送队列中的请求
     * - 如果未连接则重新建立连接
     */
    async _onCheckRequestQueue() {
        if (!this._requestQueue.length) {
            return;
        }

        const readyState = this.readyState;
        if (readyState == JsonrpcClient.CLOSED) {
            await this.reconnect();
        }

        await this.flushRequestQueue();
    }

    /**
     * 检查有没有超时的请求
     */
    _onCheckRequestTimeout() {
        const TIMEOUT = JsonrpcClient.DEFAULT_REQUEST_TIMEOUT / 1000;
        const uptime = os.uptime();

        // 1. queue - 等待发送超时
        const requestQueue = this._requestQueue;
        const request = requestQueue[0];
        if (request) {
            const span = uptime - request.updated;
            if (span > TIMEOUT) {
                request.callback({ error: new Error('request queue timeout') });
                requestQueue.shift();
            }
        }

        // 2. map - 等待应答超时
        const requestMap = this._requestMap;
        for (const [key, entry] of requestMap.entries()) {
            const span = uptime - entry.updated;
            if (span > TIMEOUT) {
                entry.callback({ error: new Error('wait response timeout') });
                requestMap.delete(key);
            }
        }

        if (this.isIdle()) {
            // Set to idle
            // @ts-ignore
            this._socket?.unref();
        }
    }

    async _onCheckTimer() {
        await this._onCheckRequestQueue();
        this._onCheckRequestTimeout();
    }

    _onClose() {
        this._readBuffer = undefined;
        this.connected = undefined;

        // queueTimer - 关闭相关的定时器
        const queueTimer = this._checkQueueTimer;
        if (queueTimer) {
            this._checkQueueTimer = null;

            clearTimeout(queueTimer);
        }

        // socket
        const socket = this._socket;
        if (socket) {
            this._socket = undefined;

            socket.onclose = undefined;
            socket.onerror = undefined;
            socket.onmessage = undefined;
            socket.onopen = undefined;
        }
    }

    /**
     * 当网络连接断开
     */
    _onSocketClose() {
        console.log(TAG, '_onSocketClose');

        const lastState = this.readyState;
        this.setReadyState(JsonrpcClient.CLOSED);

        // close - event
        if (lastState == JsonrpcClient.OPEN) {
            const event = new JsonrpcEvent('close', { currentTarget: this });
            this.dispatchEvent(event);
        }

        this._onClose();
    }

    /**
     * 处理收到的数据
     * @param {ArrayBufferLike} data 
     */
    _onSocketData(data) {
        const textDecoder = new TextDecoder();
        this._readBuffer = (this._readBuffer || '') + textDecoder.decode(data);

        while (this._readBuffer && this._readBuffer.length) {
            const buffer = this._readBuffer;

            if (buffer.length > JsonrpcClient.MAX_MESSAGE_SIZE) {
                this._readBuffer = '';
                return;
            }

            // 16 进制数字字符串表示的消息长度，如：3130\r\n 表示长度 10
            const pos = buffer.indexOf('\r\n');
            if (!(pos >= 0)) {
                return;
            }

            const value = buffer.substring(0, pos);
            const size = Number.parseInt(value, 16);
            const chunkSize = pos + size + 4;
            if (buffer.length < chunkSize) {
                return;
            }

            const offset = pos + 2;
            const message = buffer.substring(offset, offset + size);
            this._readBuffer = buffer.substring(chunkSize);

            this.processMessage(message);
        }
    }

    /**
     * 当 Socket 发生错误
     * @param {Error} error 
     */
    _onSocketError(error) {
        this.lastError = error;
    }

    /**
     * 当 Socket 连接成功
     */
    _onSocketOpen() {
        this.setReadyState(JsonrpcClient.OPEN);
    }
}

defineEventAttribute(JsonrpcSession, 'close');
defineEventAttribute(JsonrpcSession, 'open');
defineEventAttribute(JsonrpcSession, 'statechange');

JsonrpcSession.INIT = 0;

/** 正在连接中 */
JsonrpcSession.CONNECTING = 1;

/** 已连接 */
JsonrpcSession.OPEN = 2;

/** 正在关闭连接 */
JsonrpcSession.CLOSING = 3;

/** 连接已关闭 */
JsonrpcSession.CLOSED = 4;

/** 空闲状态 */
JsonrpcSession.IDLE = 5;

/**
 * 代表一个 JSON-RPC 客户端，一般通过 Pipe 和服务端进行通信
 */
export class JsonrpcClient extends JsonrpcSession {
    /**
     * @param {string} url 要连接的服务的名称或 URL
     */
    constructor(url) {
        super();

        /** @type string */
        this.name = '';

        /** @type string 要连接的 RPC 服务的名称 */
        this.url = url;

    }

    get [Symbol.toStringTag]() {
        return 'JsonrpcClient';
    }

    /**
     * 开启客户端
     * - 客户端实现了断线自动重连
     */
    async connect() {
        await this._onSocketConnect();
    }

    /**
     * 暴露一个方法
     * @param {string} name 
     * @param {any} handler 
     * @returns 
     */
    expose(name, handler) {
        if (!name || !handler) {
            return;
        }

        if (typeof handler == 'function') {
            this.handlers[name] = handler;
            return;
        }

        for (const key in handler) {
            const value = handler[key];
            if (typeof value == 'function') {
                if (key.startsWith('$')) {
                    this.handlers['$' + name + '.' + key.substring(1)] = value;

                } else {
                    this.handlers[name + '.' + key] = value;
                }
            }
        }
    }

    /**
     * 指出这个连接是否超时
     * @returns {boolean}
     */
    isExpired() {
        if (this.readyState == JsonrpcSession.CLOSED) {
            return true;
        }

        const now = Date.now();
        const span = Math.abs(now - this.updated);
        const TIMEOUT = 60;
        if (span >= TIMEOUT * 1000) {
            return true;
        }

        return false;
    }

    /**
     * 执行指定名称的方法
     * @param {string} name 
     * @returns 
     */
    method(name) {
        /** @param {any[]} args */
        return async (...args) => {
            try {
                const result = await this.call(String(name), args);
                return result;

            } catch (error) {
                return { error };
            }
        };
    }

    /**
     * 重新连接
     */
    async reconnect() {
        // console.log(TAG, 'reconnect');

        let connected = this.connected;
        if (connected == null) {
            connected = this.connect();
            this.connected = connected;
        }

        await connected;
    }

    /**
     * 建立连接
     * - 只有处于连接关闭状态时才能重新建立连接
     */
    async _onSocketConnect() {
        console.log(TAG, '_onSocketConnect');

        const readyState = this.readyState;
        if (readyState != JsonrpcClient.INIT && readyState != JsonrpcClient.CLOSED) {
            return; // 连接未关闭
        }

        this.setReadyState(JsonrpcClient.CONNECTING);

        try {
            const socket = new net.Socket();
            this.setSocket(socket);

            let url = this.url;
            if (url.startsWith('tcp:')) {
                const uri = new URL(url);
                const host = uri.hostname || '127.0.0.1';
                const port = Number.parseInt(uri.port) || 8002;
                await socket.connect(port, host);

            } else {
                if (!url.startsWith('/')) {
                    url = '/var/run/' + url + '-jsonrpc.socket';
                }

                await socket.connect(url);
            }

            if (socket.readyState != net.Socket.OPEN) {
                socket.close();
                this.setReadyState(JsonrpcClient.CLOSED);
                return;
            }

            const event = new JsonrpcEvent('open', { currentTarget: this });
            this.dispatchEvent(event);

            this.setReadyState(JsonrpcClient.OPEN);

        } catch (err) {
            console.log(TAG, err);
            this.setReadyState(JsonrpcClient.CLOSED);
        }

        return this;
    }
}

JsonrpcClient.JSONRPC_VERSION = '2.0';
JsonrpcClient.MAX_MESSAGE_SIZE = 64 * 1024;
JsonrpcClient.DEFAULT_REQUEST_TIMEOUT = 3000;

/**
 * 服务端连接
 */
export class JsonrpcConnection extends JsonrpcSession {

    constructor() {
        super();

        /** @type JsonrpcServer | undefined */
        this.server = undefined;
    }

    _onSocketClose() {
        super._onSocketClose();

        const server = this.server;
        if (server) {
            this.server = undefined;
            server._removeConnection(this);
        }
    }

}

/**
 * JSON-RPC 服务端
 */
export class JsonrpcServer extends EventTarget {

    /**
     * @param {JsonrpcServerOptions} options
     */
    constructor(options) {
        super();

        /** @type any */
        this.checkTimer = null;

        /** @type {Set<JsonrpcConnection>} */
        this.connections = new Set();

        /** @type {JsonrpcHandlerMap} */
        this.handlers = {};

        /** 用于生成会话 ID */
        this.nextConnectionId = 1;

        /** @type {JsonrpcServerOptions} */
        this.options = { ...options };

        /** @type {net.Server|undefined} */
        this.server = undefined;
    }

    get [Symbol.toStringTag]() {
        return 'JsonrpcServer';
    }

    /**
     * @param {number} topic 
     * @param {string} method 
     * @param {[]|{}} params 
     * @param {number} timeout 
     * @returns {Promise<any>}
     */
    async call(topic, method, params, timeout) {
        /** @type JsonrpcConnection | undefined */
        const connection = this.getConnection(topic);
        if (!connection) {
            return;
        }

        return connection.call(method, params, timeout);
    }

    close() {
        // 关闭所有连接
        const connections = this.connections;
        for (const connection of connections.values()) {
            connection.close();
        }

        this.connections.clear();
        this.handlers = {};
        this.options = {};

        // 关闭 Server socket
        const server = this.server;
        if (server) {
            this.server = undefined;

            server.close();
        }

        this.removeAllEventListeners();

        const checkTimer = this.checkTimer;
        if (checkTimer) {
            this.checkTimer = null;

            clearInterval(checkTimer);
        }
    }

    /**
     * 暴露一个方法
     * @param {string} name 
     * @param {JsonrpcHandler|JsonrpcHandlerMap} handler 
     */
    expose(name, handler) {
        if (!name || !handler) {
            return;
        }

        if (typeof handler == 'function') {
            this.handlers[name] = handler;
            return;
        }

        for (const key in handler) {
            const value = handler[key];
            if (typeof value != 'function') {
                continue;
            }

            if (key.startsWith('$')) {
                this.handlers['$' + name + '.' + key.substring(1)] = value;

            } else {
                this.handlers[name + '.' + key] = value;
            }
        }
    }

    /**
     * 返回指定的 ID 的连接
     * @param {number} id 
     * @returns {JsonrpcConnection | undefined}
     */
    getConnection(id) {
        /** @type JsonrpcConnection | undefined */
        let result;
        const connections = this.connections;
        for (const connection of connections.values()) {
            if (id && connection.id == id) {
                result = connection;
            }
        }

        return result;
    }

    /**
     * 发送通知
     * @param {number} id 
     * @param {string} method 
     * @param {*} params 
     * @returns {Promise<void>}
     */
    async notify(id, method, params) {
        const connections = this.connections;
        for (const connection of connections.values()) {
            if (id && connection.id != id) {
                continue;
            }

            await connection.sendNotify(method, params);
        }
    }

    async onCheckTimer() {
        const connections = this.connections;
        for (const connection of connections.values()) {
            try {
                await connection._onCheckTimer();

            } catch (e) {
                console.log(TAG, 'onCheckTimer:', e);
            }
        }
    }

    /** 
     * @public 
     */
    async start() {
        const server = net.createServer();
        this._setServer(server);

        const options = this.options;
        if (options.path) {
            const path = '/var/run/' + options.path + '-jsonrpc.socket';

            try {
                await fs.unlink(path);
            } catch (err) {

            }

            server.listen(path);

        } else {
            const address = options.host || '127.0.0.1';
            const port = Number(options.port) || 8002;
            server.listen({ address, port });
        }

        this.startTimer();
    }

    startTimer() {
        this.checkTimer = setInterval(() => {
            this.onCheckTimer();
        }, 1000);

        this.checkTimer.unref();
    }

    /**
     * @param {net.Server} server 
     */
    _setServer(server) {
        server.onclose = (event) => {
            this.dispatchEvent(new Event('close'));
        };

        server.onconnection = (event) => {
            const connection = event.connection;
            this._handleConnection(connection);
        };

        server.onerror = (error) => {
            this.dispatchEvent(new ErrorEvent('error', { error }));
        };

        server.onlistening = (event) => {
            const address = server.address();
            console.info(TAG, 'Listening at:', address.address + ':' + address.port);
            this.dispatchEvent(new Event('open'));
        };

        this.server = server;
    }

    /**
     * @private
     * @param {net.Socket} socket 
     */
    _handleConnection(socket) {
        const connection = new JsonrpcConnection();
        connection.id = this.nextConnectionId++;
        connection.handlers = this.handlers;
        connection.server = this;
        connection.setSocket(socket);
        connection.setReadyState(JsonrpcClient.OPEN);

        this.connections.add(connection);
    }

    /**
     * @param {JsonrpcConnection} connection 
     */
    _removeConnection(connection) {
        this.connections.delete(connection);

        // console.log(TAG, '_removeConnection:', connection);
    }
}

defineEventAttribute(JsonrpcServer, 'close');
defineEventAttribute(JsonrpcServer, 'error');
defineEventAttribute(JsonrpcServer, 'open');

JsonrpcServer.JSONRPC_VERSION = '2.0';
JsonrpcServer.MAX_MESSAGE_SIZE = 64 * 1024;

/**
 * JSON-RPC 客户端连接池管理器
 */
class JsonrpcManager {
    constructor() {
        /** @type any */
        this.checkTimer = null;

        /** @type {Map<string, JsonrpcClient>} 客户端连接池 */
        this.connections = new Map();

        /** @type boolean 是否打印调试信息 */
        this.debug = false;

        /** @type number 连接 ID 累积 */
        this.nextConnectionId = 1;
    }

    /**
     * 关闭并释放所有的资源
     */
    close() {
        const clients = this.connections;
        for (const client of clients.values()) {
            client.close();
            clients.delete(client.name);
        }

        const checkTimer = this.checkTimer;
        if (checkTimer) {
            this.checkTimer = undefined;

            clearInterval(checkTimer);
        }
    }

    /**
     * 关闭已过期的连接
     */
    closeExpiredConnections() {
        const clients = this.connections;
        for (const client of clients.values()) {
            if (client?.isExpired()) {
                if (this.debug) {
                    console.print('关闭过期的 JSON-RPC 客户端: ' + client.name);
                }

                client.close();
                clients.delete(client.name);
            }
        }
    }

    /**
     * 返回指定的名称的连接
     * @param {string} name 连接的名称
     * @returns {JsonrpcClient=}
     */
    get(name) {
        return this.connections.get(name);
    }

    /**
     * 打开指定名称的连接
     * @param {string} name 连接的名称
     * @returns {JsonrpcClient=}
     */
    open(name) {
        let client = this.get(name);
        if (client) {
            if (this.debug) {
                console.print('使用已有的 JSON-RPC 客户端');
            }

            return client;
        }

        client = new JsonrpcClient(name);
        client.name = name;
        client.id = this.nextConnectionId++;
        this.connections.set(name, client);

        if (this.debug) {
            console.print('创建一个新的 JSON-RPC 客户端');
        }

        this.startTimer();
        return client;
    }

    async onCheckTimer() {
        this.closeExpiredConnections();

        const connections = this.connections;
        for (const client of connections.values()) {
            try {
                await client._onCheckTimer();

            } catch (e) {
                console.log(TAG, 'onCheckTimer:', e);
            }
        }
    }

    startTimer() {
        if (this.checkTimer) {
            return;
        }

        this.checkTimer = setInterval(() => {
            this.onCheckTimer();
        }, 1000);

        this.checkTimer.unref();

        // 在程序退出前，释放所有缓存的资源
        process?.addEventListener('exit', () => {
            close();
        });
    }
}

const $manager = new JsonrpcManager();

/**
 * 关闭连接池中的所有客户端并释放相关的资源
 */
export function close() {
    $manager.close();
}

/** 
 * 调用远程方法
 * @param {string} name 服务名
 * @param {string} method 方法名
 * @param {any[]} args 参数列表
 * @returns {Promise<any>}
 */
export async function call(name, method, ...args) {
    const client = $manager.open(name);
    if (client == null) {
        return;
    }

    try {
        await client.reconnect();

        if (client.readyState != JsonrpcSession.OPEN) {
            throw client.lastError || new Error('connect error');
        }

        return await client.call(method, args);

    } catch (error) {
        return { code: error.code, error: error.message };
    }
}

/**
 * 创建一个新的 JSON-PRC 连接
 * @param {string|number} name 服务文件名或服务器端口号
 * @param {string=} host 可选的主机名
 * @returns {JsonrpcClient}
 */
export function connect(name, host) {
    let url = name;
    if (typeof url == 'number') {
        // connect(port:number, host:string)
        const port = name;
        url = `tcp://${host || '127.0.0.1'}:${port}`;
    }

    const client = new JsonrpcClient(url);
    client.startTimer();
    client.connected = client.connect();
    return client;
}

/** 
 * 创建一个 JSON-RPC 服务器
 * @param {string|number|Object<string,any>} pathname 
 * @param {string} host 
 * @param {JsonrpcHandlerMap} handlers 
 */
export function createServer(pathname, host, handlers) {
    /** @type JsonrpcServerOptions */
    const options = {};
    if (typeof pathname == 'number') {
        // createServer(port: number, host: string, handlers?: JsonrpcHandlerMap);
        options.port = pathname;
        options.host = host;

    } else if (typeof pathname == 'string') {
        // createServer(path: string, handlers?: JsonrpcHandlerMap);
        // @ts-ignore
        handlers = host;

        if (pathname.startsWith('tcp:')) {
            const uri = new URL(pathname);
            options.host = uri.hostname || '127.0.0.1';
            options.port = Number.parseInt(uri.port);

        } else {
            options.path = pathname;
        }

    } else if (typeof pathname == 'object') {
        // createServer(options: JsonrpcServerOptions, handlers?: JsonrpcHandlerMap);
        // @ts-ignore
        handlers = host;

        options.port = Number.parseInt(pathname.port);
        options.host = pathname.host;
        options.path = pathname.path;

    } else {
        return;
    }

    const server = new JsonrpcServer(options);
    if (handlers) {
        server.handlers = { ...handlers };
    }

    return server;
}

/**
 * 创建一个 JSON-RPC 错误
 * @param {number} code 错误码
 * @param {string} message 错误消息
 * @returns {JsonrpcError}
 */
export function error(code, message) {
    return new JsonrpcError(code, message);
}

/**
 * 返回连接池管理器
 * @returns {JsonrpcManager}
 */
export function getManager() {
    return $manager;
}

/** 
 * 创建一个服务代理
 * @param {string} name 服务名
 * @return {any}
 */
export function proxy(name) {

    const exports = new Proxy({}, {
        get: function (object, property) {
            /** @param {any[]} args */
            return async (...args) => {
                return call(name, String(property), ...args);
            };
        }
    });

    return exports;
}
