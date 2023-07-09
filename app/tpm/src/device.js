// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />

import * as config from '@tjs/config';

import * as cmdline from '../../modules/utils/cmdline.js';
import * as shell from '../../modules/system/shell.js';

const $config = cmdline.command('device');

/**
 * 供 CLI 调用的命令接口
 */
const commands = {
    get: $config.commands.get,
    set: $config.commands.set,
    unset: $config.commands.unset,

    /**
     * 显示设备信息
     */
    async info() {
        const info = await shell.info();

        console.print('Device:');
        console.table(info.device);

        console.print('Tuya:');
        console.table(info.tuya);

        console.print('Web things:');
        console.table(info.wot);

        console.print('Network:');
        console.table(info.net);

        console.print('UART:');
        console.table(info.uart);

        console.print('GPIO:');
        console.table(info.gpio);

        console.print('More:');
        console.table(info.more);
    },

    async init() {
        const gpio = await import('@tjs/gpio');

        const deviceConfig = await config.load('device');
        gpio.setPortInfos(deviceConfig.data);
        await gpio.getPorts();
    },

    /** 
     * 恢复出厂设置
     * @param {string} mode
    */
    async restore(mode) {
        if (mode == 'all') {
            shell.restore('all');

        } else if (mode == 'reboot') {
            shell.restore('reboot');

        } else {
            console.print('Usage: tpm device restore <all|reboot>');
        }
    }
};

export const command = {
    title: '管理设备',
    subtitle: {
        get: '查询设备配置参数',
        set: '修改设备配置参数',
        unset: '删除设备配置参数',
        info: '查看设备信息',
        init: '初始化设备',
        restore: '重置设备',
        token: '查看或修改设备访问凭证'
    },
    commands
};
