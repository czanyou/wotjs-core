// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

/**
 * Syslog 日志优先级别
 */
export const SYSLOG_LEVELS = {
    debug: 7, // 调试信息
    d: 7,
    l: 7,
    info: 6, // 有用的信息
    i: 6,
    notice: 5, // 普通但重要的事件
    assert: 5,
    a: 5,
    warn: 4, // 警告事件
    w: 4,
    error: 3, // 错误事件
    e: 3,
    crit: 2, // 关键的事件
    alert: 1, // 必须马上采取行动的事件
    emerg: 0 // 系统不可用
};

const $context = {
    options: {
        /** 进程名，syslog 输出时会用到 */
        name: 'tjs',

        /** 输出级别，暂时没有用到 */
        level: 'debug',

        /** 输出方式，支持 console 和 syslog */
        type: 'console'
    }
};

export const syslog = {
    log: native.syslog,
    open: native.openlog
};

/**
 * 输出日志信息到 syslog
 * @param {string} level 日志级别: `d`,`l`,`i`,`w`,`e`,`a`
 * @param {string} line 源代码行号信息
 * @param  {...any} args 
 */
export function printSyslog(level, line, ...args) {
    const message = console.inspect(false, ...args);
    const syslogLevel = SYSLOG_LEVELS[level] || 7;
    // console.print('printSyslog:', syslogLevel, message, line);
    native.syslog(syslogLevel, message);

    // @ts-ignore
    console.printConsole(level, line, ...args);
    return true;
}

/**
 * 启用 syslog
 * - 将 console 日志重定向到 syslog
 */
export function openSyslog() {
    native.openlog($context.options.name);

    // @ts-ignore 注入 syslog 到 console 对象
    window.console.onPrintLog = printSyslog;
}

export function openConsole() {
    // @ts-ignore 注入 syslog 到 console 对象
    window.console.onPrintLog = console.printConsole;
}

/** 
 * 配置日志输出
 * - 支持输出日志信息到 console 或 syslog
 * - 当输出到 syslog 时可指定进程名称
 * @param {any} config 
 */
export function config(config) {
    if (!config) {
        return { ...$context.options };
    }

    if (config.name) {
        $context.options.name = config.name;
    }

    if (config.level) {
        $context.options.level = config.level;
    }

    if (config.type) {
        $context.options.type = config.type;
    }

    if ($context.options.type == 'syslog') {
        openSyslog();

    } else if ($context.options.type == 'console') {
        openConsole();
    }

    return { ...$context.options };
}
