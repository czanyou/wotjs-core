// @ts-check
/// <reference path ="../../types/index.d.ts" />
/* eslint-disable no-prototype-builtins */

import * as native from '@tjs/native';
import * as dns from '@tjs/dns';
import * as streams from '@tjs/streams';
import * as process from '@tjs/process';

const http = native.http;
const zlib = native.zlib;
const DEBUG = 0;

/**
 * RequestOptions
 * @typedef RequestOptions
 * @property {string} [hostname]
 * @property {string} [host]
 * @property {string} [pathname]
 * @property {string} [search]
 * @property {string} [protocol]
 * @property {number} [port]
 * @property {URL} [uri]
 */

/**
 * ResponseInfo
 * @typedef ResponseInfo
 * @property {ArrayBuffer} [body]
 * @property {any} [headers]
 * @property {string} [statusText]
 * @property {string} [url]
 * @property {number} [status]
 * @property {number} [httpMinor]
 * @property {number} [httpMajor]
 */

// ////////////////////////////////////////////////////////////
// Headers

/** 
 * @param {string} name 
 * @return {string}
 */
function _normalizeName(name) {
    if (typeof name !== 'string') {
        name = String(name);
    }

    if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(name) || name === '') {
        throw new TypeError('Invalid character in header field name');
    }

    return name.toLowerCase();
}

/** 
 * @param {string} value 
 * @return {string}
 */
function _normalizeValue(value) {
    if (typeof value !== 'string') {
        value = String(value);
    }

    return value;
}

/**
 * Build a destructive iterator for the value list
 * @param {any[]} items 
 * @returns 
 */
function _iteratorFor(items) {
    const iterator = {
        next: function () {
            const value = items.shift();
            return { done: value === undefined, value };
        }
    };

    iterator[Symbol.iterator] = function () {
        return iterator;
    };

    return iterator;
}

/**
 * 代表 HTTP 消息头
 */
export class Headers {
    /**
     * 
     * @param {Headers|[string, string][]|{[key: string]: string}|null|any=} headers 
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

const support = {
    arrayBuffer: 'ArrayBuffer' in globalThis,
    formData: 'FormData' in globalThis,
    iterable: 'Symbol' in globalThis && 'iterator' in Symbol,
    searchParams: 'URLSearchParams' in globalThis,
    blob:
        'FileReader' in globalThis &&
        'Blob' in globalThis &&
        (function () {
            try {
                // eslint-disable-next-line no-new
                new Blob();
                return true;
            } catch (e) {
                return false;
            }
        })()
};

/**
 * 
 * @param {FileReader} reader 
 * @returns 
 */
function fileReaderReady(reader) {
    return new Promise(function (resolve, reject) {
        reader.onload = function () {
            resolve(reader.result);
        };

        reader.onerror = function () {
            reject(reader.error);
        };
    });
}

/**
 * @typedef {{ type: string, text?: string, blob?: Blob, formData?: FormData, arrayBuffer?: ArrayBuffer | ArrayBufferView }} RawBody
 */

/**
 * 代表一个 HTTP 消息体
 */
export class Body {
    constructor() {
        /** @type {ReadableStream<Uint8Array>=} */
        this._body = undefined;

        /** @type boolean 指出 body 内容是否已经读取过了 */
        this._bodyUsed = false;

        /** @type {BodyInit=} */
        this._rawBody = undefined;

        /** @type {string=} */
        this.encoding = undefined;
    }

    get [Symbol.toStringTag]() {
        return 'Body';
    }

    /** @type {ReadableStream|undefined} */
    get body() {
        if (this._body) {
            return this._body;
        }

        return this._body;
    }

    get bodyUsed() {
        return this._bodyUsed;
    }

    /**
     * 异步读取原始消息内容
     * - 如果消息已经接收完毕，立即返回所有内容
     * - 如果消息还没有收完，将等到消息结束才返回
     * - 如果是请求消息，则读取整个要发送的消息体的内容
     * - 如果是应答消息，则读取整个要接收的消息体的内容
     * @private
     * @returns {Promise<RawBody>}
     */
    async fullyReadBody() {
        if (this.bodyUsed) {
            // 不能重复读取
            return Promise.reject(new TypeError('Already read'));
        }

        this._bodyUsed = true;

        const body = await this.processBody();
        delete this._rawBody;
        return this._getBodyType(body);
    }

    /**
     * 初始化消息体内容
     * @param {BodyInit=} body 
     * @param {string=} encoding 
     */
    _initBody(body, encoding) {
        if (body instanceof ReadableStream) {
            this._body = body;
            delete this._rawBody;

        } else {
            delete this._body;
            this._rawBody = body;
        }

        if (encoding) {
            this.encoding = encoding;
        }
    }

