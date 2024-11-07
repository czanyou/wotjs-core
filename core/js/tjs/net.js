// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import * as dns from '@tjs/dns';
import { defineEventAttribute } from '@tjs/event-target';

/** @typedef {import("@tjs/net").SocketAddress} SocketAddress */

/* global MessageEvent Event ErrorEvent */

// ////////////////////////////////////////////////////////////
// Socket

/**
 * TCP 或 IPC 连接
 */
export class Socket extends EventTarget {

    /** @type {native.TCP|native.Pipe=} */
    #handle = undefined;

    /** @param {any} [options] */
    constructor(options) {
        super();

        /** @type {number} */
        this.bytesRead = 0;

        /** @type {number} */
        this.bytesWritten = 0;

        /** @type {Promise=} 表示连接状态的 promise */
        this.connected = undefined;

        /** @type {number} 连接状态 */
        this.readyState = Socket.CLOSED;

        /** @type {number=} 连接超时时间，单位为毫秒 */
        this.timeout = undefined;

        this.#setHandle(options?.handle);
    }

    get [Symbol.toStringTag]() {
        return 'Socket';
    }

    get bufferedAmount() {
        return this.#handle?.bufferedAmount();
    }

    get connecting() {
        return this.readyState == Socket.CONNECTING;
    }

    /** 
     * @param {number|string|Object<string,any>} port 
     * @param {string=} host 
     */
    async connect(port, host) {
        if (this.readyState != Socket.CLOSED) {
            return;

        } else if (port == null) {
            return Promise.reject(new Error('Invalid port'));
        }

        // console.trace('connect');

        try {
            this.readyState = Socket.CONNECTING;

            let address = null;
            let options = null;

            if (typeof port == 'object') {
                options = port;

            } else if (typeof port == 'number') {
                options = { port, host };

            } else if (typeof port == 'string') {
                options = { path: port };

            } else {
                return Promise.reject(new Error('Invalid options'));
            }

            if (options.path) {
                address = options.path;

                const handle = new native.Pipe();
                this.#handle = handle;

            } else {
                address = await dns.lookup(options.host, { family: 4 });
                if (Array.isArray(address)) {
                    return Promise.reject(new Error('lookup failed'));
                }

                address.port = options.port || 80;

                const event = new Event('lookup');
                // @ts-ignore
                event.address = address;
                this.dispatchEvent(event);

                const handle = new native.TCP();
                this.#handle = handle;
            }

            if (this.timeout && this.timeout > 0) {
                this._connectTimeoutTimer = setTimeout(() => {
                    const error = new Error('timeout');
                    const message = 'Connect timeout';
                    this.dispatchEvent(new ErrorEvent('error', { error, message }));
                }, this.timeout);
            }

            const client = this.#handle;

            this.#setHandle(client);

            // console.log('address', address);
            await client.connect(address);

            this.readyState = Socket.OPEN;

            if (this._connectTimeoutTimer) {
                clearTimeout(this._connectTimeoutTimer);
                this._connectTimeoutTimer = null;
            }

            setTimeout(() => {
                this.dispatchEvent(new Event('connect'));
                this.dispatchEvent(new Event('open'));
            }, 0);

        } catch (error) {
            if (this._connectTimeoutTimer) {
                clearTimeout(this._connectTimeoutTimer);
                this._connectTimeoutTimer = null;
            }

            this.#onError(error);
            this.close();
        }

        return this;
    }

    localAddress() {
        return this.#handle?.address();
    }

    /** 主动关闭这个连接 */
    close() {
        this.#onClose();
        this.removeAllEventListeners();
        return this;
    }

    ref() {
        this.#handle?.ref();
    }

    remoteAddress() {
        return this.#handle?.remoteAddress();
    }

    setKeepAlive(enable = true, delay = 0) {
        // @ts-ignore
        this.#handle?.setKeepAlive(enable, delay);
        return this;
    }

    setNoDelay(enable = true) {
        // @ts-ignore
        this.#handle?.setNoDelay(enable);
        return this;
    }

