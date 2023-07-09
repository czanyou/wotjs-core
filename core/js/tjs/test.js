// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as process from '@tjs/process';

// ////////////////////////////////////////////////////////////////////////////
// 单元测试

/**
 * @typedef {{ description: string, func:function, pathname:string, filename:string }} TestCase
 * @typedef {{ description: string, ok: boolean }} TestResult
 * @typedef {{ filename: string, tests: TestCase[] }} TestSuite
 */

export const $context = {
    /** @type TestSuite[] 测试套件列表 */
    suites: [],

    /** @type TestSuite | null */
    suite: null,

    /** @type string[] */
    filenames: [],

    /** @type TestResult[] 测试结果统计 */
    result: [],

    /** @type number 开始运行时间 */
    startTime: 0,

    /** @type any */
    runTimer: undefined,

    /** @type string 当前测试用例所在的文件或目录 */
    pathname: '',

    /** @type string 当前测试用例所属的脚本文件 */
    filename: '',

    /** @type boolean 加载标记 */
    loaded: false,

    /** @type number 总共测试用例数 */
    total: 0,

    /** @type number 通过测试的用例数 */
    passed: 0,

    /** @type number 未通过测试的用例数 */
    failed: 0,

    /** @type number */
    asserts: 0
};

/**
 * 加载指定目录下所有测试用例
 * @param {string|{url:string}} meta 
 * @returns {Promise<void>}
 */
export async function loadAll(meta) {
    // console.print('test:', 'load:', meta);

    const path = await import('@tjs/path');
    const fs = await import('@tjs/fs');

    // basePath
    let basePath = null;
    if (typeof meta == 'string') {
        basePath = meta;

    } else {
        const __filename = meta.url.slice(7);
        basePath = path.dirname(__filename);
    }

    $context.loaded = true;
    $context.startTime = Date.now();

    try {
        const stat = await fs.stat(basePath);
        if (stat.type == 'file') {
            // 单个文件
            $context.pathname = basePath;
            $context.filename = basePath;
            $context.filenames.push($context.filename);

            /** @type TestSuite */
            const suite = { filename: basePath, tests: [] };
            $context.suite = suite;
            $context.suites.push(suite);
            await import(basePath);

        } else {
            // 目录 directory
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
                $context.filenames.push($context.filename);
                // console.log('filename:', $context.filename);

                const suite = { filename: basePath, tests: [] };
                $context.suite = suite;
                $context.suites.push(suite);
                await import($context.filename);
            }
        }

    } catch (err) {
        console.log(err);
    }
}

/**
 * 运行所有测试用例
 * @returns {Promise<void>}
 */
export async function runAll() {
    console.print('test:', 'run:', 'all');

    const colors = console.colors;
    const FAILED = colors.background.red(' ✗ ');
    const PASSED = colors.green(' ✔ ');

    const suites = $context.suites;
    if (!suites.length) {
        return;
    }

    const timer = setInterval(() => { }, 1000);

    /**
     * @param {TestCase} test 
     */
    async function runTest(test) {
        $context.total += 1;
        $context.asserts = 0;
        let title = FAILED;
        let hasError = false;

        // run test case
        try {
            await test.func();

            if ($context.asserts) {
                hasError = true;
            }

        } catch (error) {
            hasError = true;
            console.print(error);
        }

        // print test case result
        if (hasError) {
            $context.failed += 1;
            $context.result.push({ description: test.description, ok: false });

        } else {
            title = PASSED;
            $context.passed += 1;
            $context.result.push({ description: test.description, ok: true });
        }

        console.print(`${title}[${$context.total}] ${test.description}`);
    }

    function printTestResult() {
        // print test result
        const span = (Date.now() - $context.startTime) / 1000;
        let result = '';
        if ($context.failed) {
            result = `\n${colors.background.red(' FAILED ')} `;
        } else {
            result = `\n${colors.background.green(' PASS ')} `;
        }

        result += colors.green(`passed: ${$context.passed}/${$context.total}, `);

        if ($context.failed) {
            result += colors.red(`failed: ${$context.failed}, `);
        }

        result += `time: ${span}s\n`;
        console.print(result);
    }

    console.print('');
    for (const suite of suites) {
        const tests = suite.tests;

        if (suite.filename) {
            console.print(colors.bright.black(`= ${suite.filename}:`));
        }

        for (const test of tests) {
            await runTest(test);
        }
    }

    clearInterval(timer);
    printTestResult();

    // exit test
    setTimeout(() => { process.exit($context.failed); }, 300);
}

/**
 * 注册测试用例
 * @param {string} description 描述信息
 * @param {function} func 测试用例
 * @returns {void}
 */
export function test(description, func) {
    // test suite
    const filename = $context.filename;
    if (!$context.suite) {
        const suite = { filename, tests: [] };
        $context.suite = suite;
        $context.suites.push(suite);
    }

    // test case
    const pathname = $context.pathname;
    const testCase = { description, func, pathname, filename };
    $context.suite.tests.push(testCase);

    // console.log('test:', description);

    // start run
    if ($context.loaded) {
        return;

    } else if ($context.runTimer) {
        return;
    }

    $context.startTime = Date.now();
    $context.runTimer = setTimeout(async () => {
        await runAll();
    }, 1);
}
