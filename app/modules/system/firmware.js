// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as path from '@tjs/path';
import * as fs from '@tjs/fs';
import * as os from '@tjs/os';
import * as util from '@tjs/util';
import * as config from '@tjs/config';
import * as jsonrpc from '@tjs/jsonrpc';
import * as process from '@tjs/process';

import * as led from '../system/led.js';

const join = path.join;
const tmpdir = os.tmpdir();

export const utils = {

    /**
     * @param {string} filename 
     * @param {number} mode 
     */
    async chmod(filename, mode) {
        try {
            const statInfo = await fs.stat(filename);
            const current = statInfo.mode & 0x1FF;

            if (current != mode) {
                await fs.chmod(filename, mode);
            }

        } catch (err) {
            console.warn('firmware:', 'Chmod failed:', err.message, ':', filename);
        }
    },

    /**
     * 复制文件
     * @param {string} src 
     * @param {string} dest 
     */
    async copyFile(src, dest) {
        try {
            await fs.copyFile(src, dest);
        } catch (e) {
            console.print(`copyFile: ${e.message}`);
        }
    },

    /**
     * 执行指定的可执行文件
     * @param {string} command 
     * @param {string[]} args 
     * @param {*} [options] 
     * @returns 
     */
    async exec(command, args, options) {
        const process = os.spawn(command, args, options);
        const result = await process.wait();
        return result;
    },

    /**
     * 创建目录
     * @param {string} pathname 
     */
    async mkdir(pathname) {
        const args = ['-p', pathname];
        // console.log('mkdir', pathname);
        await utils.exec('mkdir', args, {});
    },

    /**
     * 创建文件链接
     * @param {string} target 
     * @param {string} name 
     */
    async makeLink(target, name) {
        try {
            const filename = await fs.readlink(name);
            if (filename == target) {
                // console.log('filename', filename)
                return;
            }

            await fs.unlink(name);

        } catch (e) {
            const colors = console.colors;
            console.print(' +', colors.green(target), '->', colors.green(name));
        }

        return utils.exec('ln', ['-s', target, name], {});
    },

    /**
     * 读取文件内容
     * @param {string} filename 
     * @returns {Promise<ArrayBuffer|undefined>}
     */
    async readFile(filename) {
        try {
            const result = await fs.readFile(filename);
            if (result instanceof ArrayBuffer) {
                return result;

            } else if (ArrayBuffer.isView(result)) {
                return result.buffer;
            }

        } catch (err) {
            console.print('readFile', filename, err);
            
        }
    },

    /**
     * 返回指定的链接文件的目标路径
     * @param {string} pathname 目录或文件的路径
     * @param {*} [options]
     */
    async readlink(pathname, options) {
        try {
            const result = await fs.readlink(pathname);
            return result;

        } catch (e) {
            console.print(`readlink: ${e.message}`, pathname, options);
        }
    },

    /**
     * 读取文件内容
     * @param {string} filename 
     * @returns {Promise<string>}
     */
    async readTextFile(filename) {
        try {
            if (!await fs.exists(filename)) {
                return '';
            }

            const result = await fs.readFile(filename, 'utf-8');
            return result && String(result);

        } catch (err) {
            console.print('readFile', filename, err);
            return '';
        }
    },

    /**
     * @param {string} filename 目录或文件的路径
     */
    async remove(filename) {
        try {
            await fs.unlink(filename);
        } catch (err) {
            return err;
        }
    },

    /**
     * @param {number} percent 
     * @param {string} name 
     */
    showProgressBar(percent, name) {
        const progress = Math.round(percent / 4);
        const line = '='.repeat(progress) + '-'.repeat(25 - progress);

        console.write(`\r= ${name} [${line}] ${percent}%...`);

        if (percent >= 100) {
            console.print('\n');
        }
    }
};