    /**
     * 设置连接超时时间
     * @param {number} timeout 
     * @returns 
     */
    setTimeout(timeout) {
        this.timeout = Number(timeout);
        return this;
    }

    /** 关闭写 */
    async shutdown() {
        try {
            await this.#handle?.shutdown();

        } catch (error) {
            this.#onError(error);
            this.close();
        }

        return this;
    }

    unref() {
        this.#handle?.unref();
    }

    /**
     * 写数据
     * @param {string|ArrayBuffer|ArrayBufferView} data 
     * @returns {Promise<void>}
     */
    async write(data) {
        if (data == null) {
            return;
        }

        if (typeof data == 'string') {
            this.bytesWritten += data.length ?? 0;

        } else {
            this.bytesWritten += data.byteLength ?? 0;
        }

        try {
            await this.#handle?.write(data);

        } catch (error) {
            this.#onError(error);
            this.close();
        }
    }

    /**
     * 当连接关闭
     */
    #onClose() {
        this.connected = undefined;

        if (this.readyState != Socket.CLOSED) {
            this.readyState = Socket.CLOSED;
            this.dispatchEvent(new Event('close'));
        }

        const handle = this.#handle;
        if (handle) {
            this.#handle = undefined;

            handle.onclose = undefined;
            handle.onerror = undefined;
            handle.onmessage = undefined;
            handle.onconnect = undefined;
            handle.close();
        }
    }

    /**
     * 当发生错误
     * @param {any} error 
     */
    #onError(error) {
        this.dispatchEvent(new ErrorEvent('error', { error }));
    }

    /** @param {native.TCP|native.Pipe} handle */
    #setHandle(handle) {
        if (handle == null) {
            return;
        }

        this.#handle = handle;

        handle.onerror = (error) => {
            this.#onError(error);
        };

        handle.onmessage = (message) => {
            if (message == null) {
                this.#onClose();

            } else {
                this.bytesRead += message.byteLength;
            }

            this.dispatchEvent(new MessageEvent('message', { data: message }));
        };
    }
}

/** 初始状态 */
Socket.INIT = -1;

/** 正在连接中 */
Socket.CONNECTING = 0;

/** 已连接 */
Socket.OPEN = 1;

/** 正在关闭连接 */
Socket.CLOSING = 2;

/** 连接已关闭 */
Socket.CLOSED = 3;

/** 连接失败 */
Socket.FAILED = 4;

defineEventAttribute(Socket.prototype, 'close');
defineEventAttribute(Socket.prototype, 'connect');
defineEventAttribute(Socket.prototype, 'error');
defineEventAttribute(Socket.prototype, 'lookup');
defineEventAttribute(Socket.prototype, 'message');
defineEventAttribute(Socket.prototype, 'open');
defineEventAttribute(Socket.prototype, 'timeout');

// ////////////////////////////////////////////////////////////
// Server

export class Server extends EventTarget {
    /** @type {native.Pipe|native.TCP=}  */
    #handle = undefined;

    /** @type {boolean} */
    listening = false;

    get [Symbol.toStringTag]() {
        return 'Server';
    }

    address() {
        return this.#handle?.address();
    }

    async close() {
        this.listening = false;

        const handle = this.#handle;
        if (handle) {
            this.#handle = undefined;

            handle.onclose = undefined;
            handle.onconnection = undefined;
            handle.onerror = undefined;
            handle.close();

            this.dispatchEvent(new Event('close'));
        }

        this.removeAllEventListeners();
    }

    /**
     * Start a server listening for connections.
     * @param {string|SocketAddress} options 
     * @param {number=} backlog 
     */
    listen(options, backlog) {
        if (!options) {
            return;
        }

        try {
            if (typeof options == 'string') {
                const name = options;
                const handle = new native.Pipe();
                handle.bind(name);
                this.#handle = handle;

            } else {
                const address = options;
                const handle = new native.TCP();
                handle.bind(address);
                this.#handle = handle;
            }

        } catch (error) {
            this.dispatchEvent(new ErrorEvent('error', { error }));
            this.close();
            return;
        }

        const self = this;
        const socket = this.#handle;
        socket.onconnection = async function () {
            const connection = socket.accept();
            const event = new Event('connection');
            // @ts-ignore
            event.connection = new Socket({ handle: connection });
            self.dispatchEvent(event);
        };

        socket.onerror = function (error) {
            self.dispatchEvent(new ErrorEvent('error', { error }));
        };

        socket.listen(backlog);

        this.listening = true;
        this.dispatchEvent(new Event('listening'));
    }
}

