// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

import { EventTarget } from '@tjs/event-target';

/** @returns string[] */
function getProcessArgs() {
    const args = native.args; // 原始参数列表
    const arg0 = native.arg0; // 指向初始脚本

    const argv = [];
    argv.push(args[0]); // 指向可执行文件

    // 初始脚本运行参数
    for (let i = arg0; i < args.length; i++) {
        const value = args[i];
        argv.push(value);
    }

    return argv;
}

const $context = {
    eventTarget: new EventTarget()
};

// properties
export const arch = native.arch;
export const args = native.args;
export const argv = getProcessArgs();
export const command = native.command;
export const getegid = native.os.getegid;
export const geteuid = native.os.geteuid;
export const getgid = native.os.getgid;
export const getuid = native.os.getuid;
export const pid = native.os.pid();
export const platform = native.platform;
export const ppid = native.os.ppid();
export const root = native.root;
export const setegid = native.os.setegid;
export const seteuid = native.os.seteuid;
export const setgid = native.os.setgid;
export const setuid = native.os.setuid;
export const version = native.version;
export const versions = native.versions;

// methods
export const environ = native.environ;
export const execPath = native.exepath;
export const exepath = native.exepath;
export const exitCode = native.exitCode;
export const getenv = native.getenv;
export const kill = native.os.kill;
export const mainModule = native.scriptPath;
export const rss = native.os.rssmem;
export const scriptPath = native.scriptPath;
export const setenv = native.setenv;
export const signal = native.signal;
export const title = native.os.processTitle;
export const unsetenv = native.unsetenv;

/** @param {number} code */
export function exit(code) {
    if (code == null) {
        code = exitCode();
    }

    return native.exit(code);
}

export function addEventListener(type, listener, options) {
    $context.eventTarget?.addEventListener(type, listener, options);
}

export function removeEventListener(type, listener, options) {
    $context.eventTarget?.removeEventListener(type, listener, options);
}

export function onExit() {
    // console.print('proces.exit');
    $context.eventTarget.dispatchEvent(new Event('exit'));
    $context.eventTarget.removeAllEventListeners();
}

/** @returns {native.TTY} */
export function stdin() {
    if ($context.stdin) {
        return $context.stdin;
    }

    const fd = native.STDIN_FILENO;
    if (native.isatty(fd)) {
        native.print('process.stdin');
        $context.stdin = new native.TTY(fd);

    } else {
        $context.stdin = new native.Pipe();
        $context.stdin.open(fd);
    }

    return $context.stdin;
}

/** @returns {native.TTY} */
export function stdout() {
    if ($context.stdout) {
        return $context.stdout;
    }

    const fd = native.STDOUT_FILENO;
    if (native.isatty(fd)) {
        $context.stdout = new native.TTY(fd);

    } else {
        $context.stdout = new native.Pipe();
        $context.stdout.open(fd);
    }

    return $context.stdout;
}

/** @returns {native.TTY} */
export function stderr() {
    if ($context.stderr) {
        return $context.stderr;
    }

    const fd = native.STDERR_FILENO;
    if (native.isatty(fd)) {
        $context.stderr = new native.TTY(fd);

    } else {
        $context.stderr = new native.Pipe();
        $context.stderr.open(fd);
    }

    return $context.stderr;
}