/**
 * @typedef RsyncResult 文件同步结果
 * @property {string[]} added 新增的文件
 * @property {string[]} failed 更新失败的文件
 * @property {string[]} removed 删除的文件
 * @property {string[]} updated 修改的文件
 * @property {string} target
 * @property {number} current
 * @property {number} state 当前状态: STATE_INIT | STATE_COPYING | STATE_REMOVING | STATE_CHECKING | STATE_COMPLETED
 * @property {number} elapsed 总共消耗的时间，单位为秒
 * @property {number} percent 当前进度, 0 ~ 100
 * @property {number} total 总共所要同步安装的文件数
 */

export const SyncState = {
    STATE_INIT: 0,
    STATE_COPYING: 1,
    STATE_REMOVING: 2,
    STATE_CHECKING: 3,
    STATE_COMPLETED: 4
};

export const UpdateError = {
    INVALID_FIRMWARE: 1
};

const TIMEOUT = 60; // s

export class FileSync {
    constructor() {
        /** @type RsyncResult */
        this.status = {
            added: [],
            current: 0,
            elapsed: 0,
            failed: [],
            percent: -1,
            removed: [],
            state: SyncState.STATE_INIT,
            total: 0,
            target: '',
            updated: []
        };

        this.log = console;
        this.startTime = 0;
        this.intervalTimer = null;
    }

    /**
     * 返回指定的文件的 hash 值
     * @param {string} filename 
     */
    async getFileHash(filename) {
        return await fs.md5sum(filename);
    }

    /**
     * 获取包含指定的目录下所有文件列表
     * @param {string} pathname 
     */
    async getFileList(pathname) {
        const fileList = [];

        /**
         * 
         * @param {string} src 
         * @param {string} base 
         */
        async function listFiles(src, base) {
            // console.log('getFileList', src, base);
            if (!await fs.exists(src)) {
                return;
            }

            const dirs = await fs.readdir(src);
            for await (const item of dirs) {
                const filename = join(src, item.name);
                const subpath = join(base, item.name);

                if (item.type == 2) { // dir
                    await listFiles(filename, subpath);
                    // fileList.push(subpath + '/');

                } else if (item.type == 1) { // file
                    fileList.push(subpath);
                }
            }
        }

        await listFiles(pathname, '/');

        fileList.sort();
        return fileList;
    }

    /**
     * 获取指定的目录所有文件的 hash 值
     * @param {string} pathname 
     */
    async getFileHashs(pathname) {
        try {
            const fileList = await this.getFileList(pathname);
            // console.log('getFileHashs', fileList);

            const result = {};
            for (let i = 0; i < fileList.length; i++) {
                const name = fileList[i];
                const filename = join(pathname, name);
                result[name] = await this.getFileHash(filename);
            }

            return result;

        } catch (err) {
            this.log.warn('getFileHashs', err);
            return {};
        }
    }

    /** 
     * @param {string} data 
     * @returns {{[key: string]: string}}
     */
    parseFileList(data) {
        /** @type {{[key: string]: string}} */
        const result = {};
        if (data == null) {
            return result;
        }

        const lines = data.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const tokens = line.split('  ');
            if (tokens[1]) {
                result[tokens[1]] = tokens[0];
            }
        }

