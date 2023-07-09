// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as os from '@tjs/os';
import * as fs from '@tjs/fs';
import * as config from '@tjs/config';

import * as services from '../vendor/services.js';

/**
 * 安全读取文件内容
 * @param {string} filename 文件名
 * @returns {Promise<string>}
 */
async function readTextFile(filename) {
    try {
        const result = await fs.readFile(filename, 'utf-8');
        return /** @type string */(result);

    } catch (err) {
        return '';
    }
}

/**
 * 
 * @param {number} pid 
 * @returns {Promise<string|undefined>}
 */
async function _readCmdline(pid) {
    const filename = `/proc/${pid}/cmdline`;
    return await readTextFile(filename);
}

const $context = {

};

// ////////////////////////////////////////////////////////////
// export methods

/**
 * 检查指定的服务是否正在运行，如果没有则启动它
 * @param {string} name 
 * @return {Promise<boolean|undefined>}
 */
export async function check(name) {
    if (!name) {
        console.print('Usage: tpm check <service-name>');
        return;
    }

    const disabled = await isDisabled(name);
    if (disabled) {
        return;
    }

    const service = getService(name);
    if (!service) {
        return;
    }

    if ($context[name] == null) {
        $context[name] = { name };
    }

    const status = $context[name];
    if (status.pid) {
        // 检查原进程是否还存在
        status.cmdline = await _readCmdline(status.pid);
        if (!status.cmdline || !status.cmdline.startsWith(name)) {
            status.pid = await pidof(name); // 获取新进程的进程号
        }

    } else {
        // 读取进程号
        status.pid = await pidof(name);
    }

    if (!status.pid) {
        console.log('service:', `Starting ${name}...`);
        await start(name);
        return true;
    }

    // console.print(`${name}: ${status.pid}`, status);
    return false;
}

/**
 * 禁用/启用指定名称的服务
 * @param {string} name 服务名
 * @param {boolean} disabled 是否禁用
 */
export async function disable(name, disabled) {
    const service = getService(name);
    if (!service) {
        return;
    }

    const processConfig = await config.load('process', os.tmpdir());
    processConfig.setItem(name + '.disabled', disabled);
    await processConfig.save();

    if (disabled === true) {
        await service.stop();

    } else if (disabled === false) {
        await service.start();
    }
}

/** @param {string} name */
export function getService(name) {
    return services.services[name];
}

/**
 * 
 * @param {string} name 
 */
export function get(name) {
    return $context[name];
}

/**
 * 禁用/启用指定名称的服务
 * @param {string} name 服务名
 * @return {Promise<boolean>}
 */
export async function isDisabled(name) {
    const service = getService(name);
    if (!service) {
        return false;
    }

    const processConfig = await config.load('process', os.tmpdir());
    const ret = processConfig.getBoolean(name + '.disabled');
    if (ret == null) {
        return false;
    }

    return ret;
}

/**
 * 打印所有可以管理的服务的名称
 */
export async function list() {
    console.print('Available services:');
    const names = Object.keys(services.getServices());
    console.print(' ', names.join(', '), '\n');
}

/**
 * 返回指定的名称的行程的 pid
 * @param {string} name 名称
 * @returns {Promise<number|undefined>} pid
 */
export async function pidof(name) {
    if (!name) {
        return;
    }

    const result = await os.exec('pidof ' + name);
    const filedata = result && result.stdout;
    if (!filedata) {
        return;
    }

    // 检查进程是否存活
    const pid = Number.parseInt(filedata.trim());
    const cmdline = await _readCmdline(pid);
    if (!cmdline) {
        return;
    }

    return pid;
}

/**
 * 打印所有可以管理的服务的运行状态
 * @param {string} [name] 
 */
export async function ps(name) {
    if (name) {
        const pid = await pidof(name);
        if (pid) {
            console.print(pid);
        }

        return;
    }

    const processConfig = await config.load('process', os.tmpdir());

    const names = Object.keys(services.getServices());
    const processes = [];
    for (const name of names) {
        const service = getService(name);
        const pid = await pidof(name);
        const disabled = processConfig.getBoolean(name + '.disabled') || '-';
        const item = { name, pid: pid || '-', disabled, title: service?.title };
        processes.push(item);
    }

    console.print('Services:');
    console.table(processes);
}

/**
 * 返回指定名称的服务的状态
 * @param {string} name 
 */
export async function status(name) {
    /**
     * 
     * @param {number} pid 
     * @returns {Promise<string|undefined>}
     */
    async function readFilename(pid) {
        try {
            const filename = `/proc/${pid}/exe`;
            return await fs.readlink(filename);
        } catch (e) {
            return '';
        }
    }

    /**
     * 
     * @param {number} pid 
     * @returns {Promise<number|undefined>}
     */
    async function getUid(pid) {
        try {
            const filename = `/proc/${pid}`;
            const data = await fs.stat(filename);
            return data.uid;

        } catch (e) {
            return undefined;
        }
    }

    const info = name && getService(name);
    if (!info) {
        return;
    }

    const status = { name };
    status.title = info.title;
    status.disabled = await isDisabled(name);
    status.pid = await pidof(name);
    if (status.pid) {
        status.exepath = await readFilename(status.pid);
        status.uid = await getUid(status.pid);
        status.cmdline = await _readCmdline(status.pid);
    }

    return status;
}

/**
 * 重启指定名称的服务
 * @param {string} name 
 * @param {...any} args 
 */
export async function restart(name, ...args) {
    const service = getService(name);
    if (service) {
        await service.stop(...args);
        await service.start(...args);

    } else {
        console.print(`${name}: unrecognized service`);
    }
}

/**
 * 启动指定名称的服务
 * @param {string} name 
 * @param {...any} args 
 */
export async function start(name, ...args) {
    const service = getService(name);
    if (service) {
        await service.start(...args);

    } else {
        console.print(`${name}: unrecognized service`);
    }
}

/**
 * 停止指定名称的服务
 * @param {string} name 
 * @param {...any} args 
 */
export async function stop(name, ...args) {
    const service = getService(name);
    if (service) {
        await service.stop(...args);

    } else {
        console.print(`${name}: unrecognized service`);
    }
}