    /**
     * 返回消息内容
     * - 可重载这个方法用来读取消息内容
     * @returns {Promise<BodyInit|undefined>}
     */
    async processBody() {
        if (this._rawBody != null) {
            return this._rawBody;
        }

        const readStream = this._body;
        if (readStream) {
            delete this._body;
            this._rawBody = await this.readFromStream(readStream);
        }

        return this._rawBody;
    }

    /**
     * @param {BodyInit=} body 
     * @return {RawBody}
     */
    _getBodyType(body) {

        /**
         * @param {ArrayBuffer | ArrayBufferView} buffer 
         * @returns {ArrayBufferLike}
         */
        function bufferClone(buffer) {
            // @ts-ignore
            if (buffer.slice) {
                // @ts-ignore
                return buffer.slice(0);

            } else {
                const view = new Uint8Array(buffer.byteLength);
                // @ts-ignore
                view.set(new Uint8Array(buffer));
                return view.buffer;
            }
        }

        /** @type {RawBody} */
        const result = { type: '' };

        if (body == null) {
            result.type = '';

        } else if (typeof body === 'string') {
            // string
            result.text = body;
            result.type = 'text';

        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            // URLSearchParams
            result.text = body.toString();
            result.type = 'text';

        } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
            // Blob
            result.blob = /** @type Blob */(body);
            result.type = 'blob';

        } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
            // FormData
            result.formData = /** @type FormData */(body);
            result.type = 'form';

        } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || ArrayBuffer.isView(body))) {
            // ArrayBuffer | ArrayBufferView
            result.arrayBuffer = bufferClone(/** @type ArrayBuffer | ArrayBufferView */(body));

            if (this.encoding == 'gzip') {
                result.arrayBuffer = zlib.ungzip(result.arrayBuffer, result.arrayBuffer.byteLength * 4);
            }

            result.type = 'buffer';

        } else {
            // toString
            result.text = Object.prototype.toString.call(body);
            result.type = 'text';
        }

        return result;
    }

    /**
     * 从 Stream 中读取所有内容
     * @param {ReadableStream=} readStream 
     * @returns {Promise<ArrayBuffer|undefined>}
     */
    async readFromStream(readStream) {
        if (readStream == null) {
            return;

        } else if (readStream.locked) {
            return;
        }

        // 读取缓存的内容
        const reader = readStream.getReader();
        if (!reader) {
            return;
        }

        /** @type Uint8Array[] */
        const readBuffer = [];
        while (true) {
            const result = await reader.read();
            if (result.done) {
                break;

            } else if (result.value == null) {
                break;
            }

            readBuffer.push(result.value);
        }

        if (!readBuffer.length) {
            return;
        }

        // total
        let totalLength = 0;
        for (let i = 0; i < readBuffer.length; i++) {
            const item = readBuffer[i];
            totalLength += item.byteLength;
        }

        // buffer
        let offset = 0;
        const byteArray = new Uint8Array(totalLength);
        for (let i = 0; i < readBuffer.length; i++) {
            const item = readBuffer[i];
            byteArray.set(item, offset);
            offset += item.length;
        }

        return byteArray.buffer;
    }

    destroy() {

    }

    /**
     * 当应答消息内容接收完毕
     * - 通知消息内容接收完毕
     * @returns {void}
     */
    end() {

    }

    /**
     * 读取 ArrayBuffer 格式消息内容
     * @returns Promise<ArrayBuffer>
     */
    async arrayBuffer() {

        /**
         * @param {Blob|File} blob 
         * @returns {Promise<ArrayBuffer>}
         */
        function readBlobAsArrayBuffer(blob) {
            const reader = new FileReader();
            const promise = fileReaderReady(reader);
            reader.readAsArrayBuffer(blob);
            return promise;
        }

        const body = await this.fullyReadBody();
        if (body == null) {
            // TODO: 

        } else if (body.arrayBuffer) {
            return Promise.resolve(body.arrayBuffer);

        } else if (body.text) {
            const encoder = new TextEncoder();
            return Promise.resolve(encoder.encode(body.text));

        } else if (body.blob) {
            return readBlobAsArrayBuffer(body.blob);

        } else if (body.formData) {
            // @ts-ignore
            return readBlobAsArrayBuffer(body.formData.toBlob());
        }
    }

    /**
     * @returns {Promise<Blob|undefined>}
     */
    async blob() {
        const body = await this.fullyReadBody();

        if (body.blob) {
            return Promise.resolve(body.blob);

        } else if (body.arrayBuffer) {
            return Promise.resolve(new Blob([body.arrayBuffer]));

        } else if (body.formData) {
            // @ts-ignore
            return body.formData.toBlob();

        } else {
            return Promise.resolve(new Blob([body.text || '']));
        }
    }

    /**
     * @returns {Promise<string|undefined>}
     */
    async text() {

        /**
         * @param {Blob|File} blob 
         * @returns {Promise<string>}
         */
        function readBlobAsText(blob) {
            const reader = new FileReader();
            const promise = fileReaderReady(reader);
            reader.readAsText(blob);
            return promise;
        }

        const body = await this.fullyReadBody();

        if (body.blob) {
            return readBlobAsText(body.blob);

        } else if (body.arrayBuffer) {
            const decoder = new TextDecoder();
            return Promise.resolve(decoder.decode(body.arrayBuffer));

        } else if (body.formData) {
            // @ts-ignore
            return body.formData.toBlob().text();

        } else {
            return Promise.resolve(body.text);
        }
    }

    /**
     * @returns {Promise<FormData|undefined>}
     */
    async formData() {
        const body = await this.text();
        if (body == null) {
            return;
        }

        const form = new FormData();
        body.trim().split('&').forEach(function (bytes) {
            if (bytes) {
                const split = bytes.split('=');
                const name = split.shift()?.replace(/\+/g, ' ');
                const value = split.join('=').replace(/\+/g, ' ');

                if (name) {
                    form.append(decodeURIComponent(name), decodeURIComponent(value));
                }
            }
        });

        return form;
    }

    // text -> json
    async json() {
        try {
            const text = await this.text();
            if (!text || !text.length) {
                return;
            }

            return JSON.parse(text);

        } catch (err) {
            return err;
        }
    }
}

