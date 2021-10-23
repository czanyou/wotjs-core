// tjs internal bootstrap.
//

import * as native from '@tjs/native';
const util = native.util;

globalThis.setTimeout = native.setTimeout;
globalThis.clearTimeout = native.clearTimeout;
globalThis.setInterval = native.setInterval;
globalThis.clearInterval = native.clearInterval;
globalThis.alert = native.alert;
globalThis.prompt = native.prompt;
globalThis.confirm = native.confirm;

/**
 * @param {string} data 
 * @returns string
 */
globalThis.btoa = function (data) {
    if (typeof data == 'string') {
        data = util.textEncode(data);
    }
    
    return util.encode(data, util.CODE_BASE64);
};

/**
 * @param {string} encodedData 
 * @param {*} blocksSize 
 * @returns string
 */
globalThis.atob = function (encodedData, blocksSize) {
    const decodedData = util.decode(encodedData, util.CODE_BASE64);
    if (blocksSize == null) {
        return util.textDecode(decodedData);
    }

    return decodedData;
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

const tjs = Object.create(null);

tjs.signal = native.signal;

for (const [key, value] of Object.entries(native)) {
    // tjs.signal.SIGINT etc.
    if (key.startsWith('SIG')) {
        tjs.signal[key] = value;
        continue;
    }

    tjs[key] = value;
}
