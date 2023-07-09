// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { join } from '@tjs/path';
import * as fs from '@tjs/fs';
import * as native from '@tjs/native';

const basePath = '/sys/class/gpio';

// ////////////////////////////////////////////////////////////
// GpioHandle

export class GpioHandle {
    /**
     * @param {object} options 
     * @param {string} [options.direction]
     * @param {string} [options.edge]
     * @param {number} [options.level]
     * @param {string} [options.name]
     * @param {string} [options.port]
     */
    constructor(options) {
        /** @type string | undefined */
        this.direction = options?.direction || 'in';

        /** @type string | undefined */
        this.edge = options?.edge || 'none';

        /** @type {native.hal.GPIO|undefined} */
        this.handle = undefined;

        /** @type number | undefined */
        this.level = options?.level || 0;

        /** @type string | undefined */
        this.name = options?.name;

        /** @type string | undefined */
        this.port = options?.port;

        /** @type string | undefined */
        this.device = join(basePath, 'gpio' + this.port);
    }

    get [Symbol.toStringTag]() {
        return 'GpioHandle';
    }

    async close() {
        try {
            const handle = this.handle;
            if (handle) {
                this.handle = undefined;

                handle.onpoll = undefined;
                await handle.close();
            }

        } catch (err) {
            console.log('gpio:', err);
        }
    }

    /**
     * 输入输出方向
     * @returns {Promise<string|undefined>} `in` or `out`
     */
    async getDirection() {
        return this._readFile('direction');
    }

    /**
     * 控制中断触发模式
     * @returns {Promise<string|undefined>} `none`, `falling`, `both` or `rising`
     */
    async getEgde() {
        return this._readFile('edge');
    }

    async isExported() {
        try {
            const name = 'gpio' + this.port;
            const filename = join(basePath, name);
            const value = await fs.readlink(filename);
            return value != null;

        } catch (e) {
            return false;
        }
    }

    async open() {
        if (this.handle) {
            return;
        }

        try {
            const name = 'gpio' + this.port;
            const filename = join(basePath, name, 'value');
            const handle = new native.hal.GPIO(filename);
            this.handle = handle;

        } catch (err) {
            // console.log('gpio:', err);
        }
    }

    /**
     * 
     * @param {(value:boolean|null) => void} callback 
     * @returns 
     */
    async setCallback(callback) {
        if (!callback) {
            const handle = this.handle;
            if (handle) {
                handle.onpoll = undefined;
            }
            return;
        }

        if (this.direction != 'in') {
            return;

        } else if (this.edge == 'none') {
            return;
        }

        if (this.edge) {
            await this.setEdge(this.edge);
        }
        // console.log('setCallback', callback);

        if (!this.handle) {
            await this.open();
        }

        const handle = this.handle;
        if (!handle) {
            return;
        }

        async function onpoll() {
            const ret = await handle?.read();
            let value = null;
            if (ret == 49) {
                value = true;

            } else if (ret == 48) {
                value = false;
            }

            callback(value);
        };

        handle.onpoll = onpoll;
    }

    /**
     * 读取输入状态
     * @returns {Promise<number|undefined>} 0 or 1
     */
    async read() {
        if (!this.handle) {
            await this.open();
        }

        const handle = this.handle;

        try {
            const value = await handle?.read();
            if (value === 49) { // '1'
                return 1;

            } else if (value === 48) { // '0'
                return 0;
            }

        } catch (err) {
            this.close();
        }
    }

    /**
     * 设置输入输出方向
     * @param {string} direction `in` or `out`
     * @returns 
     */
    async setDirection(direction) {
        return this._writeFile('direction', direction);
    }

    /**
     * 控制中断触发模式，引脚被配置为中断后可以使用 poll() 函数监听引脚 
     * @param {string} edge `none`, `falling`, `both` or `rising`
     * @returns 
     */
    async setEdge(edge) {
        return this._writeFile('edge', edge);
    }