/**
 * 代表一个 HTTP 请求
 */
export class Request extends Body {
    /**
     * @param {Request|RequestInfo|URL} input 
     * @param {RequestInit=} options 
     */
    constructor(input, options) {
        super();

        let body = options?.body || '';

        /** @type {Headers=} */
        this.headers = undefined;

        /**
         * 
         * @param {string} method 
         * @returns string
         */
        function normalizeMethod(method) {
            // HTTP methods whose capitalization should be normalized
            const methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

            const upcased = method.toUpperCase();
            return methods.indexOf(upcased) > -1 ? upcased : method;
        }

        if (input instanceof Request) {
            if (input.bodyUsed) {
                throw new TypeError('Already read');
            }

            this.url = input.url;
            this.credentials = input.credentials;
            if (!options?.headers) {
                this.headers = new Headers(input.headers);
            }

            this.method = input.method;
            this.mode = input.mode;
            this.signal = input.signal;

            if (!body && input._rawBody != null) {
                body = input._rawBody;
                input._bodyUsed = true;
            }

        } else {
            this.url = String(input);
        }

        this.credentials = options?.credentials || this.credentials || 'same-origin';
        if (options?.headers || !this.headers) {
            this.headers = new Headers(options?.headers);
        }

        if (!this.headers) {
            this.headers = new Headers();
        }

        /** @type {string} */
        this.method = normalizeMethod(options?.method || this.method || 'GET');

        /** @type {RequestMode} */
        this.mode = options?.mode || this.mode || null;

        /** @type {boolean} */
        // @ts-ignore
        this.debug = options?.debug;

        /** @type AbortSignal */
        this.signal = options?.signal || this.signal;

        this.referrer = null;

        if ((this.method === 'GET' || this.method === 'HEAD') && body) {
            throw new TypeError('Body not allowed for GET or HEAD requests');
        }

        this._initBody(body);
    }

    get [Symbol.toStringTag]() {
        return 'Request';
    }

    clone() {
        return new Request(this, { body: this._rawBody });
    }

    destroy() {
        super.destroy();

        delete this._rawBody;

        this.headers = undefined;
        this.signal = undefined;

        const stream = this._body;
        if (stream) {
            delete this._body;
            stream.cancel();
        }
    }

    /**
     * 当请求发送完毕时，调用这个方法
     */
    end() {
        super.end();

        this.headers = undefined;
        this.signal = undefined;

        delete this._rawBody;
        delete this._body;
    }

    /**
     * 初始化消息体内容
     * @param {BodyInit=} body 
     * @param {string=} encoding 
     */
    _initBody(body, encoding) {
        super._initBody(body, encoding);

        const headers = this.headers;
        if (headers == null) {
            return;

        } else if (headers.get('content-type')) {
            return;
        }

        if (body == null || body == '') {
            // TODO:

        } else if (typeof body === 'string') {
            headers.set('Content-Type', 'text/plain;charset=UTF-8');

        } else if (body instanceof Blob) {
            if (body.type) {
                headers.set('Content-Type', body.type);
            }

        } else if (body instanceof FormData) {
            // @ts-ignore
            headers.set('Content-Type', 'multipart/form-data; boundary=' + body.boundary);

        } else if (body instanceof URLSearchParams) {
            headers.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        }
    }
}

