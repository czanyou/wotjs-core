// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';

/**
 * Terminal 主题
 * "name": "WoT.js Dark",
 * "background": "#002B36",
 * "cursorColor": "#FFFFFF",
 * "foreground": "#A7BDBF",
 * "selectionBackground": "#FFFFFF",
 * 
 * "brightBlack": "#0D6075",
 * "brightBlue": "#728A96",
 * "brightCyan": "#84A192",
 * "brightGreen": "#467556",
 * "brightPurple": "#6C71C4",
 * "brightRed": "#CB4B16",
 * "brightWhite": "#FDF6E3",
 * "brightYellow": "#7B8367",
 * 
 * "black": "#002B36",
 * "blue": "#268BD2",
 * "cyan": "#2AA198",
 * "green": "#179928",
 * "magenta": "#D33682",
 * "red": "#DC322F",
 * "white": "#EEE8D5",
 * "yellow": "#B58900"
 */

/**
 * @typedef ColorFormatter
 * @property {(name: string) => string} black
 * @property {(name: string) => string} blue
 * @property {(name: string) => string} cyan
 * @property {(name: string) => string} green
 * @property {(name: string) => string} magenta
 * @property {(name: string) => string} red
 * @property {(name: string) => string} white
 * @property {(name: string) => string} yellow
 */

/**
 * Terminal 颜色管理
 */
export const $colors = {
    /** 颜色名称和 ID */
    NAMES: {
        black: '0',
        blue: '4',
        cyan: '6',
        green: '2',
        purple: '5', // magenta
        magenta: '5', // purple
        red: '1',
        white: '7',
        yellow: '3'
    },

    /** 颜色名称和代码 */
    COLORS: {
        black: '\x1b[30m',
        blue: '\x1b[34m',
        cyan: '\x1b[36m',
        gray: '\x1b[30;1m', // alies: brightBlack
        green: '\x1b[32m',
        none: '\x1b[0m',
        purple: '\x1b[35m',
        magenta: '\x1b[35m',
        red: '\x1b[31m',
        white: '\x1b[37m',
        yellow: '\x1b[33m',
        brightBlack: '\x1b[30;1m',
        brightBlue: '\x1b[34;1m',
        brightCyan: '\x1b[36;1m',
        brightGreen: '\x1b[32;1m',
        brightPurple: '\x1b[35;1m',
        brightMagenta: '\x1b[35;1m',
        brightRed: '\x1b[31;1m',
        brightWhite: '\x1b[37;1m',
        brightYellow: '\x1b[33;1m'
    },

    /** 颜色名称和代码 */
    BRIGHT_COLORS: {
        black: '\x1b[30;1m',
        blue: '\x1b[34;1m',
        cyan: '\x1b[36;1m',
        green: '\x1b[32;1m',
        purple: '\x1b[35;1m',
        magenta: '\x1b[35;1m',
        red: '\x1b[31;1m',
        white: '\x1b[37;1m',
        yellow: '\x1b[33;1m'
    },

    /** 背景颜色名称和代码 */
    BACKGROUND_COLORS: {
        black: '\x1b[0;40m',
        blue: '\x1b[30;44m',
        cyan: '\x1b[30;46m',
        green: '\x1b[30;42m',
        grey: '\x1b[0;40m',
        purple: '\x1b[37;45m',
        magenta: '\x1b[37;45m',
        red: '\x1b[37;41m',
        white: '\x1b[30;47m',
        yellow: '\x1b[30;43m'
    },

    /**
     * 创建一个颜色格式化器
     * @param {Object<string, string>} COLORS 
     * @returns {ColorFormatter}
     */
    getColorFormatter(COLORS) {

        /**
         * 返回包含颜色的字符串
         * @param {string} color 要添加的颜色
         * @param {string} text 要添加的颜色的文本
         * @returns {string}
         */
        function colorify(color, text) {
            color = COLORS[color];
            if (color == null) {
                return text;
            }

            return color + text + $colors.COLORS.none;
        }

        /** @type {ColorFormatter} */
        const formatter = {
            black(text) {
                return colorify('black', text);
            },

            red(text) {
                return colorify('red', text);
            },

            green(text) {
                return colorify('green', text);
            },

            yellow(text) {
                return colorify('yellow', text);
            },

            blue(text) {
                return colorify('blue', text);
            },

            magenta(text) {
                return colorify('magenta', text);
            },

            cyan(text) {
                return colorify('cyan', text);
            },

            white(text) {
                return colorify('white', text);
            }
        };

        return formatter;
    },

    getColors() {
        const colors = $colors.getColorFormatter($colors.COLORS);

        /** @type Colors */
        const result = {
            COLORS: $colors.COLORS,
            BACKGROUND_COLORS: $colors.BACKGROUND_COLORS,
            bright: $colors.getColorFormatter($colors.BRIGHT_COLORS),
            background: $colors.getColorFormatter($colors.BACKGROUND_COLORS),
            ...colors
        };

        return result;
    }
};

