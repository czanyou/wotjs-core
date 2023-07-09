// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

const toString = native.utf8.decode;
const toBuffer = native.utf8.encode;

export class TextDecoder {
    constructor(label, options) {
        this.encoding = label;
        this.options = options;
    }

    /**
     * @param {BufferSource} input 
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
    constructor(label, options) {
        this.encoding = label;
        this.options = options;
    }

    /** @param {string} input */
    encode(input, options) {
        if (typeof input != 'string') {
            return input;
        }

        return toBuffer(input);
    }
}

Object.defineProperty(window, 'TextDecoder', { enumerable: true, configurable: true, writable: true, value: TextDecoder });
Object.defineProperty(window, 'TextEncoder', { enumerable: true, configurable: true, writable: true, value: TextEncoder });
