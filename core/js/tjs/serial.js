// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import { defineEventAttribute } from '@tjs/event-target';

const uart = native.uart;

const TAG = 'serial:';

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

/**
 * @typedef SerialPortInfo 设备信息
 * @property {string} [device]
 * @property {string} [name]
 * 
 */

const PARITY_TYPES = {
    none: uart?.PARITY_NONE,
    odd: uart?.PARITY_ODD,
    even: uart?.PARITY_EVEN
};

const MAX_UART_COUNT = 32;

/**
 * 
 *  #define TIOCM_LE   0x001
    #define TIOCM_DTR  0x002
    #define TIOCM_RTS  0x004
    #define TIOCM_ST   0x008
    #define TIOCM_SR   0x010
    #define TIOCM_CTS  0x020
    #define TIOCM_CAR  0x040
    #define TIOCM_RNG  0x080
    #define TIOCM_DSR  0x100
 */

/**
 * 
 * @typedef {{dataTerminalReady?: boolean, clearToSend?: boolean, dataSetReady?: boolean, requestToSend?: boolean }} Signals
 */

/**
 * @param {number} fd 
 * @returns {Promise<Signals>}
 */
export async function getSignals(fd) {
    const flags = (uart?.getSignals(fd)) || 0;
    const result = {
        dataTerminalReady: !!(flags & 0x002),
        clearToSend: !!(flags & 0x020),
        dataSetReady: !!(flags & 0x100),
        requestToSend: !!(flags & 0x004)
    };

    return result;
}

/**
 * @param {number} fd 
 * @param {Signals} signals 
 * @returns {Promise<void>}
 */
export async function setSignals(fd, signals) {
    if (signals == null) {
        return;
    }

    let mask = 0;
    let flags = 0;
    if (signals.dataTerminalReady != null) {
        mask |= 0x002;
        if (signals.dataTerminalReady) {
            flags |= 0x002;
        }
    }

    if (signals.clearToSend != null) {
        mask |= 0x020;
        if (signals.clearToSend) {
            flags |= 0x020;
        }
    }

    if (signals.dataSetReady != null) {
        mask |= 0x100;
        if (signals.dataSetReady) {
            flags |= 0x100;
        }
    }

    if (signals.requestToSend != null) {
        mask |= 0x004;
        if (signals.requestToSend) {
            flags |= 0x004;
        }
    }

    uart?.setSignals(fd, mask, flags);
}

/**
 * 打开指定的串口设备
 * @param {string} device 串口设备名
 * @param {number | SerialPortOptions} options 波特率
 * @param {string} [parity] 校验方式 `none`, `odd` 或 `even`
 * @param {number} [dataBits] 数据位
 * @param {number} [stopBits] 停止位
 * @returns {native.uart.UART|undefined} 串口设备
 */
export function open(device, options, parity, dataBits, stopBits) {
    let baudRate = 9600;
    if (typeof options == 'number') {
        baudRate = options;

    } else if (typeof options == 'object') {
        baudRate = options.baudRate || 9600;
        parity = options.parity || 'none';
        dataBits = options.dataBits || 8;
        stopBits = options.stopBits || 1;
    }

    const parityType = parity && PARITY_TYPES[parity];
    const fd = uart?.open(device, baudRate, parityType, dataBits, stopBits);
    if (!fd) {
        return;
    }

    const handle = new uart.UART(fd);
    handle.fd = fd;
    return handle;
}

class SerialPortReader {
    /** @param {native.uart.UART} [handle]  */
    constructor(handle) {
        /** @type native.uart.UART|undefined */
        this.handle = handle;
    }

    /**
     * Reading data from a port
     * @returns {Promise<ArrayBuffer|undefined>}
     */
    async read() {
        const handle = this.handle;
        if (handle) {
            return handle.read();
        }
    }
}

class SerialPortReadable {
    /**
     * @param {SerialPort} ownerPort 
     */
    constructor(ownerPort) {
        /** @type SerialPortReader | undefined  */
        this.reader = undefined;

        /** @type SerialPort | undefined */
        this.ownerPort = ownerPort;
    }

    close() {
        this.reader = undefined;
        this.ownerPort = undefined;
    }

    getReader() {
        if (!this.reader) {
            this.reader = new SerialPortReader(this.ownerPort?.handle);
        }

        return this.reader;
    }
}

export class SerialPort extends EventTarget {
    /** @param {SerialPortInfo} [info]  */
    constructor(info) {
        super();

        /** @type SerialPortOptions */
        this.options = {};

        /** @type SerialPortInfo | undefined */
        this.info = info;

        /** @type native.uart.UART | undefined */
        this.handle = undefined;

        /** @type SerialPortReadable | undefined  */
        this.readable = undefined;
    }

    get [Symbol.toStringTag]() {
        return 'SerialPort';
    }

    /**
     * Returns a Promise that resolves when the port closes.
     * @returns {void}
     */
    close() {
        const handle = this.handle;
        if (handle) {
            this.handle = undefined;

            handle.close();
            handle.onclose = undefined;
            handle.ondisconnect = undefined;
            handle.onmessage = undefined;
        }

        const readable = this.readable;
        if (readable) {
            this.readable = undefined;

            readable.ownerPort = undefined;
        }

        this.removeAllEventListeners();
    }

    /**
     * Returns a Promise that resolves with an object containing properties of the port.
     * @returns {Promise<SerialPortInfo|undefined>}
     */
    async getInfo() {
        return this.info;
    }

    /**
     * Returns a Promise that resolves with an object containing the current state of the port's control signals.
     * @returns {Promise<Signals|undefined>}
     */
    async getSignals() {
        const handle = this.handle;
        const fd = handle?.fd;
        if (!fd) {
            return;
        }

        return getSignals(fd);
    }

