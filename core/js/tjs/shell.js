// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as os from '@tjs/os';
import * as path from '@tjs/path';
import * as process from '@tjs/process';
import * as util from '@tjs/util';

export const constants = {
    /** 文件是否存在 */
    F_OK: 0,

    /** 读权限 */
    R_OK: 4,

    /** 写权限 */
    W_OK: 2,

    /** 执行权限 */
    X_OK: 1,

    /** 只读 */
    O_RDONLY: 0,

    /** 只写 */
    O_WRONLY: 1,

    /** 读写 */
    O_RDWR: 2
};

export class Shell {
    constructor() {
        /** @type {number=} */
        this.$0 = 0;

        this.arch = process.arch;
        this.args = process.args;
        this.board = navigator.board;
        this.error = null;
        this.execPath = process.execPath();
        this.pid = process.pid;
        this.platform = process.platform;
        this.ppid = process.ppid;
        this.rootPath = process.root;
        this.scriptPath = process.scriptPath();
    }

    /**
     * @param {string} path 
     * @return {Promise<number>}
     */
    async access(path) {
        return await this.call(fs.access, path);
    }

    /**
     * @param {string} filename 
     * @param {string | ArrayBuffer | ArrayBufferView} data 
     * @return {Promise<void>}
     */
    async append(filename, data) {
        return await this.call(fs.appendFile, filename, data);
    }

    /**
     * @param {string} pathname 
     * @param {string} extName 
     * @return {string}
     */
    basename(pathname, extName) {
        return path.basename(pathname, extName);
    }

    /**
     * 
     * @param {function} func 
     * @param  {...any} args 
     * @return {Promise<any>}
     */
    async call(func, ...args) {
        try {
            this.$0 = 0;
            const result = await func(...args);
            this.error = null;
            return result;

        } catch (e) {
            this.$0 = e.errno || -255;
            this.error = e;
        }
    }

    /**
     * @param {string} path 
     * @return {void}
     */
    cd(path) {
        return os.chdir(path);
    }

    /**
     * @param {string} path 
     * @param {number} mode
     * @return {Promise<void>}
     */
    async chmod(path, mode) {
        return await this.call(fs.chmod, path, mode);
    }

    /**
     * @param {string} path 
     * @param {number} uid
     * @param {number} gid
     * @return {Promise<void>}
     */
    async chown(path, uid, gid) {
        return await this.call(fs.chown, path, uid, gid);
    }

    /**
     * @param {string} src 
     * @param {string} dest 
     * @param {object=} options 
     * @return {Promise<void>}
     */
    async cp(src, dest, options) {
        return await this.call(fs.cp, src, dest, options);
    }

    /**
     * @param {string} pathname 
     * @return {string}
     */
    dirname(pathname) {
        return path.dirname(pathname);
    }

    /**
     * @param  {...any} args 
     */
    echo(...args) {
        console.print(...args);
    }

    /**
     * @param  {...any} args 
     * @returns {Promise<os.ProcessResult>}
     */
    async exec(...args) {
        const result = await os.shell(...args);
        this.$0 = result.code;
        return result;
    }

    /**
     * @param {number} code 
     * @return {Promise<void>}
     */
    async exit(code) {
        return await this.call(process.exit, code);
    }

    /**
     * @param {string} path 
     * @return {Promise<boolean>}
     */
    async exists(path) {
        return await this.call(fs.exists, path);
    }

    /**
     * @param {string} pathname 
     * @return {string}
     */
    extname(pathname) {
        return path.extname(pathname);
    }

    /**
     * @return {number}
     */
    getuid() {
        return process.getuid();
    }

    /**
     * @return {number}
     */
    getgid() {
        return process.getgid();
    }

    /**
     * @param {string} name 
     * @return {string}
     */
    getenv(name) {
        return process.getenv(name);
    }

    /**
     * @return {string}
     */
    hostname() {
        return os.hostname();
    }

    /**
     * @return {string}
     */
    homedir() {
        return os.homedir();
    }

    /**
     * @param {string} pathname 
     * @return {boolean}
     */
    isAbsolute(pathname) {
        return path.isAbsolute(pathname);
    }

    /**
     * @return {boolean}
     */
    isatty() {
        return os.isatty(0);
    }

    /**
     * @param {string[]} args 
     * @return {string}
     */
    join(...args) {
        return path.join(...args);
    }

    /**
     * @param {number} pid 
     * @param {number} signal 
     * @return {Promise<void>}
     */
    async kill(pid, signal) {
        return await this.call(os.kill, pid, signal);
    }

    /**
     * @param {string} target 
     * @param {string} path 
     * @return {Promise<void>}
     */
    async ln(target, path) {
        return await this.call(fs.symlink, target, path);
    }

    /**
     * @param {string} path 
     * @return {Promise<string>}
     */
    async md5sum(path) {
        return await this.call(fs.md5sum, path);
    }

    /**
     * @param {string} path 
     * @param {object} options
     * @return {Promise<void>}
     */
    async mkdir(path, options) {
        return await this.call(fs.mkdir, path, options);
    }

