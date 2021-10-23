// @ts-check
import { Event } from '@tjs/event-target';

export class StorageEvent extends Event {
    constructor(options) {
        super('storage');

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
 * 实现 Web Storage API 接口
 * - sessionStorage 保存在 /tmp 目录下，设备重启后会丢失
 * - localStorage 保存在 Flash，设备重启也不会丢失
 * - 文件最大大小限制在 640KB
 */
export class Storage {
    /** @param {string} type */
    constructor(type) {
        this._data = {};
    }

    get [Symbol.toStringTag]() {
        return 'Storage';
    }

    get length() {
        const keys = Object.keys(this._data);
        return keys.length;
    }

    get size() {
        let total = 0;
        const data = this._data;
        for (const key in data) {
            const value = data[key];
            total += key.length;

            if (value != null) {
                total += value.length;
            }
        };

        return total;
    }

    /**
     * @param {number} index
     * @returns {string}
     */
    key(index) {
        const keys = Object.keys(this._data);
        return keys[index];
    }

    /**
     * @param {string} name
     * @returns {string}
     */
    getItem(name) {
        return this._data[name];
    }

    /**
     * @param {string} name
     * @param {string} value
     */
    setItem(name, value) {
        if (value == null) {
            return this.removeItem(name);
        }

        if (typeof value != 'string') {
            value = String(value);
        }

        const oldValue = this._data[name];
        if (oldValue == value) {
            return;
        }

        // TODO: 统计存储文件大小
        // TODO: 当文件大小超过上限出抛出错误
        let total = this.size;
        total -= oldValue?.length || 0;
        total += value?.length || 0;
        if (total >= STORAGE_LIMIT) {
            throw new Error('storage is too large!');
        }

        this._data[name] = value;
        this._onValueChange(name, oldValue, value);
    }

    /**
     * @param {string} name
     */
    removeItem(name) {
        const oldValue = this._data[name];
        if (oldValue != null) {
            delete this._data[name];
            this._onValueChange(name, oldValue, null);
        }
    }

    clear() {
        const data = this._data;
        for (const key in data) {
            delete data[key];
        }
    }

    /**
     * @param {string} name 
     * @param {string} oldValue 
     * @param {string} newValue 
     */
    _onValueChange(name, oldValue, newValue) {
        // TODO: save to file
    }
}

/**
 * @param {string} type `local`,`session`
 * @returns {Storage}
 */
export function createStorage(type) {
    const storage = new Storage(type);
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
