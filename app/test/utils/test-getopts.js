// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as getopts from '../../modules/utils/getopts.js';

import { test } from '@tjs/test';

test('getopts', () => {
    const argv = ['-c', '-de1', '-ffoo', '--config', '--no-return', '--name', 'test', '--foo=bar', '-p', '2003', '100'];
    const options = getopts.parse(argv, {
        boolean: ['a', 'p'],
        string: ['b', 'f']
    });
    // console.log(options);

    // options
    assert.ok(options.a === false);
    assert.equal(options.b, '');
    assert.ok(options.c === true);
    assert.ok(options.d === true);
    assert.equal(options.e, 1);
    assert.equal(options.f, 'foo');
    assert.ok(options.config === true);
    assert.ok(options.p === true);
    assert.ok(options.return === false);
    assert.equal(options.name, 'test');
    assert.equal(options.foo, 'bar');

    // operands
    assert.equal(options._[0], '2003');
    assert.equal(options._[1], '100');
});

test('getopts.alias', () => {
    const argv = ['-t', '100'];
    const options = getopts.parse(argv, { alias: { test: ['t', 'T'] } });
    // console.log(options);

    assert.equal(options.test, 100);
    assert.equal(options.T, 100);
    assert.equal(options.t, 100);
});

test('getopts.default', () => {
    const argv = ['-t', '100'];
    const options = getopts.parse(argv, { default: { a: 10, b: 'test', t: 0 } });
    // console.log(options);

    assert.equal(options.a, 10);
    assert.equal(options.b, 'test');
    assert.equal(options.t, 100);
});

test('getopts.--', () => {
    // Everything after a standalone -- is an operand.
    const argv = ['--test', '--', '--foo=bar', '-p', '2003', '100'];
    const options = getopts.parse(argv, {});
    // console.log(options);

    // options
    assert.ok(options.test === true);

    // operands
    assert.equal(options._[0], '--foo=bar');
});

test('getopts.-', () => {
    // A single - is also treated as an operand.
    const argv = ['--test', '-', '--foo=bar', '-a', '2003', '-b', 'true', '-c', '25.5', '-d', 'false', '100'];
    const options = getopts.parse(argv, {});
    // console.log(options);

    // options
    assert.ok(options.test === true);
    assert.equal(options.foo, 'bar');
    assert.equal(options.a, 2003);
    assert.equal(options.b, 'true');
    assert.equal(options.c, 25.5);
    assert.equal(options.d, false);

    // operands
    assert.equal(options._[0], '-');
    assert.equal(options._[1], '100');
});

test('getopts.stopEarly', () => {
    // This property is useful when implementing sub-commands in a CLI.
    const argv = ['-t9', 'test', '--foo=bar', '-a', '2', '100'];
    const options1 = getopts.parse(argv, { stopEarly: true });
    // console.log(options1);
    assert.equal(options1._[0], 'test');
    assert.equal(options1._[1], '--foo=bar');

    const options2 = getopts.parse(argv, { stopEarly: false });
    // console.log(options2);
    assert.equal(options2._[0], 'test');
    assert.equal(options2._[1], '100');
});
