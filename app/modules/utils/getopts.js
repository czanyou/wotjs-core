// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
// https://github.com/jorgebucaran/getopts
//

const EMPTYARR = [];
const SHORTSPLIT = /$|[!-@[-`{-~][\s\S]*/g;
const isArray = Array.isArray;

/**
 * 
 * @param {any} any 
 * @returns {string|boolean|number|null}
 */
const parseValue = function (any) {
    if (any === '') {
        return '';

    } else if (any === 'false') {
        return false;
    }

    const maybe = Number(any);
    if (isNaN(maybe)) {
        return any;
    }

    // 删除，因为无法正确地区分非常大的数字
    // return maybe * 0 === 0 ? maybe : any;
    return maybe;
};

/**
 * 
 * @param {Object<string,string[]>=} aliases 
 * @returns {Object<string,any>}
 */
const parseAlias = function (aliases) {
    const out = {};
    if (aliases == null) {
        return out;
    }

    let key;
    let alias;
    let prev;
    let len;
    let any;
    let i;
    let k;

    for (key in aliases) {
        any = aliases[key];
        alias = out[key] = isArray(any) ? any : [any];

        for (i = 0, len = alias.length; i < len; i++) {
            prev = out[alias[i]] = [key];

            for (k = 0; k < len; k++) {
                if (i !== k) {
                    prev.push(alias[k]);
                }
            }
        }
    }

    return out;
};

/**
 * 
 * @param {Object<string,string[]>=} aliases 
 * @param {Object<string,any>=} defaults 
 * @returns {Object<string,any>}
 */
const parseDefault = function (aliases, defaults) {
    const out = {};
    if (aliases == null || defaults == null) {
        return out;
    }

    let key;
    let alias;
    let value;
    let len;
    let i;

    for (key in defaults) {
        value = defaults[key];
        alias = aliases[key];

        out[key] = value;

        if (alias === undefined) {
            aliases[key] = EMPTYARR;

        } else {
            for (i = 0, len = alias.length; i < len; i++) {
                out[alias[i]] = value;
            }
        }
    }

    return out;
};

/**
 * 
 * @param {Object<string,string[]>} aliases 
 * @param {string[]=} options 
 * @param {any=} value 
 * @returns {Object<string,any>}
 */
const parseOptions = function (aliases, options, value) {
    const out = {};
    if (options == null) {
        return out;
    }

    let len;
    let end;
    let i;
    let k;

    if (options !== undefined) {
        for (i = 0, len = options.length; i < len; i++) {
            const key = options[i];
            const alias = aliases[key];

            out[key] = value;

            if (alias === undefined) {
                aliases[key] = EMPTYARR;

            } else {
                for (k = 0, end = alias.length; k < end; k++) {
                    out[alias[k]] = value;
                }
            }
        }
    }

    return out;
};

/**
 * 
 * @param {Object<string,any>} out 
 * @param {string} key 
 * @param {*} value 
 * @param {Object<string,string[]>} aliases 
 * @param {Function=} unknown 
 */
const write = function (out, key, value, aliases, unknown) {
    let i;
    let prev;
    const alias = aliases[key];
    const len = alias === undefined ? -1 : alias.length;

    if (len >= 0 || unknown === undefined || unknown(key)) {
        prev = out[key];

        if (prev === undefined) {
            out[key] = value;
        } else {
            if (isArray(prev)) {
                prev.push(value);
            } else {
                out[key] = [prev, value];
            }
        }

        for (i = 0; i < len; i++) {
            out[alias[i]] = out[key];
        }
    }
};

/**
 * @typedef Options
 * @property {Function=} unknown
 * @property {Object<string,any>=} alias
 * @property {string[]=} string
 * @property {Object<string,any>=} default
 * @property {string[]=} boolean
 * @property {boolean=} stopEarly  If true, the operands array _ will be populated with all the arguments after the first operand.
 */

/**
 * --
 * -
 * @param {string[]} argv 
 * @param {Options} options 
 * @returns 
 */
export function parse(argv, options) {
    options = options || {};
    const unknown = options.unknown;
    const aliases = parseAlias(options.alias);

    /** @type {Object<string,string>} */
    const strings = parseOptions(aliases, options.string, '');

    /** @type {Object<string,boolean>} */
    const bools = parseOptions(aliases, options.boolean, false);
    const values = parseDefault(aliases, options.default);
    const stopEarly = options.stopEarly;
    const _ = [];
    const out = { _ };

    let key;
    let value;

    /**
     * 
     * @param {string} key 
     * @param {any} value 
     * @returns 
     */
    function getValue(key, value) {
        return strings[key] === undefined ? parseValue(value) : value;
    }

    const len = argv.length;
    for (let i = 0; i < len; i++) {
        const arg = argv[i];

        if (arg[0] !== '-' || arg === '-') { // X | -
            if (stopEarly) {
                while (i < len) {
                    _.push(argv[i++]);
                }

            } else {
                _.push(arg);
            }

        } else if (arg === '--') { // -- 
            while (++i < len) {
                _.push(argv[i]);
            }

        } else if (arg[1] === '-') { // --name
            const end = arg.indexOf('=', 2); // --name=value
            if (arg[2] === 'n' && arg[3] === 'o' && arg[4] === '-') { // --no-name (value is boolean)
                key = arg.slice(5, end >= 0 ? end : undefined);
                value = false;

            } else if (end >= 0) { // --name=value
                key = arg.slice(2, end);
                const data = arg.slice(end + 1);
                value = (bools[key] !== undefined) || getValue(key, data);

            } else { // --name
                key = arg.slice(2);
                value = (bools[key] !== undefined); // --name (value is boolean)
                if (!value) {
                    if (len === i + 1 || argv[i + 1][0] === '-') { // --name (value is null)
                        value = (strings[key] === undefined ? true : '');

                    } else { // --name [value]
                        const data = argv[++i];
                        value = getValue(key, data);
                    }
                }
            }

            write(out, key, value, aliases, unknown);

        } else { // -X
            SHORTSPLIT.lastIndex = 2;
            const match = SHORTSPLIT.exec(arg);
            const end = match?.index || 0;
            value = match && match[0];

            for (let k = 1; k < end; k++) {
                key = arg[k];

                if (k + 1 < end) { // -x[value]
                    value = strings[key] === undefined || arg.substring(k + 1, (k = end)) + value;

                } else if (value === '') { // -x
                    if (len === i + 1 || argv[i + 1][0] === '-') { // -x (value is null)
                        value = (strings[key] === undefined) || '';

                    } else { // -x
                        value = bools[key] !== undefined; // -x (value is boolean)
                        if (!value) { // -x [value]
                            const data = argv[++i];
                            value = getValue(key, data);
                        }
                    }

                } else { // -x[value]
                    value = (bools[key] !== undefined) || getValue(key, value);
                }

                write(out, key, value, aliases, unknown);
            }
        }
    }

    // values
    for (key in values) {
        if (out[key] === undefined) {
            out[key] = values[key];
        }
    }

    // default boolean value
    for (key in bools) {
        if (out[key] === undefined) {
            out[key] = false;
        }
    }

    // default string value
    for (key in strings) {
        if (out[key] === undefined) {
            out[key] = '';
        }
    }

    return out;
};

/**
 * 
 * @param {any} value 
 * @returns {boolean|undefined}
 */
export function parseBoolean(value) {
    if (value == null) {
        return value;
    }

    if (Array.isArray(value)) {
        value = value[0];
    }

    if (typeof value == 'boolean') {
        return value;

    } else if (typeof value == 'number') {
        return value != 0;
    }

    value = parseString(value);
    return value == 'true';
}

/**
 * 
 * @param {any} value 
 * @returns {number|undefined}
 */
export function parseFloat(value) {
    if (value == null) {
        return value;
    }

    if (Array.isArray(value)) {
        value = value[0];
    }

    if (typeof value == 'number') {
        return value;
    }

    value = parseString(value);
    return Number.parseFloat(value);
}

/**
 * 
 * @param {any} value 
 * @returns {number|undefined}
 */
export function parseInteger(value) {
    if (value == null) {
        return value;
    }

    if (Array.isArray(value)) {
        value = value[0];
    }

    if (typeof value == 'number') {
        return value;
    }

    value = parseString(value);
    return Number.parseInt(value);
}

/**
 * 
 * @param {any} value 
 * @returns {string|undefined}
 */
export function parseString(value) {
    if (value == null) {
        return value;
    }

    if (Array.isArray(value)) {
        value = value[0];
    }

    return String(value);
}