/** 
 * 类型判断
 * @type Object<string, (arg: any) => boolean> 
 */
export const $types = {
    isArray(arg) {
        return Array.isArray(arg);
    },

    isBigInt(arg) {
        return typeof arg === 'bigint';
    },

    isBigFloat(arg) {
        // @ts-ignore
        // eslint-disable-next-line valid-typeof
        return typeof arg === 'bigfloat';
    },

    isBoolean(arg) {
        return typeof arg === 'boolean';
    },

    isFunction(arg) {
        return typeof arg === 'function';
    },

    isNull(arg) {
        return arg === null;
    },

    isNullOrUndefined(arg) {
        return arg == null;
    },

    isNumber(arg) {
        return typeof arg === 'number';
    },

    isString(arg) {
        return typeof arg === 'string';
    },

    isSymbol(arg) {
        return typeof arg === 'symbol';
    },

    isUndefined(arg) {
        // eslint-disable-next-line no-void
        return arg === void 0;
    },

    isDate(d) {
        return $types.isObject(d) && $object.objectToString(d) === '[object Date]';
    },

    isError(e) {
        return ($types.isObject(e) && ($object.objectToString(e) === '[object Error]' || e instanceof Error));
    },

    isObject(arg) {
        return typeof arg === 'object' && arg !== null;
    },

    isMap(arg) {
        return arg instanceof Map;
    },

    isSet(arg) {
        return arg instanceof Set;
    },

    isRegExp(re) {
        return $types.isObject(re) && $object.objectToString(re) === '[object RegExp]';
    }
};

/**
 * 对象类型工具
 */
export const $object = {
    /**
     * 返回指定的对象的名称
     * @param {any} object
     * @returns {string}
     */
    objectToString(object) {
        return Object.prototype.toString.call(object);
    },

    /**
     * 返回指定的对象的类名
     * @param {any} object 
     * @returns {string | undefined}
     */
    getClassName(object) {
        const objectName = $object.objectToString(object);
        if (objectName.startsWith('[object ')) {
            return objectName.substring(8, objectName.length - 1);
        }
    },

    /**
     * 是否有指定名称的属性
     * @param {any} object 
     * @param {string} property
     * @returns {boolean}
     */
    haveOwnProperty(object, property) {
        return Object.prototype.hasOwnProperty.call(object, property);
    }
};

/**
 * @typedef {{ seen: any[], stylize: (value:any, type:string) => string }} FormatContext
 * @typedef {{ depth?: number }} FormatOptions
 */

/**
 * 变量格式化工具
 */
