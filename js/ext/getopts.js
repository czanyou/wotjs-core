// @ts-check
/// <reference path ="../../types/index.d.ts" />
// https://github.com/jorgebucaran/getopts
//

const EMPTYARR = [];
const SHORTSPLIT = /$|[!-@[-`{-~][\s\S]*/g;
const isArray = Array.isArray;

const parseValue = function (any) {
    if (any === '') return '';
    if (any === 'false') return false;
    const maybe = Number(any);
    return maybe * 0 === 0 ? maybe : any;
};

const parseAlias = function (aliases) {
    const out = {};
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
                if (i !== k) prev.push(alias[k]);
            }
        }
    }

    return out;
};

const parseDefault = function (aliases, defaults) {
    const out = {};
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

const parseOptions = function (aliases, options, value) {
    const out = {};
    let key;
    let alias;
    let len;
    let end;
    let i;
    let k;

    if (options !== undefined) {
        for (i = 0, len = options.length; i < len; i++) {
            key = options[i];
            alias = aliases[key];

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
 * 
 * @param {string[]} argv 
 * @param {*} opts 
 * @returns 
 */
const getopts = function (argv, opts) {
    opts = opts || {};
    const unknown = opts.unknown;
    const aliases = parseAlias(opts.alias);
    const strings = parseOptions(aliases, opts.string, '');
    const values = parseDefault(aliases, opts.default);
    const bools = parseOptions(aliases, opts.boolean, false);
    const stopEarly = opts.stopEarly;
    const _ = [];
    const out = { _ };
    let i = 0;
    let k = 0;
    const len = argv.length;
    let key;
    let arg;
    let end;
    let match;
    let value;

    for (; i < len; i++) {
        arg = argv[i];

        if (arg[0] !== '-' || arg === '-') {
            if (stopEarly) while (i < len) _.push(argv[i++]);
            else _.push(arg);
        } else if (arg === '--') {
            while (++i < len) _.push(argv[i]);
        } else if (arg[1] === '-') {
            end = arg.indexOf('=', 2);
            if (arg[2] === 'n' && arg[3] === 'o' && arg[4] === '-') {
                key = arg.slice(5, end >= 0 ? end : undefined);
                value = false;
            } else if (end >= 0) {
                key = arg.slice(2, end);
                value =
                    bools[key] !== undefined ||
                    (strings[key] === undefined
                        ? parseValue(arg.slice(end + 1))
                        : arg.slice(end + 1));
            } else {
                key = arg.slice(2);
                value =
                    bools[key] !== undefined ||
                    (len === i + 1 || argv[i + 1][0] === '-'
                        ? strings[key] === undefined
                            ? true
                            : ''
                        : strings[key] === undefined
                            ? parseValue(argv[++i])
                            : argv[++i]);
            }
            write(out, key, value, aliases, unknown);
        } else {
            SHORTSPLIT.lastIndex = 2;
            match = SHORTSPLIT.exec(arg);
            end = match.index;
            value = match[0];

            for (k = 1; k < end; k++) {
                write(
                    out,
                    (key = arg[k]),
                    k + 1 < end
                        ? strings[key] === undefined ||
                        arg.substring(k + 1, (k = end)) + value
                        : value === ''
                            ? len === i + 1 || argv[i + 1][0] === '-'
                                ? strings[key] === undefined || ''
                                : bools[key] !== undefined ||
                                (strings[key] === undefined ? parseValue(argv[++i]) : argv[++i])
                            : bools[key] !== undefined ||
                            (strings[key] === undefined ? parseValue(value) : value),
                    aliases,
                    unknown
                );
            }
        }
    }

    for (key in values) if (out[key] === undefined) out[key] = values[key];
    for (key in bools) if (out[key] === undefined) out[key] = false;
    for (key in strings) if (out[key] === undefined) out[key] = '';

    return out;
};

export { getopts };
