// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';
import process from '@tjs/process';

test('process.argv', () => {
    // console.log(process.argv, process.script);

    assert.ok(process.argv[0].endsWith('tjs'));
    assert.equal(process.argv[1], 'test');
    assert.equal(process.applet, undefined);
    assert.ok(Array.isArray(process.argv), 'process.argv is an array');
});

function testProcess() {
    assert.ok(process.pid > 0);
    assert.ok(process.ppid > 0);

    assert.ok(process.arch);
    assert.ok(process.platform);
    assert.ok(process.root);
    assert.ok(process.version);
    assert.ok(process.versions);
    assert.ok(process.argv);

    const cwd = process.cwd();
    process.chdir('/');
    assert.equal(process.cwd(), '/');
    assert.ok(process.exepath());
    process.chdir(cwd);

    let hrtime = process.hrtime();
    assert.equal(typeof hrtime, 'bigint');
    hrtime = hrtime / 1000_000_000n;
    assert.ok(hrtime > 0);
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
