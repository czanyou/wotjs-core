// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { join } from '@tjs/path';
import * as fs from '@tjs/fs';
import * as native from '@tjs/native';

const basePath = '/sys/class/gpio';

// ////////////////////////////////////////////////////////////
// GPIO

export class GPIO {
    /**
     * @param {object} options 
     * @param {string} [options.direction]
     * @param {string} [options.edge]
     * @param {number} [options.level]
     * @param {string} [options.name]
     * @param {string} [options.port]
     */
    constructor(options) {
        options = options || {};

        this.direction = options.direction || 'in';
        this.edge = options.edge || 'none';

        /** @type {native.hal.GPIO} */
        this.handle = null;
        this.level = options.level || 0;
        this.name = options.name;
        this.port = options.port;
    }

    get [Symbol.toStringTag]() {
        return 'GPIO';
    }

    async close() {
        try {
            const handle = this.handle;
            if (handle) {
                this.handle = null;

                handle.onpoll = null;
                await handle.close();
            }

        } catch (err) {
            console.log('gpio:', err);
        }
    }

    /**
     * 输入输出方向
     * @returns {Promise<string>} `in` or `out`
     */
    async getDirection() {
        return this._readFile('direction');
    }

    /**
     * 控制中断触发模式
     * @returns {Promise<string>} `none`, `falling`, `both` or `rising`
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
            console.log('gpio:', err);
        }
    }

    async setCallback(callback) {
        if (!callback) {
            const handle = this.handle;
            if (handle) {
                handle.onpoll = null;
            }
            return;
        }

        if (this.direction != 'in') {
            return;

        } else if (this.edge == 'none') {
            return;
        }

        await this.setDirection(this.edge);
        // console.log('setCallback', callback);

        if (!this.handle) {
            await this.open();
        }

        const handle = this.handle;

        async function onpoll() {
            const ret = await handle.read();
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
     * @returns {Promise<number>} 0 or 1
     */
    async read() {
        if (!this.handle) {
            await this.open();
        }

        const handle = this.handle;

        try {
            const value = await handle.read();
            if (value === 49) { // '1'
                return 1;

            } else if (value === 48) { // '0'
                return 0;
            }

        } catch (err) {
            close();
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
     * @returns {Promise<Error|number>}
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
     * @returns {Promise<string>}
     */
    async _readFile(name) {
        const basename = 'gpio' + this.port;
        const filename = join(basePath, basename, name);
        try {
            const value = await fs.readFile(filename, 'utf-8');
            return value && String(value);

        } catch (e) {
            return null;
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
     * @returns {Promise<Error>}
     */
    static async export(port) {
        try {
            const filename = join(basePath, 'export');
            await fs.writeFile(filename, String(port));

        } catch (e) {
            return e;
        }
    }

    /**
     * 取消导出端口
     * @param {number} port 
     * @returns {Promise<Error>}
     */
    static async unexport(port) {
        try {
            const filename = join(basePath, 'unexport');
            await fs.writeFile(filename, String(port));

        } catch (e) {
            return e;
        }
    }
}

// ////////////////////////////////////////////////////////////
// Input

export class Input {
    /** @param {any} options */
    constructor(options) {
        this.handle = new GPIO(options);
        this.callback = null;
        this.lastState = null;
        this.name = options?.name;
    }

    get [Symbol.toStringTag]() {
        return 'Input';
    }

    async clear() {
        this.lastState = null;
    }

    async close() {
        const handle = this.handle;
        if (handle) {
            this.handle = null;

            handle.close();
        }
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

    get onstatechange() {
        return this.callback;
    }

    set onstatechange(callback) {
        this.callback = callback;
        const handle = this.handle;
        handle?.setCallback(callback);
    }
}

// ////////////////////////////////////////////////////////////
// Output

export class Output extends Input {
    /** @param {any} options */
    constructor(options) {
        super(options);

        this.lastState = false;
    }

    get [Symbol.toStringTag]() {
        return 'Output';
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
}

const $context = {
    /** @type {Output[] | Input[]} */
    devices: null,

    initing: false,

    /** @type {{[key: string]: number}} */
    names: {}
};

async function initDefaults() {
    try {
        if ($context.initing) {
            return;
        }

        $context.initing = true;
        const config = await import('@tjs/config');
        const deviceConfig = await config.load('device');

        const withExport = false;
        await init(deviceConfig.data, withExport);
        $context.initing = false;

    } catch (e) {
        $context.initing = false;

        console.log('gpio: initDefaults', e);
        if (!$context.devices) {
            $context.devices = [];
        }
    }
}

export async function getDevices() {
    if (!$context.devices) {
        await initDefaults();
    }

    return $context.devices;
}

/**
 * 初始化 IO 口
 * @param {*} config 配置参数
 * @param {boolean} withExport 是否导出 IO 口，默认为 false, 建议只在设备开机后调用
 */
export async function init(config, withExport = false) {
    /** @param {number} index */
    function getPortOptions(index) {
        const name = config['gpio.' + index + '.name'];
        if (!name) {
            return;
        }

        const options = {
            index,
            name: name,
            direction: config['gpio.' + index + '.direction'],
            edge: config['gpio.' + index + '.edge'],
            port: Number.parseInt(config['gpio.' + index + '.port']),
            level: Number.parseInt(config['gpio.' + index + '.level'])
        };

        return options;
    }

    const MAX_IO_COUNT = 32;
    $context.devices = [];
    for (let i = 0; i < MAX_IO_COUNT; i++) {
        const options = getPortOptions(i);
        if (!options) {
            continue;
        }

        const isOutput = options.direction == 'out';
        const device = isOutput ? new Output(options) : new Input(options);
        $context.devices[i] = device;
        $context.names[options.name] = i;

        // 是否重新导出并初始化这个 IO 口
        const gpioHandle = device.handle;
        const isExported = await gpioHandle.isExported();
        if (!isExported) {
            await GPIO.export(options.port);
            // console.log('export', options.port, options.name, error && error.message);

            if (isOutput) {
                await gpioHandle.setDirection('out');
                if (options.level != null) {
                    await gpioHandle._writeFile('value', String(options.level));
                }

            } else {
                await gpioHandle.setDirection('in');
                await gpioHandle.setEdge(options.edge || 'none');
            }
        }
    }
}

/**
 * @param {object} options 
 * @param {string} options.name 
 * @returns {Promise<Input | Output>}
 */
export async function requestDevice(options) {
    /** @type string */
    let name = null;
    if (options == null) {
        return;

    } else if (typeof options == 'object') {
        name = options.name;

    } else if (typeof options == 'string') {
        name = options;
    }

    if (!$context.devices) {
        await initDefaults();
    }

    let index = Number.parseInt(name);
    if (!(index >= 0)) {
        index = $context.names[name];
    }

    if (index >= 0) {
        return $context.devices[index];
    }
}
