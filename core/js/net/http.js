// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import * as dns from '@tjs/dns';

import { defineEventAttribute, EventTarget } from '@tjs/event-target';

/* global TextEncoder TextDecoder Request */

const http = native.http;

export const METHODS = http.methods;

const $textEncoder = new TextEncoder();
const $textDecoder = new TextDecoder();

const $context = { nextRequestId: 0 };

// ////////////////////////////////////////////////////////////
// Request

/**
 * 
 * @param {*} request 
 * @param {*} options 
 * @returns 
 */
async function _createClient(request, options) {
    const method = request.method || 'GET';
    const body = await request.arrayBuffer() || '';
    let pathname = options.pathname || '/';
    if (options.search) {
        pathname += options.search;
    }

    // connect
    const address = await dns.lookup(options.hostname, { family: 4 });
    if (address == null || Array.isArray(address)) {
        return;
    }

    address.host = options.hostname;

    let client = null;
    if (options.protocol == 'https:') {
        address.port = options.port || 443;
        client = new native.TLS();

    } else {
        address.port = options.port || 80;
        client = new native.TCP();
    }

    await client.connect(address);

    // console.log(`connect: ${address.ip}`, options.protocol);

    // headers
    const headers = request.headers;
    headers.set('Host', options.host);
    if (body) {
        headers.set('Content-Length', body.byteLength || body.length);
    }

    const startLine = method + ' ' + pathname + ' HTTP/1.1';
    const lines = [];
    lines.push(startLine);
    headers.forEach(function (/** @type string */ value, /** @type string */ name) {
        lines.push(name + ': ' + value);
    });

    lines.push('\r\n');

    const message = lines.join('\r\n');
    await client.write(message);

    // body
    if (body) {
        await client.write(body);
    }

    return client;
}

/**
 * 
 * @param {Request} request 
 * @param {*} options 
 * @returns Promise<Response>
 */
async function _sendRequest(request, options) {
    let parser = null;

    const client = await _createClient(request, options);
    if (client == null) {
        throw new Error('create socket failed.');
    }

    const clientId = ($context.nextRequestId || 0) + 1;
    const requestContext = { client, clientId, parser, readLength: 0, totalLength: 0 };
    $context.nextRequestId = clientId;
    $context[clientId] = client;

    const promise = new Promise((resolve, reject) => {
        let isEnd = false;
        let response = null;
        const readBuffer = [];

        // response parser
        parser = new http.Parser(http.RESPONSE);
        requestContext.parser = parser;

        function parserOnMessageComplete() {
            onResponseEnd();
        }

        let onprogress = null;
        if (typeof options.onprogress == 'function') {
            onprogress = options.onprogress;
        }

        function parserOnBody(body) {
            if (options.ondata) {
                options.ondata(body);

            } else {
                readBuffer.push(body);
            }

            if (body) {
                requestContext.readLength = (requestContext.readLength || 0) + body.byteLength;
            }

            if (onprogress) {
                onprogress(requestContext.readLength, requestContext.totalLength);
            }

            if (requestContext.totalLength && (requestContext.readLength >= requestContext.totalLength)) {
                parserOnMessageComplete();
            }
        }

        function parserOnHeadersComplete(info) {
            response = info;

            response.headers = new Headers(info.headers);
            requestContext.totalLength = Number.parseInt(response.headers.get('content-length'));

            if (onprogress) {
                onprogress(0, requestContext.totalLength);
            }

            // console.log(info);
        }

        parser.onbody = parserOnBody;
        parser.onheaderscomplete = parserOnHeadersComplete;
        parser.onmessagecomplete = parserOnMessageComplete;

        function onResponseEnd() {
            if (isEnd) {
                return;
            }

            if (options.ondata) {
                options.ondata();
            }

            isEnd = true;
            client.close();

            if (readBuffer.length) {
                let totalLength = 0;
                for (let i = 0; i < readBuffer.length; i++) {
                    const item = readBuffer[i];
                    totalLength += item.byteLength;
                }

                let offset = 0;
                const byteArray = new Uint8Array(totalLength);
                for (let i = 0; i < readBuffer.length; i++) {
                    const item = new Uint8Array(readBuffer[i]);
                    byteArray.set(item, offset);
                    offset += item.length;
                }

                response.body = byteArray.buffer;
            }

            delete $context[clientId];
            resolve(response);
        }

        client.onerror = function (error) {
            client.error = error;
        };

        client.onmessage = function (data) {
            if (data == null) {
                onResponseEnd();
                return;
            }

            parser.execute(data);
        };
    });

    return promise;
}

/**
 * 
 * @param {Request} request 
 * @param {*} options 
 * @returns 
 */
