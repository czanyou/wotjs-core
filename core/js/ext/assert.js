// @ts-check
/// <reference path ="../../types/index.d.ts" />
import process from '@tjs/process';

/**
 * 
 * @param {*} a 
 * @param {*} b 
 * @returns {boolean}
 */
function fastDeepEqual(a, b) {
    if (a === b) {
        return true;
    }

    if (a && b && typeof a == 'object' && typeof b == 'object') {
        if (a.constructor !== b.constructor) {
            return false;
        }

        // Array
        let length, i;
        if (Array.isArray(a)) {
            length = a.length;
            if (length != b.length) {
                return false;
            }

            for (i = length; i-- !== 0;) { 
                if (!fastDeepEqual(a[i], b[i])) {
                    return false; 
                }
            }

            return true;
        }

        // RegExp
        if (a.constructor === RegExp) {
            return a.source === b.source && a.flags === b.flags;
        }

        // Object with valueOf, valueOf() 方法返回指定对象的原始值，默认返回对象本身
        if (a.valueOf && a.valueOf !== Object.prototype.valueOf) {
            return a.valueOf() === b.valueOf();
        }

        // Object with toString，toString() 方法返回一个表示该对象的字符串。
        if (a.toString && a.toString !== Object.prototype.toString) {
            return a.toString() === b.toString();
        }

        // Object
        const keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) {
            return false;
        }

        for (i = length; i-- !== 0;) { 
            if (!Object.prototype.hasOwnProperty.call(b, keys[i])) {
                return false; 
            }
        }

        for (i = length; i-- !== 0;) {
            const key = keys[i];

            if (!fastDeepEqual(a[key], b[key])) {
                return false;
            }
        }

        return true;
    }

    // true if both NaN, false otherwise
    // eslint-disable-next-line no-self-compare
    return a !== a && b !== b;
};

/**
 * @typedef {{ pass: boolean, actual: any, expected: any, description: string, operator: string }} AssertionResult
 * @typedef {(...args: any) => AssertionResult} AssertionFunction
 * @typedef {(...args: any) => void} Assertion
 */

export class AssertionError extends Error {
    /** @param {AssertionResult} result */
    constructor(result) {
        super(result.description);

        this.name = 'AssertionError';
        this.actual = result.actual;
        this.expected = result.expected;
        this.operator = result.operator;
        this.code = 'ERR_ASSERTION';

        const stackLines = this.stack.split('\n');
        stackLines.splice(0, 2);
        this.stack = stackLines.join('\n');

        const message = this.message ? `"${this.message}" ` : '';
        this.message = `${message}expected:[${result.expected}], actual:[${result.actual}], operator:<${result.operator}>`;
    }

    get [Symbol.toStringTag]() {
        return 'AssertionError';
    }
}

const $context = {
    suites: [],
    tests: [],
    result: [],
    startTime: null,
    runTimer: null,
    timeoutTimer: null,
    pathname: null,
    filename: null,
    load: false,
    total: 0,
    passed: 0,
    failed: 0,
    asserts: 0
};

/**
 * @param {AssertionFunction} fn 
 * @returns {Assertion}
 */
const assertMethodHook = (fn) => function (...args) {
    const result = fn(...args);
    if (!result.pass) {
        $context.asserts = ($context.asserts || 0) + 1;
        throw new AssertionError(result);
    }
};

/**
 * @param {string} methodName 
 */
const aliasMethodHook = (methodName) => function (...args) {
    return this[methodName](...args);
};

export const equal = assertMethodHook((actual, expected, description = 'should be equivalent') => ({
    pass: fastDeepEqual(actual, expected),
    actual,
    expected,
    description,
    operator: 'equal' /* EQUAL */
}));

export const deepEqual = aliasMethodHook('equal');

export const notEqual = assertMethodHook((actual, expected, description = 'should not be equivalent') => ({
    pass: !fastDeepEqual(actual, expected),
    actual,
    expected,
    description,
    operator: 'notEqual' /* NOT_EQUAL */
}));

export const notDeepEqual = aliasMethodHook('notEqual');

// Object.is 和 === 有细微差别，如 -0 和 +0 视为相等, Number.NaN 与 NaN 视为不相等
export const is = assertMethodHook((actual, expected, description = 'should be the same') => ({
    pass: Object.is(actual, expected),
    actual,
    expected,
    description,
    operator: 'is' /* IS */
}));

export const ok = assertMethodHook((actual, description = 'should be truthy') => ({
    pass: Boolean(actual),
    actual,
    expected: 'truthy value',
    description,
    operator: 'ok' /* OK */
}));

export const fail = assertMethodHook((description = 'fail called') => ({
    pass: false,
    actual: 'fail called',
    expected: 'fail not called',
    description,
    operator: 'fail' /* FAIL */
}));

