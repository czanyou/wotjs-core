// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />

import * as service from '../../modules/system/service.js';

/**
 * 供 CLI 调用的命令接口
 */
const commands = {
    /** @param {string[]} args */
    async enable(...args) {
        if (!args.length) {
            console.print('Usage: tpm enable <service>\n');
            return service.list();
        }

        for (const name of args) {
            await service.disable(name, false);

        }

    },
    /** @param {string[]} args */
    async disable(...args) {
        if (!args.length) {
            console.print('Usage: tpm disable <service>\n');
            return service.list();
        }

        for (const name of args) {
            await service.disable(name, true);
        }
    },
    /** @param {any[]} args */
    list(...args) {
        return service.ps(...args);
    },
    /** @param {string[]} args */
    async restart(...args) {
        if (!args.length) {
            console.print('Usage: tpm restart <service>\n');
            return service.list();
        }

        for (const name of args) {
            await service.restart(name);
        }
    },
    /** @param {string} name */
    async info(name) {
        const status = await service.status(name);
        if (!status) {
            console.print('Usage: tpm service status <service>\n');
            return service.list();
        }

        console.table(status);
    },
    /** @param {string[]} args */
    async start(...args) {
        if (!args.length) {
            console.print('Usage: tpm start <service>\n');
            return service.list();
        }

        for (const name of args) {
            await service.start(name);
        }

    },
    /** @param {string[]} args */
    async stop(...args) {
        if (!args.length) {
            console.print('Usage: tpm stop <service>\n');
            return service.list();
        }

        for (const name of args) {
            await service.stop(name);
        }
    }
};

export const command = {
    title: '管理后台服务',
    subtitle: {
        disable: '停止并禁止指定的服务',
        enable: '启用指定的服务',
        list: '查询所有服务状态',
        restart: '重启指定的服务',
        info: '查询指定的服务的状态',
        start: '启动指定的服务',
        stop: '停止指定的服务，但可能还是会被自动重启'
    },
    commands
};
