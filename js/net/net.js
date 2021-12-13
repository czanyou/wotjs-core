// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import * as dns from '@tjs/dns';

import { defineEventAttribute, EventTarget } from '@tjs/event-target';

/* global MessageEvent Event ErrorEvent */

// ////////////////////////////////////////////////////////////
// TCPSocket

export class TCPSocket extends EventTarget {

    /** @param {any} options */
    constructor(options) {
        super();

        this._options = Object.assign({}, options);
        this._handle = options?.handle;

        this.bytesRead = 0;
        this.bytesWritten = 0;
        this.readyState = TCPSocket.CLOSED;
        this.timeout = undefined;

        if (this._handle) {
            this._setHandle(this._handle);
        }
    }

    get [Symbol.toStringTag]() {
        return 'TCPSocket';
    }

    get connecting() {
        return this.readyState == TCPSocket.CONNECTING;
    }

    get bufferedAmount() {
        const handle = this._handle;
        return handle?.bufferedAmount();
    }

    /** 
     * @param {number|string|object} port 
     * @param {string} host 
     */
    async connect(port, host) {
        if (this.readyState != TCPSocket.CLOSED) {
            return;

        } else if (port == null) {
            return Promise.reject(new Error('Invalid port'));
        }

        // console.trace('connect');

        try {
            this.readyState = TCPSocket.CONNECTING;

            let address = null;
            let options = null;

            const portType = typeof port;
            if (portType == 'object') {
                options = port;

            } else if (portType == 'number') {
                options = { port, host };

            } else if (portType == 'string') {
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
                    this.dispatchEvent(new Event('timeout'));
                }, this.timeout);
            }

            const client = this._handle;

            this._setHandle(client);

            // console.log('address', address);
            await client.connect(address);

            this.readyState = TCPSocket.OPEN;

            if (this._connectTimeoutTimer) {
                clearTimeout(this._connectTimeoutTimer);
                this._connectTimeoutTimer = null;
            }

            this.dispatchEvent(new Event('connect'));
            this.dispatchEvent(new Event('open'));

        } catch (error) {
            if (this._connectTimeoutTimer) {
                clearTimeout(this._connectTimeoutTimer);
                this._connectTimeoutTimer = null;
            }

            await this.close(error);
        }

        return this;
    }

    address() {
        const handle = this._handle;
        return handle?.address();
    }

    remoteAddress() {
        const handle = this._handle;
        return handle?.remoteAddress();
    }

    /**
     * @param {Error} [error] 
     */
    async close(error) {
        const handle = this._handle;
        this._handle = null;

        if (error) {
            this.dispatchEvent(new ErrorEvent('error', { error }));
        }

        if (this.readyState != TCPSocket.CLOSED) {
            // console.trace('close');
            
            this.readyState = TCPSocket.CLOSED;
            this.dispatchEvent(new Event('close'));
        }

        if (handle) {
            handle.onclose = null;
            handle.onerror = null;
            handle.onmessage = null;
            await handle.close();
        }

        return this;
    }

    /**
     * @param {*} data 
     * @param {string} encoding 
     * @returns 
     */
    async end(data, encoding = 'utf-8') {
        if (data) {
            await this.write(data, encoding);
        }

        const handle = this._handle;
        if (!handle) {
            return this;
        }

        try {
            await handle.shutdown();

        } catch (error) {
            this.dispatchEvent(new ErrorEvent('error', { error }));
            await this.close(error);
        }

        return this;
    }

    setKeepAlive(enable = true, delay = 0) {
        const handle = this._handle;
        handle?.setKeepAlive(enable, delay);
        return this;
    }

    setNoDelay(enable = true) {
        const handle = this._handle;
        handle?.setNoDelay(enable);
        return this;
    }

    setTimeout(timeout) {
        this.timeout = Number.parseInt(timeout);
        return this;
    }

    async write(data, encoding = 'uft-8') {
        if (!data) {
            return;
        }

        this.bytesWritten += data.byteLength || data.length || 0;

        const handle = this._handle;
        if (!handle) {
            return;
        }

        try {
            const result = await handle.write(data, encoding);
            return result;

        } catch (error) {
            self.dispatchEvent(new ErrorEvent('error', { error }));
            await this.close(error);
        }
    }

    /** @param {native.TCP} handle */
    _setHandle(handle) {
        if (handle == null) {
            return;
        }

        const self = this;

        handle.onclose = function () {
            self.close();
        };

        handle.onerror = function (error) {
            self.dispatchEvent(new ErrorEvent('error', { error }));
        };

        handle.onmessage = function (message) {
            if (message && message.byteLength > 0) {
                self.bytesRead += message.byteLength;
            }

            self.dispatchEvent(new MessageEvent('message', { data: message }));
        };
    }
}

