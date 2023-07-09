// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as os from '@tjs/os';
import * as util from '@tjs/util';

/**
 * 安全读取文件内容
 * @param {string} filename 文件名
 * @returns {Promise<string>}
 */
async function readTextFile(filename) {
    try {
        const result = await fs.readFile(filename, 'utf-8');
        return String(result);

    } catch (err) {
        return '';
    }
}

/**
 * 返回指定的名称的行程的 pid
 * @param {string} name 名称
 * @returns {Promise<number|undefined>} pid
 */
async function pidof(name) {
    // pidof
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
    const procName = '/proc/' + pid + '/cmdline';
    const data = await readTextFile(procName);
    if (!data) {
        return;
    }

    return pid;
}

/**
 * 启动指定的名称的进程
 * @param {string} name 进程名称
 * @param {string|string[]} cmdline 启动命令行
 * @returns 
 */
async function startProcess(name, cmdline) {
    const pid = await pidof(name);
    if (pid) {
        console.print(`${name}.service already started: ${pid}`);
        return;
    }

    const options = { detached: true, stdout: 'ignore', stderr: 'ignore' };
    await os.exec(['sh', '-c', cmdline + ' &'], options);
}

/**
 * 关闭指定的名称的进程
 * @param {string} name 进程名称
 * @param {string} cmdline 关闭命令行
 * @returns 
 */
async function stopProcess(name, cmdline) {
    const data = await pidof(name);
    if (!data) {
        return console.print(`stop ${name}.service: no service stoped`);
    }

    console.print('stopping:', name);
    await os.exec(cmdline);
}

/**
 * @typedef Service
 * @property {string=} title
 * @property {string=} name
 * @property {number=} pid
 * @property {number=} uid
 * @property {number=} gid
 * @property {Function} start
 * @property {Function} stop
 */

/**
 * @type Object<string,Service>
 */
export const services = {

    mdnsd: {
        title: 'mDNS daemon',
        async start() {
            const command = 'mdnsd -p -i wlan0';
            await startProcess('mdnsd', command);
        },
        async stop() {
            const command = 'killall -q mdnsd';
            await stopProcess('mdnsd', command);
        }
    },

    tcd: {
        name: 'tcd',
        title: 'WoT.js config daemon',
        async start() {
            const command = 'tjs tcd run';
            await startProcess('tcd', command);
        },
        async stop() {
            const command = 'killall -q tcd';
            await stopProcess('tcd', command);
        }
    },

    ipcd: {
        title: 'Network camera & P2P protocol daemon',
        async start() {
            const filename = '/var/run/ipcd.token';
            const token = await readTextFile(filename);

            let command = 'ipcd run';
            if (token) {
                command += ' -t ' + token;
            }

            command += ' > /dev/null';
            await startProcess('ipcd', command);
        },
        async stop(timeout = 5000) {
            const command = 'killall -q ipcd';
            await stopProcess('ipcd', command);

            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                const span = Date.now() - start;

                const pid = await pidof('ipcd');
                if (pid == null) {
                    console.info('Tuyad stoped', span);
                    break;

                } else if (span > timeout) {
                    const command = 'killall -9 -q ipcd';
                    await stopProcess('ipcd', command);
                    break;
                }
                
                await util.sleep(100);
            }
        }
    },

    syslogd: {
        title: 'System syslog daemon',
        async start() {
            const command = 'syslogd';
            await startProcess('syslogd', command);
        },
        async stop() {
            const command = 'killall -q syslogd';
            await stopProcess('syslogd', command);
        }
    },

    udhcpc: {
        title: 'DHCP client daemon',
        /** @param {string} ifname */
        async start(ifname) {
            ifname = ifname || 'eth0';
            const interval = 5;
            const command = `udhcpc -f -A ${interval} -p /var/run/udhcpc.pid -i ${ifname} --syslog`;
            await startProcess('udhcpc', command);
        },
        async stop() {
            const command = 'killall -q udhcpc';
            await stopProcess('udhcpc', command);
        }
    },

    wpa_supplicant: {
        title: 'WPA supplicant daemon',
        /** @param {string} ifname */
        async start(ifname) {
            ifname = ifname || 'wlan0';
            const command = `wpa_supplicant -Dwext -i${ifname} -c/system/etc/wpa_supplicant.conf`;
            await startProcess('wpa_supplicant', command);
        },
        async stop() {
            const command = 'killall -q wpa_supplicant';
            await stopProcess('wpa_supplicant', command);
        }
    }
};

/**
 * 
 * @param {string=} board 
 * @returns {Object<string,Service>}
 */
export function getServices(board) {
    board = board || navigator.board;

    /** @type Object<string,Service> */
    const result = {};
    if (board == 'linux') {
        result.tcd = services.tcd;
        result.ipcd = services.ipcd;
        result.wpa_supplicant = services.wpa_supplicant;
    }

    return result;
}
