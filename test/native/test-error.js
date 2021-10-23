// @ts-check
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';

test('native.error', () => {
    const error = new native.Error(-1);
    assert.ok(error);
    assert.equal(error.errno, -1);
    assert.equal(error.message, 'operation not permitted');
    // console.log(error.message, error.errno, error);

    // strerror
    const message = native.Error.strerror(-2);
    assert.equal(message, 'no such file or directory');
    // console.log(message);
});