/**
 * 代理一个 HTTP 应答
 */
export class Response extends Body {
    /**
     * @param {BodyInit=} body
     * @param {ResponseInfo=} init
     */
    constructor(body, init) {
        super();

        if (!init) {
            init = {};
        }

        /** @type {Headers=} */
        this.headers = new Headers(init.headers);

        /** @type boolean */
        this.ok = (this.status >= 200) && (this.status < 300);

        /** @type boolean */
        this.redirected = false;

        /** @type {Request=} */
        this.request = undefined;

        /** @type number */
        this.status = (init.status === undefined) ? 200 : init.status;

        /** @type {string=} */
        this.statusText = ('statusText' in init) ? init.statusText : 'OK';

        /** @type string */
        this.type = 'default';

        /** @type string */
        this.url = init.url || '';

        const encoding = this.headers.get('content-encoding');
        this._initBody(body, encoding);
    }

    get [Symbol.toStringTag]() {
        return 'Response';
    }

    clone() {
        return new Response(this._rawBody, {
            status: this.status,
            statusText: this.statusText,
            headers: new Headers(this.headers),
            url: this.url
        });
    }

    destroy() {
        super.destroy();

        delete this._rawBody;
        delete this._body;
        delete this.headers;
    }

    /**
     * 当应答接收完毕时，调用这个方法
     */
    end() {
        super.end();

        delete this.request;
    }

    static error() {
        const response = new Response(undefined, { status: 0, statusText: '' });
        response.type = 'error';
        return response;
    }

    /**
     * 
     * @param {string} url 
     * @param {number} status 
     * @returns 
     */
    static redirect(url, status) {
        const redirectStatuses = [301, 302, 303, 307, 308];

        if (redirectStatuses.indexOf(status) === -1) {
            throw new RangeError('Invalid status code');
        }

        return new Response(undefined, { status, headers: { location: url } });
    }
}

// ////////////////////////////////////////////////////////////
// FetchContext

/**
 * @typedef FetchContext
 * @property {(value: any) => void=} callback 应答回调函数
 * @property {number} loadedLength 应答消息体已下载的长度。
 * @property {number} totalLength 应答消息体总长度, NaN 表消息长度未知，0 表示没有消息体。
 * @property {ReadableStreamDefaultController<Uint8Array>=} readController 消息体读取流控制器
 * @property {ReadableStream=} readStream 消息体读取流
 */

/**
 * 客户端连接
 */
export class FetchConnection {
    /**
     * @param {number} id 
     */
    constructor(id) {
        /** @type {native.TLS | native.TCP=} 网络层连接 */
        this.socket = undefined;

        /** @type {FetchContext=} 上下文 */
        this.context = { loadedLength: 0, totalLength: NaN };

        /** @type {string=} 绑定的主机地址 */
        this.host = undefined;

        /** @type {number} 唯一 ID */
        this.id = id || 0;

        /** @type {boolean} 是否保存连接 */
        this.isKeepAlive = true;

        /** @type {Error=} 最后发生的错误 */
        this.lastError = undefined;

        /** @type {native.http.Parser=} 消息解析器 */
        this.messageParser = undefined;

        /** @type {number} 当前状态 */
        this.readyState = FetchConnection.INIT;

        /** @type {Request=} 请求对象 */
        this.request = undefined;

        /** @type {Response=} 应答消息 */
        this.response = undefined;

        /** @type {number} 最后活跃时间 */
        this.updated = Date.now();
    }

    /**
     * 关闭这个连接，释放所有的资源
     */
    close() {
        // 1. 清除上下文
        const requestContext = this.context;
        if (requestContext) {
            this.context = undefined;

            requestContext.readController?.close();
            requestContext.readStream = undefined;
            requestContext.readController = undefined;

            const callback = requestContext.callback;
            if (callback) {
                requestContext.callback = undefined;
                callback(null);
            }
        }

        // 2. close socket
        const socket = this.socket;
        if (socket) {
            // console.log('close:', this.host);
            this.socket = undefined;

            socket.onclose = undefined;
            socket.onconnect = undefined;
            socket.onopen = undefined;
            socket.onerror = undefined;
            socket.onmessage = undefined;
            socket.close();
        }

        // 3. 清除 parser
        const messageParser = this.messageParser;
        if (messageParser) {
            this.messageParser = undefined;

            messageParser.onbody = undefined;
            messageParser.onheaderscomplete = undefined;
            messageParser.onmessagecomplete = undefined;
        }

        // 4. response
        const response = this.response;
        if (response) {
            this.response = undefined;
            response.end();
        }

        // 5. request
        const request = this.request;
        if (request) {
            this.request = undefined;

            request.end();
            request.destroy();
        }

        // 回到初始状态
        this.setReadyState(FetchConnection.CLOSED);
    }

