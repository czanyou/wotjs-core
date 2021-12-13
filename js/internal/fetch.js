// @ts-check
/// <reference path ="../../types/index.d.ts" />
/* eslint-disable no-prototype-builtins */
// Copyright (c) GitHub, Inc.
// License: MIT
import * as http from '@tjs/http';

/* global Blob FormData FileReader */

const Headers = http.Headers;

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

function consumed(body) {
    if (body.bodyUsed) {
        return Promise.reject(new TypeError('Already read'));
    }
    body.bodyUsed = true;
}

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

function readBlobAsArrayBuffer(blob) {
    const reader = new FileReader();
    const promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise;
}

function readBlobAsText(blob) {
    const reader = new FileReader();
    const promise = fileReaderReady(reader);
    reader.readAsText(blob);
    return promise;
}

function bufferClone(buf) {
    if (buf.slice) {
        return buf.slice(0);

    } else {
        const view = new Uint8Array(buf.byteLength);
        view.set(new Uint8Array(buf));
        return view.buffer;
    }
}

export class Body {
    constructor() {
        this.bodyUsed = false;
        this.headers = null;
    }

    get [Symbol.toStringTag]() {
        return 'Body';
    }

    _initBody(body) {
        this._rawBody = body;
        if (!body) {
            this._bodyText = '';

        } else if (typeof body === 'string') {
            this._bodyText = body;

        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            this._bodyText = body.toString();

        } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
            this._bodyBlob = body;

        } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
            this._bodyFormData = body;

        } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || ArrayBuffer.isView(body))) {
            this._bodyArrayBuffer = bufferClone(body);

        } else {
            this._bodyText = body = Object.prototype.toString.call(body);
        }

        const headers = this.headers;
        if (!headers.get('content-type')) {
            if (typeof body === 'string') {
                headers.set('content-type', 'text/plain;charset=UTF-8');

            } else if (this._bodyBlob && this._bodyBlob.type) {
                headers.set('content-type', this._bodyBlob.type);

            } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
            }
        }
    }

    blob() {
        const rejected = consumed(this);
        if (rejected) {
            return rejected;
        }

        if (this._bodyBlob) {
            return Promise.resolve(this._bodyBlob);

        } else if (this._bodyArrayBuffer) {
            return Promise.resolve(new Blob([this._bodyArrayBuffer]));

        } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as blob');

        } else {
            return Promise.resolve(new Blob([this._bodyText]));
        }
    }

    arrayBuffer() {
        if (this._bodyArrayBuffer) {
            return consumed(this) || Promise.resolve(this._bodyArrayBuffer);

        } else if (this._bodyText) {
            const encoder = new TextEncoder();
            return consumed(this) || Promise.resolve(encoder.encode(this._bodyText));

        } else if (this._bodyBlob) {
            return consumed(this) || readBlobAsArrayBuffer(this._bodyBlob);

        } else if (this._bodyFormData) {
            // TODO: 
        }
    }

    text() {
        const rejected = consumed(this);
        if (rejected) {
            return rejected;
        }

        if (this._bodyBlob) {
            return readBlobAsText(this._bodyBlob);

        } else if (this._bodyArrayBuffer) {
            const decoder = new TextDecoder();
            return Promise.resolve(decoder.decode(this._bodyArrayBuffer));

        } else if (this._bodyFormData) {
            throw new Error('could not read FormData body as text');

        } else {
            return Promise.resolve(this._bodyText);
        }
    }

    async formData() {
        function decode(body) {
            const form = new FormData();
            body.trim().split('&').forEach(function (bytes) {
                if (bytes) {
                    const split = bytes.split('=');
                    const name = split.shift().replace(/\+/g, ' ');
                    const value = split.join('=').replace(/\+/g, ' ');
                    form.append(decodeURIComponent(name), decodeURIComponent(value));
                }
            });
            return form;
        }

        return this.text().then(decode);
    }

    async json() {
        const text = await this.text();
        return JSON.parse(text);
    }
}

export class Request extends Body {
    constructor(input, options) {
        super();

        options = options || {};
        let body = options.body;

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
            if (!options.headers) {
                this.headers = new Headers(input.headers);
            }

            this.method = input.method;
            this.mode = input.mode;
            this.signal = input.signal;
            if (!body && input._rawBody != null) {
                body = input._rawBody;
                input.bodyUsed = true;
            }

        } else {
            this.url = String(input);
        }

        this.credentials = options.credentials || this.credentials || 'same-origin';
        if (options.headers || !this.headers) {
            this.headers = new Headers(options.headers);
        }

        this.method = normalizeMethod(options.method || this.method || 'GET');
        this.mode = options.mode || this.mode || null;
        this.signal = options.signal || this.signal;
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
}

export class Response extends Body {
    constructor(bodyInit, options) {
        super();

        if (!options) {
            options = {};
        }

        this.type = 'default';
        this.status = options.status === undefined ? 200 : options.status;
        this.ok = this.status >= 200 && this.status < 300;
        this.statusText = 'statusText' in options ? options.statusText : 'OK';
        this.headers = new Headers(options.headers);
        this.url = options.url || '';
        this._initBody(bodyInit);
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

    static error() {
        const response = new Response(null, { status: 0, statusText: '' });
        response.type = 'error';
        return response;
    }

    static redirect(url, status) {
        const redirectStatuses = [301, 302, 303, 307, 308];

        if (redirectStatuses.indexOf(status) === -1) {
            throw new RangeError('Invalid status code');
        }

        return new Response(null, { status: status, headers: { location: url } });
    }
}

// DOMException

export class DOMException extends Error {
    constructor(message, name) {
        super();

        this.message = message;
        this.name = name;
    }
}

// fetch

/**
 * 
 * @param {*} input 
 * @param {*} init 
 * @returns 
 */
export async function fetch(input, init) {
    const request = new Request(input, init);
    // @ts-ignore
    const result = await http.sendRequest(request);

    const options = {
        status: result.status,
        statusText: result.statusText,
        url: request.url,
        headers: result.headers
    };

    const response = new Response(result.body, options);
    return response;
}

Object.defineProperty(window, 'fetch', { enumerable: true, configurable: true, writable: true, value: fetch });
Object.defineProperty(window, 'Headers', { enumerable: true, configurable: true, writable: true, value: Headers });
Object.defineProperty(window, 'Request', { enumerable: true, configurable: true, writable: true, value: Request });
Object.defineProperty(window, 'Response', { enumerable: true, configurable: true, writable: true, value: Response });
