// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { Event } from '@tjs/event-target';
import * as fs from '@tjs/fs';
import * as path from '@tjs/path';
import * as os from '@tjs/os';
import * as process from '@tjs/process';

export class StorageEvent extends Event {
    constructor(init) {
        super('storage', init);

        this.key = null;
        this.newValue = null;
        this.oldValue = null;
        this.storageArea = null;
        this.url = null;
    }

    get [Symbol.toStringTag]() {
        return 'StorageEvent';
    }
}

export const STORAGE_LIMIT = 1024 * 640;

/**
 * 文件 Key-Value 存储
 */
export class FileStorage {
    /**
     * @param {string} filename 
     */
    constructor(filename) {
        /** @type fs.FileHandle | undefined */
        this.file = undefined;

        /** @type string | null */
        this.filename = filename;

        /** @type number */
        this.fileSize = 0;

        /** @type number */
        this.lineCount = 0;

        /** @type string[] */
        this.queue = [];

        /** @type any */
        this.flushTimer = null;

        /** @type any */
        this.flushPromise = null;

        /** @type Map<string,any> */
        this.values = new Map();
    }

    get [Symbol.toStringTag]() {
        return 'FileStorage';
    }

    get length() {
        return this.lineCount;
    }

    get size() {
        return this.fileSize;
    }

    /**
     * 关闭
     */
    async close() {
        const promise = this.flushPromise;
        if (promise) {
            await promise;
        } else {
            await this.onFlush();
        }

        const file = this.file;
        if (file) {
            this.file = undefined;

            await file.close();
        }

        this.values = new Map();
        this.lineCount = 0;
        this.fileSize = 0;
    }

    clear() {
        this.values = new Map();
        this.lineCount = 0;
        this.fileSize = 0;

        this.enqueue('');
    }

    /**
     * 
     * @param {string} line 
     */
    enqueue(line) {
        this.queue.push(line);

        if (this.flushTimer) {
            return;
        }

        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;

            if (this.flushPromise) {
                return;
            }

            this.flushPromise = this.onFlush();
        }, 100);
    }

    /**
     * 查询
     * @param {string} key 
     * @returns {any|null}
     */
    getItem(key) {
        const value = this.values.get(key);
        try {
            return JSON.parse(value);

        } catch (e) {
            return null;
        }
    }

    /**
     * 打开
     */
    async open() {
        if (this.file) {
            return;
        }

        const filename = this.filename;
        if (!filename) {
            return;
        }

        const dirname = path.dirname(filename);
        if (!await fs.exists(dirname)) {
            await fs.mkdir(dirname);
        }

        const file = await fs.open(filename, 'ra');
        if (file == null) {
            return;
        }

        const statInfo = await file.stat();
        if (statInfo == null) {
            return;
        }

        // console.log(statInfo);
        this.file = file;
        this.fileSize = statInfo.size;

        if (statInfo.size <= 0) {
            return;
        }

        const textDecoder = new TextDecoder();
        const data = await this.file.read(statInfo.size, 0);
        const text = textDecoder.decode(data);

        // console.log(text);
        let state = 0;
        let pos = 0;

        let offset = 0;
        const length = text.length;
        let index = null;
        let key = null;
        let value = null;
        let lines = 0;
        const values = this.values;

        while (pos < length) {
            if (state == 0) {
                pos = text.indexOf(',', offset);
                if (pos < 0) {
                    break;
                }

                index = text.substring(offset + 1, pos);
                state = 1;

            } else if (state == 1) {
                pos = text.indexOf('=', offset);
                if (pos < 0) {
                    break;
                }

                key = text.substring(offset, pos).trim();
                state = 2;

            } else {
                pos = text.indexOf('\n', offset);
                if (pos < 0) {
                    pos = text.length;
                }

                value = text.substring(offset, pos);
                // console.log(index, key, value);

                if (key) {
                    if (value == 'X') {
                        values.delete(key);
                    } else {
                        values.set(key, value);
                    }
                }

                lines++;
                state = 0;
            }

            // console.log(state, text.substring(offset, pos));
            offset = pos + 1;
        }

        this.index = Number.parseInt(index || '') || 0;
        this.lineCount = lines;
    }

    /**
     * @param {number} index
     * @returns {string|null}
     */
    key(index) {
        if (index >= this.values.size) {
            return null;
        }

        const keys = this.values.keys();
        for (let i = 0; i < index; i++) {
            keys.next();
        }

        return keys.next().value;
    }

    /**
     * 合并
     * @returns 
     */
    async merge() {
        // 1. save
        const filename = this.filename;
        if (!filename) {
            return;
        }

        const tempnamp = filename + '.2';
        let lineCount = 0;
        let fileSize = 0;

        {
            const file = await fs.open(tempnamp, 'ra');
            if (file == null) {
                return;
            }

            const values = this.values;
            for (const [key, value] of values.entries()) {
                const length = key.length + value.length + 1;
                const line = `$${length},${key}=${value}\n`;
                await file.write(line);

                lineCount++;
                fileSize += line.length;
                // console.log('line:', line);
            }

            await file.close();
        }

        // 2. close
        let file = this.file;
        if (file != null) {
            await file.close();
        }

        // 3. rename
        try {
            await fs.unlink(filename);
        } catch (e) {
        }

        await fs.rename(tempnamp, filename);

        // 4. open
        file = await fs.open(filename, 'ra');
        this.file = file;
        this.fileSize = fileSize;
        this.lineCount = lineCount;
    }

    async onFlush() {
        try {
            const queue = this.queue;
            if (queue.length <= 0) {
                return;
            }

            this.queue = [];

            for (const line of queue) {
                if (line == '') {
                    await this.merge();
                    continue;
                }

                const file = this.file;
                await file?.write(line);
            }

            const values = this.values;
            if (this.lineCount >= values.size * 10) {
                await this.merge();
            }

        } catch (e) {
            console.log(e);

        } finally {
            this.flushPromise = null;
        }
    }

    /**
     * 删除
     * @param {string} key 
     */
    removeItem(key) {
        const file = this.file;
        if (file == null) {
            return;
        }

        if (key == null) {
            return;
        }

        const name = key.trim();
        if (name == '') {
            return;
        }

        const values = this.values;
        if (!values.has(name)) {
            return;
        }

        this.values.delete(name);

        const length = name.length + 2;
        const line = `$${length},${name}=X\n`;

        this.enqueue(line);

        this.lineCount++;
        this.fileSize += line.length;
    }

    /**
     * 设置
     * @param {string} key 
     * @param {any} value 
     */
    setItem(key, value) {
        const file = this.file;
        if (file == null) {
            return;
        }

        if (key == null || value == null) {
            return;
        }

        const name = key.trim();
        if (name == '') {
            return;
        }

        const values = this.values;
        const rawValue = JSON.stringify(value);
        if (rawValue === values.get(name)) {
            return;
        }

        values.set(name, rawValue);

        const length = name.length + rawValue.length + 1;
        const line = `$${length},${name}=${rawValue}\n`;

        this.enqueue(line);

        this.lineCount++;
        this.fileSize += line.length;
    }
}