    /**
     * 创建连接
     * @param {RequestOptions} options 连接选项
     * @returns {Promise<native.TLS|native.TCP|undefined>} 返回创建的连接
     */
    async connect(options) {
        this.response = undefined;
        this.lastError = undefined;

        if (this.socket) {
            if (this.readyState == FetchConnection.IDLE) {
                this.setReadyState(FetchConnection.CONNECTED);
            }

            return this.socket;
        }

        try {
            // 1. lookup
            this.setReadyState(FetchConnection.LOOKUPING);

            if (DEBUG) {
                console.log('fetch:', 'connect:', options.hostname);
            }

            const hostname = options.hostname;
            if (!hostname) {
                throw new Error('Invalid hostname');
            }

            const request = this.request;
            if (request?.debug) {
                console.write('正在解析主机', hostname, '... ');
            }

            const address = await dns.lookup(hostname, { family: 4 });
            if (address == null || Array.isArray(address)) {
                if (request?.debug) {
                    console.print('hostname lookup failed');
                }

                throw new Error('hostname lookup failed');
            }

            if (request?.debug) {
                console.print(address.address);
            }

            this.updated = Date.now();
            address.host = options.hostname;

            // 2. create socket
            /** @type {native.TCP|native.TLS=} */
            let socket;
            if (options.protocol == 'https:') {
                // console.log('fetch:', 'connect:', request, options);
                address.port = options.port || 443;
                socket = new native.TLS();

            } else {
                address.port = options.port || 80;
                socket = new native.TCP();
            }

            this.socket = socket;

            const self = this;
            socket.onerror = function (error) {
                console.log('connect:', 'error:', error);
                self.lastError = error;
                self.close();
            };

            /**
             * 收到传输层数据
             * @param {ArrayBuffer} data 
             * @returns {void}
             */
            socket.onmessage = function (data) {
                if (data == null) {
                    self.onResponseBodyEnd();
                    self.close();
                    return;
                }

                // const textDecoder = new TextDecoder();
                // console.log('data:', textDecoder.decode(data));

                const messageParser = self.messageParser;
                messageParser?.execute(data);
            };

            // 3. Connect to server
            this.setReadyState(FetchConnection.CONNECTING);
            if (request?.debug) {
                console.write('正在连接', address.address, address.port, '... ');
            }

            await socket.connect(address);

            if (request?.debug) {
                console.print('已连接.');
            }

            // 4. connected
            this.setReadyState(FetchConnection.CONNECTED);
            this.updated = Date.now();

            return socket;

        } catch (error) {
            this.lastError = error;
            this.close();

            throw error;
        }
    }

    /**
     * 指出这个连接是否已经过期了
     * @returns {boolean}
     */
    isExpired() {
        if (this.context == null) {
            return true;

        } else if (this.readyState == FetchConnection.CLOSED) {
            return true;
        }

        const now = Date.now();
        const span = Math.abs(now - this.updated);
        const TIMEOUT = 10;
        if (span >= TIMEOUT * 1000) {
            return true;
        }

        return false;
    }

    /**
     * 当请求发送完毕
     */
    onRequestEnd() {
        this.request?.end();
        this.updated = Date.now();
        this.setReadyState(FetchConnection.REQUEST_END);
    }

    /**
     * 应答消息内容数据
     * @param {ArrayBuffer} data 
     */
    onResponseBodyData(data) {
        const requestContext = this.context;
        if (requestContext == null) {
            return;
        }

        if (DEBUG) {
            console.log('onBodyData:', data?.byteLength);
        }

        if (data) {
            requestContext.readController?.enqueue(new Uint8Array(data));
            requestContext.loadedLength = (requestContext.loadedLength || 0) + data.byteLength;
            this.updated = Date.now();
            // console.log('fetch:', 'body:', requestContext.loadedLength);
        }

        if (requestContext.totalLength) {
            // 消息内容接收完毕
            if (requestContext.loadedLength >= requestContext.totalLength) {
                this.onResponseBodyEnd();
            }
        }
    }

