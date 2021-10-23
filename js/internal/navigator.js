// @ts-check
import * as native from '@tjs/native';
import { defineEventAttribute, EventTarget } from '@tjs/event-target';

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
 * Navigator 接口
 * - Web Things 环境将提供设备相关的信息
 */
export class Navigator {
    constructor() {
        this.bluetooth = {
            async requestDevice(options) {
                const bluetooth = await import('@tjs/bluetooth');
                return bluetooth.requestDevice(options);
            }
        };

        this.connection = null;
        this.credentials = {};

        this.devices = {
            async getDevices() {
                const devices = await import('@tjs/devices');
                return devices.getDevices();
            },
            async requestDevice(options) {
                const devices = await import('@tjs/devices');
                return devices.requestDevice(options);
            }
        };

        this.geolocation = {
            async getCurrentPosition(success, error, options) {
                const location = await import('@tjs/location');
                return location.getDevices(success, error, options);
            },
            async watchPosition(success, error, options) {
                const location = await import('@tjs/location');
                return location.requestDevice(success, error, options);
            },
            async clearWatch(id) {
                const location = await import('@tjs/location');
                return location.clearWatch(id);
            }
        };

        this.language = 'en-US';
        this.languages = ['en', 'en-US', 'zh-CN'];

        this.mediaCapabilities = {
            async decodingInfo(mediaConfig) {
                const media = await import('@tjs/media');
                return media.decodingInfo(mediaConfig);                
            },
            async encodingInfo(mediaConfig) {
                const media = await import('@tjs/media');
                return media.encodingInfo(mediaConfig);
            }
        };

        this.mediaDevices = {
            async enumerateDevices() {
                const media = await import('@tjs/media');
                return media.getDevices();
            },
            async getUserMedia(constraints) {
                const media = await import('@tjs/media');
                return media.requestDevice(constraints);
            }
        };

        this.onLine = true;
        this.platform = native.platform;

        this.serial = {
            async getPorts() {
                const serial = await import('@tjs/serial');
                return serial.getDevices();
            },
            async requestPort(options) {
                const serial = await import('@tjs/serial');
                return serial.requestDevice(options);
            }
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

    set connection(value) {}
}