        return result;
    }

    /**
     * 
     * @param {string} source 
     * @param {{[key: string]: string}} fileList 
     * @param {string} target 
     * @returns 
     */
    async rsync(source, fileList, target) {
        const log = this.log;

        let sourcePath = source || join(tmpdir, 'wotjs');
        if (!sourcePath.endsWith('/')) {
            sourcePath += '/';
        }

        /** @type RsyncResult */
        const status = this.status;

        this.startTime = os.uptime();
        this.startUpgradeTimer();

        // target
        let targetPath = target;
        if (!targetPath.endsWith('/')) {
            targetPath += '/';
        }

        status.target = targetPath;
        status.total = Object.getOwnPropertyNames(fileList).length;
        log.info(`firmware: Installing ${status.total} files from ${sourcePath} to ${targetPath}`);
        this.updatePercent();

        // 复制有改动的文件
        status.state = SyncState.STATE_COPYING;
        const oldFileList = await this.getFileHashs(targetPath);
        for (const name in fileList) {
            const hash1 = fileList[name];
            const hash2 = oldFileList[name];

            delete oldFileList[name];
            if (hash1 != hash2) {
                if (!hash2) {
                    status.added.push(name);

                } else {
                    status.updated.push(name);
                }

                const srcname = join(sourcePath, name);
                const destname = join(targetPath, name);
                const dirname = path.dirname(destname);
                // console.log('copy', srcname, destname);

                await utils.mkdir(dirname);
                await utils.copyFile(srcname, destname);
            }

            status.current++;
            this.updatePercent();
        }

        // 删除多余的文件
        status.state = SyncState.STATE_REMOVING;
        const unusedFileCount = Object.getOwnPropertyNames(oldFileList).length;
        if (unusedFileCount > 0) {
            for (const name in oldFileList) {
                const destname = join(targetPath, name);
                await utils.remove(destname);
                status.removed.push(name);
            }
        }

        this.updatePercent();

        // 检查
        status.state = SyncState.STATE_CHECKING;
        const installedFileList = await this.getFileHashs(targetPath);
        status.current = 0;

        for (const name in fileList) {
            const hash1 = fileList[name];
            const hash3 = installedFileList[name];

            if (hash1 == hash3) {
                delete installedFileList[name];

            } else {
                status.failed.push(name);
            }

            status.current++;
            this.updatePercent();
        }

        status.state = SyncState.STATE_COMPLETED;
        const faildFileCount = Object.getOwnPropertyNames(installedFileList).length;
        if (faildFileCount > 0) {
            log.error('firmware: Install failed: found ' + faildFileCount + ' files update failded.');
            log.info('firmware:', installedFileList);
        }

        await utils.chmod(targetPath + '/bin/tjs', 0x1FF); // 777
        await utils.chmod(targetPath + '/bin/init.sh', 0x1FF); // 777

        this.updatePercent();

        const now = os.uptime();
        status.elapsed = Math.round(now - this.startTime);

        log.warn('firmware:', `Updated: total: ${status.total}, updated: ${status.updated.length}, ` +
            `added: ${status.added.length}, removed: ${status.removed.length}, ` +
            `failed: ${status.failed.length}, elapsed: ${status.elapsed}s`);

        if (status.failed.length) {
            log.info('firmware:', status.failed);
        }

        const intervalTimer = this.intervalTimer;
        if (intervalTimer) {
            this.intervalTimer = null;
            clearInterval(intervalTimer);
        }

        return status;
    }

    startUpgradeTimer() {
        if (this.intervalTimer) {
            return;
        }

        const status = this.status;

        // 指示灯定时器
        this.intervalTimer = setInterval(async () => {
            if (status.percent >= 100) {
                led.setOff('orange');

                const intervalTimer = this.intervalTimer;
                if (intervalTimer) {
                    this.intervalTimer = null;
                    clearInterval(intervalTimer);
                }

                return;
            }

            const now = os.uptime();
            if ((now - this.startTime) > TIMEOUT) {
                // timeout
                return;
            }

            led.toggle('orange');
        }, 250);
    }

    updatePercent() {
        const status = this.status;
        let percent = 0;
        if (!(status.total > 0)) {
            return;
        }

        if (status.state == SyncState.STATE_COPYING) {
            percent = Math.round(status.current * 70 / status.total);

        } else if (status.state == SyncState.STATE_REMOVING) {
            percent = 80;

        } else if (status.state == SyncState.STATE_CHECKING) {
            percent = 90 + Math.round(status.current * 9 / status.total);

        } else if (status.state == SyncState.STATE_COMPLETED) {
            percent = 100;
        }

        utils.showProgressBar(percent, 'Updating');
    }

}

