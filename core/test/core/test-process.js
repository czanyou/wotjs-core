// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as process from '@tjs/process';

test('process.argv', () => {
    assert.ok(process.argv[0].endsWith('tjs'));
    assert.equal(process.argv[1], 'test');
    assert.equal(process.command, undefined);
    assert.ok(Array.isArray(process.argv), 'process.argv is an array');
});

function testProcess() {
    assert.ok(process.pid > 0);
    assert.ok(process.ppid > 0);

    assert.ok(process.scriptPath());
    assert.ok(process.args);
    assert.ok(process.root);
    assert.ok(process.version);
    assert.ok(process.versions);
    assert.ok(process.argv);

    console.log(process.execPath());
    console.log(process.scriptPath());
    console.log(process.getuid());
    console.log(process.getgid());
    console.log(process.geteuid());
    console.log(process.getegid());
}

function testEnv() {
    process.setenv('test', 'TEST');
    const value1 = process.getenv('test');
    assert.equal(value1, 'TEST');

    const environ = process.environ();
    assert.equal(environ.test, 'TEST');
    // console.log(envs);

    process.unsetenv('test');

    const value2 = process.getenv('test');
    assert.equal(value2, undefined);
}

test('process', testProcess);
test('process.env', testEnv);
