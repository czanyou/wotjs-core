// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import * as fs from '@tjs/fs';

const TAG = 'devcies:';

export const watchdog = native.watchdog;
export const adc = native.adc;

export class ADC {
    constructor() {
        /** @type string */
        this.device = '/dev/adc';

        /** @type string */
        this.name = 'adc';
    }

    get [Symbol.toStringTag]() {
        return 'ADC';
    }

    close() {
        
    }
}

/**
 * 硬件看门狗
 * 
 * - /dev/watchdog 和 /dev/watchdog0 是同一个设备，是为了兼容老的应用。
 */
export class Watchdog {
    constructor() {
        /** @type string */
        this.device = '/dev/watchdog';

        /** @type boolean */
        this.enabled = false;

        /** @type {number|null} */
        this.fileno = null;

        /** @type string */
        this.name = 'watchdog';
    }

    get [Symbol.toStringTag]() {
        return 'Watchdog';
    }

    close() {
        const fileno = this.fileno;
        if (fileno) {
            this.fileno = null;
            watchdog.close(fileno);
        }
    }

    open() {
        if (this.fileno) {
            return;
        }

        this.fileno = watchdog.open(this.device);
        if (this.fileno) {
            this.enabled = true;
            return true;
        }
    }

    disable() {
        if (!this.fileno) {
            return;
        }

        watchdog.enable(this.fileno, false);
        this.enabled = false;
    }

    enable() {
        if (!this.fileno) {
            return;
        }

        watchdog.enable(this.fileno, true);
        this.enabled = true;
    }

    keepalive() {
        if (!this.fileno) {
            return;
        }

        return watchdog.keepalive(this.fileno);
    }

    getTimeout() {
        if (!this.fileno) {
            return;
        }

        return watchdog.timeout(this.fileno);
    }

    isEnabled() {
        return this.enabled;
    }

    /** @param {number} timeout */
    setTimeout(timeout) {
        if (!this.fileno) {
            return;
        }

        return watchdog.timeout(this.fileno, timeout);
    }

    reset() {
        if (!this.fileno) {
            return;
        }

        return watchdog.reset(this.fileno);
    }
}

/**
 * 上下文信息
 */
const $context = {
    /** @type {{[key: string]: number}} 设备名称和设备文件映射表 */
    names: {},

    /** @type Watchdog[] 看门狗设备列表 */
    watchdogs: [],

    /** @type ADC[] */
    adcs: [],

    /** @type boolean 是否正在初始化中 */
    initing: false,

    /** @type boolean 是否已初始化 */
    inited: false
};

/**
 * 初始化
 * @returns 
 */
async function init() {
    if ($context.inited || $context.initing) {
        return;
    }

    $context.initing = true;

    // watchdog
    try {
        $context.watchdogs = [];

        const filename = '/dev/watchdog';
        if (await fs.exists(filename)) {
            const watchdog = new Watchdog();
            const index = $context.watchdogs.length;
            $context.watchdogs[index] = watchdog;
            $context.names.watchdog = index;
        }
    } catch (e) {
        console.log(TAG, 'init:', e.message);
    }

    // adc
    try {
        $context.adcs = [];

        const filename = '/dev/adc';
        if (await fs.exists(filename)) {
            const index = $context.adcs.length;
            const adc = new ADC();
            $context.adcs[index] = adc;
            $context.names.adc = index;
        }

    } catch (e) {
        console.log(TAG, 'init:', e.message);
    }

    $context.inited = true;
    $context.initing = false;
}

/**
 * 关闭所有设备
 */
export function close() {
    const watchdogs = $context.watchdogs;
    if (watchdogs) {
        $context.watchdogs = [];
        for (const watchdog of watchdogs) {
            watchdog.close();
        }
    }

    const adcs = $context.adcs;
    $context.adcs = [];
    if (adcs) {
        for (const adc of adcs) {
            adc.close();
        }
    }
}

/**
 * 返回所有已打开的 Watchdog 设备
 * @returns {Promise<Watchdog[]>}
 */
export async function getWatchdogs() {
    if (!$context.watchdogs?.length) {
        await init();
    }

    return $context.watchdogs || [];
}

/**
 * 返回指定的 Watchdog 设备
 * @param {{name?: string}} options 
 * @returns {Promise<Watchdog|undefined>}
 */
export async function requestWatchdog(options) {
    if (!$context.watchdogs?.length) {
        await init();
    }

    const name = options?.name;
    if (name == null || name == 'watchdog0') {
        return $context.watchdogs[0];
    }
}