    /**
     * 应答消息内容接收完毕
     * @returns 
     */
    onResponseBodyEnd() {
        const requestContext = this.context;
        if (requestContext == null) {
            this.close();
            return;

        } else if (this.readyState != FetchConnection.RESPONSE_START) {
            return;
        }

        this.setReadyState(FetchConnection.RESPONSE_END);
        this.updated = Date.now();

        // 2. close connection
        const isKeepAlive = this.isKeepAlive;

        const request = this.request;
        if (request?.debug) {
            console.print('应答消息体接收完毕。');
        }

        if (DEBUG) {
            console.log('fetch:', 'onResponseBodyEnd:', isKeepAlive);
        }

        if (!isKeepAlive) {
            this.close();
            return;
        }

        // 3. reset connection
        if (this.readyState > FetchConnection.CONNECTED) {
            this.setReadyState(FetchConnection.IDLE);
        }

        // console.log('fetch:', 'end:', connection);
        requestContext.readController?.close();
        requestContext.readController = undefined;
        requestContext.readStream = undefined;
        requestContext.loadedLength = 0;
        requestContext.totalLength = 0;

        // response
        const response = this.response;
        if (response) {
            this.response = undefined;
            response.end();
        }

        // request
        if (request) {
            this.request = undefined;
            request.end();
            request.destroy();
        }
    }

    /**
     * 已收到收应答消息头，开始接收应答消息内容
     * @param {ResponseInfo} responseInfo
     */
    onResponseBodyStart(responseInfo) {
        const requestContext = this.context;
        if (requestContext == null) {
            return;

        } else if (this.readyState != FetchConnection.REQUEST_END) {
            return;
        }

        const request = this.request;

        this.setReadyState(FetchConnection.RESPONSE_START);

        // 1. headers
        const responseHeaders = new Headers(responseInfo.headers);
        requestContext.totalLength = Number.parseInt(responseHeaders.get('Content-Length'));
        this.updated = Date.now();

        const connection = responseHeaders?.get('connection');
        if (connection == 'close') {
            this.isKeepAlive = false;
        }

        if (request?.method == 'HEAD') {
            // 正常情况下，HEAD 不应该有消息体，但是有些服务出现错误时会返回错误消息内容
            if (responseInfo?.status == 200) {
                requestContext.totalLength = 0;

            } else if (isNaN(requestContext.totalLength)) {
                requestContext.totalLength = 0;
            }
        }

        // 2. response
        const response = new Response(undefined, {
            status: responseInfo?.status,
            statusText: responseInfo?.statusText,
            headers: responseHeaders
        });

        response.request = request;

        // @ts-ignore
        // response.connection = this;

        // 3. response body
        if (DEBUG) {
            console.log('onResponseBodyStart:', request?.method, request?.url, response.status, 'headers:', response.headers, requestContext);
        }

        if (requestContext.totalLength !== 0) {
            /** @type ReadableStream<Uint8Array> */
            // @ts-ignore
            requestContext.readStream = new streams.ReadableStream({
                start(controller) {
                    // @ts-ignore
                    requestContext.readController = controller;
                }
            });

            response._body = requestContext.readStream;
        }

        this.response = response;

        // 4. call response callback
        const callback = requestContext.callback;
        if (callback) {
            requestContext.callback = undefined;
            callback(response);
        }

        // 5. response body end
        if (requestContext.totalLength === 0) {
            // 没有消息内容可接收
            this.onResponseBodyEnd();
        }
    }

    /**
     * 发送 HTTP 请求消息和内容
     * @param {RequestOptions} options 请求选项
     * @returns {Promise<void>}
     * @throw 如果发生错误
     */
    async sendRequest(options) {
        const socket = this.socket;
        if (socket == null) {
            throw new Error('Invalid socket');

        } else if (this.readyState != FetchConnection.CONNECTED) {
            throw new Error('Invalid readyState: ' + this.readyState);
        }

        const request = this.request;
        if (request == null) {
            throw new Error('request is null');
        }

        try {
            this.setReadyState(FetchConnection.REQUEST_START);
            this.messageParser?.init(http.RESPONSE);

            // console.log('fetch:', `connect: ${options.protocol}//${address.address}`);

            // 1. Init request headers
            const headers = request.headers;
            headers?.set('Host', options.host);

            let bodyData = null;
            const bodyStream = request.body;
            if (!bodyStream) {
                bodyData = await request.arrayBuffer();
                if (headers?.get('Content-Length') == null) {
                    if (bodyData) {
                        headers?.set('Content-Length', bodyData.byteLength);
                    }
                }
            }

            // 2. Encode request headers
            const method = request.method || 'GET';
            let pathname = options.pathname || '/';
            if (options.search) {
                pathname += options.search;
            }

            const startLine = method + ' ' + pathname + ' HTTP/1.1';
            const lines = [];
            lines.push(startLine);
            headers?.forEach(function (/** @type string */ value, /** @type string */ name) {
                lines.push(name + ': ' + value);
            });

            lines.push('\r\n');

            // 3. Send request headers
            const message = lines.join('\r\n');
            await socket.write(message);
            this.updated = Date.now();

            // console.log('fetch:', 'write:', message);

            // 4. Send request body
            // console.log('fetch:', 'body:', bodyData, body);
            if (bodyData) {
                await socket.write(bodyData);
                // console.log('fetch:', 'body:', bodyData);

            } else if (bodyStream) {
                await this.sendRequestBody(bodyStream);
            }

            // 5. 请求发送完毕，清理相关的资源
            this.onRequestEnd();

        } catch (error) {
            console.log('sendRequest:', 'error:', error);
            this.lastError = error;
            this.close();

            throw error;
        }
    }

