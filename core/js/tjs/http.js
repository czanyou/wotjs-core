// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import * as formdata from '@tjs/form-data';

import { defineEventAttribute } from '@tjs/event-target';

const http = native.http;
export const METHODS = http.methods;

const $textEncoder = new TextEncoder();
const $textDecoder = new TextDecoder();

export class HeaderValue {
    /** @param {string} value */
    constructor(value) {
        /** @type {{[key: string]: string}} */
        this.params = {};

        /** @type string|null */
        this.value = null;

        this.parse(value);
    }

    /** @param {string} value */
    parse(value) {
        const tokens = value.split(';');
        this.value = tokens[0];

        /** @type {{[key: string]: string}} */
        const params = {};
        for (let i = 1; i < tokens.length; i++) {
            const param = tokens[i];
            const pos = param.indexOf('=');
            if (pos > 0) {
                const key = param.substring(0, pos).trim();
                params[key] = param.substring(pos + 1).trim();
            }
        }

        this.params = params;
    }
}

// ////////////////////////////////////////////////////////////
// STATUS_CODES

// RFC 7231 (http://tools.ietf.org/html/rfc7231#page-49)
export const STATUS_CODES = {
    100: 'Continue',
    101: 'Switching Protocols',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Large',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    426: 'Upgrade Required',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Time-out',
    505: 'HTTP Version Not Supported'
};

// ////////////////////////////////////////////////////////////
// IncomingMessage

export class IncomingMessage {
    /**
     * @param {native.http.Message} messageInit 
     */
    constructor(messageInit) {
        /** @type string */
        this.method = METHODS[(messageInit.method == null) ? 1 : messageInit.method];

        /** @type Headers */
        this.headers = new Headers(messageInit.headers);

        /** @type string */
        this.url = messageInit.url || '';

        /** @type Object<string,any> */
        this.locals = {};

        /** @type {ReadableStream<Uint8Array>=} */
        this._body = undefined;

        /** @type {ArrayBufferLike=} */
        this._rawBody = undefined;

        /** @type boolean 指出 body 内容是否已经读取过了 */
        this._bodyUsed = false;
    }

    get [Symbol.toStringTag]() {
        return 'IncomingMessage';
    }

    /** @type {ReadableStream=} */
    get body() {
        return this._body;
    }

    get bodyUsed() {
        return this._bodyUsed;
    }

    /** @returns {string} */
    get path() {
        return this.uri.pathname;
    }

    /** @returns {Object<string,any>} */
    get query() {
        const uri = this.uri;
        const query = {};
        const search = uri.searchParams;
        search.forEach(function (value, key) {
            query[key] = value;
        });

        return query;
    }

    /** @returns {URL} */
    get uri() {
        let url = this.url;
        const host = this.headers.get('host') || '$host';
        if (url.startsWith('/')) {
            url = 'http://' + host + url;
        }

        return new URL(url);
    }

    /** @param {string} field */
    get(field) {
        return this.headers.get(field);
    }

    /**
     * 
     * @returns {Promise<ArrayBufferLike|undefined>}
     */
    async arrayBuffer() {
        if (this._bodyUsed) {
            // 不能重复读取
            return Promise.reject(new TypeError('Already read'));
        }

        this._bodyUsed = true;
        return this._rawBody;
    }

    async json() {
        try {
            const body = await this.text();
            if (body == null) {
                return;
            }

            return JSON.parse(body);

        } catch (err) {
            this.error = err;
        }
    }

    /**
     * @returns {Promise<URLSearchParams|undefined>}
     */
    async form() {
        const data = await this.text();
        if (!data) {
            return;
        }

        const params = new URLSearchParams(data);
        return params;
    }

    async formData() {
        const data = await this.arrayBuffer();
        if (!data) {
            return;
        }

        const formData = formdata.parse(new Uint8Array(data));
        return formData;
    }

