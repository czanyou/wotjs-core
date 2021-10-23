// @ts-check
import * as native from '@tjs/native';

export const NAMES = {
    black: '0',
    red: '1',
    green: '2',
    yellow: '3',
    blue: '4',
    magenta: '5',
    cyan: '6',
    white: '7'
};

/* eslint-disable valid-typeof */
const COLORS = {
    none: '\x1b[0m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[30;1m', // alies
    grey: '\x1b[30;1m', // alies
    bright_black: '\x1b[30;1m',
    bright_red: '\x1b[31;1m',
    bright_green: '\x1b[32;1m',
    bright_yellow: '\x1b[33;1m',
    bright_blue: '\x1b[34;1m',
    bright_magenta: '\x1b[35;1m',
    bright_cyan: '\x1b[36;1m',
    bright_white: '\x1b[37;1m',
    bg_grey: '\x1b[0;40m',
    bg_black: '\x1b[0;40m',
    bg_red: '\x1b[37;41m',
    bg_green: '\x1b[30;42m',
    bg_yellow: '\x1b[30;43m',
    bg_blue: '\x1b[30;44m',
    bg_magenta: '\x1b[37;45m',
    bg_cyan: '\x1b[30;46m',
    bg_white: '\x1b[30;47m'
};

function getColorFormatter(style) {
    return {
        black(text) {
            return style('black', text);
        },

        red(text) {
            return style('red', text);
        },

        green(text) {
            return style('green', text);
        },

        yellow(text) {
            return style('yellow', text);
        },

        blue(text) {
            return style('blue', text);
        },

        magenta(text) {
            return style('magenta', text);
        },

        cyan(text) {
            return style('cyan', text);
        },

        white(text) {
            return style('white', text);
        }
    };
}

export class Colors {
    constructor() {
        this.styles = {};
    }

    get bright() {
        function brightStyle(color, text) {
            color = COLORS['bright_' + color];
            if (color == null) {
                return text;
            }

            return color + text + COLORS.none;
        }

        return getColorFormatter(brightStyle);
    }

    get background() {
        function backgroundStyle(color, text) {
            color = COLORS['bg_' + color];
            if (color == null) {
                return text;
            }

            return color + text + COLORS.none;
        }

        return getColorFormatter(backgroundStyle);
    }

    colors() {
        return COLORS;
    }

    style(color, text) {
        color = COLORS[color];
        if (color == null) {
            return text;
        }

        return color + text + COLORS.none;
    }

    black(text) {
        return this.style('black', text);
    }

    red(text) {
        return this.style('red', text);
    }

    green(text) {
        return this.style('green', text);
    }

    yellow(text) {
        return this.style('yellow', text);
    }

    blue(text) {
        return this.style('blue', text);
    }

    magenta(text) {
        return this.style('magenta', text);
    }

    cyan(text) {
        return this.style('cyan', text);
    }

    white(text) {
        return this.style('white', text);
    }
}

/** 
 * @param {boolean} mode 
 * @param {any[]} args 
 */
