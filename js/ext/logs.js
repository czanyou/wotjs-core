// @ts-check
import * as native from '@tjs/native';
import * as fs from '@tjs/fs';

/** @param {number} [offset] */
function getFileLineNumber(offset) {
    const err = new Error();
    const stack = err.stack.split('\n');
    const line = stack[offset || 4];
    if (!line) {
        return '';
    }

    return line.trim();
}

const colors = console.colors.colors();
const startTag = colors.gray;

const startTags = {
    debug: colors.gray,
    info: colors.green,
    warn: colors.yellow,
    assert: colors.yellow,
    error: colors.red
};

const syslogLevels = {
    debug: 7,
    info: 6,
    warn: 4,
    assert: 4,
    error: 3
};

const endTag = colors.none;

export class Appender {
    get [Symbol.toStringTag]() {
        return 'Appender';
    }
}

export class SyslogAppender extends Appender {
    /** @param {string} category */
    constructor(category) {
        super();

        this.category = category;
    }

    get [Symbol.toStringTag]() {
        return 'SyslogAppender';
    }

    line() {
        return getFileLineNumber();
    }

    /**
     * @param {string} type 
     * @param  {...any} args 
     */
    log(type, ...args) {
        const line = getFileLineNumber();
        const message = console.format(...args);

        const level = syslogLevels[type] || 7;
        native.syslog(level, `${message} - ${line}`);

        console.print(`${message} - ${line}`);
    }
}

export class FileAppender extends Appender {
    /** @param {string} category */
    constructor(category) {
        super();

        this.category = category;
    }

    get [Symbol.toStringTag]() {
        return 'FileAppender';
    }

    line() {
        return getFileLineNumber();
    }

    /**
     * @param {string} type 
     * @param  {...any} args 
     */
    log(type, ...args) {
        const line = getFileLineNumber();
        const message = console.format(...args);
        native.print(message, `\n- ${type} ${line}`);
    }
}

export class TtyAppender extends Appender {
    /** @param {string} category */
    constructor(category) {
        super();

        this.category = category;
    }

    get [Symbol.toStringTag]() {
        return 'TtyAppender';
    }

    line() {
        return getFileLineNumber();
    }

    /**
     * @param {string} type 
     * @param  {...any} args 
     */
    log(type, ...args) {
        const tag = startTags[type] || startTag;
        const uptime = native.os.uptime();
        const line = getFileLineNumber();
        const message = console.format(...args);

        fs.writeFile('/dev/tty', `${message}\n${tag}- ${type} ${startTag}[${uptime}] ${line} ${endTag}`);
    }
}

export class ConsoleAppender extends Appender {
    /** @param {string} category */
    constructor(category) {
        super();

        this.category = category;
    }

    get [Symbol.toStringTag]() {
        return 'ConsoleAppender';
    }

    line() {
        return getFileLineNumber();
    }

    /**
     * @param {string} type 
     * @param {...any} args 
     */
    log(type, ...args) {
        const tag = startTags[type] || startTag;
        const uptime = native.os.uptime();
        const line = getFileLineNumber();
        const message = console.format(...args);
        native.print(message, `\n${tag}- ${type} ${startTag}[${uptime}] ${line} ${endTag}`);
    }
}

const $context = {
    level: 'debug',
    type: 'console',
    logs: {}
};

/** @param {any} config */
export function init(config) {
    if (!config) {
        return;
    }

    if (config.name) {
        $context.name = config.name;
        native.openlog(config.name);
    }

    if (config.level) {
        $context.level = config.level;
    }

    if (config.type) {
        $context.type = config.type;
    }
}

/** @param {string} category */
export function get(category) {
    let log = $context.logs[category];
    if (log) {
        return log;
    }

    if ($context.type == 'tty') {
        log = new TtyAppender(category);

    } else if ($context.type == 'syslog') {
        log = new SyslogAppender(category);

    } else if ($context.type == 'file') {
        log = new FileAppender(category);

    } else {
        log = new ConsoleAppender(category);
    }

    $context.logs[category] = log;
    return log;
}

export const Log = {
    init(config) {
        init(config);
    },
    d(tag, ...args) {
        const category = get(tag);
        category.log('debug', ...args);
    },
    i(tag, ...args) {
        const category = get(tag);
        category.log('info', ...args);
    },
    w(tag, ...args) {
        const category = get(tag);
        category.log('warn', ...args);
    },
    e(tag, ...args) {
        const category = get(tag);
        category.log('error', ...args);
    },
    tag(meta) {
        const url = meta && meta.url;
        if (!url) {
            return 'log';

        } else if (url.startsWith('file://')) {
            return url.substring(7);
        }

        return url;
    },
    test() {
        // @ts-ignore
        const tag = this.tag(import.meta);
        this.w(tag, tag);
    }
};

export default Log;
