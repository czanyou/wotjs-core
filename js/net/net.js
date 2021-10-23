// @ts-check
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

        this.CONNECTING = 0;
        this.OPEN = 1;
        this.CLOSING = 2;
        this.CLOSED = 3;

        this._options = Object.assign({}, options);
        this._handle = options?.handle;

        this.bytesRead = 0;
        this.bytesWritten = 0;
        this.readyState = this.CLOSED;
        this.timeout = undefined;

        if (this._handle) {
            this._setHandle(this._handle);
        }
    }

    get [Symbol.toStringTag]() {
        return 'TCPSocket';
    }

    get connecting() {
        return this.readyState == this.CONNECTING;
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
        if (this.readyState != this.CLOSED) {
            return;

        } else if (port == null) {
            return;
        }

        try {
            this.readyState = this.CONNECTING;

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
                return;
            }

            if (options.path) {
                address = options.path;

                const handle = new native.Pipe();
                this._handle = handle;

            } else {
                address = await dns.lookup(options.host, { family: 4 });
                if (Array.isArray(address)) {
                    return;
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

            this.readyState = this.OPEN;

            if (this._connectTimeoutTimer) {
                clearTimeout(this._connectTimeoutTimer);
                this._connectTimeoutTimer = null;
            }

            this.dispatchEvent(new Event('connect'));
            this.dispatchEvent(new Event('open'));

        } catch (error) {
            this.readyState = this.CLOSED;

            if (this._connectTimeoutTimer) {
                clearTimeout(this._connectTimeoutTimer);
                this._connectTimeoutTimer = null;
            }

            this.dispatchEvent(new ErrorEvent(error));
            await this.close();
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

    async close(code, reason) {
        const handle = this._handle;
        this._handle = null;

        if (this.readyState != this.CLOSED) {
            this.readyState = this.CLOSED;

            this.dispatchEvent(new Event('close'));
        }

        if (handle) {
            handle.onclose = null;
            handle.onend = null;
            handle.onerror = null;
            handle.onmessage = null;
            await handle.close();
        }

        return this;
    }

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
            this.dispatchEvent(new ErrorEvent(error));
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
            self.dispatchEvent(new ErrorEvent(error));
            await this.close(error);
        }
    }

    /** @param {native.TCP} handle */
    _setHandle(handle) {
        if (handle == null) {
            return;
        }

        const self = this;

        handle.onclose = function (error) {
            self.close(error);
        };

        handle.onend = function () {
            self.dispatchEvent(new Event('end'));
        };

        handle.onerror = function (error) {
            self.dispatchEvent(new ErrorEvent(error));
            self.close(error);
        };

        handle.onmessage = function (message) {
            if (message && message.byteLength > 0) {
                self.bytesRead += message.byteLength;
            }

            self.dispatchEvent(new MessageEvent('message', { data: message }));
        };
    }
}

defineEventAttribute(TCPSocket.prototype, 'close');
defineEventAttribute(TCPSocket.prototype, 'connect');
defineEventAttribute(TCPSocket.prototype, 'end');
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

    async accept() {
        const handle = this._handle;
        const result = handle && await handle.accept();
        return result;
    }

    address() {
        return this._handle && this._handle.address();
    }

    bind(options) {
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
            this.dispatchEvent(new ErrorEvent(error));
            this.close();
            return;
        }

        const self = this;
        const server = this._handle;
        server.onconnection = async function () {
            // console.log('connection');
            const connection = await server.accept();
            const event = new Event('connection');
            // @ts-ignore
            event.connection = new TCPSocket({ handle: connection });
            self.dispatchEvent(event);
        };

        server.onend = function () {
            self.dispatchEvent(new Event('end'));
        };

        server.onerror = function (error) {
            self.dispatchEvent(new ErrorEvent(error));
        };
    }

    async close(code, reason) {
        const handle = this._handle;
        if (handle) {
            this._handle = null;

            await handle.close();
            this.dispatchEvent(new Event('close'));
        }
    }

    listen(backlog) {
        const handle = this._handle;
        if (handle) {
            handle.listen(backlog);
            this.dispatchEvent(new Event('listening'));
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
    constructor(handle) {
        super();

        if (!handle) {
            handle = new native.UDP();
        }

        this._handle = handle;

        handle.onmessage = (data, address) => {
            const event = new MessageEvent('message', { data });
            // @ts-ignore
            event.address = address;
            this.dispatchEvent(event);
        }

        handle.onclose = () => {
            const event = new Event('close');
            this.dispatchEvent(event);
        }
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

    bind(address) {
        const handle = this._handle;
        handle?.bind(address);
    }

    close() {
        const handle = this._handle;
        if (handle) {
            this._handle = null;
            return handle.close();
        }
    }

    send(message, address) {
        const handle = this._handle;
        return handle?.send(message, address);
    }

    recv() {
        const handle = this._handle;
        return handle?.recv();
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
        await socket.connect(port, host);
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

    const socket = new native.UDP();

    return new UDPSocket(socket);
}