    /**
     * @private
     * @param {ReadableStream} body 
     */
    async sendRequestBody(body) {
        const socket = this.socket;

        const reader = body.getReader();
        if (reader == null) {
            return;
        }

        while (true) {
            const result = await reader.read();
            if (result.done) {
                break;

            } else if (result.value != null) {
                // console.log('data:', result.value.length, util.hash(result.value, 'md5'));
                await socket?.write(result.value);
                this.updated = Date.now();
            }
        }
    }

    /**
     * @param {number} state 
     */
    setReadyState(state) {
        if (this.readyState != state) {
            this.readyState = state;

            if (DEBUG) {
                console.log('setReadyState:', this.id, this.host, state);
            }

            const socket = this.socket;
            if (state == FetchConnection.IDLE) {
                // 当连接处于空闲状态时，取消引用，使程序可以自动退出
                socket?.unref();

            } else if (state == FetchConnection.REQUEST_START) {
                // 当空闲的连接开始新的请求时，重新引用
                socket?.ref();
            }
        }
    }

    startParser() {
        // response parser
        if (this.messageParser) {
            return;
        }

        const self = this;

        /**
         * 应答消息内容数据
         * @param {ArrayBuffer} data 
         */
        function onBodyData(data) {
            self.onResponseBodyData(data);
        }

        /**
         * 当应答消息头接收完毕
         * @param {native.http.Message} responseInfo 
         */
        function onHeadersComplete(responseInfo) {
            // console.log('onHeadersComplete:', responseInfo);
            self.onResponseBodyStart(responseInfo);
        }

        /**
         * 当整个应答消息接收完毕
         */
        function onMessageComplete() {
            // console.log('onMessageComplete');
            self.onResponseBodyEnd();
        }

        const messageParser = new http.Parser(http.RESPONSE);
        messageParser.onbody = onBodyData;
        messageParser.onheaderscomplete = onHeadersComplete;
        messageParser.onmessagecomplete = onMessageComplete;
        this.messageParser = messageParser;
    }

    /**
     * 等待 HTTP 应答消息
     * @param {(result?: any, error?: any) => void} callback 
     */
    waitResponse(callback) {
        const requestContext = this.context;
        if (requestContext == null) {
            // 如果这个连接已经关闭了
            const error = this.lastError || new TypeError('Connection is closed');
            callback(null, error);
            return;

        } else if (requestContext.callback) {
            callback(null, new TypeError('Already waiting for response'));
            return;
        }

        requestContext.callback = callback;
    }
}

/** 初始状态 */
FetchConnection.INIT = 0;

/** 已关闭状态 */
FetchConnection.CLOSED = 1;

/** 正在解析地址 */
FetchConnection.LOOKUPING = 2;

/** 连接中 */
FetchConnection.CONNECTING = 3;

/** 已连接到服务器 */
FetchConnection.CONNECTED = 4;

/** 开始发送请求 */
FetchConnection.REQUEST_START = 5;

/** 请求发送完毕 */
FetchConnection.REQUEST_END = 6;

/** 开始接收应答 */
FetchConnection.RESPONSE_START = 7;

/** 应答接收完毕 */
FetchConnection.RESPONSE_END = 8;

/** 空闲状态 */
FetchConnection.IDLE = 9;

/**
 * 客户端连接管理器
 */
export class FetchManager {
    constructor() {
        /** @type {any} */
        this.checkTimer = null;

        /** @type {Map<number, FetchConnection>} */
        this.fetchConnections = new Map();

        /** @type {number} */
        this.nextConnectionId = 0;
    }

