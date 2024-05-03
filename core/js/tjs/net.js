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

    /** @param {any} [options] */
    constructor(options) {
        super();

        /** @type number */
        this.bytesRead = 0;

        /** @type number */
        this.bytesWritten = 0;

        /** @type {Promise=} 表示连接状态的 promise */
        this.connected = undefined;

        /** @type {native.TCP | native.Pipe =} */
        this._handle = undefined;

        /** @type {number} 连接状态 */
        this.readyState = Socket.CLOSED;

        /** @type {number=} 连接超时时间，单位为毫秒 */
        this.timeout = undefined;

        const handle = options?.handle;
        if (handle) {
            this._setHandle(handle);
        }
    }

    get [Symbol.toStringTag]() {
        return 'Socket';
    }

    get bufferedAmount() {
        const handle = this._handle;
        return handle?.bufferedAmount();
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
                this._handle = handle;

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
                this._handle = handle;
            }

            if (this.timeout && this.timeout > 0) {
                this._connectTimeoutTimer = setTimeout(() => {
                    const error = new Error('timeout');
                    const message = 'Connect timeout';
                    this.dispatchEvent(new ErrorEvent('error', { error, message }));
                }, this.timeout);
            }

            const client = this._handle;

            this._setHandle(client);

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

            this._onError(error);
            this.close();
        }

        return this;
    }

    localAddress() {
        const handle = this._handle;
        return handle?.address();
    }

    /** 主动关闭这个连接 */
    close() {
        this._onClose();
        this.removeAllEventListeners();
        return this;
    }

    ref() {
        this._handle?.ref();
    }

    remoteAddress() {
        const handle = this._handle;
        return handle?.remoteAddress();
    }

    setKeepAlive(enable = true, delay = 0) {
        const handle = this._handle;
        // @ts-ignore
        handle?.setKeepAlive(enable, delay);
        return this;
    }

    setNoDelay(enable = true) {
        const handle = this._handle;
        // @ts-ignore
        handle?.setNoDelay(enable);
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
            const handle = this._handle;
            await handle?.shutdown();

        } catch (error) {
            this._onError(error);
            this.close();
        }

        return this;
    }

    unref() {
        this._handle?.unref();
    }

    /**
     * 写数据
     * @param {string|ArrayBuffer|ArrayBufferView} data 
     * @returns {Promise<void>}
     */
    async write(data) {
        if (!data) {
            return;
        }

        // @ts-ignore
        this.bytesWritten += data.byteLength || data.length || 0;

        const handle = this._handle;
        if (!handle) {
            return;
        }

        try {
            await handle.write(data);

        } catch (error) {
            this._onError(error);
            this.close();
        }
    }

    /**
     * 当发生错误
     * @param {any} error 
     */
    _onError(error) {
        this.dispatchEvent(new ErrorEvent('error', { error }));
    }

    /**
     * 当连接关闭
     */
    _onClose() {
        this.connected = undefined;

        if (this.readyState != Socket.CLOSED) {
            this.readyState = Socket.CLOSED;
            this.dispatchEvent(new Event('close'));
        }

        const handle = this._handle;
        if (handle) {
            this._handle = undefined;

            handle.onclose = undefined;
            handle.onerror = undefined;
            handle.onmessage = undefined;
            handle.onconnect = undefined;
            handle.close();
        }
    }

    /** @param {native.TCP|native.Pipe} handle */
    _setHandle(handle) {
        if (handle == null) {
            return;
        }

        this._handle = handle;

        handle.onerror = (error) => {
            this._onError(error);
        };

        handle.onmessage = (message) => {
            if (message == null) {
                this._onClose();

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
    constructor() {
        super();

        /** @type boolean */
        this.listening = false;

        /** @type native.Pipe | native.TCP | undefined  */
        this._handle = undefined;
    }

    get [Symbol.toStringTag]() {
        return 'Server';
    }

    address() {
        return this._handle?.address();
    }

    async close() {
        this.listening = false;

        const handle = this._handle;
        if (handle) {
            this._handle = undefined;

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
                this._handle = handle;

            } else {
                const address = options;
                const handle = new native.TCP();
                handle.bind(address);
                this._handle = handle;
            }

        } catch (error) {
            this.dispatchEvent(new ErrorEvent('error', { error }));
            this.close();
            return;
        }

        const self = this;
        const socket = this._handle;
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
    constructor(options) {
        super();

        this.readyState = 0;

        /** @type {native.UDP=} */
        this._handle = new native.UDP();
    }

    get [Symbol.toStringTag]() {
        return 'UDPSocket';
    }

    address() {
        const handle = this._handle;
        return handle?.address();
    }

    remoteAddress() {
        const handle = this._handle;
        return handle?.remoteAddress();
    }

    connect(address) {
        const handle = this._handle;
        handle?.connect(address);
    }

    disconnect() {
        const handle = this._handle;
        handle?.disconnect();
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

        const handle = this._handle;
        handle?.bind(options, flags);

        this._init();
    }

    close() {
        const handle = this._handle;
        if (handle) {
            this._handle = undefined;

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
        this._handle?.setBroadcast(broadcast);
    }

    /**
     * @param {number} ttl 
     */
    setTTL(ttl) {
        return this._handle?.setTTL(ttl);
    }

    /**
     * @param {*} message 
     * @param {*} address 
     * @returns 
     */
    async send(message, address) {
        const handle = this._handle;
        const result = await handle?.send(message, address);

        this._init();

        return result;
    }

    _init() {
        if (this.readyState > 0) {
            return;
        }

        this.readyState = 1;

        const handle = this._handle;
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
