// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as os from '@tjs/os';
import * as fs from '@tjs/fs';

/**
 * @param {string} command 
 * @param {string[]} args 
 * @param {os.ProcessOptions} options 
 */
async function exec(command, args, options) {
    try {
        const process = os.spawn(command, args, options);
        const result = await process.wait();
        return result;
    } catch (e) {
    }
}

/**
 * 删除文件
 * @param {string} filename 
 */
async function rm(filename) {
    if (await fs.exists(filename)) {
        await exec('rm', [filename], {});
    }
}

/**
 * 创建文件链接
 * @param {string} target 
 * @param {string} name 
 */
async function makeLink(target, name) {
    // console.log('makeLink', name);

    const colors = console.colors;
    try {
        const filename = await fs.readlink(name);
        if (filename == target) {
            console.print(' *', colors.white(name), '->', colors.blue(target));
            return;
        }

        await fs.unlink(name);

    } catch (e) {
        // file not exists
    }

    console.print(' +', colors.green(name), '->', colors.blue(target));
    return exec('ln', ['-sf', target, name], {});
}

/**
 * 
 * @param {string} filename 
 */
async function mkdirp(filename) {
    await exec('mkdir', ['-p', filename], {});
}

const LOCAL_BIN_PATH = '/usr/local/bin';
const INSTALL_ROOT_PATH = '/usr/local/tjs';

/** @param {string} board */
export async function link(board) {
    board = board || 'local';
    if (board == 'dt02' || board == 'dt01') {
        return; // 跳过交叉编译环境
    }

    const PROJECT_PATH = os.cwd();
    const BUILD_BIN_PATH = `${PROJECT_PATH}/build/${board}`;

    console.print(`Symlinks current project files to '${INSTALL_ROOT_PATH}'\n`);

    // Create the desired directory
    await mkdirp(`${LOCAL_BIN_PATH}`);
    await mkdirp(`${INSTALL_ROOT_PATH}/conf`);

    await makeLink(`${PROJECT_PATH}/app`, `${BUILD_BIN_PATH}/app`);
    await makeLink(BUILD_BIN_PATH, `${INSTALL_ROOT_PATH}/bin`);

    const names = ['tjs', 'tjsc', 'mscan'];
    const commands = ['tci', 'tcd', 'tpm'];

    //  Create links to the wottjs executable file
    if (board == 'dt03') {
        names.push('mkd');
        commands.push('tbusd', 'tgd');

    } else if (board == 'linux') {
        names.push('faad', 'ipcd');
    }

    // 在 `/usr/local/bin` 目录下创建需要的可执行文件链接
    for (const name of names) {
        await makeLink(`${INSTALL_ROOT_PATH}/bin/${name}`, `${LOCAL_BIN_PATH}/${name}`);
    }

    // 在 `/usr/local/bin` 目录下创建需要的 tjs 子命令链接
    for (const name of commands) {
        await makeLink(`${INSTALL_ROOT_PATH}/bin/tjs`, `${LOCAL_BIN_PATH}/${name}`);
    }

    await rm(`${PROJECT_PATH}/app/app`);
    console.print('\nLink finished.\n');
}

/** 
 * 删除链接文件
 * @param {string} board 
 */
export async function unlink(board) {

    /**
     * 删除文件
     * @param {string} filename 
     */
    async function remove(filename) {
        if (await fs.exists(filename)) {
            await exec('rm', ['-rf', filename], {});

            const colors = console.colors;
            console.print(' -', colors.red(filename));
        }
    }

    // 删除所有 `/usr/local/bin` 目录下的可执行文件链接
    console.print('');
    const names = ['tjs', 'tjsc', 'tci', 'tcd', 'tpm', 'mscan', 'faad', 'tgd', 'tbusd', 'mkd', 'ipcd'];
    for (const name of names) {
        await remove(`${LOCAL_BIN_PATH}/${name}`);
    }

    const PROJECT_PATH = os.cwd();
    await remove(`${PROJECT_PATH}/app/app`);
    await remove(`${INSTALL_ROOT_PATH}/bin`);

    console.print('\nUnlink finished.\n');
}
