#!/bin/env tjs
/// <reference path ="../modules/types/index.d.ts" />

// @ts-check
import * as process from '@tjs/process';

import * as cmdline from '../modules/utils/cmdline.js';

import * as device from './src/device.js';
import * as factory from './src/factory.js';
import * as info from './src/info.js';
import * as log from './src/log.js';
import * as firmware from './src/firmware.js';
import * as service from './src/service.js';
import * as token from './src/token.js';
import * as config from './src/config.js';

/**
 * 
 * @param {string} type 
 */
function showHelp(type) {
    cmdline.help($commands, true);
    console.print(`${process.version}@${process.execPath()}:${process.scriptPath()}`);
}

/**
 * 供 CLI 调用的命令接口
 */
const $commands = {
    title: 'This is the CLI for WoT.js',
    /** @type {cmdline.ManageCommands} */
    subcommands: {
        config: config.command,
        device: device.command,
        factory: factory.command,
        firmware: firmware.command,
        info: info.command,
        log: log.command,
        service: service.command,
        token: token.command
    },

    commands: {
        // config
        get: config.command.commands.get,
        set: config.command.commands.set,
        unset: config.command.commands.unset,

        // service process manager
        list: service.command.commands.list,
        ps: service.command.commands.list,
        restart: service.command.commands.restart,
        start: service.command.commands.start,
        stop: service.command.commands.stop,

        /**
         * 显示帮助信息
         * @param {string} type 
         */
        help(type) {
            showHelp(type);
        },
        /** 打印运行环境及模块版本信息 */
        version() {
            console.print('Versions:');
            console.table(process.versions, undefined);
        }
    }
};

// alias tpm='tjs tpm'
cmdline.run($commands, ...process.argv);
process.title('tpm');
