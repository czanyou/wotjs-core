// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const TypedArrayPrototypeToStringTag = Object.getOwnPropertyDescriptor(TypedArrayPrototype, Symbol.toStringTag).get;

function getRandomValues(obj) {
    const type = TypedArrayPrototypeToStringTag.call(obj);

    switch (type) {
        case 'Int8Array':
        case 'Uint8Array':
        case 'Int16Array':
        case 'Uint16Array':
        case 'Int32Array':
        case 'Uint32Array':
            break;
        default:
            throw new TypeError('Argument 1 of Crypto.getRandomValues does not implement interface ArrayBufferView');
    }

    if (obj.byteLength > 65536) {
        const e = new Error();
        e.name = 'QuotaExceededError';
        throw e;
    }

    native.random(obj.buffer, obj.byteOffset, obj.byteLength);
    return obj;
}

const crypto = Object.freeze({
    getRandomValues,
    subtle: {
        digest(algorithm, data) {
            return native.crypto.digest(algorithm, data);
        }
    }
});

Object.defineProperty(window, 'crypto', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: crypto
});