export const throws = assertMethodHook((func, expected, description) => {
    let caught;
    let pass;
    let actual;
    if (typeof expected === 'string') {
        [expected, description] = [description, expected];
    }

    try {
        func();
    } catch (err) {
        caught = { error: err };
    }

    pass = caught !== undefined;
    actual = caught && caught.error;
    if (expected instanceof RegExp) {
        pass = expected.test(actual) || expected.test(actual && actual.message);
        actual = (actual && actual.message) || actual;
        expected = String(expected);

    } else if (typeof expected === 'function' && caught) {
        pass = actual instanceof expected;
        actual = actual.constructor;
    }

    return {
        pass,
        actual,
        expected,
        description: description || 'should throw',
        operator: 'throws' /* THROWS */
    };
});

export const doesNotThrow = assertMethodHook((func, expected, description) => {
    let caught;
    if (typeof expected === 'string') {
        [expected, description] = [description, expected];
    }

    try {
        func();
    } catch (err) {
        caught = { error: err };
    }

    return {
        pass: caught === undefined,
        expected: 'no thrown error',
        actual: caught && caught.error,
        operator: 'doesNotThrow' /* DOES_NOT_THROW */,
        description: description || 'should not throw'
    };
});

// ////////////////////////////////////////////////////////////////////////////
// 单元测试

/**
 * @param {*} meta 
 */
export async function loadAll(meta) {
    const path = await import('@tjs/path');
    const fs = await import('@tjs/fs');

    let basePath = null;
    if (typeof meta == 'string') {
        basePath = meta;

    } else {
        const __filename = meta.url.slice(7);
        basePath = path.dirname(__filename);
    }

    $context.load = true;
    $context.startTime = Date.now();

    try {
        const stat = await fs.stat(basePath);
        if (stat.type == 'file') {
            $context.pathname = basePath;
            $context.filename = basePath;
            await import(basePath);
            return;
        }

        // directory
        $context.pathname = basePath;
        const dirs = await fs.readdir(basePath);
        for (const dirent of dirs) {
            const name = dirent.name;
            if (name == 'test-all.js') {
                continue;

            } else if (!name.startsWith('test-')) {
                continue;
            }

            $context.filename = path.join(basePath, name);
            await import($context.filename);
        }

    } catch (err) {
        console.log(err);
    }
}

export async function runAll() {
    const colors = console.colors;

    const tests = $context.tests;
    if (!tests.length) {
        return;
    }

    console.print('');
    for (const test of tests) {
        $context.total += 1;
        $context.asserts = 0;
        let title;
        let hasError = false;

        try {
            await test.func();

            if ($context.asserts) {
                hasError = true;
            }

        } catch (error) {
            hasError = true;
            console.print(error);
        }

        if (hasError) {
            title = colors.background.red(' ✗ ');
            $context.failed += 1;
            $context.result.push({ description: test.description, ok: false });

        } else {
            title = colors.green(' ✔ ');
            $context.passed += 1;
            $context.result.push({ description: test.description, ok: true });
        }

        console.print(`${title} ${$context.total}. ${test.description}`);
    }

    const span = (Date.now() - $context.startTime) / 1000;
    console.print(`\n${colors.background.blue('RESULT')} ` +
        `total: ${$context.total}, ` +
        colors.green(`passed: ${$context.passed}, `) +
        colors.red(`failed: ${$context.failed}, `) +
        `time: ${span}s\n`);

    setTimeout(() => {
        process.exit($context.failed);
    }, 300);
}

/**
 * @param {string} description 
 * @param {function} func 
 * @returns 
 */
export function test(description, func) {
    const filename = $context.filename;
    const pathname = $context.pathname;
    $context.tests.push({ description, func, pathname, filename });
    if ($context.load) {
        return;
    }

    if ($context.runTimer) {
        return;
    }

    $context.startTime = Date.now();
    $context.runTimer = setTimeout(async () => {
        runAll();
    }, 1);
}

export async function sleep(timeout = 1000) {
    const promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            resolve(timer);
        }, timeout);
    });

    return promise;
}

/**
 * @param {number} timeout 
 * @param {function} func 
 * @returns 
 */
export function startTimeout(timeout, func) {
    $context.timeoutTimer = setTimeout(() => {
        $context.timeoutTimer = null;
        func();
    }, timeout);

    return $context.timeoutTimer;
}

export function stopTimeout() {
    if ($context.timeoutTimer) {
        clearTimeout($context.timeoutTimer);
        $context.timeoutTimer = null;
    }
}

export async function waitTimeout() {
    while ($context.timeoutTimer) {
        await sleep(100);
    }
}

/**
 * @param {any} actual 
 * @param {string} [message]
 */
export function assert(actual, message) {
    return ok(actual, message);
}

assert.deepEqual = deepEqual;
assert.doesNotThrow = doesNotThrow;
assert.equal = equal;
assert.fail = fail;
assert.is = is;
assert.notDeepEqual = notDeepEqual;
assert.notEqual = notEqual;
assert.ok = ok;
assert.throws = throws;

export default assert;