    /**
     * 修改输出状态
     * @param {number|string} value `high`, `low`, 0 or 1
     * @returns {Promise<Error|number|undefined>}
     */
    async write(value) {
        if (!this.handle) {
            await this.open();
        }

        const handle = this.handle;
        if (!handle) {
            return;
        }

        if (value == 'high') {
            value = 1;

        } else if (value == 'low') {
            value = 0;
        }

        value = Number.parseInt(String(value)) || 0;
        if (value != 0) {
            value = 1;
        }

        try {
            await handle.write(String(value));
            return value;

        } catch (err) {
            close();
            return err;
        }
    }

    /**
     * @param {string} name 
     * @returns {Promise<string|undefined>}
     */
    async _readFile(name) {
        const basename = 'gpio' + this.port;
        const filename = join(basePath, basename, name);
        try {
            const value = await fs.readFile(filename, 'utf-8');
            return value && String(value);

        } catch (e) {

        }
    }

    /**
     * @param {string} name 
     * @param {string} value 
     * @returns 
     */
    async _writeFile(name, value) {
        if (value == null) {
            return;
        }

        const basename = 'gpio' + this.port;
        const filename = join(basePath, basename, name);
        try {
            await fs.writeFile(filename, String(value));

        } catch (e) {
            return e;
        }
    }

    /**
     * 导出端口
     * @param {number} port 
     * @returns {Promise<Error|undefined>}
     */
    static async export(port) {
        try {
            const filename = join(basePath, 'export');
            await fs.writeFile(filename, String(port));

        } catch (err) {
            return err;
        }
    }

    /**
     * 取消导出端口
     * @param {number} port 
     * @returns {Promise<Error|undefined>}
     */
    static async unexport(port) {
        try {
            const filename = join(basePath, 'unexport');
            await fs.writeFile(filename, String(port));

        } catch (err) {
            return err;
        }
    }
}

// ////////////////////////////////////////////////////////////
// GpioPort

export class GpioPort {
    /** @param {any} options */
    constructor(options) {
        this.options = { ...options };

        /** @type GpioHandle | undefined */
        this.handle = new GpioHandle(options);

        /** @type {((value: boolean|null) => void) | undefined} */
        this.callback = undefined;

        /** @type boolean | undefined */
        this.lastState = undefined;

        /** @type string */
        this.name = options?.name;
    }

    get [Symbol.toStringTag]() {
        return 'GpioPort';
    }

    get isOutput() {
        const options = this.options;
        return options.direction == 'out';
    }

    async clear() {
        this.lastState = undefined;
    }

    async close() {
        const handle = this.handle;
        if (handle) {
            this.handle = undefined;

            handle.close();
        }
    }

    async open() {

    }

    /** @return {Promise<boolean>} */
    async isOff() {
        const handle = this.handle;
        const value = await handle?.read();
        const state = value === 0;
        this.lastState = state;
        return state;
    }

    /** @return {Promise<boolean>} */
    async isOn() {
        const handle = this.handle;
        const value = await handle?.read();
        const state = value === 1;
        this.lastState = state;
        return state;
    }

    async setOff() {
        // console.log('setOff', this.name);
        const handle = this.handle;
        this.lastState = false;
        return handle?.write(0);
    }

    async setOn() {
        // console.log('setOn', this.name);
        const handle = this.handle;
        this.lastState = true;
        return handle?.write(1);
    }

    async toggle() {
        if (this.lastState) {
            return this.setOff();

        } else {
            return this.setOn();
        }
    }

    get onstatechange() {
        return this.callback;
    }

    set onstatechange(callback) {
        this.callback = callback;
        const handle = this.handle;

        if (callback != null) {
            handle?.setCallback(callback);
        }
    }
}

// ////////////////////////////////////////////////////////////
// context

const $context = {
    /** @type {GpioPort[] | undefined} */
    devices: undefined,

    /** @type any */
    initing: undefined,

    /** @type {{[key: string]: number}} */
    names: {},

    /** @type any */
    options: undefined
};

/**
 * @returns {Promise<any>}
 */
async function closeGpioPorts() {
    const devices = $context.devices;
    if (!devices) {
        return;
    }

    $context.devices = undefined;
    $context.options = undefined;
    $context.names = {};

    for (const device of devices) {
        await device.close();
    }
}

/**
 * @returns {Promise<GpioPort[]|undefined>}
 */
