// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

const util = native.util;

const FORMATS = {
    hex: util.CODE_HEX,
    base64: util.CODE_BASE64
};

export const utf8 = native.utf8;
const toString = native.utf8.decode;
const toBuffer = native.utf8.encode;

export class TextDecoder {
    /**
     * @param {string=} label 
     * @param {any=} options 
     */
    constructor(label, options) {
        this.encoding = label;
        this.options = options;
    }

    /**
     * @param {BufferSource} input 
     * @param {any=} options 
     * @returns string
     */
    decode(input, options) {
        if (input == null || input == undefined) {
            return input;

        } else if (typeof input == 'string') {
            return input;
        }

        if (input.byteLength == 0) {
            return '';
        }

        return toString(input);
    }
}

export class TextEncoder {
    /**
     * @param {string=} label 
     * @param {any=} options 
     */
    constructor(label, options) {
        this.encoding = label;
        this.options = options;
    }

    /** 
     * @param {string} input 
     * @param {any=} options 
     * @return {Uint8Array}
     */
    encode(input, options) {
        if (typeof input != 'string') {
            return input;
        }

        return toBuffer(input);
    }
}

Object.defineProperty(window, 'TextDecoder', { enumerable: true, configurable: true, writable: true, value: TextDecoder });
Object.defineProperty(window, 'TextEncoder', { enumerable: true, configurable: true, writable: true, value: TextEncoder });

/**
 * to string
 * @param {ArrayBuffer|Uint8Array} data 
 * @param {string} format `hex`,`base64`
 * @returns {string}
 */
export function encode(data, format) {
    const type = (format && FORMATS[format]) || util.CODE_HEX;
    return util.encode(data, type);
}

/**
 * to buffer
 * @param {string} data 
 * @param {string} format 
 * @returns {Uint8Array}
 */
export function decode(data, format) {
    const type = (format && FORMATS[format]) || util.CODE_HEX;
    return util.decode(data, type);
}
