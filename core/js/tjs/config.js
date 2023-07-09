// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import { join, basename } from '@tjs/path';

const options = {
    root: navigator.root || '/system/wotjs/'
};

export const CONFIG_LIMIT = 1024 * 640;

/**
 * 读取文本文件内容
 * @param {string} filename 
 * @return {Promise<string>}
 */
async function readTextFile(filename) {
    const filedata = await fs.readFile(filename, 'utf-8');
    if (filedata == null) {
        return '';
    }

    return /** @type string */(filedata);
}

/**
 * 配置文件名
 * @private
 * @param {string} base
 * @param {string} name
 * @returns {string}
 */
function _getFilename(base, name) {
    base = base || (options.root + 'conf');
    const filename = join(base, name + '.conf');
    return filename;
}

/** @typedef {{[key: string]: any}} SettingMap */
/** @typedef {{[key: string]: any}} SettingObject */

/**
 * 将一级 object 对象转换成多级 object 对象
 * 将通过参数名 '.' 号分级，如 `{'a.name': x}` 转换为 `{a: { name: x}}`
 * @param {SettingMap} flatMap 
 * @returns {SettingObject}
 */
export function parseFlatMap(flatMap) {
    if (flatMap == null) {
        return flatMap;

    } else if (typeof flatMap == 'string') {
        return flatMap;
    }

    /** @type SettingObject */
    const result = {};
    for (const name in flatMap) {
        const tokens = name.split('.');

        let current = result;
        for (let i = 0; i < tokens.length - 1; i++) {
            const key = tokens[i];
            const value = current[key];

            if (value == null) {
                /** @type SettingObject */
                const map = {};
                current[key] = map;
                current = map;

            } else if (typeof value == 'object') {
                current = value;

            } else {
                /** @type SettingObject */
                const map = {};
                current[key] = map;
                current = map;
            }
        }

        const key = tokens[tokens.length - 1];
        current[key] = flatMap[name];
    }

    return result;
}

const kPrivate = Symbol('private');

/**
 * 配置文件项
 */
export class ConfigItem {
    /**
     * @param {string} name 
     * @param {string} value 
     * @param {string[]=} comments 
     */
    constructor(name, value, comments) {
        /** @type {string} */
        this.name = name || '';

        /** @type {string=} */
        this.value = value;

        /** @type {string[]=} */
        this.comments = undefined;

        if (comments) {
            this.comments = [];
            this.comments.push(...comments);
        }
    }
}

export class ConfigSection {
    /**
     * @param {string} name
     * @param {string[]=} comments 
     */
    constructor(name, comments) {
        /** @type {string} */
        this.name = name || '';

        /** @type {string[]=} */
        this.comments = undefined;

        if (comments) {
            this.comments = [];
            this.comments.push(...comments);
        }
    }
}

/**
 * 配置参数文件
 */
export class Config {
    /**
     * @param {string} name Name
     * @param {string} base Base
     */
    constructor(name, base) {

        /** @type {Map<string, ConfigItem>} */
        this.values = new Map();

        /** @type {string[]} */
        this.sections = [];

        this[kPrivate] = {
            /** @type string */
            base,

            /** @type string */
            filedata: '',

            /** @type string */
            filename: _getFilename(base, name),

            /** @type fs.Stats|undefined */
            filestat: undefined,

            /** @type string[] */
            sections: [],

            /** @type string */
            name,

            /** @type number */
            updateCount: 0
        };
    }

    get [Symbol.toStringTag]() {
        return 'Config';
    }

    get $properties() {
        return this[kPrivate];
    }

    get data() {
        const result = {};
        const values = this.values;
        for (const key of values.keys()) {
            result[key] = values.get(key)?.value;
        }

        return result;
    }

    /**
     * 最后修改时间
     * @returns {number|undefined}
     */
    get lastModified() {
        let modified = this.$properties.filestat?.mtime;
        if (modified != null) {
            modified = Math.round(modified * 1000);
        }

        return modified;
    }

    /** @type string */
    get filename() {
        return this.$properties.filename;
    }

    /** @type number */
    get length() {
        const values = this.values;
        if (values == null) {
            return 0;
        }

        return values.size;
    }

    /** @type string */
    get name() {
        return this.$properties.name || 'user';
    }

    /**
     * 添加分组
     * @param {string} section 
     * @returns 
     */
    addSection(section) {
        if (!section) {
            return;
        }

        /** @type string[] */
        const sections = this.sections;
        if (!sections) {
            return;
        }

        if (sections.indexOf(section) < 0) {
            sections.push(section);
        }
    }