export class Updater extends EventTarget {
    constructor() {
        super();

        this.log = console;
    }

    /**
     * 安装指定的固件文件
     * @param {string} filename 
     * @returns 
     */
    async applyFile(filename) {
        if (!filename) {
            console.warn('firmware: Invalid filename');
            return;
        }

        // 1. 获取要安装的目录
        const target = await this.getInstallFilename();
        if (!target) {
            console.warn('firmware: Invalid install path');
            return;
        }

        // 2. 比较和复制固件文件
        const fileSync = new FileSync();
        const hash1 = await fileSync.getFileHash(filename);
        if (!hash1) {
            console.warn('firmware: Invalid firmware file');
            return;
        }

        const rootPath = process.root;
        const imagePath = path.join(rootPath, `${target}.img`);
        console.log('Link to', imagePath);

        const hash2 = await fileSync.getFileHash(imagePath);
        if (hash1 != hash2) {
            // await utils.exec('cp ' + filename + ` /system/wotjs/${target}.img`);
            console.print(' +', filename, '->', imagePath);
            await fs.copyFile(filename, imagePath);
        }

        // 3. 重新挂载固件文件
        await utils.exec('umount', ['-f', `/mnt/${target}`]);
        await utils.exec('mount', ['-o', 'loop', imagePath, `/mnt/${target}`]);

        // 4. 重定向 bin 链接文件
        const binPath = path.join(rootPath, 'bin');
        await utils.makeLink(`/mnt/${target}/bin`, binPath);
    }

    close() {
        this.removeAllEventListeners();
    }

    /**
     * 返回指定名称进程的执行文件的路径
     * @param {string} name 进程名称
     * @returns {Promise<string|undefined>} 路径
     */
    async getProcessExecPath(name) {
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
        const exeName = '/proc/' + pid + '/exe';
        const filename = await utils.readlink(exeName);
        if (!filename) {
            return;
        }

        return filename;
    }

    /**
     * 返回 tjs 可执行文件所在的路径
     * @returns {Promise<string|undefined>}
     */
    async getExecPath() {
        let filename = await this.getProcessExecPath('tcd');
        if (!filename) {
            filename = await this.getProcessExecPath('tbusd');
        }

        return filename;
    }

    /**
     * 获取要安装的目录
     * - 安装目录会包含 v1 和 v2 两个版本子目录
     * - 如果当前运行的版本位于 v1 则安装和更新 v2 目录，反之亦可
     * - 通过双版本升级策略可以保证设备不会因升级过程异常导致损坏
     * @param {string} [filedata]
     * @returns {Promise<string|undefined>}
     */
    async getInstallPath(filedata) {
        const rootPath = navigator.root;
        const binPath = join(rootPath, 'bin');
        const exePath = await this.getExecPath();
        const v1Path = join(rootPath, 'v1');
        const v2Path = join(rootPath, 'v2');

        if (exePath) {
            const v1BinPath = join(rootPath, 'v1/bin/tjs');
            return (exePath == v1BinPath) ? v2Path : v1Path;

        } else {
            const v1BinPath = join(rootPath, 'v1/bin');

            if (filedata) {
                let listdata = await utils.readTextFile(join(v1Path, 'filelist.list'));
                if (listdata == filedata) {
                    return v1Path;
                }

                listdata = await utils.readTextFile(join(v2Path, 'filelist.list'));
                if (listdata == filedata) {
                    return v2Path;
                }
            }

            const linkPath = await utils.readlink(binPath);
            return (linkPath == v1BinPath) ? v2Path : v1Path;
        }
    }

