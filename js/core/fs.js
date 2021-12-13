// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

const fs = native.fs;

export const access = fs.access;
export const chmod = fs.chmod;
export const chown = fs.chown;
export const copyFile = fs.copyFile;
export const hashFile = fs.sha1sum;
export const lstat = fs.lstat;
export const mkdir = fs.mkdir;
export const mkdtemp = fs.mkdtemp;
export const mkstemp = fs.mkstemp;
export const open = fs.open;
export const opendir = fs.opendir;
export const readlink = fs.readlink;
export const realpath = fs.realpath;
export const rename = fs.rename;
export const rm = fs.rm;
export const rmdir = fs.rmdir;
export const stat = fs.stat;
export const statfs = fs.statfs;
export const symlink = fs.symlink;
export const truncate = fs.truncate;
export const unlink = fs.unlink;
export const utimes = fs.utimes;
export const watch = fs.watch;

/**
 * @param {string} path 
 * @returns {Promise<string>}
 */
export async function md5sum(path) {
    try {
        const data = await fs.md5sum(path);
        return data && native.util.encode(data, native.util.CODE_HEX);

    } catch (error) {
        return null;
    }
}

/**
 * @param {string} path 
 * @returns {Promise<string>}
 */
export async function sha1sum(path) {
    try {
        const data = await fs.sha1sum(path);
        return data && native.util.encode(data, native.util.CODE_HEX);

    } catch (error) {
        return null;
    }
}

/**
 * @param {string} filename 
 * @returns {Promise<boolean>}
 */
export async function exists(filename) {
    try {
        await fs.access(filename);
        return true;

    } catch (e) {
        return false;
    }
}

/**
 * @param {string} filename 
 * @param {*} options 
 * @returns {Promise<any[]>}
 */
export async function readdir(filename, options) {
    try {
        const dir = await fs.opendir(filename, options);
        const result = [];
        for await (const dirent of dir) {
            result.push(dirent);
        }

        return result;

    } catch (err) {
        err.message = err.message + ': ' + filename;
        throw err;
    }
}

/**
 * @param {string} filename 
 * @param {string|ArrayBuffer} data 
 * @param {string|{encoding?: string, mode?: number, flag?: string}} options 
 */
export async function appendFile(filename, data, options) {
    let flag = 'a';
    let mode = 0o666;
    let encoding = null;
    if (typeof options == 'object') {
        encoding = options.encoding;

        if (options.mode) {
            mode = options.mode;
        }

        if (options.flag) {
            flag = options.flag;
        }

    } else if (typeof options == 'string') {
        encoding = options;
    }

    try {
        const file = await fs.open(filename, flag, mode);
        await file.write(data, encoding);
        await file.close();

    } catch (err) {
        err.message = err.message + ': ' + filename;
        throw err;
    }
}

/**
 * 
 * @param {string} filename 
 * @param {*} options 
 * @returns {Promise<string|Uint8Array>}
 */
export async function readFile(filename, options) {
    let encoding = options;
    if (typeof options == 'object') {
        encoding = options.encoding;
    }

    try {
        const fileData = await fs.readFile(filename);
        if (!fileData) {
            return;
        }

        if (!encoding) {
            return new Uint8Array(fileData);
        }

        const textDecoder = new TextDecoder(encoding);
        return textDecoder.decode(fileData);

    } catch (err) {
        err.message = err.message + ': ' + filename;
        throw err;
    }
}

/**
 * @param {string} filename 
 * @param {string|ArrayBuffer} data 
 * @param {string|{encoding?: string, mode?: number, flag?: string}} options 
 */
export async function writeFile(filename, data, options) {
    let flag = 'w';
    let mode = 0o666;
    let encoding = null;
    if (typeof options == 'object') {
        encoding = options.encoding;

        if (options.mode) {
            mode = options.mode;
        }

        if (options.flag) {
            flag = options.flag;
        }

    } else if (typeof options == 'string') {
        encoding = options;
    }

    try {
        const file = await fs.open(filename, flag, mode);
        await file.write(data, encoding);
        await file.close();

    } catch (err) {
        err.message = err.message + ': ' + filename;
        throw err;
    }
}