    /**
     * @returns {Promise<string|undefined>}
     */
    async text() {
        const body = await this.arrayBuffer();
        if (!body) {
            return;
        }

        return $textDecoder.decode(body);
    }
}

// ////////////////////////////////////////////////////////////
// ServerResponse

export class ServerResponse extends EventTarget {
    /**
     * @param {IncomingMessage} request 
     */
    constructor(request) {
        super();

        /** @type any */
        this.body = null;

        /** @type boolean */
        this.bodyUsed = false;

        /** @type Headers */
        this.headers = new Headers();

        /** @type boolean 消息头是否已发送到网络层 */
        this.isHeadersSent = false;

        /** @type {native.TCP=} 相关的 Socket */
        this.socket = undefined;

        /** @type any */
        this._onSocketClose = undefined;

        /** @type number */
        this.status = 200;

        /** @type string */
        this.statusText = 'OK';

        const options = {};
        this.options = options;
        options.hasTransferEncoding = false;
        options.keepAlive = true;
        options.keepAliveTimeout = 60;
        options.sendDate = true;

        if (request) {
            // eslint-disable-next-line dot-notation
            const connection = request.headers['Connection']?.toLowerCase();
            if (connection == 'keep-alive') {
                options.keepAlive = true;

            } else if (connection == 'close') {
                options.keepAlive = false;
            }

            this.locals = request.locals;
        }
    }

    get [Symbol.toStringTag]() {
        return 'ServerResponse';
    }

    /** @param {*=} data */
    async end(data) {
        /** @type {native.TCP=} */
        const socket = this.socket;
        if (!socket) {
            return;
        }

        this.socket = undefined;
        const options = this.options;

        if (data) {
            await this.write(data);
        }

        if (!this.isHeadersSent) {
            if (!this.bodyUsed) {
                this.headers.set('Content-Length', '0');
            }

            await this.writeHead();
        }

        try {
            if (this.bodyUsed && options.hasTransferEncoding) {
                const data = '0\r\n\r\n';
                await socket.write(data);
            }

            if (options.keepAlive) {
                return;
            }

            await socket.shutdown();

        } catch (error) {

        }

        socket.onclose = undefined;
        socket.onerror = undefined;
        socket.onconnect = undefined;
        socket.onmessage = undefined;
        socket.close();

        const onSocketClose = this._onSocketClose;
        if (onSocketClose) {
            onSocketClose();
        }

        this.removeAllEventListeners();
    }

    /** @param {string} field */
    get(field) {
        return this.headers.get(field);
    }

    /**
     * redirect
     * @param {number} status 
     * @param {string} path 
     */
    async redirect(status, path) {
        this.setStatus(status);
        this.set('Location', path);

        await this.send({ path });
    }

    /** @param {*} data */
    async send(data) {
        if (data == null) {
            return;
        }

        if (typeof data == 'object') {
            data = JSON.stringify(data);
            data = $textEncoder.encode(data);
            this.type('json');
            this.set('Content-Length', String(data.length));
        }

        await this.write(data);
        await this.end();
    }

    /**
     * @param {string} field 
     * @param {string} value 
     */
    set(field, value) {
        if (!field || !value) {
            return;
        }

        return this.headers.set(field, value);
    }

    /**
     * @param {number} statusCode 
     * @param {string=} statusText 
     * @returns this
     */
    setStatus(statusCode, statusText) {
        this.status = statusCode;
        statusText = statusText || STATUS_CODES[statusCode];

        if (statusText) {
            this.statusText = statusText;
        }

        return this;
    }

    /** @param {string} type */
    type(type) {
        if (type == 'json') {
            this.set('content-type', 'application/json');
        } else {
            this.set('content-type', 'text/html');
        }
    }

