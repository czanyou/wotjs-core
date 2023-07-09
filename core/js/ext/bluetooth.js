// @ts-check
/// <reference path ="../../types/index.d.ts" />

export class BluetoothDevice extends EventTarget {
    constructor() {
        super();

        this.id = null;
        this.name = null;
        this.gatt = null;
    }

    async watchAdvertisments() {

    }

    async unwatchAdvertisments() {
        
    }
}

// ongattserverdisconnected

export class BluetoothSlaveDevice extends EventTarget {
    constructor() {
        super();

        this.id = null;
        this.name = null;
        this.gatt = null;
    }
}

// onconnected
// ondisconnected

const $context = {
    names: {},
    devices: null
};

async function initDefaults() {

}

export async function getAvailability() {
    return true;
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
    if (!$context.device) {
        $context.device = new BluetoothDevice();
    }

    return $context.device;
}