const kStorageFile = Symbol('StorageFile');

/**
 * 实现 Web Storage API 接口
 * - sessionStorage 保存在 /tmp 目录下，设备重启后会丢失
 * - localStorage 保存在 Flash，设备重启也不会丢失
 * - 文件最大大小限制在 640KB
 */
export class Storage {
    /** 
     * @param {string} scope 
     * @param {string} type 
     */
    constructor(scope, type) {
        const uid = process.getuid();

        /** @type string */
        this.scope = scope;

        /** @type string */
        this.type = type;

        /** @type number */
        this.uid = uid;

        let basedir = path.join(os.homedir(), '.tjs');
        if (type == 'session') {
            basedir = path.join(os.tmpdir(), 'tjs-' + uid);
        }

        const name = 'storage-' + scope + '-' + type + '.db';
        const filename = path.join(basedir, name);
        
        this[kStorageFile] = new FileStorage(filename);
    }

    get [Symbol.toStringTag]() {
        return 'Storage';
    }

    get length() {
        return this.file.length;
    }

    get size() {
        return this.file.size;
    }

    /** @type FileStorage */
    get file() {
        return this[kStorageFile];
    }

    clear() {
        return this.file.clear();
    }

    /**
     * @param {string} name
     * @returns {string}
     */
    getItem(name) {
        return this.file.getItem(name);
    }

    /**
     * @param {number} index
     * @returns {string|null}
     */
    key(index) {
        return this.file.key(index);
    }

    /**
     * @param {string} name
     */
    removeItem(name) {
        return this.file.removeItem(name);
    }

    /**
     * @param {string} name
     * @param {string} value
     */
    setItem(name, value) {
        if (value == null) {
            return;
        }

        return this.file.setItem(name, String(value));
    }
}

/**
 * 存储管理
 */
export class StorageManager {
    constructor() {
        /** @type string */
        this.scope = '';

        /** @type Object<string, Storage> */
        this.storages = {};

        /** @type boolean */
        this._loadFlag = false;
    }

    async estimate() {
        return {};
    }

    /**
     * 保存数据到存储
     * @param {string} type 
     */
    async flushValues(type) {
        if (!type) {
            return;
        }

        const storage = this.storages[type];
        if (!storage) {
            return;
        }

        return storage.file?.onFlush();
    }

    async flush() {
        await this.flushValues('local');
        await this.flushValues('session');
    }

    /**
     * 加载存储的数据
     * @param {string} type 
     * @returns 
     */
    async loadValues(type) {
        if (!type) {
            return;

        } else if (this._loadFlag) {
            return;
        }

        let storage = this.storages[type];
        if (!storage) {
            storage = new Storage(this.scope, type);
            this.storages[type] = storage;
        }

        return storage.file.open();
    }

    /**
     * 
     * @param {string} scope 
     */
    async load(scope) {
        this.scope = scope || 'tjs';
        await this.loadValues('local');
        await this.loadValues('session');
        this._loadFlag = true;
    }
}

const $storageManager = new StorageManager();

/**
 * 加载所有存储
 * @param {string} scope 
 */
export function loadStorages(scope) {
    return $storageManager.load(scope);
}

/**
 * 保存所有存储
 */
export function flushStorages() {
    return $storageManager.flush();
}

/**
 * @param {string} type `local`,`session`
 * @returns {Storage}
 */
export function getStorage(type, scope = 'tjs') {
    let storage = $storageManager.storages[type];
    if (!storage) {
        storage = new Storage(scope, type);
        $storageManager.storages[type] = storage;
    }

    const proxy = new Proxy(storage, {
        get: function (object, property) {
            const hasProperty = property in object;
            if (hasProperty) {
                return object[property];
            }

            return object.getItem(String(property));
        },
        set: function (object, property, value) {
            object.setItem(String(property), value);
            return true;
        }
    });

    return proxy;
}

export function getStorageManager() {
    return $storageManager;
}