export const $formatter = {

    /**
     * 
     * @param {string[]} array 
     * @returns {Object<string,any>}
     */
    arrayToHash(array) {
        const hash = {};

        array.forEach(function (val, index) {
            hash[val] = true;
        });

        return hash;
    },

    /**
     * 格式化数组
     * @param {FormatContext} ctx 
     * @param {any} value 
     * @param {number|undefined} recurseTimes 打印深度
     * @param {Object<string,true>} visibleKeys 
     * @param {string[]} keys 
     * @returns {string[]}
     */
    formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
        /** @type {string[]} */
        const output = [];

        // 文本索引
        for (let i = 0, l = value.length; i < l; ++i) {
            if ($object.haveOwnProperty(value, String(i))) {
                output.push(
                    $formatter.formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true)
                );

            } else {
                output.push('');
            }
        }

        // 数字索引
        keys.forEach(function (key) {
            if (!key.match(/^\d+$/)) {
                output.push(
                    $formatter.formatProperty(ctx, value, recurseTimes, visibleKeys, key, true)
                );
            }
        });

        return output;
    },

    /**
     * @param {Error} error 
     * @returns {string}
     */
    formatError(error) {
        let text = Error.prototype.toString.call(error);
        // @ts-ignore
        const errno = error.errno;
        if (errno) {
            text += ` (${errno})`;
        }

        if (error.stack) {
            text += '\n';
            text += error.stack;
        }

        return text;
    },

    /**
     * 
     * @param {*} ctx 
     * @param {any} value 
     * @returns 
     */
    formatPrimitive(ctx, value) {
        if ($types.isUndefined(value)) {
            return ctx.stylize('undefined', 'undefined');

        } else if ($types.isString(value)) {
            const simple =
                "'" +
                JSON.stringify(value)
                    .replace(/^"|"$/g, '')
                    .replace(/'/g, "\\'")
                    .replace(/\\"/g, '"') +
                "'";
            return ctx.stylize(simple, 'string');

        } else if ($types.isNumber(value)) {
            if (value == 0) {
                if (1 / value < 0) { value = '-0'; } else { value = '0'; }
            }
            return ctx.stylize('' + value, 'number');

        } else if ($types.isBoolean(value)) {
            return ctx.stylize('' + value, 'boolean');

        } else if ($types.isNull(value)) {
            // For some reason typeof null is "object", so special case here.
            return ctx.stylize('null', 'null');

        } else if ($types.isBigInt(value)) {
            return ctx.stylize('' + value + 'n', 'bigint');

        } else if ($types.isBigFloat(value)) {
            return ctx.stylize('' + value + 'l', 'bigfloat');

        } else if (value instanceof ArrayBuffer) {
            return ctx.stylize($object.getClassName(value), 'special') + ` { byteLength: ${value.byteLength} }`;

        } else if (ArrayBuffer.isView(value)) {
            return ctx.stylize($object.getClassName(value), 'special') + ` { byteOffset: ${value.byteOffset}, byteLength: ${value.byteLength} }`;
        }
    },

    /**
     * 格式化属性
     * @param {FormatContext} ctx 
     * @param {any} value 
     * @param {number|undefined} recurseTimes 
     * @param {Object<string,true>} visibleKeys 
     * @param {string} key 
     * @param {boolean} array 
     * @returns {string}
     */
    formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
        let name, str;

        // descriptor
        const descriptor = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
        if (descriptor.get) {
            if (descriptor.set) {
                str = ctx.stylize('[Getter/Setter]', 'special');

            } else {
                str = ctx.stylize('[Getter]', 'special');
            }

        } else {
            if (descriptor.set) {
                str = ctx.stylize('[Setter]', 'special');
            }
        }

        // key
        if (!$object.haveOwnProperty(visibleKeys, key)) {
            name = '[' + key + ']';
        }

        // value
        if (!str) {
            if (ctx.seen.indexOf(descriptor.value) < 0) {
                if (recurseTimes == null) {
                    str = $formatter.formatValue(ctx, descriptor.value);

                } else {
                    str = $formatter.formatValue(ctx, descriptor.value, recurseTimes - 1);
                }

                if (str.indexOf('\n') > -1) {
                    if (array) {
                        // 增加缩进
                        str = str.split('\n').map(line => '  ' + line).join('\n').substring(2);
                    } else {
                        str = '\n' + str.split('\n').map(line => '   ' + line).join('\n');
                    }
                }

            } else {
                str = ctx.stylize('[Circular]', 'special');
            }
        }

        // name
        if ($types.isUndefined(name)) {
            if (array && key.match(/^\d+$/)) {
                return str;
            }

            name = JSON.stringify('' + key);
            if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                // 无双引号
                name = name.substring(1, name.length - 1);
                name = ctx.stylize(name, 'name');

            } else {
                // 双引号
                name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
                name = ctx.stylize(name, 'string');
            }
        }

        return name + ': ' + str;
    },

    /**
     * 
     * @param {FormatContext} ctx 
     * @param {any} value 
     * @param {number=} recurseTimes 限制深度
     * @returns {string}
     */
    formatValue(ctx, value, recurseTimes) {
        // Primitive types cannot have properties
        const primitive = $formatter.formatPrimitive(ctx, value);
        if (primitive) {
            return primitive;

        } else if ($types.isError(value)) {
            return $formatter.formatError(value);
        }

        if (value instanceof Set) {
            const result = [];
            for (const item of value.values()) {
                result.push(item);
            }

            value = result;

        } else if (value instanceof Map) {
            const result = {};
            for (const key of value.keys()) {
                result[key] = value.get(key);
            }

            value = result;
        }

        // Look up the keys of the object.
        const keys = Object.keys(value);

        // Some type of object without properties can be shortcutted.
        if (keys.length === 0) {
            if ($types.isFunction(value)) {
                const name = value.name ? ': ' + value.name : '';
                return ctx.stylize('[Function' + name + ']', 'special');

            } else if ($types.isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');

            } else if ($types.isDate(value)) {
                return ctx.stylize(Date.prototype.toString.call(value), 'date');

            } else if ($types.isError(value)) {
                return $formatter.formatError(value);
            }
        }

        let base = '';
        let isArray = false;
        let braces = ['{', '}'];

        if ($types.isArray(value)) {
            // Make Array say that they are Array
            isArray = true;
            braces = ['[', ']'];

        } else if ($types.isFunction(value)) {
            // Make functions say that they are functions
            const n = value.name ? ': ' + value.name : '';
            base = ' [Function' + n + ']';

        } else if ($types.isRegExp(value)) {
            // Make RegExps say that they are RegExps
            base = ' ' + RegExp.prototype.toString.call(value);

        } else if ($types.isDate(value)) {
            // Make dates with properties first say the date
            base = ' ' + Date.prototype.toUTCString.call(value);

        } else if ($types.isError(value)) {
            // Make error with message first say the error
            base = ' ' + $formatter.formatError(value);
        }

        // Class name
        let prefix = '';
        const className = $object.getClassName(value);
        if (className) {
            if (className != 'Object' && className != 'Array') {
                prefix = ctx.stylize(className, 'special') + ' ';
            }
        }

        // empty object
        if (keys.length === 0 && (!isArray || value.length == 0)) {
            return prefix + braces[0] + base + braces[1];
        }

        if (recurseTimes != null && recurseTimes < 0) {
            if ($types.isRegExp(value)) {
                return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
            } else {
                return ctx.stylize('[Object]', 'special');
            }
        }

        ctx.seen.push(value);

        let output;
        if (isArray) {
            // array
            const visibleKeys = $formatter.arrayToHash(keys);
            output = $formatter.formatArray(ctx, value, recurseTimes, visibleKeys, keys);

        } else {
            // object
            const visibleKeys = $formatter.arrayToHash(keys);
            output = keys.map(function (key) {
                return $formatter.formatProperty(ctx, value, recurseTimes, visibleKeys, key, isArray);
            });
        }

        ctx.seen.pop();

        return prefix + $formatter.reduceToSingleString(output, base, braces);
    },

    /**
     * @param {boolean} colorfully 
     * @param  {...any} args 
     * @returns {string}
     */
    formatValues(colorfully, ...args) {
        let stylize = $formatter.stylizeNoColor;
        if (colorfully) {
            stylize = $formatter.stylizeColor;
        }

        // native.print('formatValues', args);
        const formatRegExp = /%[sdj%]/g;

        const f = args[0];
        if (!$types.isString(f)) {
            const objects = [];
            for (let i = 0; i < args.length; i++) {
                objects.push($formatter.inspect(stylize, args[i], {}));
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
            if ($types.isNull(x) || !$types.isObject(x)) {
                str += ' ' + x;
            } else {
                str += ' ' + $formatter.inspect(stylize, x, {});
            }
        }

        return str;
    },

    /**
     * @param {(value:any, type:string) => string} stylize 
     * @param {any} obj 
     * @param {FormatOptions} options 
     * @returns {string}
     */
    inspect(stylize, obj, options) {

        /** @type {FormatContext} */
        const ctx = { seen: [], stylize };

        return $formatter.formatValue(ctx, obj, options.depth);
    },

    /**
     * @param {any[]} output 
     * @param {string} base 
     * @param {string[]} braces 
     * @returns 
     */
    reduceToSingleString(output, base, braces) {
        const length = output.reduce(function (prev, current) {
            return prev + current.replace(/\u001b\[\d\d?m/g, '').length + 1;
        }, 0);

        if (length > 60) {
            base = (base === '' ? '' : base + '\n ');
            return braces[0] + base + ' ' + output.join(',\n  ') + ' ' + braces[1];
        }

        return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    },

    // eslint-disable-next-line no-unused-vars
    stylizeNoColor(str, styleType) {
        return str;
    },

    /**
     * @param {string} str 
     * @param {string} styleType boolean|date|name|null|number|regexp|special|undefined
     * @returns {string}
     */
    stylizeColor(str, styleType) {
        const COLORS = $colors.COLORS;

        const colors = {
            boolean: COLORS.blue,
            date: COLORS.brightGreen,
            name: COLORS.green,
            null: COLORS.magenta,
            number: COLORS.yellow,
            regexp: COLORS.brightRed,
            special: COLORS.cyan,
            undefined: COLORS.red
        };

        const color = colors[styleType];
        if (!color) {
            return str;
        }

        return color + str + COLORS.none;
    }
};

/**
 * 表格格式化工具
 */
export const $tableFormatter = {

    // Copyright Joyent, Inc. and other Node contributors. MIT license.
    // Forked from Node's lib/internal/cli_table.js

    // eslint-disable-next-line no-unused-vars
    hasOwnProperty(object, value) {
        if (object == null) {
            return false;
        }

        return Object.prototype.hasOwnProperty.call(object, value);
    },

    /**
     * 
     * @param {string} value 
     * @returns {number}
     */
    getBytesWidth(value) {
        return (value && $tableFormatter.stringWidth(value)) || 0;
    },

    /**
     * 
     * @param {*} value 
     * @returns {number}
     */
    stringWidth(value) {
        value = String(value);

        let width = 0;
        for (const char of value) {
            const code = char.codePointAt(0);
            width += (code >= 0x2E80) ? 2 : 1;
        }

        return width;
    },

    /**
     * @param {number} index
     * @param {{value:string,width:number}[]} row 
     * @param {number[]} columnWidths 
     * @returns {string}
     */
    formatTableRow(index, row, columnWidths) {
        let out = '';
        for (let i = 0; i < row.length; i++) {
            const cell = row[i];
            const cellWidth = cell.width;

            const padWidth = columnWidths[i] - cellWidth;
            const value = cell.value || '--';

            if (index == 0) {
                // TODO:
                out += value;

            } else if (i == 0) {
                out += $colors.COLORS.brightWhite + value + $colors.COLORS.none;

            } else {
                out += value;
            }

            if (padWidth > 0) {
                out += ' '.repeat(Math.min(padWidth, 32));
            }

            if (i < row.length - 1) {
                out += ' ';
            }
        }

        out += '\n';
        return out;
    },

    /**
     * @param {{value:string,width:number}[]} row 
     * @param {number[]} columnWidths 
     * @returns {string}
     */
    formatObjectTableRow(row, columnWidths) {
        let output = '';
        for (let i = 0; i < row.length; i++) {
            const cell = row[i];
            const padWidth = columnWidths[i] - cell.width;
            const value = cell.value || '--';

            if (i == 0) {
                // key
                if (padWidth > 0) {
                    output += ' '.repeat(Math.min(padWidth, 32));
                }

                output += $colors.COLORS.brightGreen + value + ':' + $colors.COLORS.none;

            } else {
                // value
                output += value;
                if (padWidth > 0) {
                    output += ' '.repeat(Math.min(padWidth, 80));
                }
            }

            if (i < row.length - 1) {
                output += ' ';
            }
        }

        output += '\n';
        return output;
    },

    /**
     * @param {string[]} header 
     * @param {any[][]} rows 
     * @returns 
     */
    formatObjectTable(header, rows) {
        const columnWidths = header.map((cell) => $tableFormatter.getBytesWidth(cell));
        const maxWidth = 80;

        /** @type {{value:string,width:number}[][]} table body */
        const body = [];
        for (const row of rows) {
            /** @type any */
            const values = [];
            for (const item of row) {
                const index = values.length;
                const cell = $tableFormatter.formatCell(item, maxWidth);
                if (columnWidths[index] < cell.width) {
                    columnWidths[index] = cell.width;
                }

                values.push(cell);
            }

            body.push(values);
        }

        // table body
        let result = '';
        for (const row of body) {
            result += $tableFormatter.formatObjectTableRow(row, columnWidths);
        }

        return result;
    },

    /**
     * @param {string[]} header 
     * @param {any[][]} rows 
     * @returns 
     */
    formatTable(header, rows) {
        const columnWidths = header.map((cell) => $tableFormatter.getBytesWidth(cell));
        const maxWidth = 56;

        /** @type {{value:string,width:number}[][]} table body */
        const body = [];
        for (const row of rows) {
            /** @type any */
            const values = [];
            for (const item of row) {
                const index = values.length;

                const cell = $tableFormatter.formatCell(item, maxWidth);
                if (columnWidths[index] < cell.width) {
                    columnWidths[index] = cell.width;
                }

                values.push(cell);
            }

            body.push(values);
        }

        let result = '';

        // table title
        let index = 0;

        // table header
        {
            const row = [];
            for (let i = 0; i < header.length; i++) {
                const value = header[i].toUpperCase();
                row[i] = { value, width: value.length };
            }

            result += $colors.COLORS.gray;
            result += $tableFormatter.formatTableRow(index, row, columnWidths);
            result += $colors.COLORS.none;
        }

        // table body
        for (const row of body) {
            index++;
            result += $tableFormatter.formatTableRow(index, row, columnWidths);
        }

        return result;
    },

    /** @param {any} value */
    formatValue(value) {
        if (value == null) {
            return null;

        } else if (typeof value == 'object') {
            return JSON.stringify(value);

        } else {
            return String(value);
        }
    },

    /** 
     * @param {any} value 
     * @param {number} maxWidth 
     */
    formatCell(value, maxWidth) {
        let text = null;
        if (value == null) {
            text = String(value);
            value = $formatter.formatValues(true, value);

        } else if (typeof value == 'object') {
            text = JSON.stringify(value);
            if (text.length > maxWidth) {
                text = text.substring(0, maxWidth) + '..';
            }

            value = text;

        } else {
            text = String(value);
            value = $formatter.formatValues(true, value);
        }

        const width = $tableFormatter.getBytesWidth(text);
        return { value, width };
    },

    // data to array

    /** 
     * @param {IterableIterator<[string, any]>|[string, any][]} entries1 
     * @param {IterableIterator<[string, any]>|[string, any][]} entries2 
     */
    formatArray(entries1, entries2, properties) {
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

        if (properties && properties.length) {
            for (const key of properties) {
                if (!keys.has(key)) {
                    continue;
                }

                header.push(key);
            }

        } else {
            for (const key of keys.keys()) {
                header.push(key);
            }
        }

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
    },

    /** @param {IterableIterator<[string, any]>|[string, any][]} entries */
    formatObject(entries, properties) {
        /** @type string[] */
        const header = [];

        /** @type string[][] */
        const body = [];

        header.push('key', 'value');
        for (const [key, value] of entries) {
            body.push([key, value]);
        }

        return { header, body };
    },

    /**
     * 打印表格
     * @param {object|Array|Map|Set} data 
     * @param {string[]} properties 
     */
    printTable(data, properties) {

        if (data instanceof Set) {
            const table = $tableFormatter.formatArray(data.entries(), data.entries(), properties);
            print($tableFormatter.formatTable(table.header, table.body));

        } else if (Array.isArray(data)) {
            const table = $tableFormatter.formatArray(Object.entries(data), Object.entries(data), properties);
            print($tableFormatter.formatTable(table.header, table.body));

        } else if (data instanceof Map) {
            const table = $tableFormatter.formatObject(data.entries(), properties);
            print($tableFormatter.formatObjectTable(table.header, table.body));

        } else {
            const table = $tableFormatter.formatObject(Object.entries(data), properties);
            print($tableFormatter.formatObjectTable(table.header, table.body));
        }
    }
};

/**
 * 日志格式化工具
 */
export const $logFormatter = {

    /**
     * @param {number} now 
     */
    formatTime(now) {
        /**
         * @param {number} value 
         * @param {number} count 
         */
        function padStart(value, count) {
            return String(Math.floor(value)).padStart(count, '0');
        }

        let value = now * 1000;
        const ms = value % 1000;

        value /= 1000;
        const s = value % 60;

        value /= 60;
        const m = value % 60;

        value /= 60;
        const h = value % 24;

        value = Math.floor(value / 24);

        let time = padStart(h, 2) + ':' + padStart(m, 2) + ':' + padStart(s, 2) + '.' + padStart(ms, 3);
        if (value > 0) {
            time = value + ',' + time;
        }

        return time;
    },

    /**
     * 打印日志信息
     * @param {string} level 日志级别: d, l, i, w, a, e
     * @param {string} lineNumber 行号信息
     * @param {any[]} args 
     */
    print(level, lineNumber, ...args) {
        let printf = print;
        if (level == 'i') {
            // 

        } else if (level == 'w' || level == 'a') {
            printf = alert;

        } else if (level == 'e') {
            printf = alert;
        }

        printf(format(true, ...args));
    },

    /**
     * 打印日志信息
     * @param {string} level 日志级别: d, l, i, w, a, e
     * @param {string} lineNumber 行号信息
     * @param {any[]} args 
     */
    printConsole(level, lineNumber, ...args) {
        let printf = print;
        let start = $colors.COLORS.gray;
        if (level == 'i') {
            start = $colors.COLORS.green;

        } else if (level == 'w' || level == 'a') {
            start = $colors.COLORS.yellow;
            printf = alert;

        } else if (level == 'e') {
            start = $colors.COLORS.red;
            printf = alert;
        }

        const gray = $colors.COLORS.gray;
        const none = $colors.COLORS.none;
        const now = $logFormatter.formatTime(native.os.uptime());

        printf(`${start}[${now}]${none} ${format(true, ...args)}\n${gray} ${lineNumber}${none}`);
    },

    getFileLine() {
        const error = new Error();
        const stack = error.stack || '';
        const stacks = stack.split('\n');
        const line = stacks[2] || '';
        return line.trim();
    }
};

export function getColors() {
    return $colors.getColors();
}

/** 
 * 返回格式化后的字符串
 * @param {boolean} colorfully 
 * @param {any[]} args 
 * @retuns {string}
 */
export function format(colorfully, ...args) {
    return $formatter.formatValues(colorfully, ...args);
}

/** 
 * 打印到 stdout
 * @param {any[]} args 
 */
export function print(...args) {
    native.print(format(true, ...args));
}

/** 
 * 打印到 stderr
 * @param {any[]} args 
 */
export function alert(...args) {
    native.alert(format(true, ...args));
}

/** @param {string} text */
export function width(text) {
    return $tableFormatter.stringWidth(text);
}

/** @param {any[]} args */
export function write(...args) {
    native.write(...args);
}

/** 
 * @param {boolean} colorfully 
 * @param {any} message 
 * @param {any[]} args 
 */
export function inspect(colorfully, message, ...args) {
    return $formatter.formatValues(colorfully, message, ...args);
}

/**
 * 打印日志信息
 * @param {string} level 日志级别: `d`,`l`,`i`,`w`,`e`,`a`
 * @param {string} lineNumber 源代码行号信息
 * @param {any[]} args 
 */
export function printConsole(level, lineNumber, ...args) {
    $logFormatter.printConsole(level, lineNumber, ...args);
    return true;
}

/**
 * @param {Function} onPrintLog 
 */
export function setPrintLog(onPrintLog) {
    if (typeof onPrintLog == 'function') {
        // @ts-ignore
        window.console.onPrintLog = onPrintLog;
    }
}

/**
 * 控制台工具
 */
export class Console {
    constructor(options) {
        /** @type Colors */
        this.colors = $colors.getColors();

        /** @type boolean */
        this._isColorfully = true;

        /** @type Object<string,number> */
        this._count = {};

        /** @type Object<string,number> */
        this._time = {};

        const value = native.getenv('SESSIONNAME');
        if (value == 'Console') {
            this._isColorfully = false;

            for (const key in $colors.COLORS) {
                $colors.COLORS[key] = '';
            }

            for (const key in $colors.BRIGHT_COLORS) {
                $colors.BRIGHT_COLORS[key] = '';
            }

            for (const key in $colors.BACKGROUND_COLORS) {
                $colors.BACKGROUND_COLORS[key] = '';
            }
        }

        /** @type Function | null */
        this.onPrintLog = null;
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
     * 打印日志信息
     * @param {string} level 日志级别: `d`,`l`,`i`,`w`,`e`,`a`
     * @param {string} lineNumber 源代码行号信息
     * @param {any[]} args 
     */
    printConsole(level, lineNumber, ...args) {
        $logFormatter.printConsole(level, lineNumber, ...args);
        return true;
    }

    /**
     * 打印日志信息
     * @param {string} level 日志级别: `d`,`l`,`i`,`w`,`e`,`a`
     * @param {string} lineNumber 源代码行号信息
     * @param {any[]} args 
     */
    printLog(level, lineNumber, ...args) {
        if (this.onPrintLog) {
            const ret = this.onPrintLog(level, lineNumber, ...args);
            if (ret) {
                return ret;
            }
        }

        $logFormatter.print(level, lineNumber, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    debug(message, ...args) {
        this.printLog('d', $logFormatter.getFileLine(), message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    log(message, ...args) {
        this.printLog('l', $logFormatter.getFileLine(), message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    info(message, ...args) {
        this.printLog('i', $logFormatter.getFileLine(), message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    warn(message, ...args) {
        this.printLog('w', $logFormatter.getFileLine(), message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    error(message, ...args) {
        this.printLog('e', $logFormatter.getFileLine(), message, ...args);
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

        this.printLog('a', $logFormatter.getFileLine(), message || 'console.assert');
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
     * @param {any} colorfully 
     * @param {any} message 
     * @param {any[]} args 
     */
    inspect(colorfully, message, ...args) {
        return format(colorfully, message, ...args);
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    print(message, ...args) {
        native.print(format(this._isColorfully, message, ...args));
    }

    /** 
     * @param {any} message 
     * @param {any[]} args 
     */
    alert(message, ...args) {
        native.alert(format(this._isColorfully, message, ...args));
    }

    /**
     * @param {any} data 
     * @param {string[]} properties 
     * @returns void
     */
    table(data, properties) {
        if (data == null) {
            // return;

        } else if (typeof data !== 'object') {
            this.log(data);

        } else if (properties !== undefined && !Array.isArray(properties)) {
            throw new Error("The 'properties' argument must be of type Array.");

        } else {
            $tableFormatter.printTable(data, properties);
        }
    }

    /** @param {any[]} args */
    trace(...args) {
        const err = new Error();
        err.name = 'Trace';
        err.message = args.map(String).join(' ');

        const stack = err.stack || '';
        const stacks = stack.split('\n');
        stacks.splice(0, 1);
        err.stack = stacks.join('\n');
        alert(err);
    }

    /** @param {string} text */
    width(text) {
        return $tableFormatter.stringWidth(text);
    }

    /** @param {any[]} args */
    write(...args) {
        native.write(...args);
    }
}