    clear() {
        this.values.clear();
    }

    /**
     * 保存所有修改内容
     * @returns {Promise<boolean>}
     */
    async flush() {
        return await this.save();
    }

    /**
     * Get the array config value(s).
     * @param {string} name 
     * @param {{flat:boolean}=} options 选项
     * @return {SettingObject[]|undefined}
     */
    getArray(name, options) {
        const values = this.values;
        if (!values) {
            return;
        }

        /** @type SettingObject[] */
        const list = [];
        if (!name) {
            return list;
        }

        /** @type Map<string,string> */
        const map = new Map();
        const prefix = name + '.';

        const tokens = name.split('.');
        const offset = tokens.length || 1;

        // 提取所有索引
        for (const key of values.keys()) {
            if (!key.startsWith(prefix)) {
                continue;
            }

            const tokens = key.split('.');
            const index = tokens[offset] || '0';

            const keyValue = values.get(key)?.value;
            const keyName = tokens.slice(offset + 1).join('.') || 'value';
            let entity = map[index];
            if (entity == null) {
                entity = { _index: index };
                map[index] = entity;
                list.push(entity);
            }

            entity[keyName] = keyValue;
        }

        const flat = options?.flat !== false;
        if (!flat) {
            return list;
        }

        /** @type SettingObject[] */
        const result = [];
        for (const entity of list) {
            result.push(parseFlatMap(entity));
        }

        return result;
    }

    /**
     * 返回指定名称的键值的布尔值
     * @param {string} name 
     * @returns {boolean|undefined}
     */
    getBoolean(name) {
        const value = this.getString(name);
        if (!value) {
            return false;
        }

        return value != 'false';
    }

    /**
     * 返回指定名称的参数项值
     * @param {string} name 
     * @returns {string=}
     */
    getItem(name) {
        if (!name) {
            return;
        }

        const values = this.values;
        const item = values?.get(name);
        return item?.value;
    }

    /**
     * 返回指定名称的键值的数值
     * @param {string} name 
     * @returns {number|undefined}
     */
    getNumber(name) {
        const value = this.getString(name);
        if (!value) {
            return;
        }

        const numberValue = Number.parseFloat(value);
        if (numberValue == null || isNaN(numberValue)) {
            return;
        }

        return numberValue;
    }

    /**
     * 返回一个对象
     * @param {string=} name 对象名称
     * @param {{flat:boolean}=} options 选项
     * @return {SettingObject | undefined}
     */
    getObject(name, options) {
        if (!name) {
            return this.data;
        }

        const values = this.values;
        if (!values) {
            return;
        }

        const flat = options?.flat !== false;
        const prefix = name + '.';

        /** @type {SettingMap | undefined} */
        let result;
        for (const key of values.keys()) {
            if (!key.startsWith(prefix)) {
                continue;
            }

            if (!result) {
                result = {};
            }

            const keyName = key.substring(prefix.length) || '0';
            result[keyName] = values.get(key)?.value;
        }

        if (result && !flat) {
            return parseFlatMap(result);
        }

        return result;
    }

    /**
     * 返回指定名称的字符串键值（保存在文件的原始值）
     * @param {string} name 名称
     * @returns {string|undefined} 键值
     */
    getString(name) {
        return this.getItem(name);
    }

    help() {
        console.print('Manage the tpm configuration files\r\n');
    }

    /**
     * 加载配置文件
     * @param {string=} string
     * @returns {Promise<boolean>}
     */
    async load(string) {
        this.values.clear();

        try {
            this.$properties.updateCount = 0;

            // stat
            const filename = string || this.filename;
            const filestat = await this.statFile(filename);
            this.$properties.filestat = filestat;

            // read
            let filedata = null;
            if (filestat) {
                filedata = await readTextFile(filename);
            }

            if (!filedata) {
                return false;
            }

            return this.parse(filedata);

        } catch (error) {
            this.lastError = error;
        }

        return false;
    }

