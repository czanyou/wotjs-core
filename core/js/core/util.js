// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import { defineEventAttribute, EventTarget } from '@tjs/event-target';

const util = native.util;

export const textEncode = util.textEncode;
export const textDecode = util.textDecode;
export const zlib = native.zlib;

const FORMATS = {
    hex: util.CODE_HEX,
    base64: util.CODE_BASE64
};

export class MessageParser extends EventTarget {
    /** @param {{ maxBuffer?: number }} options */
    constructor(options) {
        super();

        this.buffer = '';

        this.BUFFER_LIMIT = options?.maxBuffer | 64 * 1024;
        this.textDecoder = new TextDecoder();

        this.event = {};
        this.data = [];
        this.dataLength = 0;
    }

    get [Symbol.toStringTag]() {
        return 'MessageParser';
    }

    /**
     * 执行解析
     * @param {ArrayBuffer|string} data 
     */
    execute(data) {
        if (!data) {
            return;
        }

        /** @type string */
        let text = null;
        if (typeof data == 'string') {
            text = data;

        } else {
            text = this.textDecoder.decode(data);
        }

        this.buffer = this.buffer + text;
        if (this.buffer.length >= this.BUFFER_LIMIT) {
            this.buffer = '';
        }

        // console.log(this.buffer);
        // console.log('text', text);

        while (true) {
            const line = this.readLine();
            if (line == null) {
                break;
            }

            if (line.startsWith('event: ')) {
                this.event.name = line.substring(7);

            } else if (line.startsWith('retry: ')) {
                this.event.retry = line.substring(7);

            } else if (line.startsWith('id: ')) {
                this.event.id = line.substring(7);

            } else if (line.startsWith('data: ')) {
                const value = line.substring(6);
                this.data.push(value);
                this.dataLength = (this.dataLength | 0) + value.length;

                if (this.dataLength >= this.BUFFER_LIMIT) {
                    this.event = {};
                    this.data = [];
                    this.dataLength = 0;
                }

            } else if (line.length == 0) {
                const event = this.event;
                const data = this.data;

                this.event = {};
                this.data = [];
                this.dataLength = 0;

                if (!data?.length) {
                    return;
                }

                event.data = data.join('\n');
                try {
                    event.data = JSON.parse(event.data);
                } catch (err) {

                }

                this.dispatchEvent(new MessageEvent('message', { data: event }));
            }
        }
    }

    /**
     * 从缓存中读取一行
     * @returns {string}
     */
    readLine() {
        const buffer = this.buffer;
        const pos = buffer.indexOf('\n');
        if (pos < 0) {
            return;
        }

        /** @type string */
        const line = buffer.substring(0, pos + 1);
        this.buffer = buffer.substring(pos + 1);

        return line.trim();
    }
}

defineEventAttribute(MessageParser.prototype, 'message');
defineEventAttribute(MessageParser.prototype, 'disconnect');

/** 
 * @param {object} message 
 * @param {{ event?: string, id?: string }} [options]
 * @returns {string} 
 */
export function encodeMessage(message, options) {
    if (message == null) {
        return;
    }

    if (message instanceof ArrayBuffer) {
        const textDecoder = new TextDecoder();
        message = textDecoder.decode(message);
    }

    const data = JSON.stringify(message);

    const tokens = data.split('\n');
    const result = [];
    if (options?.event) {
        result.push('event: ');
        result.push(String(options.event));
        result.push('\n');
    }

    if (options?.id) {
        result.push('id: ');
        result.push(String(options.id));
        result.push('\n');
    }

    for (const token of tokens) {
        if (token.length <= 0) {
            continue;
        }

        result.push('data: ');
        result.push(token);
        result.push('\n');
    }

    result.push('\n');
    return result.join('');
}

/**
 * to string
 * @param {ArrayBuffer|Uint8Array} data 
 * @param {string} format 
 * @returns string
 */
export function encode(data, format) {
    const type = (format && FORMATS[format]) || util.CODE_HEX;
    return util.encode(data, type);
}

/**
 * to string
 * @param {ArrayBuffer|Uint8Array} data 
 * @param {string} format 
 * @returns string
 */
export function toString(data, format) {
    if (format == null || format == 'utf8' || format == 'utf-8') {
        return util.textDecode(data);
    }

    const type = (format && FORMATS[format]) || util.CODE_HEX;
    return util.encode(data, type);
}

/**
 * to buffer
 * @param {string} data 
 * @param {string} format 
 * @returns 
 */
export function decode(data, format) {

    const type = (format && FORMATS[format]) || util.CODE_HEX;
    return util.decode(data, type);
}

/**
 * to buffer
 * @param {string} data 
 * @param {string} format 
 * @returns 
 */
