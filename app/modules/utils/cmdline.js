// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as config from '@tjs/config';
import * as path from '@tjs/path';
import * as native from '@tjs/native';
import * as os from '@tjs/os';

const utf8 = native.utf8;

const $context = {
    name: 'tjs'
};

/** 
 * @typedef {{ title: string, commands: {[key: string]: any} }} ManageCommands
 * @typedef {{ title: string, subtitle?: {[key: string]: string}, commands?: {[key: string]: any}, subcommands?: {[key: string]: ManageCommands} }} Commands
 */

// ////////////////////////////////////////////////////////////////////////////
// config

class ConfigCommands {
    /** @param {string} type */
    constructor(type) {
        /** @type string */
        this.type = type;

        /** @type string */
        this.title = '管理配置参数';

        /** @type Object<string,string> */
        this.subtitle = {
            export: '导出参数到指定的文件',
            get: '查询指定的名称的参数',
            import: '从指定的文件导入参数',
            list: '返回配置文件中所有的值',
            load: '加载默认参数',
            remove: '删除指定的分组',
            rename: '重命名指定的分组',
            set: '设置指定的名称的参数',
            unset: '删除指定的名称的参数'
        };
    }

    /** 
     * 导出参数到文件
     * @param {string} filename 
     */
    async export(filename) {
        const type = this.type;

        if (!filename) {
            console.print('Usage: export <filename>\n');
            console.print(`导出所有 ${type} 参数到指定的文件\n`);
            return;
        }

        if (!path.isAbsolute(filename)) {
            filename = path.join(os.cwd(), filename);
        }

        const configFile = await config.load(type);
        await configFile.save(filename);

        // console.log(configFile);
        console.print('config: Export to', filename);
    }

    /** 
     * Get the value for a given key
     * 打印参数值
     * @param {string=} name 
     */
    async get(name) {
        if (!name) {
            console.print(`Usage: ${$context.name} config get <key|section>\n`);
            return;
        }

        const type = this.type;

        const colors = console.colors;
        // key - value
        const configFile = await config.load(type);
        const value = configFile.getString(name);
        if (value != null) {
            console.print(value);
            return value;
        }

        // section - keys - values
        const values = configFile.getObject(name);
        if (values == null) {
            console.print(null);
            return;
        }

        for (const name in values) {
            const value = JSON.stringify(values[name]);
            console.print(`${name} = ${colors.green(value)}`);
        }
    }

    /**
     * List all variables set in config file, along with their values.
     */
    async list() {
        const type = this.type;
        const colors = console.colors;
        const configFile = await config.load(type);
        console.print('Echo the config value(s) to stdout.\n');
        console.print(';', colors.green(configFile.filename), '\n');

        const values = configFile.data;
        for (const name in values) {
            const value = JSON.stringify(values[name]);
            console.print(`${colors.blue(name)} = ${value}`);
        }

        console.print(colors.green(`\n; usage: ${$context.name} get <key> [<key>...]\n`));
    }

    /** 
     * 从文件导入参数
     * @param {string} filename 
     */
    async import(filename) {
        const type = this.type;

        if (!filename) {
            console.print('Usage: import <filename>\n');
            console.print(`从指定的文件导入 ${type} 参数\n`);
            return;
        }

        if (!path.isAbsolute(filename)) {
            filename = path.join(os.cwd(), filename);
        }

        const settings = await config.open(filename);
        // console.log(filename, settings);

        const configFile = await config.load(type);
        configFile.set(settings.data);
        await configFile.save();

        console.print('config: Import from', filename);
    }

    /** 
     * 加载默认的参数
     * @param {string} [mode] 
     * @param {string} [flags] 
     */
    load(mode, flags) {
        if (mode != 'default') {
            console.print(`Usage: ${$context.name} config load <default>\n`);
            console.print('加载默认的参数\n');
            return;
        }

        const type = this.type;
        if (type == 'network') {
            this.loadNetworkDefault(flags);

        } else if (type == 'user') {
            this.loadUserDefault(flags);

        } else {
            console.print(`Load ${type} default settings\n\n`);
        }
    }

    /**
     * 恢复默认参数
     * @param {string} [flags]
     */
    async loadUserDefault(flags) {
        console.print('load user defaults...');

        try {
            const deviceConfig = await config.load('device');
            const userConfig = await config.load('user');

            /**
             * 
             * @param {*} name 
             * @param {*=} newName 
             * @returns 
             */
            async function loadConfig(name, newName) {
                const value = deviceConfig.getString(name);
                if (value == null) {
                    return;
                }

                if (!newName) {
                    newName = name;
                }

                if (userConfig.setItem(newName, value)) {
                    console.print('load: ' + newName + ' =', value);
                }
            }

            // Web of Things
            await loadConfig('wot.did');
            await loadConfig('wot.registry');
            await loadConfig('wot.secret');

            const syslogEnabled = deviceConfig.getBoolean('syslog.enabled');
            if (syslogEnabled) {
                userConfig.setItem('log.type', 'syslog');
            }

            await userConfig.save();

        } catch (e) {
            console.print(e.message);
        }
    }

