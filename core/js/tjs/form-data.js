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
 * @returns {(string|File)[]}
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

        // @ts-ignore
        return [String(name), value];
    }

    return [String(name), String(value)];
}

// normalize line feeds for textarea
// https://html.spec.whatwg.org/multipage/form-elements.html#textarea-line-break-normalisation-transformation
function normalizeLinefeeds(value) {
    return value.replace(/\r?\n|\r/g, '\r\n');
}

/**
 * 
 * @param {any[]} array 
 * @param {(item: any) => void} callback 
 */
function each(array, callback) {
    for (let i = 0; i < array.length; i++) {
        callback(array[i]);
    }
}

const escape = (/** @type {string} */ str) => str.replace(/\n/g, '%0A').replace(/\r/g, '%0D').replace(/"/g, '%22');

const kRawData = Symbol('rawData');

export class Blob {
    /**
     * @param {string[]|Blob[]|ArrayBuffer[]|ArrayBufferView[]} blobParts 
     * @param {*} options 
     * @returns 
     */
    constructor(blobParts, options) {
        /** @type {string} */
        this.type = options && options.type;

        /** @type {number} */
        this.size = 0;

        /** @type {string=} */
        this.name = undefined;

        const textEncoder = new TextEncoder();

        if (!Array.isArray(blobParts)) {
            return;
        }

        /** @type {Uint8Array[]} */
        const list = [];
        for (const data of blobParts) {
            if (data == null) {
                continue;

            } else if (data instanceof Blob) {
                list.push(data._rawData());

            } else if (data instanceof ArrayBuffer) {
                list.push(new Uint8Array(data));

            } else if (ArrayBuffer.isView(data)) {
                list.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));

            } else {
                const text = String(data);
                list.push(textEncoder.encode(text));
            }
        }

        for (const buffer of list) {
            this.size += buffer.byteLength;
        }

        let offset = 0;
        const blobBuffer = new Uint8Array(this.size);
        for (const buffer of list) {
            blobBuffer.set(buffer, offset);
            offset += buffer.byteLength;
        }

        /** @type {Uint8Array} */
        this[kRawData] = blobBuffer;
    }

    get [Symbol.toStringTag]() {
        return 'Blob';
    }

    _rawData() {
        return this[kRawData];
    }

    async arrayBuffer() {
        return this._rawData()?.buffer;
    }

    /**
     * @param {number} start 
     * @param {number} end 
     * @param {string} contentType 
     */
    slice(start, end, contentType) {
        if (!this._rawData()) {
            return;
        }

        const buffer = this._rawData().slice(start, end);
        return new Blob([buffer], { type: contentType });
    }

    async text() {
        const textDecoder = new TextDecoder();
        return textDecoder.decode(this._rawData());
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
 * @typedef {File|string} FormDataEntryValue
 */

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
        /** @type {FormDataEntryValue[][]} */
        this[kRawData] = [];

        /** @type {string} */
        this.boundary = '----formdata-' + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }

    get [Symbol.toStringTag]() {
        return 'FormData';
    }

    get _rawData() {
        return this[kRawData];
    }

    /**
     * Append a field
     *
     * @param {string} name field name
     * @param {string|Blob} value string / blob / file
     * @param {string=} filename filename to use with blob
     * @return {void}
     */
    append(name, value, filename) {
        ensureArgs(arguments, 2);
        this._rawData.push(normalizeArgs(name, value, filename));
    }

    /**
     * Delete all fields values given name
     *
     * @param {string} name Field name
     * @return {void}
     */
    delete(name) {
        ensureArgs(arguments, 1);
        name = String(name);

        const result = [];
        for (const entry of this._rawData) {
            if (entry[0] !== name) {
                result.push(entry);
            }
        };

        this[kRawData] = result;
    }

    /**
     * Iterate over all fields as [name, value]
     *
     * @return {Iterator}
     */
    * entries() {
        const data = this._rawData;
        for (let i = 0; i < data.length; i++) {
            yield data[i];
        }
    }

    /**
     * Iterate over all fields
     *
     * @param {Function} callback  Executed for each item with parameters (value, name, thisArg)
     * @param {Object=} thisArg `this` context for callback function
     * @return {void}
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
     * @param {string} name Field name
     * @return {FormDataEntryValue|null} value Fields value
     */
    get(name) {
        ensureArgs(arguments, 1);
        const entries = this._rawData;
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
     * @param {string} name Fields name
     * @return {FormDataEntryValue[]}
     */
    getAll(name) {
        ensureArgs(arguments, 1);

        name = String(name);
        const result = [];
        each(this._rawData, data => {
            data[0] === name && result.push(data[1]);
        });

        return result;
    }

    /**
     * Check for field name existence
     *
     * @param {string} name Field name
     * @return {boolean}
     */
    has(name) {
        ensureArgs(arguments, 1);
        name = String(name);
        for (let i = 0; i < this._rawData.length; i++) {
            if (this._rawData[i][0] === name) {
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
     * @param {string} name Filed name
     * @param {string|Blob} value Field value
     * @param {string=} filename Filename (optional)
     * @return {void}
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
        each(this._rawData, data => {
            data[0] === name
                ? replace && (replace = !result.push(args))
                : result.push(data);
        });

        replace && result.push(args);

        this[kRawData] = result;
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

/**
 * 
 * @param {Uint8Array} u8Array 
 * @param {string} searchString 
 * @param {number} offset
 * @returns {number}
 */
function findStringInUint8Array(u8Array, searchString, offset = 0) {
    const encoder = new TextEncoder();
    const searchArray = encoder.encode(searchString);
    for (let i = offset; i < u8Array.length; i++) {
        if (u8Array[i] === searchArray[0]) {
            let found = true;
            for (let j = 1; j < searchArray.length; j++) {
                if (u8Array[i + j] !== searchArray[j]) {
                    found = false;
                    break;
                }
            }

            if (found) {
                return i; // 返回字符串的起始索引
            }
        }
    }

    return -1; // 没有找到字符串
}

/**
 * parse
 * @param {Uint8Array} data 
 * @param {string=} boundary 
 * @returns {FormData}
 */
export function parse(data, boundary) {
    const formData = new FormData();
    if (data == null) {
        return formData;
    }

    let state = 0;
    let offset = 0;

    const LINE_END = '\n'.charCodeAt(0);
    const textDecoder = new TextDecoder();

    /** @type {{name?: string, filename?: string, type?: string, data?: any, meta?: any}=} */
    let currentElement;

    /**
     * @param {string} data 
     * @returns {{value: string, parameters: Object<string, string>}}
     */
    function parseValue(data) {
        /** @type {Object<string, string>} */
        const result = {};
        const tokens = data.split(';');
        for (let i = 1; i < tokens.length; i++) {
            const token = tokens[i];
            const pos = token.indexOf('=');
            if (pos < 0) {
                continue;
            }

            const name = token.substring(0, pos).trim();
            let value = token.substring(pos + 1).trim();
            if (value.startsWith('"')) {
                value = value.substring(1, value.length - 1);
            }

            result[name] = value;
        }

        return { value: tokens[0], parameters: result };
    }

    /**
     * @param {string} line 
     */
    function parseLine(line) {
        const pos = line.indexOf(':');
        if (pos < 0) {
            return;
        }

        const name = line.substring(0, pos).trim();
        const value = line.substring(pos + 1).trim();

        if (currentElement) {
            currentElement.meta[name] = value;
            const key = name.toLowerCase();

            if (key == 'content-type') {
                const result = parseValue(value);
                currentElement.type = result?.value;

            } else if (key == 'content-disposition') {
                const result = parseValue(value);
                const parameters = result?.parameters;
                currentElement.name = parameters?.name;
                currentElement.filename = parameters?.filename;
            }

            // console.log(name, value, item);
        }
    }

    function addElement() {
        // console.log('item:', item);

        if (currentElement && currentElement.name && currentElement.data != null) {
            formData.append(currentElement.name, currentElement.data, currentElement.filename);
        }

        currentElement = undefined;
    }

    while (true) {
        if (state < 10) {
            const pos = data.indexOf(LINE_END, offset);
            if (pos < 0) {
                addElement();
                // const leftover = data.length - offset;
                // console.log(leftover, boundary?.length);
                break;
            }

            const line = textDecoder.decode(data.subarray(offset, pos)).trim();
            // console.log('pos:', state, pos, line);

            if (state == 0) {
                boundary = line;
                state = 1;

                currentElement = { meta: {}, type: '', data: undefined };

            } else if (state == 1) {
                if (line == '') {
                    state = 2;

                    if (currentElement?.type) {
                        state = 11;
                    }

                } else {
                    parseLine(line);
                }

            } else if (state == 2) {
                state = 0;

                if (currentElement) {
                    currentElement.data = line;
                }

                addElement();

            } else {
                break;
            }

            offset = pos + 1;

        } else {
            if (boundary == null) {
                break;
            }

            const pos = findStringInUint8Array(data, '\r\n' + boundary, offset);
            if (pos < 0) {
                break;
            }

            if (currentElement) {
                const filedata = data.subarray(offset, pos);
                currentElement.data = new File([filedata], currentElement.filename || '', { type: currentElement.type });
            }

            // console.log(state, pos);
            offset = pos + 1;

            addElement();
            state = 0;
        }
    }

    return formData;
}