    /**
     * Returns a Promise that resolves when the port is opened. 
     * By default the port is opened with 8 data bits, 1 stop bit and no parity checking.
     * @param {SerialPortOptions} options 
     * @returns {Promise<void>}
     */
    async open(options) {
        if (this.handle) {
            // InvalidStateError Returned if the port is already open.
            // NetworkError Returned if the attempt to open the port failed.
            return;
        }

        this.options = { ...options };

        const info = this.info;
        const device = info?.device;
        if (!device) {
            return;
        }

        const handle = open(device, options);
        if (!handle) {
            throw new TypeError(`Attempt to open the port '${device}' failed.`);
        }

        handle.onmessage = (data) => {
            this.dispatchEvent(new MessageEvent('message', { data }));
        };

        handle.onclose = () => {
            handle.onclose = undefined;
            handle.ondisconnect = undefined;
            handle.onmessage = undefined;
            this.dispatchEvent(new Event('close'));
        };

        handle.ondisconnect = () => {
            this.dispatchEvent(new Event('disconnect'));
        };

        this.handle = handle;
        this.readable = new SerialPortReadable(this);
    }

    async read() {
        const handle = this.handle;
        if (handle) {
            return handle.read();
        }
    }

    /**
     * Sets control signals on the port and returns a Promise that resolves when they are set.
     * @param {Signals} signals 
     * @returns {Promise<void>}
     */
    async setSignals(signals) {
        const handle = this.handle;
        const fd = handle?.fd;
        if (!fd) {
            return;
        }

        return await setSignals(fd, signals);
    }

    /**
     * Writing data to a port
     * @param {string|ArrayBuffer|ArrayBufferView} data 
     * @returns {Promise<void>}
     */
    async write(data) {
        const handle = this.handle;
        if (handle) {
            return handle.write(data);
        }
    }
}

/** An event fired when a port has been connected to the device. */
defineEventAttribute(SerialPort.prototype, 'connect');

/** An event fired when a port has been disconnected from the device. */
defineEventAttribute(SerialPort.prototype, 'disconnect');

/**  */
defineEventAttribute(SerialPort.prototype, 'message');

const $context = {
    /** @type SerialPort[] | undefined */
    devices: undefined,

    /** @type {Object<string,number>} */
    names: {},

    /** @type {Object<string,any> | undefined} */
    options: undefined,

    /** @type any */
    reading: undefined
};

/**
 * @returns {Promise<any>}
 */
async function closeSerialPorts() {
    const devices = $context.devices;
    if (!devices) {
        return;
    }

    $context.devices = undefined;
    $context.options = undefined;
    $context.names = {};

    for (const device of devices) {
        device.close();
    }
}

/**
 * @returns {Promise<SerialPort[]|undefined>}
 */
async function initSerialPorts() {
    try {
        if (!$context.options) {
            const config = await import('@tjs/config');
            const deviceConfig = await config.load('product');
            setDeviceInfos(deviceConfig.data);
        }

        await loadSerialPorts();

    } catch (e) {
        console.log(TAG, 'initSerialPorts', e);

    } finally {
        $context.reading = undefined;

        if (!$context.devices) {
            $context.devices = [];
        }
    }

    return $context.devices;
}

/**
 * 
 * @returns {Promise<void>}
 */
async function loadSerialPorts() {

    /** @param index {number} */
    function getDeviceInfo(index) {
        const options = $context.options;
        if (!options) {
            return;
        }

        const prefix = 'uart.' + index + '.';
        const name = options[prefix + 'name'];
        if (!name) {
            return;
        }

        const deviceInfo = {
            device: options[prefix + 'device'],
            index,
            name
        };

        return deviceInfo;
    }

    $context.devices = [];
    for (let i = 0; i <= MAX_UART_COUNT; i++) {
        const deviceInfo = getDeviceInfo(i);
        if (!deviceInfo) {
            continue;
        }

        const serialPort = new SerialPort(deviceInfo);
        $context.devices[i] = serialPort;
        $context.names[deviceInfo.name] = i;
    }

    // console.log('loadSerialPorts', $context.devices.length);
}

/**
 * @returns {Promise<SerialPort[]|undefined>}
 */
async function getDevices() {
    if ($context.devices) {
        return $context.devices;

    } else if ($context.reading) {
        return $context.reading;
    }

    const promise = initSerialPorts();
    $context.reading = promise;
    return promise;
}

export async function closePorts() {
    return closeSerialPorts();
}

/**
 * Returns a Promise that resolves with an array of SerialPort objects 
 * representing serial ports connected to the host which the origin has 
 * permission to access.
 * @returns {Promise<SerialPort[]|undefined>}
 */
export async function getPorts() {
    const devices = await getDevices();

    if (devices) {
        return devices;
    }
}

/**
 * Returns a Promise that resolves with an instance of SerialPort representing 
 * the device chosen by the user or rejects if no device was selected.
 * @param {{name?: string, index?: number}} options 
 * @returns {Promise<SerialPort|undefined>}
 */
export async function requestPort(options) {
    if (options == null) {
        return;
    }

    const devices = await getDevices();
    // console.log('requestPort', devices?.length);

    let index = Number(options.index);
    if (!(index >= 0)) {
        index = $context.names[String(options.name)];
    }

    if (index >= 0) {
        return devices && devices[index];
    }
}

/**
 * 设置串口设备配置信息
 * @param {{[name: string]: string}} options - { name, device }
 */
export function setDeviceInfos(options) {
    $context.options = { ...options };
}
