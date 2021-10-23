// @ts-check
import * as native from '@tjs/native';

export const watchdog = native.watchdog;
export const adc = native.adc;

export class ADC {
    constructor() {
        this.device = '/dev/adc';
        this.name = 'adc';
    }

    get [Symbol.toStringTag]() {
        return 'ADC';
    }
}

export class Watchdog {
    constructor() {
        this.device = '/dev/watchdog';
        this.enabled = false;

        /** @type {number|null} */
        this.fileno = null;
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
    names: {},
    devices: null
};

async function initDefaults() {
    try {
        if ($context.initing) {
            return;
        }

        $context.initing = true;
        $context.devices = [];

        let index = $context.devices.length;
        const watchdog = new Watchdog();
        $context.devices[index] = watchdog;
        $context.names.watchdog = index;

        index = $context.devices.length;
        const adc = new ADC();
        $context.devices[index] = adc;
        $context.names.adc = index;

        $context.initing = false;

    } catch (e) {
        $context.initing = false;

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
