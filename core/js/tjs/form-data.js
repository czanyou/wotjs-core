// @ts-check
/// <reference path ="../../types/index.d.ts" />
/* formdata-polyfill. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */

import { defineEventAttribute, EventTarget } from '@tjs/event-target';

/**
 * @param {IArguments} args 
 * @param {number} expected 
 */
function ensureArgs(args, expected) {
    if (args.length < expected) {
        throw new TypeError(`${expected} argument required, but only ${args.length} present.`);
    }
}

/**
 * @param {string} name 
 * @param {string|Blob|File} value 
 * @param {string} [filename] 
 * @returns 
 */
function normalizeArgs(name, value, filename) {
    if (value instanceof Blob) {
        if (filename !== undefined) {
            filename = String(filename + '');

        } else if (typeof value.name === 'string') {
            filename = value.name;

        } else {
            filename = 'blob';
        }

        if (value.name !== filename || Object.prototype.toString.call(value) === '[object Blob]') {
            value = new File([value], filename, { type: value.type });
        }

        return [String(name), value];
    }

    return [String(name), String(value)];
}

// normalize line feeds for textarea
// https://html.spec.whatwg.org/multipage/form-elements.html#textarea-line-break-normalisation-transformation
function normalizeLinefeeds(value) {
    return value.replace(/\r?\n|\r/g, '\r\n');
}

function each(array, callback) {
    for (let i = 0; i < array.length; i++) {
        callback(array[i]);
    }
}

const escape = (/** @type {string} */ str) => str.replace(/\n/g, '%0A').replace(/\r/g, '%0D').replace(/"/g, '%22');

export class Blob {
    /**
     * @param {string[]|Blob[]|ArrayBuffer[]|ArrayBufferView[]} blobParts 
     * @param {*} options 
     * @returns 
     */
    constructor(blobParts, options) {
        /** @type string */
        this.type = options && options.type;

        /** @type number */
        this.size = 0;

        /** @type string | undefined */
        this.name = undefined;

        const textEncoder = new TextEncoder();

        if (!Array.isArray(blobParts)) {
            return;
        }

        /** @type ArrayBufferLike[] */
        const list = [];
        for (const data of blobParts) {
            if (data == null) {
                continue;

            } else if (data instanceof Blob) {
                list.push(data._buffer && data._buffer.buffer);

            } else if (data instanceof ArrayBuffer) {
                list.push(data);

            } else if (ArrayBuffer.isView(data)) {
                list.push(data.buffer);

            } else {
                const text = String(data);
                list.push(textEncoder.encode(text).buffer);
            }
        }

        for (const buffer of list) {
            this.size += buffer.byteLength;
        }

        let offset = 0;
        const blobBuffer = new Uint8Array(this.size);
        for (const buffer of list) {
            blobBuffer.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
        }

        /** @type Uint8Array */
        this._buffer = blobBuffer;
    }

    get [Symbol.toStringTag]() {
        return 'Blob';
    }

    async arrayBuffer() {
        return this._buffer?.buffer;
    }

    /**
     * @param {number} start 
     * @param {number} end 
     * @param {string} contentType 
     */
    slice(start, end, contentType) {
        if (!this._buffer) {
            return;
        }

        const buffer = this._buffer.slice(start, end);
        return new Blob([buffer], { type: contentType });
    }

    async text() {
        const textDecoder = new TextDecoder();
        return textDecoder.decode(this._buffer);
    }
}

Object.defineProperty(window, 'Blob', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Blob
});

export class File extends Blob {
    /**
     * @param {string[]|Blob[]|ArrayBuffer[]} fileBits 
     * @param {string} filename 
     * @param {*} [options] 
     */
    constructor(fileBits, filename, options) {
        options = Object.assign({ type: 'application/octet-stream' }, options);
        if (typeof filename == 'string') {
            options.name = filename;
        }

        super(fileBits, options);

        /** @type string */
        this.name = options.name;

        /** @type number */
        this.lastModified = options.lastModified;
    }

    get [Symbol.toStringTag]() {
        return 'File';
    }
}

Object.defineProperty(window, 'File', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: File
});

export class FileReader extends EventTarget {
    constructor() {
        super();

        this.error = undefined;

        this.readyState = undefined;

        this.result = undefined;
    }

    abort() {
        this.removeAllEventListeners();
    }

    /**
     * 
     * @param {*} result 
     */
    _setResult(result) {
        this.result = result;
        this.dispatchEvent(new Event('load'));
    }

    /**
     * 
     * @param {*} error 
     */
    _setError(error) {
        this.error = error;
        this.dispatchEvent(new Event('error'));
    }

    /**
     * 
     * @param {Blob|File} blob 
     */
    readAsArrayBuffer(blob) {
        const promise = blob?.arrayBuffer();
        promise.then(result => this._setResult(result)).catch(error => this._setError(error));
    }

    /**
     * 
     * @param {Blob|File} blob 
     */
    readAsBinaryString(blob) {
        const promise = blob?.text();
        promise.then(result => this._setResult(result)).catch(error => this._setError(error));
    }

    /**
     * 
     * @param {Blob|File} blob 
     */
    readAsDataURL(blob) {

    }