    /**
     * 恢复默认网络参数
     * @param {string} [flags]
     */
    async loadNetworkDefault(flags) {
        console.print('load network defaults...');

        try {
            const deviceConfig = await config.load('device');
            const networkConfig = await config.load('network');

            /**
             * 
             * @param {*} name 
             * @param {*=} newName 
             * @returns 
             */
            async function loadConfig(name, newName) {
                const value = deviceConfig.getString(name);
                if (value == null) {
                    return;
                }

                if (!newName) {
                    newName = name;
                }

                if (networkConfig.setItem(newName, value)) {
                    console.print('load: ' + (newName) + ' =', value);
                }
            }

            // misc
            await loadConfig('hostname');

            // ethernet
            await loadConfig('eth.enabled');
            await loadConfig('eth.interface');

            // wifi
            await loadConfig('wlan.dns1');
            await loadConfig('wlan.dns2');
            await loadConfig('wlan.enabled');
            await loadConfig('wlan.interface');
            await loadConfig('wlan.mode');

            if (!flags) {
                await loadConfig('wlan.key');
                await loadConfig('wlan.ssid');
            }

            await networkConfig.save();

        } catch (e) {
            console.print(e.message);
        }
    }

    /**
     * Rename the given section to a new name.
     * @param {string} oldName 
     * @param {string} newName 
     */
    async rename(oldName, newName) {
        const type = this.type;

        if (!oldName) {
            console.print('Usage: rename <old-name> <new-name>\n');
            console.print(`从配置文件(${type})中重命名指定的分组\n`);
            return;
        }

        const configFile = await config.load(type);
        configFile.renameSection(oldName, newName);
        await configFile.save();

        console.print('config:', 'done');
    }

    /**
     * Remove the given section from the configuration file.
     * @param {string} name 
     */
    async remove(name) {
        const type = this.type;

        if (!name) {
            console.print('Usage: remove <section-name>\n');
            console.print(`从配置文件(${type})中删除指定的分组\n`);
            return;
        }

        const configFile = await config.load(type);
        configFile.removeSection(name);
        await configFile.save();

        console.print('config:', 'done');
    }

    /** 
     * 修改参数值
     * @param {string[]} values 
     */
    async set(...values) {
        const type = this.type;

        if (!values[0]) {
            console.print('Sets each of the config keys to the value provided.\n');
            console.print(`usage: ${$context.name} set <key>=<value> [<key>=<value>...]\n`);
            return;
        }

        const configFile = await config.load(type);

        const data = {};
        for (const value of values) {
            const pos = value.indexOf('=');
            if (pos > 0) {
                const name = value.substring(0, pos);
                data[name] = value.substring(pos + 1);
            }
        }

        // console.log('data:', data);
        if (configFile.set(data)) {
            console.print('saved.');
            await configFile.save();
            return true;
        }
    }

    /** 
     * Remove the line matching the key from config file.
     * 删除参数值
     * @param {string[]} names 
     */
    async unset(...names) {
        const type = this.type;

        if (!names[0]) {
            console.print('Delete the specified keys from configuration file.\n');
            console.print(`usage: ${$context.name} unset <key> [<key>...]\n`);
            return;
        }

        const configFile = await config.load(type);

        let flags = 0;
        for (const name of names) {
            if (configFile.removeItem(name)) {
                flags++;
            }
        }

        if (flags) {
            console.print('saved.');
            await configFile.save();
            return true;
        }
    }
}

/**
 * 返回指定类型的命令列表
 * @param {string} type
 */
export function command(type) {
    const commands = new ConfigCommands(type);
    return {
        title: commands.title,
        subtitle: commands.subtitle,
        commands: {
            export: (filename) => commands.export(filename),
            get: (...args) => commands.get(...args),
            list: () => commands.list(),
            import: (filename) => commands.import(filename),
            load: (...args) => commands.load(...args),
            set: (...values) => commands.set(...values),
            rename: (oldName, newName) => commands.rename(oldName, newName),
            remove: (name) => commands.remove(name),
            unset: (...names) => commands.unset(...names)
        }
    };
}

/**
 * 执行子命令
 * @param {{ commands: {[key: string]: function}, title: string, subtitle: any}} command
 * @param {string} [type] 类型
 * @param {string} [name] 命令名
 * @param {...any} args 命令参数
 */
export function execute(command, type, name, ...args) {
    const subcommand = find(command.commands, name);
    if (subcommand) {
        return subcommand.value(...args);
    }

    // Title
    if (command.title) {
        console.print(command.title, '\n');
    }

    // Usage
    const colors = console.colors.bright;
    if (name) {
        console.print(`${$context.name} ${type}: '${name}': command not found`, '\n');

    } else {
        console.print(colors.white('Usage:'), '\n');
        console.print(`  ${$context.name} ${type} <command> [arguments]\n`);
    }

    // Names
    const names = [];
    let maxLength = 1;
    for (const key in command.commands) {
        names.push(key);

        if (maxLength < key.length) {
            maxLength = key.length;
        }
    }

    // Commands
    const messages = command.subtitle || {};
    if (names.length) {
        console.print(colors.white('Commands:'), '\n');
        names.sort().forEach((name) => {
            console.print(' ', colors.green(name.padEnd(maxLength, ' ')), '', messages[name] || '');
        });

        console.print('');
    }

    return false;
}

