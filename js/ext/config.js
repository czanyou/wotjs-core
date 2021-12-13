// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import { join } from '@tjs/path';

const options = {
    root: navigator.root || '/system/wotjs/'
};

export const CONFIG_LIMIT = 1024 * 64;

/**
 * 配置参数文件
 */
export class Config {
    /**
     * @param {string} name Name
     * @param {string} base Base
     */
    constructor(name, base) {
        this.base = base;
        this.name = name || 'user';

        this.data = null;
        this.filedata = null;
        this.filename = this._getFilename(base, name);
        this.filestat = null;
        this.isCache = false;
        this.updateCount = 0;
    }

    get [Symbol.toStringTag]() {
        return 'Config';
    }

    /**
     * 最后修改时间
     * @returns {number}
     */
    get lastModified() {
        let modified = this.filestat?.mtime;
        if (modified != null) {
            modified = Math.round(modified * 1000);
        }

        return modified;
    }

    /**
     * 设置为缓存模式
     * - 缓存模式下所有的修改不会马上保存到存储
     * - 同样存储器中的文件改动也不会马上读取到
     */
    cache() {
        this.isCache = true;

        if (!this.data) {
            this.data = {};
        }
    }

    /**
     * 保存所有修改内容
     * @returns 
     */
    async flush() {
        const result = await this.save();
        this.isCache = false;
        this.updateCount = 0;
        return result;
    }

    /**
     * 返回指定名称的参数项值
     * @param {string} name 
     * @param {any} type 
     * @returns {string | any}
     */
    get(name, type) {
        if (!name) {
            return;
        }

        const data = this.data;
        if (!data) {
            return;
        }

        function toValue(value) {
            if (type == null) {
                return value;

            } else if (type == Boolean) {
                return value && value != 'false';

            } else if (type == Number) {
                const numberValue = Number.parseFloat(value);
                if (numberValue == null || isNaN(numberValue)) {
                    return null;
                }

                return numberValue;
            }

            return value;
        }

        if (Array.isArray(name)) {
            const result = {};
            name.forEach(key => {
                result[key] = toValue(data[key]);
            });

            return result;
        }

        return toValue(data[name]);
    }

    /**
     * 配置文件名
     * @private
     * @param {string} base
     * @param {string} name
     * @returns {string}
     */
    _getFilename(base, name) {
        base = base || (options.root + 'conf');
        const filename = join(base, name + '.conf');
        return filename;
    }

    help() {
        console.print('Manage the tpm configuration files\r\n');
    }

    /**
     * 加载配置文件
     * @param {boolean} cache 是否缓存
     * @returns 
     */
    async load(cache = false) {
        if (cache) {
            this.cache();
        }

        function trimValue(value) {
            if (value == null) {
                return;
            }

            value = String(value);
            return value.trim();
        }

        try {
            const data = {};
            this.data = data;
            this.updateCount = 0;

            // stat
            const filename = this.filename;
            const filestat = await this.statFile(filename);
            this.filestat = filestat;

            // read
            let filedata = null;
            if (filestat) {
                filedata = await fs.readFile(filename, 'utf-8');
            }

            this.filedata = filedata;
            if (!filedata) {
                return;
            }

            // parse
            const content = String(filedata);
            const lines = content.split('\n');
            lines.forEach(function (line) {
                const pos = line.indexOf('=');
                if (pos > 0) {
                    const key = line.substring(0, pos);
                    const value = line.substring(pos + 1);
                    data[trimValue(key)] = trimValue(value);
                }
            });

        } catch (error) {
            this.lastError = error;
        }
    }

    /**
     * 保存配置文件
     * @returns 
     */
    async save() {
        const configs = {
            filename: this.filename,
            filedata: this.filedata,
            data: this.data
        };

        const lines = [];
        for (const key in configs.data) {
            const value = configs.data[key];

            lines.push(key + '=' + value);
        }

        lines.sort();
        lines.push('');

        const filedata = lines.join('\n');
        const filename = this.filename;
        // console.log(filename, filedata);

        if (configs.filedata != filedata) {
            await fs.writeFile(filename, filedata);
            return true;
        }
    }

    /**
     * 修改参数项
     * @param {string|any} name 名称
     * @param {string} [value] 值
     * @returns 
     */
    async set(name, value) {
        if (!name) {
            return;
        }

        function trimValue(value) {
            if (value == null) {
                return;
            }

            value = String(value);
            return value.trim();
        }

        let values = name;
        if (typeof values != 'object') {
            if (value == null) {
                return;
            }

            values = {};
            values[name] = trimValue(value);
        }

        if (!this.isCache) {
            await this.load();
        }

        let flag = false;
        if (this.data) {
            for (const name2 in values) {
                const value2 = trimValue(values[name2]);
                if (this.data[name2] != value2) {
                    this.data[name2] = value2;
                    this.updateCount++;
                    flag = true;
                }
            }
        }

        if (!this.isCache) {
            await this.save();
        }

        return flag;
    }

    /**
     * 
     * @param {string} filename 文件名
     * @returns 
     */
    async statFile(filename) {
        filename = filename || this.filename;
        try {
            const result = await fs.stat(filename);
            return result;

        } catch (err) {

        }
    }

    /**
     * 删除参数项
     * @param {string} name 名称
     * @returns 
     */
    async unset(name) {
        if (!name) {
            return;
        }

        if (!this.isCache) {
            await this.load();
        }

        let flag = false;
        if (this.data) {
            if (this.data[name] != undefined) {
                delete this.data[name];
                flag = true;
            }
        }

        if (!this.isCache) {
            await this.save();
        }

        return flag;
    }
}

export async function load(name, options) {
    const config = new Config(name, options);
    await config.load(true);
    return config;
}

export default Config;
