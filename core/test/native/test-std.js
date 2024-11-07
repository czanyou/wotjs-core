#!/usr/bin/env tjs
// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import * as fs from '@tjs/fs';
import { test } from '@tjs/test';

import * as native from '@tjs/native';

/**
 * 环境变量测试
 */
test('native.env', () => {
    // setenv & getenv
    native.setenv('tjs-test', 'TEST');

    const value1 = native.getenv('tjs-test');
    assert.equal(value1, 'TEST');

    // not exist key
    const value2 = native.getenv('tjs-test-not-exist');
    assert.equal(value2, undefined);

    // null key
    // @ts-ignore
    const value3 = native.getenv(null);
    assert.equal(value3, undefined);

    // int key & value
    // @ts-ignore
    native.setenv(100, 1000);
    // @ts-ignore
    const value4 = native.getenv(100);
    assert.equal(value4, '1000');

    // boolean value
    // @ts-ignore
    native.setenv('tjs-test5', true);
    const value5 = native.getenv('tjs-test5');
    assert.equal(value5, 'true');

    // environ
    const environ = native.environ();
    assert.equal(environ['tjs-test'], 'TEST');
    // console.log(environ);

    // unsetenv
    native.unsetenv('tjs-test');
    const value100 = native.getenv('tjs-test');
    assert.equal(value100, undefined);
});

/**
 * 标准库测试
 */
test('native.std', () => {
    assert.ok(native.cwd(), 'cwd');
    assert.ok(native.exepath(), 'exepath');
    assert.ok(native.runtime.gc, 'gc');
    assert.ok(native.homedir(), 'homedir');
    assert.ok(native.hrtime(), 'hrtime');
    assert.ok(native.tmpdir(), 'tmpdir');
    assert.ok(native.uname(), 'uname');
    assert.ok(native.gettimeofday(), 'gettimeofday');

    // console.log(native);
});

/*
test('native.print', () => {
    native.write('1.write');
    native.alert('2.alert');
    native.print('3.print');
});
*/

/**
 * 系统日志接口测试
 */
test('native.syslog', () => {
    assert.ok(native.openlog, 'openlog');
    assert.ok(native.syslog, 'syslog');
});

/**
 * 运行时测试
 */
test('native.evalScript', async () => {
    const path = await import('@tjs/path');
    const __filename = import.meta.url.slice(7); // strip "file://"
    const __dirname = path.dirname(__filename);

    // evalScript
    const script = '(function() { return 100; }) ()';
    assert.equal(native.runtime.evalScript(script), 100);

    // loadScript
    const filename = __dirname + '/helpers/test-eval.js';
    assert.equal(native.runtime.loadScript(filename), 200);

    native.runtime.gc();

    console.log(native.runtime);

});

test('native.writeObject', async () => {
    // 
    const object = {
        text: 'abc', int: 100, float: 100.5, bool: true,
        array: [1, 2, 3], obj: { a: 100 }
    };
    
    const flags = 1 + 8;
    const buffer = native.runtime.writeObject(object, flags);

    console.log(buffer);

    const result = native.runtime.readObject(buffer, 0, buffer.byteLength, flags);
    console.log('result:', result);

    // const ret = await native.runtime.evalByteCode(bytecode);
    // console.log('ret:', ret);
});

test('native.compile', async () => {
    const path = await import('@tjs/path');
    const __filename = import.meta.url.slice(7); // strip "file://"
    const __dirname = path.dirname(__filename);

    const filename = __dirname + '/helpers/test-eval.js';
    const filedata = await native.fs.readFile(filename);
    console.log('filedata:', filedata);

    const buffer = native.runtime.compile(filedata, filename);
    console.log('bytecode:', buffer);

    // const code = native.runtime.loadScript(filename2);
    const code = await native.runtime.evalByteCode(buffer, 0, buffer.byteLength);
    console.log('code:', code);
});

test('native.compile', async () => {
    const path = await import('@tjs/path');
    const __filename = import.meta.url.slice(7); // strip "file://"
    const __dirname = path.dirname(__filename);

    const filename = __dirname + '/helpers/test-module.js';
    const filedata = await native.fs.readFile(filename);
    console.log('filedata:', filedata);

    const buffer = native.runtime.compile(filedata, filename);
    console.log('bytecode:', buffer);

    const code = await native.runtime.evalByteCode(buffer, 0, buffer.byteLength);
    console.log('code:', code);
});