    /**
     * 关闭并释放所有的资源
     */
    close() {
        const checkTimer = this.checkTimer;
        if (checkTimer) {
            this.checkTimer = null;

            clearInterval(checkTimer);
        }

        // 关闭所有的连接
        const connections = this.fetchConnections;
        if (connections.size > 0) {
            for (const connection of connections.values()) {
                connection.close();
            }

            connections.clear();
        }
    }

    /**
     * 关闭已过期的连接
     */
    closeExpiredConnections() {
        const connections = this.fetchConnections;
        for (const connection of connections.values()) {
            if (connection?.isExpired()) {
                connection.close();
                connections.delete(connection.id);
            }
        }
    }

    /**
     * 关闭所有空闲的连接
     */
    closeIdleConnections() {
        const connections = this.fetchConnections;
        for (const connection of connections.values()) {
            if (connection.readyState == FetchConnection.IDLE) {
                connection.close();
                connections.delete(connection.id);
            }
        }
    }

    /**
     * 返回指定名称的连接
     * @param {string=} host 
     * @returns {FetchConnection=}
     */
    get(host) {
        const connections = this.fetchConnections;
        for (const connection of connections.values()) {
            if (connection.host == host && connection.context != null) {
                if (connection.readyState == FetchConnection.IDLE) {
                    return connection;
                }
            }
        }
    }

    /**
     * 打开指定的连接
     * @param {Request} request 要发送的请求
     * @param {RequestOptions} options 连接选项
     * @returns {Promise<FetchConnection|undefined>}
     * @throw 如果发生错误
     */
    async open(request, options) {
        const host = options.host;
        if (!host) {
            return;
        }

        // 0. 返回已存在的空闲连接
        const connections = this.fetchConnections;
        const connection = this.get(host);
        if (connection) {
            connection.request = request;

            if (request?.debug) {
                console.print('使用空闲的连接:', connection.id, connection.host, connections.size);
            }

            await connection.connect(options);
            return connection;
        }

        // 1. fetcher id
        const fetcherId = (this.nextConnectionId || 0) + 1;
        this.nextConnectionId = fetcherId;

        const fetcher = new FetchConnection(fetcherId);
        fetcher.request = request;
        fetcher.host = host;

        // 2. connect
        connections.set(fetcherId, fetcher);

        // console.log('fetch:', 'sendRequest:', options.host);
        const socket = await fetcher.connect(options);
        if (socket == null) {
            throw new Error('Create socket failed.');
        }

        fetcher.startParser();

        this.startTimer();
        return fetcher;
    }

    onCheckTimer() {
        // console.log('onCheckTimer:');
        this.closeExpiredConnections();
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

const $fetchManager = new FetchManager();

// fetch

export function close() {
    $fetchManager?.close();
}

/**
 * fetch
 * @param {URL|RequestInfo} input 
 * @param {RequestInit=} init
 * @returns {Promise<Response|undefined>}
 */
export async function fetch(input, init) {

    // 0. 初始化请求
    const request = new Request(input, init);
    if (!request.url) {
        return;
    }

    const uri = new URL(request.url);

    /** @type RequestOptions */
    const options = {};
    options.uri = uri;
    options.hostname = uri.hostname;
    options.host = uri.host;
    options.pathname = uri.pathname;
    options.search = uri.search;
    options.protocol = uri.protocol;

    if (uri.port) {
        options.port = Number.parseInt(uri.port);
    }

    // 1. 创建连接
    const fetcher = await $fetchManager.open(request, options);
    if (fetcher == null) {
        return;
    }

    if (DEBUG) {
        // console.log('fetch:', 'request:', request);
    }

    // 2. 发送请求
    await fetcher.sendRequest(options);

    if (request?.debug) {
        console.write('已发出 HTTP 请求，正在等待回应... ');
    }

    // 3. 等待应答
    /** @type Promise<Response|undefined> */
    return new Promise((resolve, reject) => {
        if (DEBUG) {
            console.log('fetch:', 'response:');
        }

        fetcher.waitResponse((result, error) => {
            if (error != null) {
                if (request?.debug) {
                    console.print(error);
                }

                reject(error);

            } else {
                if (request?.debug) {
                    console.print(result?.status, result?.statusText);
                }

                resolve(result);
            }
        });
    });
}

export function getManager() {
    return $fetchManager;
}

Object.defineProperty(window, 'fetch', { enumerable: true, configurable: true, writable: true, value: fetch });
Object.defineProperty(window, 'Headers', { enumerable: true, configurable: true, writable: true, value: Headers });
Object.defineProperty(window, 'Request', { enumerable: true, configurable: true, writable: true, value: Request });
Object.defineProperty(window, 'Response', { enumerable: true, configurable: true, writable: true, value: Response });
