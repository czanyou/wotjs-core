// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

const textDecode = native.util.textDecode;
const textEncode = native.util.textEncode;

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

        return textDecode(input);
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

        return textEncode(input);
    }
}

Object.defineProperty(window, 'TextDecoder', { enumerable: true, configurable: true, writable: true, value: TextDecoder });
Object.defineProperty(window, 'TextEncoder', { enumerable: true, configurable: true, writable: true, value: TextEncoder });
