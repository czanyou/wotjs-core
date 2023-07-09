// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as util from '@tjs/util';
import * as os from '@tjs/os';
import * as fs from '@tjs/fs';
import * as process from '@tjs/process';

/**
 * 供 CLI 调用的命令接口
 */
const commands = {
    bin() {
        return console.print(navigator.root + 'bin/');
    },
    
    colors() {
        const names = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

        // eslint-disable-next-line no-undef

        function printColors(style) {
            for (const name of names) {
                const func = style[name];
                // console.log(name, style, func);
                console.write(func(` ${name} `) + ' ');
            }
            console.write('\n');
        }

        let style = console.colors.background;
        printColors(style);

        style = console.colors;
        printColors(style);

        style = console.colors.bright;
        printColors(style);
    },

    environ() {
        console.print('Environ:');
        return console.table(Object.assign({}, process.environ()));

    },

    async errors() {
        const native = await import('@tjs/native');
        console.print('Errors:');
        return console.table(Object.assign({}, native.errors));

    },

    info() {
        const info = {
            arch: os.arch,
            bin: navigator.root + 'bin/',
            board: navigator.board,
            platform: os.platform,
            root: navigator.root,
            version: process.version
        };

        console.print('Info:');
        console.table(info);
    },

    navigator() {
        const info = {
            board: navigator.board,
            language: navigator.language,
            languages: navigator.languages,
            onLine: navigator.onLine,
            root: navigator.root,
            userAgent: navigator.userAgent,
            vendor: navigator.vendor
        };

        console.print('Navigator:');
        return console.table(info);
    },

    os() {
        const info = Object.assign({
            arch: os.arch,
            board: os.board,
            cwd: os.cwd(),
            freemem: util.format.stringify(os.freemem(), 'bytes', 1),
            homedir: os.homedir(),
            hostname: os.hostname(),
            hrtime: os.hrtime() / 1000000n,
            isatty: os.isatty(0),
            loadavg: os.loadavg(),
            platform: os.platform,
            time: Date.now(),
            tmpdir: os.tmpdir(),
            totalmem: util.format.stringify(os.totalmem(), 'bytes', 1),
            uptime: util.format.stringify(os.uptime() * 1000, 'time', 2)
        }, os.uname());

        console.print('OS:');
        return console.table(info);
    },

    process() {
        const info = {
            argv: process.argv,
            args: process.args,
            command: process.command,
            execPath: process.execPath(),
            scriptPath: process.scriptPath(),
            pid: process.pid,
            ppid: process.ppid,
            rss: util.format.stringify(process.rss(), 'bytes', 1),
            title: process.title(),
            version: process.version
        };

        console.print('Process:');
        return console.table(info);
    },

    async root() {
        console.print('Root:');

        /** @type any */
        const statInfo = Object.assign({ root: navigator.root }, await fs.statfs(navigator.root));
        statInfo.total = util.format.stringify(statInfo.blocks * statInfo.bsize, 'bytes');
        statInfo.available = util.format.stringify(statInfo.bavail * statInfo.bsize, 'bytes');
        statInfo.used = Math.round((statInfo.blocks - statInfo.bavail) * 100 / statInfo.blocks) + '%';
        return console.table(statInfo);

    },

    signals() {
        console.print('Signals:');
        return console.table(Object.assign({}, os.signals));

    },

    versions() {
        console.print('Versions:');
        console.table(process.versions);
    }
};

export const command = {
    title: '打印运行环境信息',
    subtitle: {
        bin: '运行目录',
        colors: '显示颜色',
        environ: '环境变量',
        errors: '错误信息',
        info: '基本信息',
        navigator: '容器信息',
        os: '操作系统',
        process: '进程信息',
        root: '根目录信息',
        signals: '信号列表',
        versions: '版本信息'
    },
    commands
};
