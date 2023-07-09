// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as path from '@tjs/path';
import * as fs from '@tjs/fs';
import * as os from '@tjs/os';
import * as util from '@tjs/util';
import * as process from '@tjs/process';

import * as firmware from '../../modules/system/firmware.js';

const join = path.join;
const tmpdir = os.tmpdir();
const utils = firmware.utils;

/**
 * 将源目录中的所有文件以及子目录同步到目标中，并删除目标目录中多余的文件
 * @param {string} source 源目录
 * @param {string} target 目标目录
 * @returns {Promise<firmware.RsyncResult|undefined>}
 */
async function rsync(source, target) {
    if (!source || !target) {
        console.print('rsync is a file transfer program\n');
        console.print('usage: tpm firmware rsync <source-path> <target-path>');
        return;
    }

    const fileSync = new firmware.FileSync();

    // 1. 要安装的目录和文件
    let sourcePath = source || join(tmpdir, 'wotjs');
    if (!sourcePath.endsWith('/')) {
        sourcePath += '/';
    }

    // 2. 读取要安装的文件列表
    // read: `${source}/filelist.list`
    const filename = join(sourcePath, 'filelist.list');
    if (!await fs.exists(filename)) {
        console.warn('Invalid firmware: `filelist.list` not exists.', filename);
        return fileSync.status;
    }

    const filedata = await utils.readTextFile(filename);
    const fileList = filedata && fileSync.parseFileList(filedata);
    if (!fileList || !fileList['/bin/tjs']) {
        console.warn('Invalid firmware: invalid `filelist.list` format.');
        return fileSync.status;
    }

    fileList['/filelist.list'] = util.hash(filedata, 'md5');

    // 3. 获取安装目录
    if (target == '@install') {
        const updater = new firmware.Updater();
        target = await updater.getInstallPath(filedata) || '';
    }

    // 4. 安装所有文件
    return fileSync.rsync(source, fileList, target);
}

/**
 * 
 * @param {string} source 
 * @returns 
 */
async function installDirectory(source) {
    try {
        // 同步固件目录
        const result = await rsync(source, '@install');
        if (result && (result.total > 0) && (result.failed.length <= 0)) {
            const updater = new firmware.Updater();
            await updater.relocate(result);
        }

        return result;
    } catch (e) {
        console.log(e);
    }
}

const commands = {
    // ////////////////////////////////////////////////////////////
    // public methods

    /**
     * 使用指定的固件文件
     * - 挂载并链接到这个固件文件
     * @param {string} filename 
     */
    async apply(filename) {
        const updater = new firmware.Updater();
        await updater.applyFile(filename);
    },

    /**
     * 查看并显示服务端最新固件信息
     */
    async check() {
        const updater = new firmware.Updater();
        const installPath = await updater.getInstallFilename();
        console.info('firmware:', `Current version is '${process.version}' at '${installPath}'`);

        const firmwareInfo = await updater.getFirmwareInfo();

        console.print('- Lastest firmware information:\n');
        console.table(firmwareInfo);
    },

    /**
     * 清除临时文件
     */
    async clean() {
        let filename = join(tmpdir, 'upgrade.bin');
        await utils.exec('rm', ['-rf', filename]);

        filename = join(tmpdir, 'wotjs');
        await utils.exec('rm', ['-rf', filename]);
    },

    /**
     * 从服务器下载最新固件文件
     * - 默认下载到 `/tmp/upgrade.bin`
     */
    async download() {
        const updater = new firmware.Updater();
        const installPath = await updater.getInstallFilename();
        console.info('firmware:', `Current version is '${process.version}' at '${installPath}'`);

        const firmwareInfo = await updater.getFirmwareInfo();
        if (!firmwareInfo) {
            return;
        }

        const filename = join(tmpdir, 'upgrade.bin');
        const result = await updater.checkDownloadedFile(firmwareInfo.md5sum);
        if (result) {
            console.log('firmware:', `File '${filename}' is up-to-date.`);
            return result;
        }

        // download file
        return await updater.downloadFirmwareFile(filename, firmwareInfo);
    },

    /**
     * 安装指定目录下已经解压的固件文件
     * - 挂载到临时目录
     * - 验证固件内容
     * - 复制到安装目录
     * - 挂载到正式目录
     * @param {string} source 解压后的固件文件目录
     */
    async install(source) {
        if (!source) {
            console.print('Usage tpm firmware install <source>');
            return;
        }

        try {
            if (!await fs.exists(source)) {
                return console.print('No shch file:', source);
            }

            const statInfo = await fs.stat(source);
            if (statInfo.type == 'file') {
                // 安装固件文件
                const updater = new firmware.Updater();
                return await updater.installFile(source);

            } else if (statInfo.type == 'directory') {
                return await installDirectory(source);

            } else {
                console.warn('Install firmware failed, invalid source type:', statInfo.type);
            }

        } catch (err) {
            console.warn('Install firmware failed:', err.message, ':', source);
        }
    },

    /**
     * 查看升级状态
     */
    async status() {
        const updater = new firmware.Updater();
        const current = await updater.getProcessExecPath('tcd');
        const install = await updater.getInstallFilename();

        console.table({ current, install });
    },

    /**
     * 从服务器下载并安装最新固件文件
     */
    async update() {
        const result = await commands.download();
        if (!result) {
            console.warn('firmware: Update canceled.');
            return;
        }

        const filename = result?.filename;
        if (!filename) {
            console.warn('firmware: Update canceled.');
            return;
        }

        const updater = new firmware.Updater();
        await updater.installFile(filename);
    }
};

export const command = {
    title: '管理固件升级',
    subtitle: {
        apply: '使用指定的固件文件',
        install: '安装指定的固件文件',
        check: '检查版本信息',
        clean: '清除缓存文件',
        download: '下载最新固件文件',
        status: '查看固件升级状态',
        update: '从服务器下载并安装最新固件文件'
    },
    commands
};
