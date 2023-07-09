// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as path from '@tjs/path';
import * as fs from '@tjs/fs';
import * as os from '@tjs/os';
import * as util from '@tjs/util';
import * as process from '@tjs/process';

const TAG = 'build:';

/**
 * @param {string} src 
 * @param {string} dest 
 * @param {number=} mode 
 * @return {Promise<boolean>}
 */
async function copyFile(src, dest, mode) {
    try {
        if (!await fs.exists(src)) {
            return false;
        }

        const dirname = path.dirname(dest);
        if (!await fs.exists(dirname)) {
            await mkdir(dirname);
        }

        await fs.copyFile(src, dest);
        if (mode != null) {
            await fs.chmod(dest, 0o777);
        }

        return true;

    } catch (err) {
        console.log(TAG, `copyFile: ${err.message}`);
    }

    return false;
}

/**
 * @param {string} command 
 * @param {string[]} args 
 * @param {os.ProcessOptions} options 
 */
async function exec(command, args, options) {
    const process = os.spawn(command, args, options);
    const result = await process.wait();
    return result;
}

/** @param {string} pathname */
async function mkdir(pathname) {
    const args = ['-p', pathname];
    await exec('mkdir', args, {});
}

/**
 * @param {string} filename 
 * @param {string|ArrayBuffer|ArrayBufferView} filedata 
 */
async function writeFile(filename, filedata) {
    try {
        await fs.writeFile(filename, filedata);
    } catch (err) {
        console.log(TAG, `writeFile: ${err.message} '${filename}'`);
    }
}

/**
 * 固件打包器，步骤如下：
 * - 1. copy files -> output/$board/files/
 * - 2. filelist.list -> output/$board/files/
 * - 3. filelist.md5 -> output/$board/files/
 * - 4. firmware -> output/$board/dist/
 * - 5. firmware.json -> output/$board/dist/
 * - 6. firmwares -> /var/www/html/firmware/
 */
export class FirmwareBuilder {
    /**
     * @param {object} options
     * @param {string=} options.board 
     * @param {string=} options.pathname 
     * @param {string=} options.type 
     * @param {string[]=} options.binFiles 
     */
    constructor(options) {
        /** @type number 总共要打包的文件数 */
        this.fileCount = 0;

        /** @type string[] 总共要打包的文件列表 */
        this.fileList = [];

        /** @type string 项目根目录 */
        this.rootPath = '';

        /** @type string */
        this.md5sum = '';

        /** @type string */
        this.board = options?.board || 'local';

        /** @type string */
        this.pathname = options?.pathname || '';

        /** @type string */
        this.type = options?.type || 'zip';

        /** @type string[] */
        this.binFiles = options?.binFiles || [];
    }

    /**
     * 复制要打包的文件到 output 目录
     */
    async copyFiles() {
        // path: /project/output/$board 
        const boardPath = this.getBoardPath();
        const rootPath = this.rootPath;
 
        /** 
         * @param {string} src 
         * @param {string} dest 
         * @param {number=} mode 
         */
        async function _copyFile(src, dest, mode) {
            const srcname = path.join(rootPath, src);
            const destname = path.join(boardPath, dest);
            await copyFile(srcname, destname, mode);
        }

        const board = this.board;
        for (const name of this.binFiles) {
            await _copyFile(`build/${board}/${name}`, `bin/${name}`);
        }

        await _copyFile(`targets/${board}/install.sh`, 'script/install.sh', 0o777);
        await _copyFile(`targets/${board}/init.sh`, 'bin/init.sh', 0o777);
    }

    /**
     * 打包日期
     * @returns 
     */
    getBuildDate() {
        /** @param {string} value */
        function padDate(value) {
            value = value + '';
            return value.padStart(2, '0');
        }

        const date = new Date();
        return date.getFullYear() + '' + padDate(String(date.getMonth() + 1)) + '' + padDate(String(date.getDate()));
    }

    /**
     * 返回要打包的版本号
     * @returns {Promise<string>}
     */
    async getBuildVersion() {
        const filename = path.join(this.rootPath, 'build', this.board, 'version.json');
        try {
            const data = await fs.readFile(filename, 'utf-8');
            const version = JSON.parse(/** @type string */(data));
            if (version?.version) {
                return version.version;
            }

        } catch (e) {

        }

        return process.version;
    }

    /**
     * 要打包的文件输出目录
     * @returns {string}
     */
    getBoardPath() {
        return path.join(this.rootPath, 'output', this.board, 'files');
    }

    /**
     * 生成的固件文件输出目录
     * @returns {string}
     */
    getDistPath() {
        return path.join(this.rootPath, 'output', this.board, 'dist');
    }