    /**
     * 解析配置文件
     * @param {string=} string
     * @returns {boolean}
     */
    parse(string) {
        /** 
         * @param {string} name 
         * @returns {string}
         */
        function parseName(name) {
            if (name == null) {
                return '';
            }

            name = String(name);
            name = name.trim();
            return name;
        }

        /** 
         * @param {string} value 
         * @returns {string}
         */
        function parseValue(value) {
            if (value == null) {
                return '';
            }

            value = String(value);
            value = value.trim();
            try {
                return JSON.parse('"' + value + '"');

            } catch (e) {
                return value;
            }
        }

        try {
            this.values.clear();

            const values = this.values;

            this.$properties.updateCount = 0;

            if (!string) {
                return false;
            }

            this.$properties.filedata = string;

            /** @type string[] */
            const sections = [];
            const groups = {};
            let section = null;
            let base = '';

            // parse
            const content = string;
            const comments = [];

            const lines = content.split('\n');
            lines.forEach(function (item) {
                const line = item.trim();
                if (line.startsWith('[')) {

                    let pos = line.indexOf(']', 1);
                    if (!(pos > 1)) {
                        pos = line.length;
                    }

                    const name = line.substring(1, pos);
                    if (name) {
                        base = name;
                        if (groups[base] == null) {
                            groups[base] = {};
                            sections.push(base);
                        }

                        section = groups[base];
                    }

                    comments.splice(0);

                } else if (line.startsWith('#')) {
                    comments.push(line);

                } else if (line.startsWith(';')) {
                    comments.push(line);

                } else {
                    const pos = line.indexOf('=');
                    if (!(pos > 0)) {
                        comments.push(line);
                        return;
                    }

                    const key = line.substring(0, pos);
                    const value = parseValue(line.substring(pos + 1));
                    const name = parseName((section) ? base + '.' + key : key);

                    const item = new ConfigItem(name, value, comments);
                    values.set(name, item);
                    comments.splice(0);
                }
            });

            this.sections = sections;
            return true;

        } catch (error) {
            this.lastError = error;
        }

        return false;
    }

    /**
     * Rename the given section to a new name.
     * @param {string} oldName 
     * @param {string} newName 
     */
    renameSection(oldName, newName) {
        if (!oldName || !newName || oldName == newName) {
            return false;
        }

        const prefix = oldName + '.';

        let flag = false;
        const values = this.values;
        if (values == null) {
            return false;
        }

        for (const key of values.keys()) {
            if (!key.startsWith(prefix)) {
                continue;
            }

            const keyName = key.substring(prefix.length) || '0';
            const item = values.get(key);
            if (item != null) {
                values.set(newName + '.' + keyName, item);
                values.delete(key);
            }

            flag = true;
        }

        return flag;
    }

    /**
     * Remove the given section from the configuration file.
     * @param {string} name 
     */
    removeSection(name) {
        if (!name) {
            return false;
        }

        const prefix = name + '.';

        let flag = false;
        const values = this.values;
        if (values == null) {
            return false;
        }

        for (const key of values.keys()) {
            if (!key.startsWith(prefix)) {
                continue;
            }

            values.delete(key);
            flag = true;
        }

        return flag;
    }

    /**
     * @param {string} name 
     */
    removeItem(name) {
        if (!name) {
            return false;
        }

        let flag = false;
        const values = this.values;
        if (values?.has(name)) {
            values.delete(name);
            flag = true;
        }

        return flag;
    }

    /**
     * 保存配置文件
     * @param {string} [output] 另存为
     * @returns {Promise<boolean>}
     */
    async save(output) {
        const filedata = this.stringify();
        if (output) {
            // 另存为
            await fs.writeFile(output, filedata);
            return true;

        } else {
            // 保存到文件
            const filename = this.filename;
            const lastdata = this.$properties.filedata;
            // console.log(filename, filedata);

            this.$properties.updateCount = 0;

            if (filedata != lastdata) {
                await fs.writeFile(filename, filedata);
                return true;
            }
        }

        return false;
    }

    /**
     * 修改参数项
     * @param {string|Object<string,any>} name 名称
     * @param {string|null} [value] 值
     * @returns {boolean}
     */
    set(name, value) {
        if (!name) {
            return false;

        } else if (typeof name == 'object') {
            // set(values:Object<string, any>)
            const values = name;
            return this.setObject('', values);

        } else if (value != null) {
            // set(name:string, value:string)
            return this.setItem(name, value);

        } else if (value === null) {
            // set(name:string, null)
            return this.removeItem(name);
        }

        return false;
    }