defineEventAttribute(Server.prototype, 'close');
defineEventAttribute(Server.prototype, 'connection');
defineEventAttribute(Server.prototype, 'error');
defineEventAttribute(Server.prototype, 'listening');

// ////////////////////////////////////////////////////////////
// UDPSocket

/**
 * UDP Socket
 */
export class UDPSocket extends EventTarget {
    /** @type {native.UDP=} */
    #handle = new native.UDP();

    /** @type {number} */
    readyState = 0;

    get [Symbol.toStringTag]() {
        return 'UDPSocket';
    }

    /**
     * @param {any} options 
     */
    constructor(options) {
        super();
    }

    address() {
        return this.#handle?.address();
    }

    remoteAddress() {
        return this.#handle?.remoteAddress();
    }

    connect(address) {
        this.#handle?.connect(address);
    }

    disconnect() {
        this.#handle?.disconnect();
    }

    /**
     * 
     * @param {{ port?: number, address?: string }} address 
     * @param {number|undefined} flags 
     */
    bind(address, flags) {
        let options = address;
        if (typeof address == 'number') {
            options = { port: address };
            if (typeof flags == 'string') {
                options.address = flags;
            }

            flags = undefined;
        }

        const handle = this.#handle;
        handle?.bind(options, flags);

        this.#init();
    }

    close() {
        const handle = this.#handle;
        if (handle) {
            this.#handle = undefined;

            handle.onclose = undefined;
            handle.onerror = undefined;
            handle.onmessage = undefined;

            return handle.close();
        }

        this.removeAllEventListeners();
    }

    /**
     * @param {boolean} broadcast 
     */
    setBroadcast(broadcast) {
        this.#handle?.setBroadcast(broadcast);
    }

    /**
     * @param {number} ttl 
     */
    setTTL(ttl) {
        return this.#handle?.setTTL(ttl);
    }

    /**
     * @param {*} message 
     * @param {*} address 
     * @returns 
     */
    async send(message, address) {
        const result = await this.#handle?.send(message, address);

        this.#init();

        return result;
    }

    #init() {
        if (this.readyState > 0) {
            return;
        }

        this.readyState = 1;

        const handle = this.#handle;
        if (!handle) {
            return;
        }

        handle.onmessage = (message) => {
            const event = new MessageEvent('message', { data: message.data });
            // @ts-ignore
            event.address = message.address;
            this.dispatchEvent(event);
        };

        handle.onclose = () => {
            const event = new Event('close');
            this.dispatchEvent(event);
        };
    }
}

defineEventAttribute(UDPSocket.prototype, 'message');
defineEventAttribute(UDPSocket.prototype, 'close');
defineEventAttribute(UDPSocket.prototype, 'error');

// ////////////////////////////////////////////////////////////
// functions

/**
 * Creates a TCP client
 * @param {number} port 
 * @param {string} host 
 * @returns {Socket}
 */
export function connect(port, host) {
    const socket = new Socket();
    socket.connected = socket.connect(port, host);
    return socket;
}

/**
 * Creates a TCP server
 * @param {function} connectionListener 
 * @returns {Server}
 */
export function createServer(connectionListener) {
    const server = new Server();
    if (connectionListener) {
        // @ts-ignore
        server.addEventListener('connection', connectionListener);
    }

    return server;
}

/**
 * datagrams
 * Creates a UDP socket.
 * @param {object} options options or type
 * @param {string} options.type The family of socket, `udp4` or `udp6`
 * @returns {UDPSocket}
 */
export function createSocket(options) {
    if (typeof options != 'object') {
        const type = options;
        options = { type };
    }

    return new UDPSocket(options);
}
