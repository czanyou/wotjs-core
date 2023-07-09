// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as gpio from '@tjs/gpio';
import * as util from '@tjs/util';

/** @param {string} name */
export async function has(name) {
    const port = await gpio.requestPort('led' + name);
    return !!port;
}

/** @param {string} name */
export async function toggle(name) {
    const port = await gpio.requestPort('led' + name);
    if (port) {
        await port.toggle();
    }
}

/** @param {string} name */
export async function setOn(name) {
    const port = await gpio.requestPort('led' + name);
    if (port) {
        await port.setOn();
    }
}

/** @param {string} name */
export async function setOff(name) {
    const port = await gpio.requestPort('led' + name);
    if (port) {
        await port.setOff();
    } else {
        console.log('led: port not found:', name);
    }
}

/** @param {string} ledName */
export async function test(ledName) {
    if (!ledName) {
        console.print('Usage: tci test led <name>\n');
    }

    const names = ['blue', 'orange', 'ir'];
    console.print('leds:', names.join(', '));

    for (const name of names) {
        await setOff(name);
    }

    if (ledName && ledName != 'all') {
        await setOn(ledName);

        await util.sleep(1000);

        for (const name of names) {
            await setOff(name);
        }

        return;
    }

    let index = 0;

    setInterval(async () => {
        const offset = index % names.length;
        index++;

        const name = names[offset];
        await toggle(name);

    }, 100);
}