function format(mode, ...args) {
    // native.print(args);

    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.
    //
    // https://github.com/joyent/node/blob/master/lib/util.js

    const formatRegExp = /%[sdj%]/g;

    function formatValues(...args) {
        // native.print('formatValues', args);

        const f = args[0];
        if (!isString(f)) {
            const objects = [];
            for (let i = 0; i < args.length; i++) {
                objects.push(inspect(args[i], {}));
            }
            return objects.join(' ');
        }

        let i = 1;
        // const args = arguments;
        const len = args.length;
        let str = String(f).replace(formatRegExp, function (x) {
            if (x === '%%') return '%';
            if (i >= len) return x;
            switch (x) {
                case '%s': return String(args[i++]);
                case '%d': return String(args[i++]);
                case '%j':
                    try {
                        return JSON.stringify(args[i++]);
                    } catch (_) {
                        return '[Circular]';
                    }
                default:
                    return x;
            }
        });

        for (let x = args[i]; i < len; x = args[++i]) {
            if (isNull(x) || !isObject(x)) {
                str += ' ' + x;
            } else {
                str += ' ' + inspect(x, {});
            }
        }

        return str;
    }

    // eslint-disable-next-line no-unused-vars
    function stylizeNoColor(str, styleType) {
        return str;
    }

    function stylizeColor(str, styleType) {
        const colors = {
            name: COLORS.green,
            number: COLORS.yellow,
            special: COLORS.cyan,
            boolean: COLORS.blue,
            undefined: COLORS.red,
            regexp: COLORS.bright_red,
            date: COLORS.bright_green,
            null: COLORS.magenta
        };

        const color = colors[styleType];
        if (!color) {
            return str;
        }

        return color + str + COLORS.none;
    }

    let stylize = stylizeNoColor;
    if (mode) {
        stylize = stylizeColor;
    }

    function inspect(obj, options) {
        const ctx = { seen: [], stylize: stylize };

        return formatValue(ctx, obj, options.depth);
    }

    function arrayToHash(array) {
        const hash = {};

        array.forEach(function (val, index) {
            hash[val] = true;
        });

        return hash;
    }

    function formatValue(ctx, value, recurseTimes) {
        // Primitive types cannot have properties
        const primitive = formatPrimitive(ctx, value);
        if (primitive) {
            return primitive;

        } else if (isError(value)) {
            return formatError(value);
        }

        // Look up the keys of the object.
        const keys = Object.keys(value);

        // Some type of object without properties can be shortcutted.
        if (keys.length === 0) {
            if (isFunction(value)) {
                const name = value.name ? ': ' + value.name : '';
                return ctx.stylize('[Function' + name + ']', 'special');

            } else if (isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');

            } else if (isDate(value)) {
                return ctx.stylize(Date.prototype.toString.call(value), 'date');

            } else if (isError(value)) {
                return formatError(value);
            }
        }

        let base = '';
        let array = false;
        let braces = ['{', '}'];

        if (isArray(value)) {
            // Make Array say that they are Array
            array = true;
            braces = ['[', ']'];

        } else if (isFunction(value)) {
            // Make functions say that they are functions
            const n = value.name ? ': ' + value.name : '';
            base = ' [Function' + n + ']';

        } else if (isRegExp(value)) {
            // Make RegExps say that they are RegExps
            base = ' ' + RegExp.prototype.toString.call(value);

        } else if (isDate(value)) {
            // Make dates with properties first say the date
            base = ' ' + Date.prototype.toUTCString.call(value);

        } else if (isError(value)) {
            // Make error with message first say the error
            base = ' ' + formatError(value);
        }

        // Class name
        let prefix = '';
        const className = getClassName(value);
        if (className) {
            if (className != 'Object' && className != 'Array') {
                prefix = ctx.stylize(className, 'special') + ' ';
            }
        }

        // empty object
        if (keys.length === 0 && (!array || value.length == 0)) {
            return prefix + braces[0] + base + braces[1];
        }

        if (recurseTimes < 0) {
            if (isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
            } else {
                return ctx.stylize('[Object]', 'special');
            }
        }

        ctx.seen.push(value);

        let output;
        if (array) {
            // array
            const visibleKeys = arrayToHash(keys);
            output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);

        } else {
            // object
            const visibleKeys = arrayToHash(keys);
            output = keys.map(function (key) {
                return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
            });
        }

        ctx.seen.pop();

        return prefix + reduceToSingleString(output, base, braces);
    }

    function formatPrimitive(ctx, value) {
        if (isUndefined(value)) {
            return ctx.stylize('undefined', 'undefined');

        } else if (isString(value)) {
            const simple =
                "'" +
                JSON.stringify(value)
                    .replace(/^"|"$/g, '')
                    .replace(/'/g, "\\'")
                    .replace(/\\"/g, '"') +
                "'";
            return ctx.stylize(simple, 'string');

        } else if (isNumber(value)) {
            if (value == 0) {
                if (1 / value < 0) { value = '-0'; } else { value = '0'; }
            }
            return ctx.stylize('' + value, 'number');

        } else if (isBoolean(value)) {
            return ctx.stylize('' + value, 'boolean');

        } else if (isNull(value)) {
            // For some reason typeof null is "object", so special case here.
            return ctx.stylize('null', 'null');

        } else if (isBigInt(value)) {
            return ctx.stylize('' + value + 'n', 'bigint');

        } else if (isBigFloat(value)) {
            return ctx.stylize('' + value + 'l', 'bigfloat');

        } else if (value instanceof ArrayBuffer) {
            return ctx.stylize(getClassName(value), 'special') + ` { byteLength: ${value.byteLength} }`;

        } else if (ArrayBuffer.isView(value)) {
            return ctx.stylize(getClassName(value), 'special') + ` { byteOffset: ${value.byteOffset}, byteLength: ${value.byteLength} }`;
        }
    }

    function formatError(error) {
        let text = Error.prototype.toString.call(error);
        if (error.errno) {
            text += ` (${error.errno})`;
        }

        if (error.stack) {
            text += '\n';
            text += error.stack;
        }

        return text;
    }

    function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
        const output = [];

        for (let i = 0, l = value.length; i < l; ++i) {
            if (hasOwnProperty(value, String(i))) {
                output.push(
                    formatProperty(
                        ctx,
                        value,
                        recurseTimes,
                        visibleKeys,
                        String(i),
                        true
                    )
                );

            } else {
                output.push('');
            }
        }

        keys.forEach(function (key) {
            if (!key.match(/^\d+$/)) {
                output.push(
                    formatProperty(ctx, value, recurseTimes, visibleKeys, key, true)
                );
            }
        });

        return output;
    }

    function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
        let name, str;
        const desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
        if (desc.get) {
            if (desc.set) {
                str = ctx.stylize('[Getter/Setter]', 'special');

            } else {
                str = ctx.stylize('[Getter]', 'special');
            }

        } else {
            if (desc.set) {
                str = ctx.stylize('[Setter]', 'special');
            }
        }

        if (!hasOwnProperty(visibleKeys, key)) {
            name = '[' + key + ']';
        }

        if (!str) {
            if (ctx.seen.indexOf(desc.value) < 0) {
                if (isNull(recurseTimes)) {
                    str = formatValue(ctx, desc.value, null);

                } else {
                    str = formatValue(ctx, desc.value, recurseTimes - 1);
                }

                if (str.indexOf('\n') > -1) {
                    if (array) {
                        str = str
                            .split('\n')
                            .map(function (line) {
                                return '  ' + line;
                            })
                            .join('\n')
                            .substring(2);
                    } else {
                        str =
                            '\n' +
                            str
                                .split('\n')
                                .map(function (line) {
                                    return '   ' + line;
                                })
                                .join('\n');
                    }
                }

            } else {
                str = ctx.stylize('[Circular]', 'special');
            }
        }

        if (isUndefined(name)) {
            if (array && key.match(/^\d+$/)) {
                return str;
            }

            name = JSON.stringify('' + key);
            if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                name = name.substring(1, name.length - 1);
                name = ctx.stylize(name, 'name');

            } else {
                name = name
                    .replace(/'/g, "\\'")
                    .replace(/\\"/g, '"')
                    .replace(/(^"|"$)/g, "'");
                name = ctx.stylize(name, 'string');
            }
        }

        return name + ': ' + str;
    }

    /**
     * @param {any[]} output 
     * @param {string} base 
     * @param {string[]} braces 
     * @returns 
     */
    function reduceToSingleString(output, base, braces) {
        const length = output.reduce(function (prev, current) {
            return prev + current.replace(/\u001b\[\d\d?m/g, '').length + 1;
        }, 0);

        if (length > 60) {
            base = (base === '' ? '' : base + '\n ');
            return braces[0] + base + ' ' + output.join(',\n  ') + ' ' + braces[1];
        }

        return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    // NOTE: These type checking functions intentionally don't use `instanceof`
    // because it is fragile and can be easily faked with `Object.create()`.
    function isArray(arg) {
        return Array.isArray(arg);
    }

    function isBigInt(arg) {
        return typeof arg === 'bigint';
    }

    function isBigFloat(arg) {
        // @ts-ignore
        return typeof arg === 'bigfloat';
    }

    function isBoolean(arg) {
        return typeof arg === 'boolean';
    }

    function isNull(arg) {
        return arg === null;
    }

    // eslint-disable-next-line no-unused-vars
    function isNullOrUndefined(arg) {
        return arg == null;
    }

    function isNumber(arg) {
        return typeof arg === 'number';
    }

    function isString(arg) {
        return typeof arg === 'string';
    }

    // eslint-disable-next-line no-unused-vars
    function isSymbol(arg) {
        return typeof arg === 'symbol';
    }

    function isUndefined(arg) {
        // eslint-disable-next-line no-void
        return arg === void 0;
    }

    function isRegExp(re) {
        return isObject(re) && objectToString(re) === '[object RegExp]';
    }

    function isObject(arg) {
        return typeof arg === 'object' && arg !== null;
    }

    function isDate(d) {
        return isObject(d) && objectToString(d) === '[object Date]';
    }

    function isError(e) {
        return (isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error));
    }

    function isFunction(arg) {
        return typeof arg === 'function';
    }

    function objectToString(o) {
        return Object.prototype.toString.call(o);
    }

    function getClassName(o) {
        const objectName = objectToString(o);
        if (objectName.startsWith('[object ')) {
            return objectName.substring(8, objectName.length - 1);
        }
    }

    function hasOwnProperty(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
    }

    return formatValues(...args);
}

function stringWidth(value) {
    value = String(value);

    let width = 0;
    for (const char of value) {
        const code = char.codePointAt(0);
        width += (code >= 0x2E80) ? 2 : 1;
    }

    return width;
}

/** @param {any[]} args */
function print(...args) {
    native.print(format(true, ...args));
}

/** @param {any[]} args */
function alert(...args) {
    native.alert(format(true, ...args));
}

/**
 * 打印表格
 * @param {object|Array|Map|Set} data 
 * @param {string[]} properties 
 * @param {string} title 
 */
function printTable(data, properties, title) {

    // Copyright Joyent, Inc. and other Node contributors. MIT license.
    // Forked from Node's lib/internal/cli_table.js

    // eslint-disable-next-line no-unused-vars
    function hasOwnProperty(object, value) {
        if (object == null) {
            return false;
        }

        return Object.prototype.hasOwnProperty.call(object, value);
    }

    /**
     * 
     * @param {string} value 
     * @returns {number}
     */
    function getBytesWidth(value) {
        return (value && stringWidth(value)) || 0;
    }

    /**
     * 
     * @param {string[]} row 
     * @param {number[]} columnWidths 
     * @returns {string}
     */
    function formatTableRow(row, columnWidths) {
        let out = ' ';
        for (let i = 0; i < row.length; i++) {
            const cell = row[i] || '-';
            const columnWidth = columnWidths[i];
            const padWidth = columnWidth - getBytesWidth(cell);

            out += cell;
            if (padWidth > 0) {
                out += ' '.repeat(padWidth);
            }

            if (i < row.length - 1) {
                out += '  ';
            }
        }

        return out;
    }

    /**
     * 
     * @param {string[]} header 
     * @param {any[][]} rows 
     * @returns 
     */
    function formatTable(header, rows) {
        const columnWidths = header.map((cell) => getBytesWidth(cell));
        const maxWidth = 56;

        /** @type {string[][]} table body */
        const body = [];
        for (const row of rows) {
            const values = [];
            for (const cell of row) {
                let value = formatValue(cell);
                const index = values.length;
                if (value) {
                    if (value.length > maxWidth) {
                        value = value.substring(0, maxWidth) + '..';
                    }

                    const cellWidth = getBytesWidth(value);
                    if (columnWidths[index] < cellWidth) {
                        columnWidths[index] = cellWidth;
                    }
                }

                values.push(value);
            }

            body.push(values);
        }

        // table header
        let result = '';

        for (let i = 0; i < header.length; i++) {
            header[i] = header[i].toUpperCase();
        }

        result += COLORS.gray;
        result += formatTableRow(header, columnWidths);
        result += COLORS.none + '\n';

        // table body
        for (const row of body) {
            result += `${formatTableRow(row, columnWidths)}\n`;
        }

        return result;
    }

    /** @param {any} value */
    function formatValue(value) {
        if (value == null) {
            return null;

        } else if (typeof value == 'object') {
            return JSON.stringify(value);

        } else {
            return String(value);
        }
    };

    // data to array

    /** 
     * @param {IterableIterator<[string, any]>|[string, any][]} entries1 
     * @param {IterableIterator<[string, any]>|[string, any][]} entries2 
     */
    function formatArray(entries1, entries2) {
        /** @type string[] */
        const header = [];

        /** @type string[][] */
        const body = [];

        // key set for all cells
        const keys = new Set();
        let hasObject = false;
        for (const [, entry] of entries1) {
            if (entry && (typeof entry == 'object')) {
                const entryKeys = Object.keys(entry);
                for (const key of entryKeys) {
                    keys.add(key);
                }

                hasObject = true;

            } else {
                keys.add('@value');
            }
        }

        // string table
        if (!hasObject) {
            header.push('index', 'value');
            let index = 0;
            for (const [, entry] of entries2) {
                body.push([index++, entry]);
            }

            return { header, body };
        }

        // object table
        for (const key of keys.keys()) {
            header.push(key);
        }

        header.sort();

        for (const [, entry] of entries2) {
            const isObject = (entry && (typeof entry == 'object'));
            const row = [];
            for (const key of header) {
                if (isObject) {
                    row.push(entry[key]);

                } else {
                    if (key == '@value') {
                        row.push(entry);

                    } else {
                        row.push(null);
                    }
                }
            }

            body.push(row);
        }

        return { header, body };
    }

    /** @param {IterableIterator<[string, any]>|[string, any][]} entries */
    function formatObject(entries) {
        /** @type string[] */
        const header = [];

        /** @type string[][] */
        const body = [];

        header.push('key', 'value');
        for (const [key, value] of entries) {
            body.push([key, value]);
        }

        return { header, body };
    }

    let table = {};
    if (data instanceof Set) {
        table = formatArray(data.entries(), data.entries());

    } else if (Array.isArray(data)) {
        table = formatArray(Object.entries(data), Object.entries(data));

    } else if (data instanceof Map) {
        table = formatObject(data.entries());

    } else {
        table = formatObject(Object.entries(data));
    }

    print(formatTable(table.header, table.body));
}

/**
 * @param {number} now 
 */
function formatTime(now) {
    let value = Math.floor(now / 60);
    let time = (now % 60).toFixed(3);
    if (value > 0) {
        time = String(Math.floor(value % 60)).padStart(2, '0') + ':' + time;
    }

    value = value / 60;
    if (value > 0) {
        time = String(Math.floor(value)) + ':' + time;
    }

    return time;
}

/**
 * @param {string} type 
 * @param {string} lineNumber 
 * @param {any[]} args 
 */
function printLog(type, lineNumber, ...args) {
    let printf = print;
    let start = COLORS.gray;
    if (type == 'I') {
        start = COLORS.green;

    } else if (type == 'W' || type == 'A') {
        start = COLORS.yellow;
        printf = alert;

    } else if (type == 'E') {
        start = COLORS.red;
        printf = alert;
    }

    const gray = COLORS.gray;
    const none = COLORS.none;
    const now = native.os.uptime();

    printf(`${start}[${formatTime(now)}]${none} ${format(true, ...args)}\n${gray} ${lineNumber}${none}`);
}

function getFileLine() {
    const error = new Error();
    const stack = error.stack.split('\n');
    const line = stack[2] || '';
    return line.trim();
}

class Console {
    constructor() {
        this.colors = new Colors();
        this.isColorfully = true;
        this._count = {};
        this._time = {};

        const value = native.getenv('SESSIONNAME');
        if (value == 'Console') {
            this.isColorfully = false;

            for (const key in COLORS) {
                COLORS[key] = '';
            }
        }
    }

    get [Symbol.toStringTag]() {
        return 'Console';
    }

    clear() {
        native.write('\x1b[?1J');
    }

    count(name = 'default') {
        const data = this._count;
        const count = data[name] || 0;
        data[name] = count + 1;
        this.print(name + ': ' + count + 1);
    }

    countReset(name = 'default') {
        const data = this._count;
        delete data[name];
    }

    time(name = 'default') {
        const data = this._time;
        data[name] = Date.now();
    }

    timeEnd(name = 'default') {
        const data = this._count;
        const startTime = data[name];
        if (startTime == null) {
            return;
        }

        const span = (Date.now() - startTime) / 1000.0;
        this.print(name + ': ' + span + ' ms');
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    debug(message, ...args) {
        printLog('D', getFileLine(), message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    log(message, ...args) {
        printLog('L', getFileLine(), message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    info(message, ...args) {
        printLog('I', getFileLine(), message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    warn(message, ...args) {
        printLog('W', getFileLine(), message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    error(message, ...args) {
        printLog('E', getFileLine(), message, ...args);
    }

    /**
     * 
     * @param {*} expression 
     * @param {string} message 
     * @returns 
     */
    assert(expression, message) {
        if (expression) {
            return;
        }

        printLog('A', getFileLine(), message || 'console.assert');
    }

    /** @param {*} o */
    dir(o) {
        print(o);
    }

    /** @param {*} o */
    dirxml(o) {
        print(o);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    format(message, ...args) {
        return format(false, message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    print(message, ...args) {
        native.print(format(this.isColorfully, message, ...args));
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    alert(message, ...args) {
        native.alert(format(this.isColorfully, message, ...args));
    }

    /**
     * 
     * @param {*} data 
     * @param {*} properties 
     * @param {string} title 
     * @returns 
     */
    table(data, properties, title) {
        if (properties !== undefined && !Array.isArray(properties)) {
            throw new Error(
                "The 'properties' argument must be of type Array. " +
                'Received type string'
            );
        }

        if (data === null || typeof data !== 'object') {
            return this.log(data);
        }

        printTable(data, properties, title);
    }

    /** @param {any[]} args */
    trace(...args) {
        const err = new Error();
        err.name = 'Trace';
        err.message = args.map(String).join(' ');

        const stackLines = err.stack.split('\n');
        stackLines.splice(0, 1);
        err.stack = stackLines.join('\n');
        alert(err);
    }

    /** @param {string} text */
    width(text) {
        return stringWidth(text);
    }

    /** @param {any[]} args */
    write(...args) {
        native.write(...args);
    }
}

export { Console };
