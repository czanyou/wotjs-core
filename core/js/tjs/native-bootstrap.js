// @ts-check
// tjs internal bootstrap.
/// <reference path ="../../types/index.d.ts" />
//

import * as native from '@tjs/native';
const util = native.util;
const utf8 = native.utf8;

globalThis.alert = native.alert;
// @ts-ignore
globalThis.clearInterval = native.clearInterval;
// @ts-ignore
globalThis.clearTimeout = native.clearTimeout;
globalThis.confirm = native.confirm;
globalThis.prompt = native.prompt;
// @ts-ignore
globalThis.setInterval = native.setInterval;
// @ts-ignore
globalThis.setTimeout = native.setTimeout;

/**
 * @param {string} data 
 * @returns string
 */
globalThis.btoa = function (data) {
    const buffer = utf8.encode(data);
    return util.encode(buffer, util.CODE_BASE64);
};

/**
 * @param {string} encodedData 
 * @returns string
 */
globalThis.atob = function (encodedData) {
    const decodedData = util.decode(encodedData, util.CODE_BASE64);
    return utf8.decode(decodedData);
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
