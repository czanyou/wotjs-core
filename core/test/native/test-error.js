// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as native from '@tjs/native';

test('native.error', () => {
    // Error
    const error = new native.Error(-1);
    assert.ok(error);
    assert.equal(error.errno, -1);
    assert.equal(error.name, 'Error');
    assert.equal(error.code, 'UV_ERROR');
    assert.equal(error.message, 'operation not permitted');
    // console.log(error.errno, error.code, error.message);

    // errors
    const errors = native.errors;
    assert.ok(errors);
    assert.equal(errors.UV_EACCES, -13);
    // console.log(errors.UV_EACCES);

    // strerror
    {
        const message = native.strerror(-2);
        assert.equal(message, 'no such file or directory');
        // console.log(message);
    }

    try {
        const value = Symbol(100);
        // @ts-ignore
        const error = new native.Error(value);
        console.log(error);

    } catch (error) {
        // console.log('error', error.name, error.message);
    }

    {
        // @ts-ignore
        const message = native.strerror('12A');
        assert.equal(message, undefined);
        // console.log(message);
    }
});
