// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('assert', () => {
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
