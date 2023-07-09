// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

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
}

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

const $context = {
    /** @type {{[key: string]: number}} */
    names: {},

    /** @type Watchdog[] */
    watchdogs: [],

    /** @type ADC[] */
    adcs: [],

    /** @type boolean */
    initing: false
};

async function initDefaults() {
    try {
        if ($context.initing) {
            return;
        }

        $context.initing = true;

        // watchdog
        $context.watchdogs = [];
        let index = $context.watchdogs.length;
        const watchdog = new Watchdog();
        $context.watchdogs[index] = watchdog;
        $context.names.watchdog = index;
        $context.watchdog = watchdog;

        // adc
        $context.adcs = [];
        index = $context.adcs.length;
        const adc = new ADC();
        $context.adcs[index] = adc;
        $context.names.adc = index;

        $context.initing = false;

    } catch (e) {
        console.log('devices:', e.message);
        $context.initing = false;
    }
}

/**
 * 
 * @returns {Promise<Watchdog[]>}
 */
export async function getWatchdogs() {
    if (!$context.watchdogs?.length) {
        await initDefaults();
    }

    return $context.watchdogs || [];
}

/**
 * 
 * @param {*} options 
 * @returns {Promise<Watchdog>}
 */
export async function requestWatchdog(options) {
    if (!$context.watchdogs?.length) {
        await initDefaults();
    }

    return $context.watchdog;
}