async function initGpioPorts() {
    try {
        if (!$context.options) {
            const config = await import('@tjs/config');
            const deviceConfig = await config.load('device');
            setPortInfos(deviceConfig.data);
        }

        const withExport = false;
        await loadGpioPorts(withExport);

    } catch (e) {
        console.log('gpio:', 'Init error:', e);

    } finally {
        $context.initing = undefined;

        if (!$context.devices) {
            $context.devices = [];
        }
    }

    return $context.devices;
}

/**
 * 初始化 IO 口
 * @param {boolean} withExport 是否导出 IO 口，默认为 false, 建议只在设备开机后调用
 */
async function loadGpioPorts(withExport = false) {
    /** @param {number} index */
    function getPortOptions(index) {
        const config = $context.options;
        if (!config) {
            return;
        }

        const name = config['gpio.' + index + '.name'];
        if (!name) {
            return;
        }

        const options = {
            index,
            name,
            direction: config['gpio.' + index + '.direction'],
            edge: config['gpio.' + index + '.edge'],
            port: Number.parseInt(config['gpio.' + index + '.port']),
            level: Number.parseInt(config['gpio.' + index + '.level'])
        };

        return options;
    }

    /**
     * 
     * @param {GpioPort} device 
     * @param {*} options 
     * @returns 
     */
    async function exportPort(device, options) {
        // 是否重新导出并初始化这个 IO 口
        const gpioHandle = device.handle;
        if (gpioHandle == null) {
            return;
        }

        const isExported = await gpioHandle?.isExported();
        if (isExported) {
            return;
        }

        const isOutput = (options.direction == 'out');

        try {
            const err = await GpioHandle.export(options.port);
            if (err) {
                console.warn(err.message);
            }

            if (isOutput) {
                await gpioHandle.setDirection('out');
                if (options.level != null) {
                    await gpioHandle._writeFile('value', String(options.level));
                }

            } else {
                await gpioHandle.setDirection('in');
                await gpioHandle.setEdge(options.edge || 'none');
            }

        } catch (e) {
            console.warn(e.message);
        }
    }

    const exists = await fs.exists(basePath);
    if (!exists) {
        console.log('gpio:', 'Not supported.');
        return;
    }

    const MAX_IO_COUNT = 32;
    $context.devices = [];
    for (let i = 0; i < MAX_IO_COUNT; i++) {
        const options = getPortOptions(i);
        if (!options) {
            continue;
        }

        const device = new GpioPort(options);
        $context.devices[i] = device;
        $context.names[options.name] = i;

        await exportPort(device, options);
    }

    console.log('gpio:', 'Inited.');
}

/**
 * @returns {Promise<GpioPort[]|undefined>}
 */
async function getDevices() {
    if ($context.devices) {
        return $context.devices;

    } else if ($context.initing) {
        return $context.initing;
    }

    const promise = initGpioPorts();
    $context.initing = promise;
    return promise;
}

export async function closePorts() {
    return closeGpioPorts();
}

/**
 * @returns {Promise<GpioPort[]|undefined>}
 */
export async function getPorts() {
    const devices = await getDevices();
    return devices;
}

/**
 * @param {object} options 
 * @param {string} options.name 
 * @returns {Promise<GpioPort | undefined>}
 */
export async function requestPort(options) {
    /** @type string */
    let name = '';
    if (options == null) {
        return;

    } else if (typeof options == 'object') {
        name = options.name;

    } else if (typeof options == 'string') {
        name = options;
    }

    const devices = await getDevices();

    let index = Number.parseInt(name);
    if (!(index >= 0)) {
        index = $context.names[name];
    }

    if (index >= 0) {
        return devices && devices[index];
    }
}

/**
 * 
 * @param {Object<string,any>} config 
 */
export async function setPortInfos(config) {
    $context.options = config;
}

export class Gpio {
    /**
     * @param {string} name 这个 I/O 的名称
     */
    constructor(name) {
        /** @type string */
        this.name = name;
    }

    /**
     * 当前值
     * @returns number
     */
    getValue() {
        return native.gpio.value(this.name);
    }

    /**
     * 设置为输入模式
     * @returns number
     */
    setInput() {
        return native.gpio.input(this.name);
    }

    /**
     * 设置为输出模式
     * @param {number} value 
     * @returns number
     */
    setOutput(value) {
        return native.gpio.output(this.name, value);
    }
}