    /** @param {ArrayBuffer|ArrayBufferView} data */
    async write(data) {
        const socket = this.socket;
        if (!socket) {
            return;
        }

        this.bodyUsed = true;

        if (!this.isHeadersSent) {
            await this.writeHead();
        }

        if (!data) {
            return;
        }

        if (typeof data == 'string') {
            data = $textEncoder.encode(data);
        }

        try {
            if (this.options.hasTransferEncoding) {
                const length = data.byteLength;
                const head = length.toString(16) + '\r\n';
                await socket.write(head);
                await socket.write(data);
                await socket.write('\r\n');

            } else {
                await socket.write(data);
            }

        } catch (error) {
            await this.end();
        }
    }

    async writeHead() {
        const socket = this.socket;
        if (!socket) {
            return;

        } else if (this.isHeadersSent) {
            return;
        }

        const statusText = this.statusText || 'OK';
        const statusCode = this.status || '200';
        const startLine = 'HTTP/1.1 ' + statusCode + ' ' + statusText;

        const options = this.options;
        const headers = this.headers;
        const hasContentLength = headers.has('content-length');

        // 'date' header
        if (options.sendDate) {
            if (!headers.has('Date')) {
                const now = new Date();
                headers.set('Date', now.toISOString());
            }
        }

        // 'Transfer-Encoding' header
        if (this.bodyUsed && !hasContentLength) {
            if (!headers.has('Transfer-Encoding')) {
                headers.set('Transfer-Encoding', 'chunked');
                options.hasTransferEncoding = true;
            }
        }

        // 'Connection' header
        if (!headers.has('connection')) {
            if (options.keepAlive) {
                if (this.bodyUsed) {
                    if (hasContentLength) {
                        headers.set('Connection', 'keep-alive');
                        // headers.set('Connection', 'close');

                    } else if (options.hasTransferEncoding) {
                        headers.set('Connection', 'keep-alive');
                        // headers.set('Connection', 'close');

                    } else {
                        headers.set('Connection', 'close');
                    }

                } else if (this.status >= 300) {
                    headers.set('Connection', 'close');

                } else {
                    headers.set('Connection', 'keep-alive');
                    // headers.set('Connection', 'close');
                }

            } else {
                headers.set('Connection', 'close');
            }
        }

        // encode as string
        const lines = [];
        lines.push(startLine);
        headers.forEach(function (value, name) {
            lines.push(name + ': ' + value);
        });
        lines.push('\r\n');
        const message = lines.join('\r\n');

        // write to network
        await socket.write(message);
        this.isHeadersSent = true;
    }
}

defineEventAttribute(ServerResponse.prototype, 'close');
defineEventAttribute(ServerResponse.prototype, 'finish');

// ////////////////////////////////////////////////////////////
// Server

/**
 * @typedef {(req: IncomingMessage, res: ServerResponse) => any} RequestListener
 */

/**
 * HTTP Server
 */
export class Server extends EventTarget {
    /**
     * 
     * @param {*} options 
     * @param {RequestListener=} requestListener 
     */
    constructor(options, requestListener) {
        super();

        /** @type Set<native.TCP> HTTP 连接列表 */
        this.connections = new Set();

        /** @type number */
        this.nextConnectionId = 0;

        /** @type any */
        this.options = options;

        /** @type {RequestListener=} */
        this.requestListener = requestListener;

        /** @type {native.TCP=} */
        this.server = undefined;
    }

    get [Symbol.toStringTag]() {
        return 'Server';
    }

    /**
     * 关闭这个服务
     */
    close() {
        const socket = this.server;
        if (socket) {
            this.server = undefined;

            socket.onclose = undefined;
            socket.onerror = undefined;
            socket.onconnection = undefined;
            socket.close();
        }

        this.removeAllEventListeners();
        // console.log('close', this.connections);
    }