export function toBuffer(data, format) {
    if (format == null || format == 'utf8' || format == 'utf-8') {
        return util.textEncode(data);
    }

    const type = (format && FORMATS[format]) || util.CODE_HEX;
    return util.decode(data, type);
}

export const HASHS = {
    md5: util.HASH_MD5,
    sha1: util.HASH_SHA1
};

/**
 * 计算 hash 值
 * @param {ArrayBuffer|Uint8Array|string} data 
 * @param {string} type 
 * @returns {string}
 */
export function hash(data, type) {
    let buffer = null;
    if (typeof data == 'string') {
        buffer = util.textEncode(data);

    } else {
        buffer = data;
    }

    const format = (type && HASHS[type]) || util.HASH_SHA1;
    const hashdata = util.hash(buffer, format);
    return util.encode(hashdata, util.CODE_HEX);
}

export const types = {
    /** @param {any} arg */
    isNull(arg) {
        return arg === null;
    },

    /** @param {any} arg */
    isUndefined(arg) {
        return arg === undefined;
    },

    /** @param {any} arg */
    isNullOrUndefined(arg) {
        return arg === null || arg === undefined;
    },

    /** @param {any} arg */
    isNumber(arg) {
        return typeof arg === 'number';
    },

    /** @param {any} arg */
    isFinite(arg) {
        return (arg == 0) || (arg != arg / 2);
    },

    /** @param {any} arg */
    isBoolean(arg) {
        return typeof arg === 'boolean';
    },

    /** @param {any} arg */
    isString(arg) {
        return typeof arg === 'string';
    },

    /** @param {any} arg */
    isObject(arg) {
        return typeof arg === 'object' && arg != null;
    },

    /** @param {any} arg */
    isFunction(arg) {
        return typeof arg === 'function';
    }
};

export async function sleep(timeout = 1000) {
    const promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            resolve(timer);
        }, timeout);
    });

    return promise;
}

export const format = {
    /**
     * 
     * @param {any} value 
     * @param {string} format 
     * @param {number} defaultValue 
     * @returns {number}
     */
    parseNumber(value, format = null, defaultValue = null) {
        if (value == null) {
            return defaultValue;

        } else if (format == null) {
            const number = Number(value);
            return isNaN(number) ? defaultValue : number;
        }

        const re = /^(-?\d+\.\d+|-?\d+)(.*)$/;
        const result = re.exec(String(value));
        if (result == null) {
            return defaultValue;
        }

        const number = Number(result[1]);
        const unit = result[2];
        let units = null;
        // console.log(result, number, unit);

        if (format == 'bytes') {
            const B = 1;
            const KB = 1024;
            const MB = KB * 1024;
            const GB = MB * 1024;
            const TB = GB * 1024;
            units = { B, KB, MB, GB, TB };

        } else if (format == 'time') {
            const ms = 1;
            const s = 1000;
            const m = s * 60;
            const h = m * 60;
            const d = h * 24;

            units = { ms, s, m, h, d };

        } else {
            return number;
        }

        if (unit) {
            const ratio = units[unit];
            return (ratio == null) ? NaN : number * ratio;
        }

        return number;
    },
    /**
     * 
     * @param {*} string 
     * @param {string} format 
     */
    parse(string, format) {

    },
    /**
     * 
     * @param {*} data 
     * @param {string} format 
     * @param {number=} fixed 
     */
    stringify(data, format, fixed = null) {
        /** @param {number} value */
        function formatFloat(value) {
            if (fixed == null) {
                return Math.round(value);
            }
            
            const floor = Math.floor(value);
            if (floor == value) {
                return floor;
            }

            return value.toFixed(fixed);
        }

        if (format == 'bytes') {
            const KB = 1024;
            const MB = KB * 1024;
            const GB = MB * 1024;
            const TB = GB * 1024;

            const value = Number(data);
            if (isNaN(value)) {
                return null;

            } else if (value < KB) {
                return formatFloat(value) + '';

            } else if (value < MB) {
                return formatFloat(value / KB) + 'KB';

            } else if (value < GB) {
                return formatFloat(value / MB) + 'MB';

            } else if (value < TB) {
                return formatFloat(value / GB) + 'GB';

            } else {
                return formatFloat(value / TB) + 'TB';
            }

        } else if (format == 'time') {
            const s = 1000;
            const m = s * 60;
            const h = m * 60;
            const d = h * 24;

            const value = Number(data);
            if (isNaN(value)) {
                return null;

            } else if (value < s) {
                return formatFloat(value) + 'ms';

            } else if (value < m) {
                return formatFloat(value / s) + 's';

            } else if (value < h) {
                return formatFloat(value / m) + 'm';

            } else if (value < d) {
                return formatFloat(value / h) + 'h';

            } else {
                return formatFloat(value / d) + 'd';
            }
        }
    }
}
