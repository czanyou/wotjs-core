// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as build from '../../modules/utils/build.js';

/**
 * 
 * @param {string} outputName 
 * @param {Object<string,any>} info 
 * @returns 
 */
/*
async function publishImageFile(outputName, info) {
    const version = await this.getBuildVersion();
    const distPath = this.getDistPath();

    // firmware.json
    info.md5sum = await fs.md5sum(outputName);
    info.version = version;
    info.board = this.board;
    const infoName = path.join(distPath, 'firmware.json');
    await fs.writeFile(infoName, JSON.stringify(info, null, '  '));

    // publish
    const basePath = '/var/www/html/firmware/';
    if (!await fs.exists(basePath)) {
        return;
    }

    const uploadName = path.join(basePath, info.filename);
    await copyFile(outputName, uploadName);
    await copyFile(infoName, path.join(basePath, 'firmware.json'));
    this.printLine('publish', uploadName);
}
*/

/**
 * 打包固件安装/升级包
 * @param {string} board 主板类型
 * @param {string=} pathname
 */
export async function pack(board, pathname) {
    const binFiles = [];
    const options = { board, pathname, binFiles, type: 'zip' };
    if (board == 'windows') {
        binFiles.push('tjs.exe', 'tjsc.exe');

    } else {
        binFiles.push('tjs');
    }

    // console.log(board, options);
    const builder = new build.FirmwareBuilder(options);
    return await builder.pack();
}