    /**
     * 返回指定的目录下所有文件的文件名列表
     * - 不包含目录
     * @param {string} pathname 目录名
     * @return {Promise<string[]>}
     */
    async getFileList(pathname) {
        /** @type string[] */
        const fileList = [];

        /**
         * @param {string} src 
         * @param {string} base 
         */
        async function listFiles(src, base) {
            const dirs = await fs.readdir(src);
            for await (const item of dirs) {
                const filename = path.join(src, item.name);
                const subpath = path.join(base, item.name);

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
     * 返回指定的目录下所有文件的 md5 摘要
     * - 不包含目录
     * @param {string} pathname 
     * @return {Promise<{[key:string]: string}>}
     */
    async getFileHashsum(pathname) {
        const fileList = await this.getFileList(pathname);

        /** @type {{[key:string]: string}} */
        const result = {};
        for (let i = 0; i < fileList.length; i++) {
            const name = fileList[i];
            const filename = path.join(pathname, name);
            result[name] = await fs.md5sum(filename);
        }

        return result;
    }

    /**
     * 生成文件列表
     * - filelist.list
     */
    async buildFileList() {
        const boardPath = this.getBoardPath();

        // file hashsum
        const fileHashsums = await this.getFileHashsum(boardPath);

        delete fileHashsums['/filelist.list'];
        delete fileHashsums['/filelist.md5'];
        delete fileHashsums['/filelist.copy'];

        // file list
        const list = [];
        for (const filename in fileHashsums) {
            const md5sum = fileHashsums[filename];
            list.push(md5sum + '  ' + filename);
            console.print('file:', filename);
        }

        this.fileList = list;
        this.fileCount = list.length;

        // filelist.list
        const textEncoder = new TextEncoder();
        list.push('');
        const filedata = textEncoder.encode(list.join('\n'));
        let filename = path.join(boardPath, 'filelist.list');
        await writeFile(filename, filedata);

        // filelist.md5
        filename = path.join(boardPath, 'filelist.md5');
        const md5sum = util.hash(filedata, 'md5');
        await writeFile(filename, md5sum);
        this.md5sum = md5sum;
    }

    /**
     * 打包为 zip 包
     * @param {string} target 
     */
    async buildZipImage(target) {
        const boardPath = this.getBoardPath();
        const distPath = this.getDistPath();
        os.chdir(boardPath);

        let extName = 'zip';
        if (this.board == 'windows') {
            extName = 'zip';
        }

        // wotjs-$version.bin
        const version = await this.getBuildVersion();
        const filename = `wotjs-v${version}-${this.getBuildDate()}-${target}.${extName}`;
        const outputName = path.join(distPath, filename);
        const args = ['-qr', outputName, 'bin', 'script', 'filelist.list'];
        await exec('zip', args, {});
        this.printLine('package', outputName);

        // wotjs-lastest.bin
        const lastest = path.join(distPath, 'wotjs-lastest.' + extName);
        await exec('rm', ['-rf', lastest], {});
        await copyFile(outputName, lastest);

        // firmware.json
        const fileStat = await fs.stat(outputName);
        const size = fileStat.size;
        this.printLine('size', size);
        console.print('');

        const info = { filename, size, target, format: 'zip' };
        // await this.publishImageFile(outputName, info);
        return info;
    }

    /**
     * 
     * @param {string} target 
     */
    async buildSquashfsImage(target) {
        const boardPath = this.getBoardPath();
        const distPath = this.getDistPath();

        // sudo apt install squashfs-tools
        // squashfs image
        const version = await this.getBuildVersion();
        const filename = `${target}-v${version}-${this.getBuildDate()}.img`;

        const outputName = path.join(distPath, filename);
        const args = [boardPath, outputName, '-b', '64K', '-comp', 'xz', '-noappend'];
        args.push('-quiet');
        args.push('-no-progress');

        // console.print("args:", args);
        await exec('mksquashfs', args, {});

        const lastest = path.join(distPath, `${target}-lastest.img`);
        await exec('rm', ['-rf', lastest], {});
        await copyFile(outputName, lastest);
        this.printLine('squashfs', outputName);

        const fileStat = await fs.stat(outputName);
        const size = fileStat.size;
        this.printLine('size', size);

        const info = { filename, size, target, format: 'squashfs' };
        return info;
    }

    /**
     * 创建固件文件
     * @return {Promise<any>}
     */
    async buildFirmware() {
        const board = this.board;

        // /project/output/dist/$board
        const distPath = this.getDistPath();
        await mkdir(distPath);

        let target = board;
        if (target == 'local') {
            target = os.platform;
        }

        const version = await this.getBuildVersion();

        console.print('\nBuilt firmware:');
        this.printLine('board', board);
        this.printLine('target', target);
        this.printLine('version', version);
        this.printLine('type', this.type);
        // console.print('');

        // tar
        /**
        async function buildTarFile() {
            // const command = ['tar', '-C', this.boardPath, '-czvf', outputName, 'bin', 'script', 'filelist.list'];
            // rm -rf /tmp/wotjs/*
            // mkdir -p /tmp/wotjs/
            // tar -C /tmp/wotjs/ -xzvf ~/main/wotjs/build/local-wotjs.bin
            // sh /tmp/wotjs/script/install.sh
        }
        // */

        // console.log(this);

        this.printLine('files', this.fileCount);
        this.printLine('md5sum', this.md5sum);
        // console.print('');

        // squashfs
        // console.print("board:", board);
        if (this.type == 'squashfs') {
            return await this.buildSquashfsImage(target);

        } else {
            target = target + '-' + os.arch;
            return await this.buildZipImage(target);
        }
    }

    /**
     * 文件打包
     */
    async pack() {
        const pathname = this.pathname;

        // /project root path
        this.rootPath = os.cwd();
        if (pathname) {
            this.rootPath = path.join(os.cwd(), pathname);
        }

        await this.copyFiles(); //         1. copy files
        await this.buildFileList(); //     2. file list
        const result = await this.buildFirmware(); // 3. pack
        console.print('');
        return result;
    }

    /**
     * @param {string} name 
     * @param {any} value 
     */
    printLine(name, value) {
        const colors = console.colors;
        name = name + ':';
        name = colors.green(name.padEnd(10));
        console.print(`${name}`, value);
    }
}
