// @ts-check
import * as native from '@tjs/native';
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('native.tty', () => {
    assert.ok(native.TTY);
    assert.equal(native.TTY.MODE_NORMAL, 0);
    assert.equal(native.TTY.MODE_RAW, 1);
    assert.equal(native.TTY.MODE_IO, 2);

    assert.ok(!native.isatty(undefined));
    assert.ok(!native.isatty(null));
    assert.ok(native.isatty(native.STDIN_FILENO));
    assert.ok(native.isatty(native.STDOUT_FILENO));
    assert.ok(native.isatty(native.STDERR_FILENO));

    assert.ok(!native.isatty(3));
    assert.ok(!native.isatty('0'));
    assert.ok(!native.isatty('1'));
    assert.ok(!native.isatty('2'));
    assert.ok(!native.isatty('test'));

    assert.ok(native.isatty(1.4));
    assert.ok(!native.isatty({}));
});

test('native.TTY', () => {
    const stdin = new native.TTY(native.STDIN_FILENO, true);
    assert.ok(stdin);
});