export async function sendRequest(request, options) {
    const uri = new URL(request.url);

    options = options || {};
    options.uri = uri;
    options.hostname = uri.hostname;
    options.host = uri.host;
    options.pathname = uri.pathname;
    options.search = uri.search;
    options.protocol = uri.protocol;

    if (uri.port) {
        options.port = uri.port;
    }

    const response = await _sendRequest(request, options);
    return response;
}

/**
 * 
 * @param {object} config 
 * @param {object} config.params
 * @param {object} config.headers
 * @param {string} config.url
 * @param {any} config.data
 * @param {number} config.timeout
 * @param {string} config.responseType *json|arraybuffer|blob
 */
export async function request(config) {
    const uri = new URL(config.url);
    const params = Object.assign({}, config.params);
    const search = uri.searchParams;

    for (const [key, value] of Object.entries(params)) {
        search.append(key, value);
    }

    /** @type any */
    const options = Object.assign({}, config);
    options.hostname = uri.hostname;
    options.host = uri.host;
    options.pathname = uri.pathname;
    options.search = uri.search;
    options.protocol = uri.protocol;

    if (uri.port) {
        options.port = uri.port;
    }

    if (!config.headers) {
        config.headers = {};
    }

    if (config.data) {
        const headers = config.headers;
        const contentType = headers && headers['Content-Type'];
        const data = config.data;

        if (data instanceof ArrayBuffer) {
            options.body = data;

        } else if (ArrayBuffer.isView(data)) {
            options.body = data.buffer;

        } else if (typeof data == 'string') {

            options.body = data;

        } else if (data instanceof FormData) {
            // @ts-ignore
            const blob = data.toBlob();
            // console.log('blob', blob);
            headers['Content-Type'] = blob.type;
            options.body = await blob.arrayBuffer();

        } else if (typeof data == 'object') {
            if (contentType == 'application/json') {
                options.body = JSON.stringify(data);

            } else {
                const params = new URLSearchParams(data);
                options.body = params.toString();
            }

        } else {
            options.body = String(data);
        }
    }

    const httpRequest = new Request(uri.toString(), options);
    const response = await _sendRequest(httpRequest, options);
    const headers = response.headers;

    const result = {};
    result.data = response.body;
    result.status = response.status;
    result.statusText = response.statusText;
    result.headers = headers.map;
    result.request = httpRequest;
    result.config = config;

    const contentType = new HeaderValue(headers.get('Content-Type'));
    // console.log(contentType);
    if (contentType.value == 'application/json') {
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(response.body);
        result.data = JSON.parse(text);

    } else if (contentType.value.startsWith('text/')) {
        const textDecoder = new TextDecoder();
        result.data = textDecoder.decode(response.body);
    }

    return result;
}

/**
 * @param {string} url 
 * @param {*} options 
 * @returns 
 */
export async function get(url, options) {
    const config = Object.assign({}, options);
    config.method = 'GET';
    config.url = url;

    const result = await request(config);
    return result;
}

/**
 * @param {string} url 
 * @param {*} options 
 * @returns 
 */
export async function del(url, options) {
    const config = Object.assign({}, options);
    config.method = 'DELETE';
    config.url = url;

    const result = await request(config);
    return result;
}

/**
 * 
 * @param {string} url 
 * @param {string|object|ArrayBuffer|URLSearchParams|FormData|File|Blob} data 
 * @param {object} options 
 */
export async function post(url, data, options) {
    const config = Object.assign({}, options);
    config.method = 'POST';
    config.url = url;
    config.data = data;

    const result = await request(config);
    return result;
}

/**
 * @param {string} url 
 * @param {*} data 
 * @param {*} options 
 * @returns 
 */
export async function put(url, data, options) {
    const config = Object.assign({}, options);
    config.method = 'PUT';
    config.url = url;
    config.data = data;

    const result = await request(config);
    return result;
}

/**
 * @param {string} url 
 * @param {*} options 
 * @returns 
 */
export async function download(url, options) {
    options.method = 'GET';

    // TODO: 文件下载

    const httpRequest = new Request(url, options);
    const result = await sendRequest(httpRequest, options);
    return result;
}

/**
 * @param {string} url 
 * @param {*} data 
 * @param {*} options 
 * @returns 
 */
export async function upload(url, data, options) {
    const config = Object.assign({}, options);
    config.method = 'POST';
    config.url = url;
    config.data = data;

    // TODO: 实现文件上传

    const result = await request(config);
    return result;
}

// ////////////////////////////////////////////////////////////
// Headers

/** @param {string} name */
function _normalizeName(name) {
    if (typeof name !== 'string') {
        name = String(name);
    }

    if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(name) || name === '') {
        throw new TypeError('Invalid character in header field name');
    }

    return name.toLowerCase();
}

/** @param {string} value */
function _normalizeValue(value) {
    if (typeof value !== 'string') {
        value = String(value);
    }

    return value;
}