    /**
     * 获取固件文件要安装的路径
     * @param {*} [filedata] 
     * @returns {Promise<'data1'|'data2'>}
     */
    async getInstallFilename(filedata) {
        const v1Path = 'data1';
        const v2Path = 'data2';

        const exePath = await this.getExecPath();
        if (exePath) {
            const v1BinPath = '/mnt/data1/bin/tjs';
            return (exePath == v1BinPath) ? v2Path : v1Path;

        } else {
            const v1BinPath = '/mnt/data1/bin/tjs';

            const binPath = join(navigator.root, 'bin');
            const linkPath = await utils.readlink(binPath) + '/tjs';
            return (linkPath == v1BinPath) ? v2Path : v1Path;
        }
    }

    /**
     * 返回指定的固件文件的格式
     * @param {string} filename 
     * @returns {Promise<string|undefined>}
     */
    async getFirmwareFormat(filename) {
        try {
            const file = await fs.open(filename, 'r');
            const data = await file.read(4);
            await file.close();

            const buffer = new Uint8Array(data);
            // console.log(buffer, buffer[0], buffer[1], buffer[2], buffer[3])
            if (buffer[0] == 104 && buffer[1] == 115 && buffer[2] == 113 && buffer[3] == 115) {
                // hsqs
                return 'hsqs';

            } else if (buffer[0] == 80 && buffer[1] == 75) {
                // PK
                return 'zip';

            } else {
                return '';
            }

        } catch (e) {

        }
    }

    /**
     * 返回固件信息查询 URL 地址
     * @returns {Promise<URL|undefined>}
     */
    async getFirmwareInfoURL() {
        const userConfig = await config.load('user');
        const url = userConfig.getString('wot.firmware.url');
        if (url) {
            const did = userConfig.getString('wot.did');
            const pid = userConfig.getString('wot.pid');

            const uri = new URL(url);
            if (did) {
                uri.searchParams.set('did', did);
            }

            if (pid) {
                uri.searchParams.set('pid', pid);
            }

            return uri;
        }

        const deviceConfig = await config.load('device');
        const registry = deviceConfig.getString('wot.registry');
        const did = deviceConfig.getString('wot.did');
        const pid = deviceConfig.getString('wot.pid') || deviceConfig.getString('tuya.pid');

        if (registry) {
            const uri = new URL(registry);
            uri.pathname = '/v2/device/firmware/info';
            if (did) {
                uri.searchParams.set('did', did);
            }

            if (pid) {
                uri.searchParams.set('pid', pid);
            }

            return uri;
        }
    }

    /**
     * 返回固件信息查询 URL 地址
     * @param {Object<string,any>} firmwareInfo
     * @returns {URL|undefined}
     */
    getFirmwareFileURL(firmwareInfo) {
        const registry = firmwareInfo.registry;
        const did = firmwareInfo.did;
        const pid = firmwareInfo.pid;

        if (!registry) {
            return;
        }

        const url = new URL(registry);
        url.searchParams.set('did', did);
        if (pid) {
            url.searchParams.set('pid', pid);
        }

        const filename = firmwareInfo.filename;
        if (filename) {
            const dirname = path.dirname(url.pathname);
            url.pathname = path.join(dirname, filename);

        } else {
            url.pathname = '/v2/device/firmware/file';
        }

        return url;
    }

    /**
     * 显示固件信息
     * @returns 
     */
    async getFirmwareInfo() {
        // const arch = os.arch;
        // const platform = os.platform;
        // console.print('- platform: ' + platform + '-' + arch);

        const uri = await this.getFirmwareInfoURL();
        if (!uri) {
            this.log.error('firmware: Invalid registry');
            return;
        }

        const did = uri.searchParams.get('did');
        if (!did) {
            this.log.error('firmware: Invalid did');
            return;
        }

        this.log.info('firmware: Loading ' + uri.toString());

        const response = await fetch(uri.toString());
        const body = await response.text();

        const firmwareInfo = JSON.parse(body);
        firmwareInfo.did = did;
        firmwareInfo.registry = uri.toString();
        return firmwareInfo;
    }

