// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import { defineEventAttribute, EventTarget } from '@tjs/event-target';

import * as storage from '@tjs/storage';

/**
 * 网络信息
 */
class NetworkInformation extends EventTarget {
    constructor() {
        super();

        this.type = 'wifi';
        this.downlink = 10;
        this.rtt = 200;
        this.saveData = false;
        this.onchange = null;
    }
}

defineEventAttribute(NetworkInformation.prototype, 'change');

/**
 * @param {string} name 
 * @param {string} method 
 * @returns 
 */
function asyncMethod(name, method) {
    return async function (...args) {
        const module = await import(name);
        const func = module[method];
        return func && await func(...args);
    };
}

/**
 * Navigator 接口
 * - Web Things 环境将提供设备相关的信息
 */
export class Navigator {
    constructor() {
        /** @type any */
        // this.connection = undefined;
        this.credentials = {};

        this.geolocation = {
            getCurrentPosition: asyncMethod('@tjs/location', 'getCurrentPosition'),
            clearWatch: asyncMethod('@tjs/location', 'clearWatch'),
            watchPosition: asyncMethod('@tjs/location', 'watchPosition')
        };

        this.language = 'en-US';
        this.languages = ['en', 'en-US', 'zh-CN'];

        this.mediaCapabilities = {
            decodingInfo: asyncMethod('@tjs/media', 'decodingInfo'),
            encodingInfo: asyncMethod('@tjs/media', 'encodingInfo')
        };

        this.mediaDevices = {
            enumerateDevices: asyncMethod('@tjs/media', 'enumerateDevices'),
            getUserMedia: asyncMethod('@tjs/media', 'getUserMedia')
        };

        this.onLine = true;
        this.platform = native.platform;

        this.serial = {
            getPorts: asyncMethod('@tjs/serial', 'getPorts'),
            requestPort: asyncMethod('@tjs/serial', 'requestPort')
        };

        this.userAgent = 'WoT.js/' + native.version;
        this.vendor = 'WoT.js';

        this.root = native.root;
        this.board = native.board;
    }

    get [Symbol.toStringTag]() {
        return 'Navigator';
    }

    get connection() {
        if (!this._connection) {
            this._connection = new NetworkInformation();
        }

        return this._connection;
    }

    get storage() {
        return storage.getStorageManager();
    }
}