    /** 
     * 处理连接
     * @param {native.TCP} connection 
     */
    async handleConnection(connection) {
        const requestListener = this.requestListener;

        const type = http.REQUEST;
        const parser = new http.Parser(type);

        /** @type IncomingMessage | null */
        let request = null;

        /** @type ServerResponse | null */
        let response = null;

        /** @type ArrayBuffer[] | null */
        let readBuffer = [];

        async function processRequest() {
            if (!request) {
                return;
            }

            // body
            if (readBuffer && readBuffer.length) {
                // total
                let totalLength = 0;
                for (let i = 0; i < readBuffer.length; i++) {
                    const item = readBuffer[i];
                    totalLength += item.byteLength;
                }

                // join
                let offset = 0;
                const byteArray = new Uint8Array(totalLength);
                for (let i = 0; i < readBuffer.length; i++) {
                    const item = new Uint8Array(readBuffer[i]);
                    byteArray.set(item, offset);
                    offset += item.length;
                }

                // console.log(totalLength, offset, byteArray);
                request._rawBody = byteArray.buffer;
                readBuffer = null;
            }

            // response
            response = new ServerResponse(request);
            response.socket = connection;
            response._onSocketClose = () => {
                onSocketClose();
            };

            const keepAlive = request.headers.get('Connection');
            if (keepAlive) {
                response.headers.set('Connection', keepAlive);
            }

            if (requestListener) {
                await requestListener(request, response);
            }
        }

        const self = this;

        function onSocketClose() {
            if (response) {
                response.dispatchEvent(new Event('close'));
                response.socket = undefined;
            }

            request = null;
            response = null;

            parser.onbody = undefined;
            parser.onheaderscomplete = undefined;
            parser.onmessagecomplete = undefined;

            connection.onmessage = undefined;

            self.connections.delete(connection);
        }

        async function parserOnMessageComplete() {
            await processRequest();
            resetRequestParser();
        }

        /**
         * 
         * @param {ArrayBuffer} body 
         */
        function parserOnBody(body) {
            if (!readBuffer) {
                readBuffer = [];
            }

            readBuffer.push(body);
        }

        /**
         * 
         * @param {native.http.Message} info 
         */
        function parserOnHeadersComplete(info) {
            request = new IncomingMessage(info);
        }

        parser.onbody = parserOnBody;
        parser.onheaderscomplete = parserOnHeadersComplete;
        parser.onmessagecomplete = parserOnMessageComplete;

        function resetRequestParser() {
            parser.init(type);

            request = null;
            readBuffer = null;
        }

        connection.onclose = function () {
            // console.log('onclose');

            connection.onclose = undefined;
            connection.onerror = undefined;
            connection.onmessage = undefined;
            onSocketClose();
        };

        connection.onerror = (error) => {
            this.dispatchEvent(new ErrorEvent('error', { error }));
        };

        connection.onmessage = async function (data) {
            if (data == null) {
                connection.close();
                return;
            }

            parser.execute(data);
        };

        this.connections.add(connection);
    }

    /**
     * 开始这个服务
     * @returns {Promise<this>}
     */
    async start() {
        const options = this.options || {};
        const address = { address: '0.0.0.0', port: 80, family: 4 };
        address.address = options.host || '0.0.0.0';
        address.port = options.port || 80;
        const backlog = options.backlog || 100;

        // console.log('bind', address, backlog);
        const socket = new native.TCP();
        socket.bind(address);
        socket.listen(backlog);

        this.server = socket;

        socket.onclose = () => {

        };

        socket.onerror = (error) => {
            this.dispatchEvent(new ErrorEvent('error', { error }));
        };

        socket.onconnection = () => {
            const connection = socket.accept();
            if (connection != null) {
                this.handleConnection(connection);
            }
        };

        return this;
    }
}

defineEventAttribute(Server.prototype, 'error');
defineEventAttribute(Server.prototype, 'close');

/**
 * 
 * @param {*} options 
 * @param {*} requestListener 
 * @returns {Server}
 */
export function createServer(options, requestListener) {
    return new Server(options, requestListener);
}