    /**
     * 下载指定名称的固件文件
     * @param {string} filename 文件名称
     * @param {*} firmwareInfo 固件信息
     */
    async downloadFirmwareFile(filename, firmwareInfo) {
        const log = this.log;

        const url = this.getFirmwareFileURL(firmwareInfo);
        if (!url) {
            return;
        }

        log.info('firmware: Downloading', url.toString(), '...');
        log.info(`firmware: Downloading firmware to '${filename}'`);

        /** @type any */
        const options = {};
        this.percent = -1;

        const file = await fs.open(filename, 'w', 0o666);

        try {
            this.emitUpdateEvent({ state: 'downloading', url: url.toString() });
            const response = await fetch(url, options);

            const total = Number.parseInt(response.headers.get('Content-Length') || '');
            const body = response.body;
            const reader = body?.getReader();
            if (reader == null) {
                return false;
            }

            let readed = 0;
            while (true) {
                const result = await reader.read();
                if (result.done) {
                    await file.close();
                    break;
                }

                const data = result.value;
                // console.log(readed, total, data.length);
                if (data != null) {
                    readed += data.length;
                    await file.write(data);

                    if (total > 0) {
                        this.showProgressBar('Downloading', readed, total);
                    }
                }
            }

            this.emitUpdateEvent({ state: 'downloaded', url: url.toString() });
            const statusCode = response.status;
            if (statusCode >= 300) {
                log.warn('firmware: Download failed:', statusCode, response.statusText);
                return false;
            }

            log.info(`firmware: Checking firmware file '${filename}'`);
            const result = await this.checkDownloadedFile(firmwareInfo.md5sum);
            if (result) {
                console.log(`firmware: File '${filename}' is OK.`);
                result.info = firmwareInfo;
                return result;
            }

            console.log(`firmware: File '${filename}' is BAD.`, result);
            return false;

        } catch (err) {
            log.warn('firmware: Download error:', err.message);
            return false;
        }
    }

    /**
     * 发布固件更新事件
     * @param {*} data 
     */
    async emitUpdateEvent(data) {
        const client = jsonrpc.connect('tci');
        if (!client) {
            return;
        }

        let result = null;
        try {
            const name = 'firmware';
            const args = { name, data };
            result = await client.call('emitEvent', args, 1000);

        } catch (error) {
            result = { error };

        } finally {
            client.close();
        }

        return result;
    }

    /**
     * @param {string} filename 
     * @returns {Promise<void>}
     */
    async installZipFile(filename) {
        if (!filename) {
            return this.log.info('Usage: tpm firmware load <filename>');
        }

        const log = this.log;

        this.emitUpdateEvent({ state: 'updating', filename });

        // 1. 解压固件文件
        filename = filename || '/home/cz/main/wotjs/build/local-wotjs.bin';
        log.info('firmware:', 'Installing firmware from zip at', filename);

        const wotjsPath = join(process.root, 'v0');
        log.info('firmware:', 'Unpacking firmware to', wotjsPath);

        // 清除缓存目录
        let result = await utils.exec('rm', ['-rf', wotjsPath]);
        result = await utils.exec('mkdir', ['-p', wotjsPath]);

        // 解压到缓存目录
        result = await utils.exec('unzip', ['-q', '-d', wotjsPath, filename]);
        if (result?.code != 0) {
            log.info('firmware:', 'Unpacking failed:', result);
            return;
        }

        // 2. 执行安装脚本
        const script = join(wotjsPath, '/script/install.sh');
        if (!await fs.exists(script)) {
            log.warn('firmware:', 'Invalid firmware file: install script not exists');
            return;
        }

        log.info('firmware:', 'Execute install script', script, '...');
        await utils.exec('sh', [script]); // install directory ... 

        // 3. 安装完成
        // TODO: 读取安装结果
        this.emitUpdateEvent({ state: 'updated', version: process.version });
    }

