// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import * as path from '@tjs/path';

const fs = native.fs;
const join = path.join;
const dirname = path.dirname;

export const access = fs.access;
export const chmod = fs.chmod;
export const chown = fs.chown;
export const copyFile = fs.copyFile;
export const lstat = fs.lstat;
export const mkdtemp = fs.mkdtemp;
export const mkstemp = fs.mkstemp;
export const open = fs.open;
export const opendir = fs.opendir;
export const readlink = fs.readlink;
export const realpath = fs.realpath;
export const rename = fs.rename;
export const rmdir = fs.rmdir;
export const stat = fs.stat;
export const statfs = fs.statfs;
export const symlink = fs.symlink;
export const unlink = fs.unlink;
export const utimes = fs.utimes;
export const watch = fs.watch;

/**
 * @param {string} filename 
 * @param {number} len 
 */
export async function truncate(filename, len) {
    const file = await fs.open(filename, 'rw');
    if (file) {
        await file.truncate(len);
        await file.close();
    }
}

/**
 * @param {string} src 
 * @param {string} dest 
 * @param {object} [options]
 * @param {boolean} [options.recursive] 同时复制所有的目录
 * @param {boolean} [options.force] 强制复制不报错
 */
export async function cp(src, dest, options) {
    const recursive = !!options?.recursive;
    const force = !!options?.force;

    if (src == dest) {
        return;
    }

    /**
     * @param {string} src 
     * @param {string} dest 
     */
    async function copyFile(src, dest) {
        // stat
        try {
            const info = await stat(dest);
            if (info.type == 'directory') {
                dest = join(dest, path.basename(src));
                await fs.copyFile(src, dest);

            } else {
                await fs.copyFile(src, dest);
            }

        } catch (e) {

        }

        const basename = path.dirname(dest);
        if (!await exists(basename)) {
            throw new Error(`directory '${basename}' not exists`);
        }

        await fs.copyFile(src, dest);
        // console.log(src, dest);
    }

    /**
     * @param {string} src 
     * @param {string} dest 
     */
    async function copyDir(src, dest) {
        await mkdir(dest, options);

        const dirs = await readdir(src);
        for await (const dir of dirs) {
            const subsrc = path.join(src, dir.name);
            const subdest = path.join(dest, dir.name);

            if (dir.type == 2) { // dir
                // console.log('cp:', subsrc, subdest);
                if (recursive) {
                    await cp(subsrc, subdest);
                }

            } else if (dir.type == 1) { // file
                // console.log(subsrc, subdest);
                await fs.copyFile(subsrc, subdest);

            } else if (dir.type == 3) { // link
                const target = await readlink(subsrc);
                if (target) {
                    await symlink(target, subdest);
                }
            }
        }
    }

    // stat
    try {
        const info = await stat(src);
        if (info.type == 'directory') {
            await copyDir(src, dest);

        } else {
            await copyFile(src, dest);
        }

    } catch (e) {
        // 源文件不存在
        if (!force) {
            throw e;
        }
    }
}

/**
 * @param {string} path 
 * @param {object} [options] 
 * @param {boolean} [options.recursive] 同时复制所有的目录
 */
export async function mkdir(path, options) {
    const recursive = !!options?.recursive;
    if (!recursive) {
        return await fs.mkdir(path);
    }

    if (!await exists(path)) {
        const basename = dirname(path);
        if (basename != path) {
            await mkdir(basename, options);
        }

        await fs.mkdir(path);
    }
}

/**
 * @param {string} path 
 * @param {object} [options] 
 * @param {boolean} [options.recursive] 同时复制所有的目录
 * @param {boolean} [options.force] 强制删除不报错
 */
export async function rm(path, options) {
    const recursive = !!options?.recursive;
    const force = !!options?.force;

    /**
     * 删除指定的文件
     * @param {string} pathname 
     */
    async function remove(pathname) {
        if (!force) {
            return await unlink(pathname);
        }

        try {
            return await unlink(pathname);

        } catch (e) {

        }
    }

    /**
     * 删除指定的目录以及文件
     * @param {string} pathname 目录名
     */
    async function rmdir(pathname) {
        const files = await readdir(pathname);
        for (const file of files) {
            if (file.type == 2) {
                await rmdir(join(pathname, file.name));

            } else {
                await remove(join(pathname, file.name));
            }
        }

        return await fs.rmdir(pathname);
    }

    if (!recursive) {
        return await remove(path);
    }

    // stat
    try {
        const info = await stat(path);
        if (info.type != 'directory') {
            return await remove(path);
        }

    } catch (e) {
        if (!force) {
            throw e;
        }

        return;
    }

    return await rmdir(path);
}