// Build a destructive iterator for the value list
function _iteratorFor(items) {
    const iterator = {
        next: function () {
            const value = items.shift();
            return { done: value === undefined, value: value };
        }
    };

    iterator[Symbol.iterator] = function () {
        return iterator;
    };

    return iterator;
}

export class HeaderValue {
    /** @param {string} value */
    constructor(value) {
        this.params = {};
        this.value = null;
        this._parse(value);
    }

    /** @param {string} value */
    _parse(value) {
        const tokens = value.split(';');
        this.value = tokens[0];
        for (let i = 1; i < tokens.length; i++) {
            const param = tokens[i];
            const pos = param.indexOf('=');
            if (pos > 0) {
                const key = param.substring(0, pos).trim();
                this.params[key] = param.substring(pos + 1).trim();
            }
        }
    }
}

export class Headers {
    /**
     * 
     * @param {Headers|string[][]|object} headers 
     */
    constructor(headers) {
        this.map = {};

        if (headers instanceof Headers) {
            headers.forEach(function (value, name) {
                this.append(name, value);
            }, this);

        } else if (Array.isArray(headers)) {
            headers.forEach(function (header) {
                this.append(header[0], header[1]);
            }, this);

        } else if (headers) {
            Object.getOwnPropertyNames(headers).forEach(function (name) {
                this.append(name, headers[name]);
            }, this);
        }
    }

    get [Symbol.toStringTag]() {
        return 'Headers';
    }

    /**
     * @param {string} name 
     * @param {any} value 
     */
    append(name, value) {
        name = _normalizeName(name);
        value = _normalizeValue(value);
        const oldValue = this.map[name];
        this.map[name] = oldValue ? oldValue + ', ' + value : value;
    }

    /**
     * @param {string} name 
     */
    delete(name) {
        delete this.map[_normalizeName(name)];
    }

    /**
     * @param {string} name 
     * @returns {string}
     */
    get(name) {
        name = _normalizeName(name);
        return this.has(name) ? this.map[name] : null;
    }

    /**
     * @param {string} name 
     * @returns {boolean}
     */
    has(name) {
        return Object.prototype.hasOwnProperty.call(this.map, _normalizeName(name));
    }

    /**
     * @param {string} name 
     * @param {any} value 
     */
    set(name, value) {
        this.map[_normalizeName(name)] = _normalizeValue(value);
    }

    forEach(callback, thisArg) {
        for (const name in this.map) {
            if (Object.prototype.hasOwnProperty.call(this.map, name)) {
                callback.call(thisArg, this.map[name], name, this);
            }
        }
    }

    keys() {
        const items = [];
        this.forEach(function (value, name) {
            items.push(name);
        });
        return _iteratorFor(items);
    }

    values() {
        const items = [];
        this.forEach(function (value) {
            items.push(value);
        });
        return _iteratorFor(items);
    }

    entries() {
        const items = [];
        this.forEach(function (value, name) {
            items.push([name, value]);
        });
        return _iteratorFor(items);
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
    constructor(info) {
        this.method = METHODS[info.method];
        this.headers = new Headers(info.headers);
        this.url = info.url;

        let url = info.url;
        const host = this.headers.get('host') || '$host';
        if (url.startsWith('/')) {
            url = 'http://' + host + url;
        }

        const uri = new URL(url);

        const query = {};
        const search = uri.searchParams;
        search.forEach(function (value, key) {
            query[key] = value;
        });

        this.query = query;
        this.path = uri.pathname;
        this.uri = uri;
        this.locals = {};
        this.body = null;
    }

    get [Symbol.toStringTag]() {
        return 'IncomingMessage';
    }

    async arrayBuffer() {
        return this.body;
    }

    get(field) {
        return this.headers.get(field);
    }

    async json() {
        let result = null;
        try {
            const text = await this.text();
            result = JSON.parse(text);
        } catch (err) {
            result = null;
            this.error = err;
        }

        return result;
    }

    async text() {
        const result = this.body && $textDecoder.decode(this.body);
        return result;
    }
}

// ////////////////////////////////////////////////////////////
// ServerResponse

export class ServerResponse extends EventTarget {
    constructor(request) {
        super();

        this.body = null;
        this.bodyUsed = false;
        this.headers = new Headers();
        this.isHeadersSent = false;
        this.status = 200;
        this.statusText = 'OK';

        /** @type native.TCP */
        this.socket = null;

        const options = {};
        this.options = options;
        options.hasTransferEncoding = false;
        options.keepAlive = false;
        options.keepAliveTimeout = 60;
        options.sendDate = true;

        if (request) {
            if (request.headers.Connection == 'keep-alive') {
                options.keepAlive = true;
            }

            this.locals = request.locals;
        }

        this._onsocketclose = null;
    }

    get [Symbol.toStringTag]() {
        return 'ServerResponse';
    }

