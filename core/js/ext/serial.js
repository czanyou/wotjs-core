// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import { defineEventAttribute, EventTarget } from '@tjs/event-target';

/* global MessageEvent Event */

const uart = native.uart;

/**
 * @module @tjs/uart
 * 
 * @typedef UART 串口设备
 * @property {function} close? 关闭
 * @property {function} flush? 等待数据传输完毕
 * @property {function} read? 读取数据
 * @property {function(number):void} [wait] 等待数据就绪
 * @property {function(string):number} [write] 写数据
 * @property {function} [onmessage] 处理读取的消息
 * @property {function} [onclose] 当设备断开
 */

/**
 * @typedef SerialPortOptions 串口选项
 * @property {number} [baudRate] 波特率
 * @property {string} [parity] 校验方式 `none`, `odd` 或 `even`
 * @property {number} [dataBits] 数据位
 * @property {number} [stopBits] 停止位
 */

const PARITY_TYPES = {
    none: uart?.PARITY_NONE,
    odd: uart?.PARITY_ODD,
    even: uart?.PARITY_EVEN
};

export const setDTR = uart?.setDTR;
export const setRTS = uart?.setRTS;

/**
 * 打开指定的串口设备
 * @param {string} device 串口设备名
 * @param {number | SerialPortOptions} baudRate 波特率
 * @param {string} [parity] 校验方式 `none`, `odd` 或 `even`
 * @param {number} [dataBits] 数据位
 * @param {number} [stopBits] 停止位
 * @returns {native.uart.UART} 串口设备
 */
export function open(device, baudRate, parity, dataBits, stopBits) {
    let options = null;
    if (typeof baudRate == 'object') {
        options = baudRate;

        baudRate = options.baudRate;
        parity = options.parity;
        dataBits = options.dataBits;
        stopBits = options.stopBits;
    }

    const parityType = parity && PARITY_TYPES[parity];
    const fd = uart?.open(device, baudRate, parityType, dataBits, stopBits);
    if (!fd) {
        return;
    }

    const handle = new uart.UART(fd);
    return handle;
}

export class SerialPort extends EventTarget {
    constructor(info) {
        super();

        this.options = {};
        this.info = info;
        this.handle = null;
    }

    get [Symbol.toStringTag]() {
        return 'SerialPort';
    }

    async close() {
        const handle = this.handle;
        if (handle) {
            this.handle = null;
            
            await handle.close();
        }
    }

    getInfo() {
        return this.info;
    }

    /**
     * 
     * @param {SerialPortOptions} options 
     */
    async open(options) {
        this.options = options;

        const info = this.info;
        const device = info && info.device;
        if (!device) {
            return;
        }

        const handle = open(device, options);
        if (!handle) {
            return;
        }

        handle.onmessage = (data) => {
            this.dispatchEvent(new MessageEvent('message', { data: data }));
        };

        handle.onclose = () => {
            this.dispatchEvent(new Event('close'));
        };

        handle.ondisconnect = () => {
            this.dispatchEvent(new Event('disconnect'));
        };

        this.handle = handle;
    }

    async read() {
        const handle = this.handle;
        if (handle) {
            return handle.read();
        }
    }

    async write(data) {
        const handle = this.handle;
        if (handle) {
            return handle.write(data);
        }
    }
}

defineEventAttribute(SerialPort.prototype, 'open');
defineEventAttribute(SerialPort.prototype, 'disconnect');
defineEventAttribute(SerialPort.prototype, 'close');
defineEventAttribute(SerialPort.prototype, 'message');

const $context = {
    names: {},
    devices: null
};

async function initDefaults() {
    try {
        const config = await import('@tjs/config');
        const deviceConfig = await config.load('device');

        await init(deviceConfig.data);

    } catch (e) {
        console.log('serial: initDefaults', e);
        if (!$context.devices) {
            $context.devices = [];
        }
    }
}

export async function getDevices() {
    if (!$context.devices) {
        await initDefaults();
    }

    if ($context.devices) {
        return $context.devices;
    }
}

export async function init(config) {
    function getDeviceInfo(index) {
        const name = config['uart.' + index + '.name'];
        if (!name) {
            return;
        }

        const deviceInfo = {
            device: config['uart.' + index + '.device'],
            index,
            name
        };

        return deviceInfo;
    }

    $context.devices = [];
    for (let i = 0; i <= 16; i++) {
        const deviceInfo = getDeviceInfo(i);
        if (!deviceInfo) {
            continue;
        }

        const serialPort = new SerialPort(deviceInfo);
        $context.devices[i] = serialPort;
        $context.names[deviceInfo.name] = i;
    }
}

export async function requestDevice(options) {
    let name = options;
    if (options == null) {
        return;

    } else if (typeof options == 'object') {
        name = options.name;
    }

    if (!$context.devices) {
        await initDefaults();
    }

    let index = Number.parseInt(name);
    if (!(index >= 0)) {
        index = $context.names[String(name)];
    }

    if (index >= 0) {
        return $context.devices[index];
    }
}