    /**
     * 设置一个字符串值
     * @param {string} name 
     * @param {string} value 
     * @returns {boolean}
     */
    setItem(name, value) {
        const values = this.values;
        if (!values) {
            return false;
        }

        /**
         * @param {any} name 
         * @returns {string|undefined}
         */
        function encodeName(name) {
            if (name == null) {
                return;
            }

            name = String(name);
            name = name.trim();
            name = JSON.stringify(name);
            return name.substring(1, name.length - 1);
        }

        /**
         * @param {any} value 
         * @returns {string|undefined}
         */
        function trimValue(value) {
            if (value == null) {
                return;
            }

            value = String(value);
            return value.trim();
        }

        const name2 = encodeName(name);
        if (name2 == null) {
            return false;
        }

        const value2 = trimValue(value);
        if (value2 == null) {
            return false;
        }

        let item = values.get(name2);
        if (item == null) {
            item = new ConfigItem(name2, value2);
            values.set(name2, item);
            this.$properties.updateCount++;
            return true;

        } else if (item.value !== value2) {
            // console.log('setItem:', name2, value2, values);
            item.value = value2;

            this.$properties.updateCount++;
            return true;
        }

        return false;
    }

    /**
     * 设置一个对象值
     * @param {string} section 
     * @param {Object<string, any>} values 
     * @return {boolean}
     */
    setObject(section, values) {
        if (values == null || typeof values != 'object') {
            return false;
        }

        let flag = false;

        if (section) {
            this.addSection(section);
        }

        for (const name in values) {
            const value = values[name];
            const key = section ? (section + '.' + name) : name;
            // console.log('set:', key, value);

            if (value == null) {
                this.removeItem(key);

            } else if (typeof value == 'object') {
                if (this.setObject(key, value)) {
                    flag = true;
                }

            } else {
                if (this.setItem(key, value)) {
                    flag = true;
                }
            }
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
     * Encode as string
     * @returns string
     */
    stringify() {
        /** @param {string} value */
        function stringifyValue(value) {
            if (value == null) {
                return false;
            }

            value = String(value);
            value = value.trim();
            value = JSON.stringify(value);
            return value.substring(1, value.length - 1);
        }

        // group keys
        const sections = [''];
        sections.push(...this.sections);
        sections.sort();

        // console.log('this.sections', this.sections, groupKeys);
        const values = this.values;

        // groups
        /** @type {Object<string,Object<string,ConfigItem>>} */
        const groups = { '': {} };
        for (const key of values.keys()) {
            let base = '';
            let name = key;

            for (const groupName of sections) {
                if (key.startsWith(groupName + '.')) {
                    base = groupName;
                    name = key.substring(groupName.length + 1);
                }

                // console.log('base', base, name);
            }

            if (groups[base] == null) {
                groups[base] = {};
            }

            const section = groups[base];
            const item = values.get(key);
            if (item) {
                section[name] = item;
            }
        }

        const outputs = [];
        // console.log('groups', groupKeys);

        for (let i = 0; i < sections.length; i++) {
            const lines = [];

            const base = sections[i];
            if (base) {
                lines.push(`\n[${base}]\n`);
            }

            const section = groups[base];
            for (const key in section) {
                const item = section[key];

                const value = item.value;
                if (value != null) {
                    const comments = item.comments;
                    if (comments?.length) {
                        for (const comment of comments) {
                            lines.push(comment + '\n');
                        }
                    }

                    lines.push(key + '=' + stringifyValue(value) + '\n');
                }
            }

            outputs.push(lines.join(''));
        }

        return outputs.join('');
    }

    /**
     * Encode as JSON string
     * @returns {string|undefined}
     */
    toJSON() {
        const object = this.toObject();
        if (object == null) {
            return;
        }

        return JSON.stringify(object);
    }

    toObject() {
        return parseFlatMap(this.data);
    }
}

/**
 * 加载指定名称的文件
 * @param {string} name 
 * @param {*} options 
 * @returns {Promise<Config>}
 */
export async function load(name, options) {
    const config = new Config(name, options);
    await config.load();
    return config;
}

/**
 * 打开指定的文件
 * @param {string} filename 
 * @param {*} options 
 * @returns 
 */
export async function open(filename, options) {
    const name = basename(filename);
    const config = new Config(name, options);
    config.$properties.filename = filename;
    await config.load();
    return config;
}

/**
 * 字符串解析
 * @param {string} string 
 * @param {*=} options 
 */
export async function parse(string, options) {

}

/**
 * 格式化输出
 * @param {Object<string,any>} value 
 * @param {*=} options 
 */
export async function stringify(value, options) {

}

export default Config;
