// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

const os = native.os;
const utf8 = native.utf8;

// const
export const arch = native.arch;
export const platform = native.platform;
export const signals = native.signals;
export const EOL = '\r\n';

// methods
export const board = native.board;
export const cpus = os.cpuinfo;
export const chdir = native.os.chdir;
export const cwd = native.cwd;
export const freemem = os.freemem;
export const gettimeofday = native.gettimeofday;
export const homedir = native.homedir;
export const hostname = os.hostname;
export const hrtime = native.hrtime;
export const isatty = native.isatty;
export const kill = os.kill;
export const loadavg = os.loadavg;
export const printHandles = os.printHandles;
export const printMemoryUsage = os.printMemoryUsage;
export const reboot = os.reboot;
export const rss = os.rssmem;
export const signal = native.signal;
export const sleep = os.sleep;
export const tmpdir = native.tmpdir;
export const totalmem = os.totalmem;
export const uname = native.uname;
export const uptime = os.uptime;

export function networkInterfaces() {
    const interfaces = os.interfaces() || [];
    const result = {};
    for (const iface of interfaces) {
        const name = iface.name;
        if (result[name] == null) {
            result[name] = [];
        }

        result[name].push(iface);
    }

    return result;
}

/**
 * spawn
 * @param {string} command 
 * @param {string[]} args 
 * @param {native.SpawnOptions} options 
 * @returns {native.ChildProcess}
 */
export function spawn(command, args, options) {
    const cmdline = [command];
    cmdline.push(...args);
    return native.spawn(cmdline, options);
}

/**
 * 执行一个命令并获取执行结果
 * @param {string} file 要执行的命令
 * @param {string[]} args 要执行的命令
 * @param {native.SpawnOptions} [options]
 * @returns {Promise<native.ChildProcess>} 返回这个命令输出的内容
 */
export async function execFile(file, args, options) {
    const command = [file];
    command.push(...args);

    options = Object.assign({}, options);
    options.stdin = 'pipe';
    options.stdout = 'pipe';
    options.stderr = 'pipe';

    const subprocess = native.spawn(command, options);
    const util = await import('@tjs/util');

    subprocess.send = async function (/** @type {object} */ message) {
        try {
            const stdin = subprocess.stdin;
            const data = util.encodeMessage(message);
            if (data != null) {
                stdin?.write(data);
                return true;
            }

            return false;

        } catch (err) {
            return false;
        }
    };

    const parser = new util.MessageParser();
    parser.onmessage = function (event) {
        if (subprocess.onmessage) {
            subprocess.onmessage(event);
        }
    };

    function onDisconnected() {
        if (subprocess.ondisconnect) {
            subprocess.ondisconnect(new Event('disconnect'));
        }
    }

    if (subprocess.stdout) {
        subprocess.stdout.onmessage = (data) => {
            if (!data) {
                onDisconnected();
                return;
            }

            parser.execute(data);
        };
    }

    if (subprocess.stderr) {
        subprocess.stderr.onmessage = (data) => {
            if (!data) {
                onDisconnected();
            }
        };
    }

    return subprocess;
}

/**
 * 执行一个命令并获取执行结果
 * @param {string|string[]} command 要执行的命令
 * @param {native.SpawnOptions} [options]
 * @returns {Promise<native.ProcessResult>} 返回这个命令输出的内容
 */
export async function exec(command, options) {
    if (typeof command == 'string') {
        command = command.split(' ');
    }

    options = Object.assign({}, options);
    if (!options.stdout) {
        options.stdout = 'pipe';
    }

    if (!options.stderr) {
        options.stderr = 'pipe';
    }

    try {
        // console.log('exec', command);
        const subprocess = native.spawn(command, options);

        const stdout = [];
        const stderr = [];

        if (subprocess.stdout) {
            subprocess.stdout.onmessage = (data) => {
                if (data != null) {
                    stdout.push(utf8.decode(data));
                }
            };
        }

        if (subprocess.stderr) {
            subprocess.stderr.onmessage = (data) => {
                if (data != null) {
                    stderr.push(utf8.decode(data));
                }
            };
        }

        const result = await subprocess.wait();

        if (subprocess.stdout) {
            subprocess.stdout.onmessage = undefined;
        }

        if (subprocess.stderr) {
            subprocess.stderr.onmessage = undefined;
        }

        if (stdout.length) {
            result.stdout = stdout.join('');
        }

        if (stderr.length) {
            result.stderr = stderr.join('');
        }

        return result;

    } catch (err) {
        return { code: -1, stderr: err.message, error: err };
    }
}

/**
 * @param {string[]} args
 * @returns 
 */
export async function shell(...args) {
    try {
        // console.log('exec', command);
        const subprocess = native.spawn(args, {});
        return await subprocess.wait();

    } catch (err) {
        console.print('shell:', err);
        return { code: -1, stderr: err.message };
    }
}
