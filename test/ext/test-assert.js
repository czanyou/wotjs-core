// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';

assert.test('assert', () => {
    // equal
    assert.equal(100, 100);
    assert.equal(true, true);
    assert.equal(false, false);
    assert.equal(null, null);
    assert.equal(undefined, undefined);
    assert.equal('string', 'string');
    assert.equal({}, {});

    // notEqual
    assert.notEqual(100, '100');
    assert.notEqual(true, 'true');
    assert.notEqual(false, 'false');
    assert.notEqual(null, undefined);
    assert.notEqual({}, []);

    // ok
    assert.ok(true);
    assert.ok(1);
    assert.ok('true');
    assert.ok('false');

    // throws
    assert.throws(() => { throw new Error(); }, Error);
    assert.doesNotThrow(() => { }, Error);
});

assert.test('assert.waitTimeout', async () => {
    const start = Date.now();
    await assert.waitTimeout();
    const now = Date.now();
    assert.ok(now - start <= 100);
});

assert.test('assert.stopTimeout', async () => {
    const start = Date.now();
    assert.stopTimeout();
    const now = Date.now();
    assert.ok(now - start <= 100);
});

assert.test('assert.timeout.wait', async () => {
    let timeout = 0;
    const start = Date.now();
    assert.startTimeout(100, () => {
        timeout = 1;
    });

    await assert.waitTimeout();
    const now = Date.now();

    assert.equal(timeout, 1);
    assert.ok(now - start >= 90, String(now - start));
});

assert.test('assert.timeout.stop', async () => {
    let timeout = 0;
    const start = Date.now();
    assert.startTimeout(100, () => {
        timeout = 1;
    });

    setTimeout(() => { assert.stopTimeout(); }, 50);

    await assert.waitTimeout();
    const now = Date.now();

    assert.equal(timeout, 0);
    assert.ok(now - start >= 40);
    assert.ok(now - start < 110);
});
