import * as assert from '@tjs/assert';

import { test } from '@tjs/test';

function checkFail(func) {
    assert.throws(func, assert.AssertionError, 'should throws AssertionError');
}

test('assert', () => {
    // equal
    assert.equal(200, 200);
    checkFail(() => { assert.equal(100, '100'); });

    // notEqual
    assert.notEqual(100, '100');
    checkFail(() => { assert.notEqual(200, 200); });

    // ok
    assert.ok(true);
    checkFail(() => { assert.ok(false, 'false is not ok'); });

    // fail
    checkFail(() => { assert.fail('fail is fail'); });

    // throws
    assert.throws(() => { throw new Error('test'); }, Error, 'should throws Error');
    checkFail(() => { assert.throws(() => { }, Error); });

    // doesNotThrow
    assert.doesNotThrow(() => {}, Error, 'should not throws Error');
    checkFail(() => { assert.doesNotThrow(() => { throw new Error('test'); }, Error); });
});
