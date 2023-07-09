// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import * as storage from '@tjs/storage';
import { test } from '@tjs/test';

test('sessionStorage', async () => {
    await storage.loadStorages('test');

    const sessionStorage = window.sessionStorage;
    sessionStorage.clear();

    // setItem
    sessionStorage.setItem('test', '100');

    // getItem
    const value = sessionStorage.getItem('test');
    assert.equal(value, '100');
    assert.equal(sessionStorage.test, '100');
    assert.equal(sessionStorage.length, 1);
    assert.equal(sessionStorage.key(0), 'test');

    // update
    sessionStorage.test = 200;
    assert.equal(sessionStorage.getItem('test'), '200');

    // clear
    sessionStorage.clear();
    assert.equal(sessionStorage.length, 0);
    assert.equal(sessionStorage.key(0), null);
});

test('localStorage', async () => {
    await storage.loadStorages('test');

    const localStorage = window.localStorage;
    localStorage.clear();

    // setItem
    localStorage.setItem('test', '100');

    // getItem
    const value = localStorage.getItem('test');
    assert.equal(value, '100');
    assert.equal(localStorage.test, '100');
    assert.equal(localStorage.length, 1);
    assert.equal(localStorage.key(0), 'test');

    // update
    localStorage.test = 200;
    assert.equal(localStorage.getItem('test'), '200');

    // clear
    localStorage.clear();
    assert.equal(localStorage.length, 0);
    assert.equal(localStorage.key(0), null);
});
