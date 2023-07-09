// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as os from '@tjs/os';
import * as config from '@tjs/config';
import * as util from '@tjs/util';

import * as process from '@tjs/process';

/**
 * 
 * @param {string|string[]} args 
 * @returns 
 */
export async function execute(args) {
    const result = await os.exec(args);
    return result;
}

export async function info() {
    // TODO: 显示设备激活信息
    const deviceConfig = await config.load('device');
    const result = { device: {}, net: {}, wot: {}, uart: [{}], gpio: [{}], more: {}, tuya: {}, watchdog: {} };

    const data = deviceConfig.data;
    for (const key in data) {
        const value = data[key];
        if (key.startsWith('device.')) {
            result.device[key] = value;

        } else if (key.startsWith('tuya.')) {
            result.tuya[key] = value;

        } else if (key.startsWith('wot.')) {
            result.wot[key] = value;

        } else if (key.startsWith('mqtt.')) {
            result.wot[key] = value;

        } else if (key.startsWith('wlan.')) {
            result.net[key] = value;

        } else if (key.startsWith('eth.')) {
            result.net[key] = value;

        } else if (key.startsWith('watchdog.')) {
            result.watchdog[key] = value;

        } else if (key.startsWith('uart.')) {
            const tokens = key.split('.');
            const index = Number.parseInt(tokens[1]);
            const name = tokens[2];
            if (result.uart[index] == null) {
                result.uart[index] = {};
            }

            result.uart[index][name] = value;

        } else if (key.startsWith('gpio.')) {
            const tokens = key.split('.');
            const index = Number.parseInt(tokens[1]);
            const name = tokens[2];
            if (result.gpio[index] == null) {
                result.gpio[index] = {};
            }

            result.gpio[index][name] = value;

        } else {
            result.more[key] = value;
        }
    }

    return result;
}

/**
 * 恢复出厂设置
 * - 用户长按复位按钮
 * - 用户在 APP 上删除了设备
 */
export async function restore(action = 'all') {
    /** @param {string} cmdline */
    async function exec(cmdline) {
        const result = await os.exec(cmdline);
        console.info('shell:', `'${cmdline}' result: `, result?.code, result?.signal);
        const message = result?.stdout || result?.stderr;
        if (message != null) {
            console.print(message);
        }
    }

    // factory
    await exec('tpm factory reload');

    // network
    await exec('tci config load default');

    // tuya
    await exec('tci tuya clean');

    // reboot
    setTimeout(async () => {
        if (action == 'reboot') {
            os.reboot();

        } else {
            await exec('tpm restart ipcd');
            process.exit(0);
        }
    }, 1000);

    // sync 
    await exec('sync');

    await exec('ipcd play tone2');
    console.warn('shell:', 'Device restored.');
}

/** 
 * 查询或设置设备远程控制 token
 * @param {string=} action `renew`
 */
export async function token(action) {
    if (!action) {
        return;
    }

    const userConfig = await config.load('user');
    let token = userConfig.getString('device.token');

    // renew
    if (!token || action == 'renew') {
        const buffer = new Uint8Array(16);
        window.crypto.getRandomValues(buffer);
        token = util.encode(buffer, 'hex');

        userConfig.setItem('device.token', token);
        await userConfig.save();
    }

    return token;
}
