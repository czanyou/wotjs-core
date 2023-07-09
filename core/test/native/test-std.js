// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as native from '@tjs/native';

test('native.env', () => {
    native.setenv('test', 'TEST');
    const value1 = native.getenv('test');
    assert.equal(value1, 'TEST');

    const environ = native.environ();
    // eslint-disable-next-line dot-notation
    assert.equal(environ['test'], 'TEST');
    // console.log(envs);

    native.unsetenv('test');

    const value2 = native.getenv('test');
    assert.equal(value2, undefined);
});

test('native.std', () => {
    assert.ok(native.cwd(), 'cwd');
    assert.ok(native.exepath(), 'exepath');
    assert.ok(native.runtime.gc, 'gc');
    assert.ok(native.homedir(), 'homedir');
    assert.ok(native.hrtime(), 'hrtime');
    assert.ok(native.tmpdir(), 'tmpdir');
    assert.ok(native.uname(), 'uname');
    assert.ok(native.gettimeofday(), 'gettimeofday');
});

/*
test('native.print', () => {
    native.write('1.write');
    native.alert('2.alert');
    native.print('3.print');
});
*/

test('native.syslog', () => {
    assert.ok(native.openlog, 'openlog');
    assert.ok(native.syslog, 'syslog');
});

test('native.evalScript', async () => {
    const path = await import('@tjs/path');
    const __filename = import.meta.url.slice(7); // strip "file://"
    const __dirname = path.dirname(__filename);

    assert.equal(native.runtime.evalScript('(function() { return 100; }) ()'), 100);
    assert.equal(native.runtime.loadScript(__dirname + '/helpers/test-eval.js'), 200);

    native.runtime.gc();
});
