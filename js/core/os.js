// @ts-check
import * as native from '@tjs/native';

const os = native.os;
const textDecode = native.util.textDecode;

// const
export const arch = native.arch;
export const platform = native.platform;
export const signal = native.signal;

// methods
export const cpus = os.cpuinfo;
export const cwd = native.cwd;
export const freemem = os.freemem;
export const homedir = native.homedir;
export const hostname = os.hostname;
export const hrtime = native.hrtime;
export const isatty = native.isatty;
export const kill = os.kill;
export const loadavg = os.loadavg;
export const networkInterfaces = os.interfaces;
export const printActiveHandles = os.printActiveHandles;
export const printAllHandles = os.printAllHandles;
export const printMemoryUsage = os.printMemoryUsage;
export const reboot = os.reboot;
export const rss = os.rssmem;
export const sleep = os.sleep;
export const spawn = native.spawn;
export const tmpdir = native.tmpdir;
export const totalmem = os.totalmem;
export const uname = native.uname;
export const uptime = os.uptime;
export const openlog = native.openlog;
export const syslog = native.syslog;

export const EOL = '\r\n';

/**
 * 执行一个命令并获取执行结果
 * @param {string} file 要执行的命令
 * @param {string[]} [args] 要执行的命令
 * @param {native.ProcessOptions} [options]
 * @returns {Promise<native.ProcessResult>} 返回这个命令输出的内容
 */
export async function execFile(file, args, options) {
    const command = [file];
    command.push(...args);

    options = Object.assign({}, options);
    options.stdin = 'pipe';
    options.stdout = 'pipe';
    options.stderr = 'pipe';

    const subprocess = spawn(command, options);
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
 * @param {native.ProcessOptions} [options]
 * @returns {Promise<native.ProcessResult>} 返回这个命令输出的内容
 */
export async function exec(command, options) {
    try {
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

        // console.log('exec', command);
        const subprocess = spawn(command, options);

        const stdout = [];
        const stderr = [];
        while (subprocess.stdout) {
            const data = await subprocess.stdout.read();
            if (data == null) {
                break;
            }

            stdout.push(textDecode(data));
        }

        while (subprocess.stderr) {
            const data = await subprocess.stderr.read();
            if (data == null) {
                break;
            }

            stderr.push(textDecode(data));
        }

        const result = await subprocess.wait();
        if (stdout.length) {
            result.stdout = stdout.join('');
        }

        if (stderr.length) {
            result.stderr = stderr.join('');
        }

        return result;

    } catch (err) {
        return { code: -1, stderr: err.message };
    }
}