    /**
     * @param {string} src 
     * @param {string} dest 
     * @return {Promise<void>}
     */
    async mv(src, dest) {
        return await this.call(fs.rename, src, dest);
    }

    /**
     * @param {number} percent 
     * @param {string} name 
     * @return {void}
     */
    progress(percent, name) {
        const progress = Math.round(percent / 4);
        const line = '='.repeat(progress) + '-'.repeat(25 - progress);

        console.write(`\r= ${name} [${line}] ${percent}%...`);

        if (percent >= 100) {
            console.print('\n');
        }
    }

    /**
     * @return {string}
     */
    pwd() {
        return os.cwd();
    }

    /**
     * @return {number}
     */
    reboot() {
        const ret = os.reboot();
        this.$0 = ret;
        return ret;
    }

    /**
     * @param {string} filename 
     * @return {Promise<string>}
     */
    async read(filename) {
        return await this.call(fs.readTextFile, filename);
    }

    /**
     * @param {string} path 
     * @return {Promise<string>}
     */
    async readlink(path) {
        return await this.call(fs.readlink, path);
    }

    /**
     * @param {string} path 
     * @return {Promise<string>}
     */
    async readdir(path) {
        return await this.call(fs.readdir, path);
    }

    /**
     * @param {string} path 
     * @return {Promise<string>}
     */
    async realpath(path) {
        return await this.call(fs.realpath, path);
    }

    /**
     * @param {string} path 
     * @param {object} options
     * @return {Promise<void>}
     */
    async rm(path, options) {
        return await this.call(fs.rm, path, options);
    }

    /**
     * @param {string} path 
     * @return {Promise<void>}
     */
    async rmdir(path) {
        return await this.call(fs.rmdir, path);
    }

    /**
     * @param {string} name 
     * @param {string} value 
     * @return {void}
     */
    setenv(name, value) {
        return process.setenv(name, value);
    }

    /**
     * @param {string} path 
     * @return {Promise<string>}
     */
    async sha1sum(path) {
        return await this.call(fs.sha1sum, path);
    }

    /**
     * @param {number} time 
     * @return {Promise<string>}
     */
    async sleep(time) {
        return await this.call(util.sleep, time);
    }

    /**
     * @param {string} path 
     * @return {Promise<fs.Stats>}
     */
    async stat(path) {
        return await this.call(fs.stat, path);
    }

    /**
     * @param {string} title
     * @return {string}
     */
    title(title) {
        return process.title(title);
    }

    /**
     * @param {string} path 
     * @param {number} len
     * @return {Promise<void>}
     */
    async truncate(path, len) {
        return await this.call(fs.truncate, path, len);
    }

    /**
     * @return {string}
     */
    tmpdir() {
        return os.tmpdir();
    }

    /**
     * @return {number}
     */
    uptime() {
        return os.uptime();
    }

    /**
     * @return {{ sysname: string, release: string, version: string, machine: string }}
     */
    uname() {
        return os.uname();
    }

    /**
     * @param {string} path 
     * @return {Promise<void>}
     */
    async unlink(path) {
        return await this.call(fs.unlink, path);
    }

    /**
     * @param {string} name 
     * @return {void}
     */
    unsetenv(name) {
        return process.unsetenv(name);
    }

    /**
     * @param {string} name 
     * @returns {Promise<string|undefined>}
     */
    async which(name) {
        this.$0 = 0;
        const value = this.getenv('PATH');
        if (!value) {
            return;
        }

        const tokens = value.split(':');
        for (const path of tokens) {
            const filename = this.join(path, name);
            // console.log('filename:', filename);
            if (await fs.exists(filename)) {
                return filename;
            }
        }
    }

    /**
     * @param {string} filename 
     * @param {string | ArrayBuffer | ArrayBufferView} data 
     * @return {Promise<void>}
     */
    async write(filename, data) {
        if (data == null) {
            return;
        }

        const self = this;

        /**
         * @param {string} filename 
         * @param {string | ArrayBuffer | ArrayBufferView} data 
         */
        async function writeFile(filename, data) {
            /** @type {Uint8Array=} */
            let buffer;
            if (typeof data == 'string') {
                buffer = new TextEncoder().encode(data);

            } else if (ArrayBuffer.isView(data)) {
                buffer = new Uint8Array(data.buffer);

            } else {
                buffer = new Uint8Array(data);
            }

            const tempfile = filename + '~';
            await fs.writeFile(tempfile, buffer);

            const md5sum1 = util.hash(buffer, 'md5');
            const md5sum2 = await self.md5sum(tempfile);
            if (md5sum1 != md5sum2) {
                throw new Error('md5sum does not match');
            }

            await self.rm(filename, {});
            await self.mv(tempfile, filename);
        }

        return await this.call(writeFile, filename, data);
    }
}

export function shell() {
    return new Shell();
}

const defaultShell = new Shell();

export default defaultShell;
