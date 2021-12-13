// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

test('sessionStorage', () => {
    const storage = window.sessionStorage;

    // setItem
    storage.setItem('test', '100');

    // getItem
    const value = storage.getItem('test');
    assert.equal(value, '100');
    assert.equal(storage.test, '100');
    assert.equal(storage.length, 1);
    assert.equal(storage.key(0), 'test');

    // update
    storage.test = 200;
    assert.equal(storage.getItem('test'), '200');

    // clear
    storage.clear();
    assert.equal(storage.length, 0);
    assert.equal(storage.key(0), undefined);
});

test('localStorage', () => {
    const storage = window.localStorage;

    // setItem
    storage.setItem('test', '100');

    // getItem
    const value = storage.getItem('test');
    assert.equal(value, '100');
    assert.equal(storage.test, '100');
    assert.equal(storage.length, 1);
    assert.equal(storage.key(0), 'test');

    // update
    storage.test = 200;
    assert.equal(storage.getItem('test'), '200');

    // clear
    storage.clear();
    assert.equal(storage.length, 0);
    assert.equal(storage.key(0), undefined);
});