    /** @param {*} data */
    async end(data) {
        const socket = this.socket;
        if (!socket) {
            return;
        }

        this.socket = null;
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
                await socket.write('0\r\n\r\n');
            }

            if (options.keepAlive) {
                return;
            }

            await socket.shutdown();

        } catch (error) {

        }

        await socket.close();

        if (this._onsocketclose) {
            this._onsocketclose();
        }
    }

    /** @param {string} field */
    get(field) {
        return this.headers.get(field);
    }

    redirect(status, path) {

    }

    /** @param {*} data */
    async send(data) {
        if (data == null) {
            return;
        }

        if (typeof data == 'object') {
            data = JSON.stringify(data);
            this.type('json');
        }

        await this.write(data);
        await this.end();
    }

    /**
     * @param {string} field 
     * @param {string} value 
     */
    set(field, value) {
        return this.headers.set(field, value);
    }

    /**
     * @param {number} statusCode 
     * @param {string} statusText 
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

        if (!data) {
            return;
        }

        this.bodyUsed = true;
        if (!this.isHeadersSent) {
            await this.writeHead();
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

        // Date
        if (options.sendDate) {
            if (!headers.has('Date')) {
                const now = new Date();
                headers.set('Date', now.toISOString());
            }
        }

        // Transfer encoding
        if (this.bodyUsed && !hasContentLength) {
            if (!headers.has('Transfer-Encoding')) {
                headers.set('Transfer-Encoding', 'chunked');
                options.hasTransferEncoding = true;
            }
        }

        // Connection
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

        const lines = [];
        lines.push(startLine);
        headers.forEach(function (value, name) {
            lines.push(name + ': ' + value);
        });
        lines.push('\r\n');
        const message = lines.join('\r\n');

        await socket.write(message);
        this.isHeadersSent = true;
    }
}

defineEventAttribute(ServerResponse.prototype, 'close');
defineEventAttribute(ServerResponse.prototype, 'finish');

// ////////////////////////////////////////////////////////////
// Server

export class Server extends EventTarget {
    constructor(options, requestListener) {
        super();

        this.options = options;
        this.requestListener = requestListener;
        this.server = null;
        this.socket = null;
        this.nextRequestId = 0;
        this.nextConnectionId = 0;
        this.connections = {};

        setTimeout(() => { this._startServer(); }, 0);
    }

    get [Symbol.toStringTag]() {
        return 'Server';
    }

    /** @param {native.TCP} connection */
    async handleConnection(connection) {
        // console.log(this.nextRequestId++, 'accept');

        const requestListener = this.requestListener;

        const type = http.REQUEST;
        const parser = new http.Parser(type);

        let request = null;
        let response = null;
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
                request.body = byteArray.buffer;
                readBuffer = null;
            }

            // response
            response = new ServerResponse(request);
            response.socket = connection;

            response._onsocketclose = () => {
                onSocketClose();
            };

            if (requestListener) {
                await requestListener(request, response);
            }
        }

        const self = this;

        function onSocketClose() {
            if (response) {
                response.dispatchEvent(new Event('close'));
                response.socket = null;
            }

            request = null;
            response = null;

            parser.onbody = null;
            parser.onheaderscomplete = null;
            parser.onmessagecomplete = null;

            connection.onmessage = null;

            delete self.connections[connection._id];
        }

        async function parserOnMessageComplete() {
            await processRequest();
            resetRequestParser();
        }

        function parserOnBody(body) {
            if (!readBuffer) {
                readBuffer = [];
            }

            readBuffer.push(body);
        }

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
            onSocketClose();
        };

        connection.onerror = (error) => {
            this.dispatchEvent(new ErrorEvent('error', { error }));
        };

        connection.onmessage = async function (data) {
            if (data == null) {
                await connection.close();
                return;
            }

            parser.execute(data);
        };

        this.connections[connection._id] = connection;
    }

    async close() {
        const server = this.server;
        this.server = null;
        if (server) {
            server.close();
        }
    }

    async _startServer() {
        try {
            const options = this.options || {};
            const address = { address: '0.0.0.0', port: 80, family: 4 };
            address.port = options.port || 80;
            const backlog = options.backlog || 100;

            const server = new native.TCP();
            server.bind(address);
            server.listen(backlog);

            this.server = server;

            server.onclose = () => {
                
            };

            server.onerror = (error) => {
                this.dispatchEvent(new ErrorEvent('error', { error }));
            };

            server.onconnection = () => {
                const connection = server.accept();
                if (connection != null) {
                    this.nextConnectionId++;
                    connection._id = this.nextConnectionId;
                    this.handleConnection(connection);
                }
            };

        } catch (error) {
            this.dispatchEvent(new ErrorEvent('error', { error }));
            this.close();
        }
    }
}

defineEventAttribute(Server.prototype, 'error');

export function createServer(options, requestListener) {
    return new Server(options, requestListener);
}