    /**
     * @param {string} filename 
     * @returns {Promise<void>}
     */
    async installImageFile(filename) {
        this.emitUpdateEvent({ state: 'updating', filename });
        const mountPath = '/mnt/data';

        const log = this.log;

        // 1. 解压固件文件
        filename = await fs.realpath(filename);
        log.info('firmware:', 'Installing firmware at', filename);

        // 2. 执行安装脚本
        await utils.exec('umount', ['-f', mountPath]);
        await utils.exec('mount', ['-o', 'loop', filename, mountPath]);

        // 3. 验证固件文件内容
        const script = join(mountPath, '/bin/tjs');
        if (!await fs.exists(script)) {
            log.warn('firmware:', 'Invalid firmware file: install script not exists');
            return;
        }

        // TODO: 检查 MD5 值...

        // 4. 安装固件
        await utils.exec(mountPath + '/bin/tjs', ['tpm', 'firmware', 'apply', filename]);

        // 5. 安装完成
        // TODO: 读取安装结果
        this.emitUpdateEvent({ state: 'updated', version: process.version });
    }

    /**
     * 安装指定的固件文件
     * @param {string} filename 固件文件路径
     * @returns {Promise<void>}
     */
    async installFile(filename) {
        if (!await fs.exists(filename)) {
            return console.print('No shch file:', filename);
        }

        const format = await this.getFirmwareFormat(filename);
        if (format == 'hsqs') {
            return this.installImageFile(filename);

        } else if (format == 'zip') {
            return this.installZipFile(filename);

        } else {
            return console.print('Unsupport firmware file format:', filename);
        }
    }

    /**
     * @typedef {{filename: string, md5sum: string, size: number, info?: any}} FileInfo
     * 检查缓存中已下载的文件是否为最新文件
     * @param {string} newMd5sum 新固件 md5 摘要值
     * @returns {Promise<FileInfo|undefined>} 如果已是最新，则返回缓存文件的信息，否则返回空
     */
    async checkDownloadedFile(newMd5sum) {
        // 缓存文件路径
        const filename = join(tmpdir, 'upgrade.bin');

        try {
            if (await fs.exists(filename)) {
                const filedata = await utils.readFile(filename);
                if (filedata == null || filedata.byteLength == 0) {
                    return;
                }

                // console.log('filedata', filedata);
                const md5sum = filedata && util.hash(filedata, 'md5');
                const size = filedata?.byteLength || 0;

                // console.print('- size:     ' + size);
                // console.print('- md5sum:   ' + md5sum);

                if (md5sum == newMd5sum) {
                    return { filename, md5sum, size };
                }

                await utils.remove(filename);
            }

        } catch (err) {
            this.log.warn('firmware: Check firmware error:', err.message);
        }
    }

    /**
     * 切换固件版本
     * @param {RsyncResult} [result]
     */
    async relocate(result) {
        const rootPath = navigator.root;
        const binPath = join(rootPath, 'bin');
        const log = this.log;

        // TODO: 检查固件版本
        const newPath = result?.target || await this.getInstallPath();
        const newBinPath = newPath && join(newPath, 'bin');
        const realPath = await utils.readlink(binPath);
        if (newBinPath == null || newBinPath == realPath) {
            return;
        }

        // console.log('firmware:', 'Relocate:', newBinPath, realPath);
        try {
            await utils.remove(binPath);
            await fs.symlink(newBinPath, binPath);
            log.warn('firmware:', `Switch to new firmware: ${newPath}`);

        } catch (err) {
            log.error('firmware: Switch to new firmware failed:', err.message);
        }
    }

    /**
     * @param {string} name
     * @param {number} readed 
     * @param {number} total 
     */
    showProgressBar(name, readed, total) {
        const percent = Math.floor(readed * 100 / total);
        if (percent == this.percent) {
            return;
        }

        this.percent = percent;
        utils.showProgressBar(percent, name);
    }

}
