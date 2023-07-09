// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as config from '@tjs/config';
import * as util from '@tjs/util';
import * as logs from '@tjs/logs';

const LOG_TYPES = {
    console: 1,
    syslog: 2,
    mqtt: 3
};

const LOG_LEVELS = {
    debug: 1,
    log: 2,
    info: 3,
    warn: 4,
    error: 5
};

/**
 * 读取设置
 * @param {string} name 
 * @returns 
 */
export async function getSettings(name) {
    const userConfig = await config.load('user');

    const type = userConfig.getString('log.type') || 'console';
    const level = userConfig.getString('log.level') || 'info';

    return { name, type, level };
}

/**
 * init
 * @param {string} name 
 * @returns 
 */
export async function init(name) {
    const options = await getSettings(name);
    logs.config(options);
}

/**
 * 打印日志
 * @param {number=} limit 
 * @param {string=} name 
 * @returns 
 */
export async function readLogs(limit, name) {
    /**
     * @param {string} line 
     */
    function parseLine(line) {
        const index = line.indexOf(': ');
        if (index <= 0) {
            return;
        }

        const header = line.substring(0, index);
        const tokens = header.split(' ');
        if (tokens.length <= 5) {
            return;
        }

        const result = { header };
        let offset = 0;

        // 1. date
        let date = tokens[offset++];
        if (!tokens[offset]) {
            offset++;
        }

        date += ' ' + tokens[offset++];
        result.date = date;

        // 2. time
        result.time = tokens[offset++];

        // 3. hostname
        result.hostname = tokens[offset++];

        // 4. process
        let process = tokens[tokens.length - 1];
        const end = process.indexOf('[');
        if (end > 0) {
            result.pid = Number.parseInt(process.substring(end + 1));
            process = process.substring(0, end);
        }

        // 5.message
        result.message = line.substring(index + 2);

        result.process = process;
        return result;
    }

    limit = limit || 20;
    let filename = '/var/log/syslog';
    if (!await fs.exists(filename)) {
        filename = '/var/log/messages';
        if (!await fs.exists(filename)) {
            return;
        }
    }

    const MAX_SIZE = 64 * 1024;

    // file size
    const statInfo = await fs.stat(filename);

    const size = statInfo.size;
    const mtime = statInfo.mtime;
    const lines = [];
    const result = { filename, limit, name, size, mtime, lines };

    /** @type fs.FileHandle | undefined */
    let file;

    try {
        // 读取最后 64KB
        file = await fs.open(filename, 'r');
        let size = statInfo.size;
        let position = 0;
        if (size > MAX_SIZE) {
            position = size - MAX_SIZE;
            size = MAX_SIZE;
        }

        const data = await file.read(size, position);
        const filedata = util.toString(data);

        let offset = filedata.length;

        // 读取最后 N 行
        let count = 0;
        while (true) {
            const pos = filedata.lastIndexOf('\n', offset - 1);
            if (pos <= 0) {
                break;
            }

            // `Dec  2 17:17:01 linaro-alip CRON[8262]: `
            const line = filedata.substring(pos + 1, offset);
            const item = parseLine(line);
            if (item) {
                if (!name || item.process?.startsWith(name)) {
                    count++;
                    lines.push(item);
                }
            }

            offset = pos;

            if (count >= limit) {
                break;
            }
        }

        result.lines = lines.reverse();

        // 打印

    } finally {
        file?.close();
    }

    return result;
}

/**
 * 打印日志
 * @param {number=} limit 
 * @param {string=} name 
 * @returns 
 */
export async function printLogs(limit, name) {
    const result = await readLogs(limit, name);
    if (!result) {
        return;
    }

    const lines = result.lines;
    const fileSize = util.format.stringify(result.size, 'bytes');
    console.print(`logs: ${result.filename}, ${fileSize}\n`);

    // item.date + ' ' + item.process + item.message
    // console.print(lines, '\n');
    const colors = console.colors;
    for (const line of lines) {
        const header = `${line.date} ${line.time} ${line.process}:`;
        console.print(colors.bright.black(header), line.message);
    }
}

/**
 * 保存设置
 * @param {string=} name 
 * @param {string=} value 
 * @returns 
 */
export async function setSettings(name, value) {
    const userConfig = await config.load('user');
    if (value == null) {
        const data = {
            type: userConfig.getString('log.type') || 'console',
            level: userConfig.getString('log.level') || 'info'
        };

        const colors = console.colors;
        console.print('Current', name + ':', colors.blue(data[name]), '\n');
        return;
    }

    if (name == 'type') {
        if (LOG_TYPES[value] != null) {
            userConfig.setItem('log.type', value);

        } else {
            console.print('Invalid log type: ' + value, '\n');
        }

    } else if (name == 'level') {
        if (LOG_LEVELS[value] != null) {
            userConfig.setItem('log.level', value);

        } else {
            console.print('Invalid log level: ' + value, '\n');
        }
    }

    await userConfig.save();
}

/**
 * CLI 命令列表
 */
const commands = {
    /** 
     * 查看日志
     * @param {string=} limit 行数
     * @param {string=} process 进程名
     */
    async cat(limit, process) {
        if (!limit) {
            console.print('Usage: tpm log cat <limit> <process>\n');
        }

        await printLogs(Number(limit), process);
    },

    /** 
     * 日志输出级别
     * @param {string=} level 
     */
    async level(level) {
        if (!level) {
            console.print('Usage: tpm log level <debug|log|info|warn|error>', '\n');
        }

        await setSettings('level', level);
    },

    /** 
     * 日志输出方式
     * @param {string=} type 
     */
    async type(type) {
        if (!type) {
            console.print('Usage: tpm log type <console|syslog|mqtt>', '\n');
        }

        await setSettings('type', type);
    }
};

export const command = {
    title: '管理日志',
    subtitle: {
        cat: '查看历史日志',
        level: '日志输出级别',
        type: '日志输出方式'
    },
    commands
};