/**
 * @param {string} filename 
 * @param {native.crypto.DigestAlgorithm} hash 
 * @returns {Promise<string>}
 */
export async function filesum(filename, hash) {
    try {
        const data = native.crypto.hashfile(hash, filename);
        return data && native.util.encode(data, native.util.CODE_HEX);

    } catch (error) {
        return '';
    }
}

/**
 * @param {string} path 
 * @returns {Promise<string>}
 */
export async function md5sum(path) {
    return await filesum(path, 'MD5');
}

/**
 * @param {string} path 
 * @returns {Promise<string>}
 */
export async function sha1sum(path) {
    return await filesum(path, 'SHA1');
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
 * Read dir
 * @param {string} filename 
 * @returns {Promise<native.Dir[]>}
 */
export async function readdir(filename) {
    try {
        const dir = await fs.opendir(filename);
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
 * Append to file
 * @param {string} filename 
 * @param {string|ArrayBuffer} data 
 * @param {string|{encoding?: string, mode?: number, flag?: string}} options 
 * @returns {Promise<void>}
 */
export async function appendFile(filename, data, options) {
    let flag = 'a';
    let mode = 0o666;
    let encoding;
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
 * Read from file
 * @param {string} filename 
 * @param {*} options 
 * @returns {Promise<string|Uint8Array|undefined>}
 */
export async function readFile(filename, options) {
    let encoding = options;
    if (typeof options == 'object') {
        encoding = options.encoding;
    }

    try {
        let fileData = null;
        if (filename.startsWith('@app/')) {
            fileData = native.util.asset(filename);

        } else {
            fileData = await fs.readFile(filename);
        }

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
 * Read from text file
 * @param {string} filename 
 * @param {*} options 
 * @returns {Promise<string|undefined>}
 */
export async function readTextFile(filename, options) {
    let encoding = 'utf-8';
    if (typeof options == 'object') {
        encoding = options.encoding;
    }

    try {
        let fileData = null;
        if (filename.startsWith('@app/')) {
            fileData = native.util.asset(filename);

        } else {
            fileData = await fs.readFile(filename);
        }

        if (!fileData) {
            return;
        }

        const textDecoder = new TextDecoder(encoding);
        return textDecoder.decode(fileData);

    } catch (err) {
        err.message = err.message + ': ' + filename;
        throw err;
    }
}

/**
 * Write to file
 * @param {string} filename 
 * @param {string|ArrayBuffer} data 
 * @param {string|{encoding?: string, mode?: number, flag?: string}} options 
 */
export async function writeFile(filename, data, options) {
    let flag = 'w';
    let mode = 0o666;
    let encoding;
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

    const file = await fs.open(filename, flag, mode);
    await file.write(data, encoding);
    await file.close();
}

/**
 * 创建一个文件流
 * @param {string} filename 
 * @param {{ chunkSize?: number, onprogress?: (event: {loaded: number, total: number}) => void}} options 
 * @returns {Promise<ReadableStream<Uint8Array>>}
 */
export async function readableStream(filename, options) {
    // eslint-disable-next-line no-unused-vars
    const streams = await import('@tjs/streams');

    /** @type native.FileHandle | null */
    let file = await open(filename, 'rb');

    const statInfo = await file.stat();

    let loadedLength = 0;
    const BUFFER_SIZE = options?.chunkSize || 32 * 1024;
    const onprogress = options?.onprogress;

    const stream = new ReadableStream({
        pull(controller) {
            async function readChunk() {
                const chunkData = await file?.read(BUFFER_SIZE);
                if (chunkData == null || chunkData.byteLength == 0) {
                    controller.close();

                    if (file) {
                        file.close();
                        file = null;
                    }

                    return;
                }

                loadedLength += chunkData.byteLength;
                const data = new Uint8Array(chunkData);
                controller.enqueue(data);

                if (onprogress) {
                    onprogress({ loaded: loadedLength, total: statInfo.size });
                }
            }

            return readChunk();
        },
        cancel() {
            if (file) {
                file.close();
                file = null;
            }
        }
    });

    return stream;
}
