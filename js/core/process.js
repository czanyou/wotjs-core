// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

/** @param {any} process */
function setProcessArgs(process) {
    const args = native.args; // 原始参数列表
    const arg0 = native.arg0; // 指向初始脚本
    const applet = native.applet;

    const argv = [];
    argv.push(args[0]); // 指向可执行文件

    // 初始脚本运行参数
    for (let i = arg0; i < args.length; i++) {
        const value = args[i];
        argv.push(value);
    }

    process.argv = argv;
    if (applet) {
        process.applet = applet;
    }
}

const $context = {};

export const process = {
    // properties
    arch: native.arch,
    argv: native.args,
    pid: native.os.pid(),
    ppid: native.os.ppid(),
    root: native.root,
    version: native.version,
    versions: native.versions,
    platform: native.platform,
    SIGNAL: native.signals,

    // methods
    chdir: native.os.chdir,
    cwd: native.cwd,
    environ: native.environ,
    exepath: native.exepath,
    getenv: native.getenv,
    hrtime: native.hrtime,
    kill: native.os.kill,
    openlog: native.openlog,
    rss: native.os.rssmem,
    setenv: native.setenv,
    signal: native.signal,
    syslog: native.syslog,
    unsetenv: native.unsetenv,

    /** @param {number} code */
    exit(code) {
        if (code == null) {
            code = process.exitCode;
        }
        
        return native.exit(code);
    },

    /** @param {object} message */
    async send(message) {
        try {
            const stdout = process.stdout;

            if (!$context.util) {
                $context.util = await import('@tjs/util');
            }

            const util = $context.util;
            
            const data = util.encodeMessage(message);
            if (data != null) {
                stdout.write(data);
                return true;
            }

            return false;

        } catch (err) {
            return false;
        }
    },

    get title() {
        return native.os.processTitle();
    },

    /**
     * @param {string} title
     */
    set title(title) {
        native.os.processTitle(title);
    },

    get exitCode() {
        return native.exitCode();
    },

    /**
     * @param {number} exitCode
     */
    set exitCode(exitCode) {
        native.exitCode(exitCode);
    },

    get stdin() {
        if ($context.stdin) {
            return $context.stdin;
        }

        const fd = native.STDIN_FILENO;
        if (native.isatty(fd)) {
            $context.stdin = new native.TTY(fd, true);

        } else {
            $context.stdin = new native.Pipe();
            $context.stdin.open(fd);
        }

        return $context.stdin;
    },

    get stdout() {
        if ($context.stdout) {
            return $context.stdout;
        }

        const fd = native.STDOUT_FILENO;
        if (native.isatty(fd)) {
            $context.stdout = new native.TTY(fd, false);

        } else {
            $context.stdout = new native.Pipe();
            $context.stdout.open(fd);
        }

        return $context.stdout;
    },

    get stderr() {
        if ($context.stderr) {
            return $context.stderr;
        }

        const fd = native.STDERR_FILENO;
        if (native.isatty(fd)) {
            $context.stderr = new native.TTY(fd, false);

        } else {
            $context.stderr = new native.Pipe();
            $context.stderr.open(fd);
        }

        return $context.stderr;
    },

    get onmessage() {
        return $context.onmessage;
    },

    set onmessage(onmessage) {
        $context.onmessage = onmessage;
    }
};

setProcessArgs(process);

export default process;