/**
 * 查找指定名称或者名称前缀的值
 * - 当多个属性前缀相同时，将返回第一个找到的值
 * @param {Object<string,any>=} names 要查询的对象
 * @param {string=} name 要查询的属性的名称或者前缀
 * @return {{name: string, value: any} | undefined}
 */
export function find(names, name) {
    if (!names || !name) {
        return;
    }

    const value = names[name];
    if (value != null) {
        return { name, value };
    }

    for (const key in names) {
        if (key.startsWith(name)) {
            return { name: key, value: names[key] };
        }
    }
}

/**
 * 显示帮助信息
 * @param {*} $commands 
 * @param {*=} details
 */
export function help($commands, details) {
    const colors = console.colors.bright;

    // Usage
    console.print(colors.white('Usage:'), '\n');

    let appname = '';
    if ($context.name != 'tjs') {
        appname = $context.name + ' ';
    }

    console.print(`  tjs ${appname}<command> [arguments]`);
    console.print(`  tjs ${appname}<command> <subcommand> [arguments]\n`);

    // Commands
    console.print(colors.white('Commands:'), '\n');

    if ($commands.commands) {
        const commands = Object.keys($commands.commands);
        if (commands.length) {
            console.print(' ', commands.sort().join(', '));
        }
    }

    // Manage commands
    if ($commands.subcommands) {
        const commands = Object.keys($commands.subcommands).sort();
        if (!commands.length) {
            console.print('');
            return;
        }

        if (!details) {
            console.print(' ', colors.cyan(commands.join(', ')));
            console.print('');
            return;
        }

        // Max length
        let maxLength = 1;
        for (const key of commands) {
            if (maxLength < key.length) {
                maxLength = key.length;
            }
        }

        // Details
        console.print('');
        commands.forEach((name) => {
            const command = $commands.subcommands[name];
            const message = command?.title;
            console.print(' ', colors.green(name.padEnd(maxLength, ' ')), '', message || '');
        });
    }

    console.print('');
}

/**
 * 加载默认参数值
 * @param {string} [type] 
 * @param {string} [flags] 
 */
export async function load(type, flags) {
    if (type == 'network') {
        const commands = new ConfigCommands(type);
        commands.loadNetworkDefault(flags);

    } else if (type == 'user') {
        const commands = new ConfigCommands(type);
        commands.loadUserDefault(flags);

    } else {
        console.print(`Load ${type} default settings\n\n`);
    }
}

// ////////////////////////////////////////////////////////////////////////////
// CLI

/**
 * 返回指定的脚本所属的应用的名称
 * - :app
 * - /path/to/:app/app.js
 * @param {string} scriptPath 脚本路径
 * @returns {string}
 */
export function parseAppName(scriptPath) {
    if (!scriptPath) {
        return '';

    } else if (scriptPath.endsWith('/app.js')) {
        const dirname = path.dirname(scriptPath);
        return path.basename(dirname);

    } else {
        return path.basename(scriptPath, '.js');
    }
}

/**
 * 运行命令行指令
 * @param {Commands} commands 命令列表
 * @param {string} [execPath]
 * @param {string} [scriptPath]
 * @param {string} [name] 命令名
 * @param {...any} args 命令参数
 */
export function run(commands, execPath, scriptPath, name, ...args) {
    if (scriptPath) {
        $context.name = parseAppName(scriptPath);
    }

    if (!name) {
        if (commands.title) {
            console.print(commands.title, '\n');
        }

        help(commands);
        return;
    }

    // sub-command
    if (commands.subcommands) {
        const result = find(commands.subcommands, name);
        if (result) {
            return execute(result.value, result.name, ...args);
        }
    }

    // top-command
    const result = find(commands.commands, name);
    if (result) {
        return result.value(...args);
        // return true;

    } else {
        console.print(`${$context.name}: '${name}': command not found`);
        return false;
    }
}

/**
 * @param {string|string[]} command
 * @returns 
 */
export async function shell(command) {
    try {
        if (typeof command == 'string') {
            command = command.split(' ');
        }

        const options = { stdout: 'pipe', stderr: 'pipe' };

        // console.log('exec', command);
        const subprocess = native.spawn(command, options);

        subprocess.stdout.onmessage = (data) => {
            if (data != null) {
                console.print(utf8.decode(data));
            }
        }

        subprocess.stderr.onmessage = (data) => {
            if (data != null) {
                console.print(utf8.decode(data));
            }
        }

        const result = await subprocess.wait();

        if (subprocess.stdout) {
            subprocess.stdout.onmessage = undefined;
        }

        if (subprocess.stderr) {
            subprocess.stderr.onmessage = undefined;
        }
        
        return result;

    } catch (err) {
        return { code: -1, stderr: err.message };
    }
}