/** 正在连接中 */
TCPSocket.CONNECTING = 0;

/** 已连接 */
TCPSocket.OPEN = 1;

/** 正在关闭连接 */
TCPSocket.CLOSING = 2;

/** 连接已关闭 */
TCPSocket.CLOSED = 3;

defineEventAttribute(TCPSocket.prototype, 'close');
defineEventAttribute(TCPSocket.prototype, 'connect');
defineEventAttribute(TCPSocket.prototype, 'error');
defineEventAttribute(TCPSocket.prototype, 'lookup');
defineEventAttribute(TCPSocket.prototype, 'message');
defineEventAttribute(TCPSocket.prototype, 'open');
defineEventAttribute(TCPSocket.prototype, 'timeout');

// ////////////////////////////////////////////////////////////
// TCPServer

export class TCPServer extends EventTarget {
    constructor(options) {
        super();

        this._options = options;
        this._handle = null;
        this.onconnection = null;
    }

    get [Symbol.toStringTag]() {
        return 'TCPServer';
    }

    address() {
        return this._handle?.address();
    }

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
        const server = this._handle;
        server.onconnection = async function () {
            // console.log('connection');
            const connection = server.accept();
            const event = new Event('connection');
            // @ts-ignore
            event.connection = new TCPSocket({ handle: connection });
            self.dispatchEvent(event);
        };

        server.onerror = function (error) {
            self.dispatchEvent(new ErrorEvent('error', { error }));
        };

        server.listen(backlog);
        this.dispatchEvent(new Event('listening'));
    }

    async close(code, reason) {
        const handle = this._handle;
        if (handle) {
            this._handle = null;

            await handle.close();
            this.dispatchEvent(new Event('close'));
        }
    }
}

defineEventAttribute(TCPServer.prototype, 'close');
defineEventAttribute(TCPServer.prototype, 'connection');
defineEventAttribute(TCPServer.prototype, 'error');
defineEventAttribute(TCPServer.prototype, 'listening');

// ////////////////////////////////////////////////////////////
// UDPSocket

export class UDPSocket extends EventTarget {
    constructor(options) {
        super();

        this.readyState = 0;

        /** @type native.UDP */
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
     * @param {number} flags 
     */
    bind(address, flags) {
        let options = address;
        if (typeof address == 'number') {
            options = { port: address };
            if (typeof flags == 'string') {
                options.address = flags;
            }

            flags = null;
        }

        const handle = this._handle;
        handle?.bind(options, flags);

        this._init();
    }

    close() {
        const handle = this._handle;
        if (handle) {
            this._handle = null;

            handle.onmessage = null;
            handle.onclose = null;

            return handle.close();
        }
    }

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
 * @returns {TCPSocket}
 */
export function connect(port, host) {
    const socket = new TCPSocket();
    setTimeout(async () => {
        try {
            await socket.connect(port, host);

        } catch (error) {
            socket.dispatchEvent(new Event('close'));

            await socket.close();
        }

    }, 0);

    return socket;
}

export const createConnection = connect;

/**
 * Creates a TCP server
 * @param {function} connectionListener 
 * @returns {TCPServer}
 */
export function createServer(connectionListener) {
    const server = new TCPServer();
    server.onconnection = connectionListener;
    return server;
}

/**
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