    /**
     * 
     * @param {Blob|File} blob 
     * @param {string=} encoding 
     */
    readAsText(blob, encoding) {
        const promise = blob?.text();
        promise.then(result => this._setResult(result)).catch(error => this._setError(error));

    }
}

defineEventAttribute(FileReader.prototype, 'error');
defineEventAttribute(FileReader.prototype, 'load');

Object.defineProperty(window, 'FileReader', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: FileReader
});

/**
 * @implements {Iterable}
 */
export class FormData {
    /**
     * FormData class
     *
     * @param {HTMLElement=} form
     */
    constructor(form) {
        this._data = [];

        this.boundary = '----formdata-' + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }

    get [Symbol.toStringTag]() {
        return 'FormData';
    }

    /**
     * Append a field
     *
     * @param {string} name field name
     * @param {string|Blob|File} value string / blob / file
     * @param {string=} filename filename to use with blob
     * @return {void}
     */
    append(name, value, filename) {
        ensureArgs(arguments, 2);
        this._data.push(normalizeArgs(name, value, filename));
    }

    /**
     * Delete all fields values given name
     *
     * @param   {string}  name  Field name
     * @return  {void}
     */
    delete(name) {
        ensureArgs(arguments, 1);
        const result = [];
        name = String(name);

        each(this._data, entry => {
            entry[0] !== name && result.push(entry);
        });

        this._data = result;
    }

    /**
     * Iterate over all fields as [name, value]
     *
     * @return {Iterator}
     */
    * entries() {
        for (let i = 0; i < this._data.length; i++) {
            yield this._data[i];
        }
    }

    /**
     * Iterate over all fields
     *
     * @param   {Function}  callback  Executed for each item with parameters (value, name, thisArg)
     * @param   {Object=}   thisArg   `this` context for callback function
     * @return  {void}
     */
    forEach(callback, thisArg) {
        ensureArgs(arguments, 1);
        for (const [name, value] of this) {
            callback.call(thisArg, value, name, this);
        }
    }

    /**
     * Return first field value given name
     * or null if non existent
     *
     * @param   {string}  name      Field name
     * @return  {string|File|null}  value Fields value
     */
    get(name) {
        ensureArgs(arguments, 1);
        const entries = this._data;
        name = String(name);
        for (let i = 0; i < entries.length; i++) {
            if (entries[i][0] === name) {
                return entries[i][1];
            }
        }
        return null;
    }

    /**
     * Return all fields values given name
     *
     * @param   {string}  name  Fields name
     * @return  {Array}         [{String|File}]
     */
    getAll(name) {
        ensureArgs(arguments, 1);
        const result = [];
        name = String(name);
        each(this._data, data => {
            data[0] === name && result.push(data[1]);
        });

        return result;
    }

    /**
     * Check for field name existence
     *
     * @param   {string}   name  Field name
     * @return  {boolean}
     */
    has(name) {
        ensureArgs(arguments, 1);
        name = String(name);
        for (let i = 0; i < this._data.length; i++) {
            if (this._data[i][0] === name) {
                return true;
            }
        }
        return false;
    }

    /**
     * Iterate over all fields name
     *
     * @return {Iterator}
     */
    * keys() {
        for (const [name] of this) {
            yield name;
        }
    }

    /**
     * Overwrite all values given name
     *
     * @param   {string}    name      Filed name
     * @param   {string}    value     Field value
     * @param   {string=}   filename  Filename (optional)
     * @return  {void}
     */
    set(name, value, filename) {
        ensureArgs(arguments, 2);
        name = String(name);
        const result = [];
        const args = normalizeArgs(name, value, filename);
        let replace = true;

        // - replace the first occurrence with same name
        // - discards the remaining with same name
        // - while keeping the same order items where added
        each(this._data, data => {
            data[0] === name
                ? replace && (replace = !result.push(args))
                : result.push(data);
        });

        replace && result.push(args);

        this._data = result;
    }

    /**
     * Iterate over all fields
     *
     * @return {Iterator}
     */
    * values() {
        for (const [, value] of this) {
            yield value;
        }
    }

    /**
     * [toBlob description]
     *
     * @return {Blob} [description]
     */
    toBlob() {
        const boundary = this.boundary;
        const chunks = [];
        const p = `--${boundary}\r\nContent-Disposition: form-data; name="`;
        this.forEach((value, name) => {
            chunks.push(p);
            chunks.push(escape(normalizeLinefeeds(name)));

            if (typeof value == 'string') {
                chunks.push(`"\r\n\r\n${normalizeLinefeeds(value)}\r\n`);

            } else {
                chunks.push(`"; filename="${escape(value.name)}"\r\n`);
                chunks.push(`Content-Type: ${value.type || 'application/octet-stream'}\r\n\r\n`);
                chunks.push(value);
                chunks.push('\r\n');
            }
        });

        chunks.push(`--${boundary}--`);
        return new Blob(chunks, { type: 'multipart/form-data; boundary=' + boundary });
    }

    /**
     * The class itself is iterable
     * alias for formdata.entries()
     *
     * @return  {Iterator}
     */
    [Symbol.iterator]() {
        return this.entries();
    }

    /**
     * Create the default string description.
     *
     * @return  {string} [object FormData]
     */
    toString() {
        return '[object FormData]';
    }
}

Object.defineProperty(window, 'FormData', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: FormData
});

export function parse(data) {
    const formData = new FormData();
    return formData;
}
