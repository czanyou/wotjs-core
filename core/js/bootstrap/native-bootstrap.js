// @ts-check
// tjs internal bootstrap.
/// <reference path ="../../types/index.d.ts" />
//

import * as native from '@tjs/native';
const util = native.util;

// @ts-ignore
globalThis.setTimeout = native.setTimeout;
// @ts-ignore
globalThis.setInterval = native.setInterval;
globalThis.alert = native.alert;
globalThis.clearInterval = native.clearInterval;
globalThis.clearTimeout = native.clearTimeout;
globalThis.confirm = native.confirm;
globalThis.prompt = native.prompt;

/**
 * @param {string} data 
 * @returns string
 */
globalThis.btoa = function (data) {
    const buffer = util.textEncode(data);
    return util.encode(buffer, util.CODE_BASE64);
};

/**
 * @param {string} encodedData 
 * @returns string
 */
globalThis.atob = function (encodedData) {
    const decodedData = util.decode(encodedData, util.CODE_BASE64);
    return util.textDecode(decodedData);
};

Object.defineProperty(globalThis, 'global', { 
    enumerable: true, 
    get() { return globalThis; }, 
    set() { } 
});

Object.defineProperty(globalThis, 'window', {
    enumerable: true,
    get() { return globalThis; },
    set() { }
});

Object.defineProperty(globalThis, 'self', {
    enumerable: true,
    get() { return globalThis; },
    set() { }
});
