// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as util from '@tjs/util';

import * as native from '@tjs/native';
const crypto = native.crypto;

test('native.crypto.digest', () => {
    assert.ok(crypto);
    assert.equal(crypto.MD_MD5, 1);
    assert.equal(crypto.MD_SHA1, 2);
    assert.equal(crypto.MD_SHA256, 4);
    assert.equal(crypto.MD_SHA512, 6);

    const result1 = crypto.digest(crypto.MD_MD5, 'test');
    const result2 = crypto.digest(crypto.MD_SHA1, 'test');
    const result3 = crypto.digest(crypto.MD_SHA256, 'test');
    const result4 = crypto.digest(crypto.MD_SHA512, 'test');

    assert.equal(util.encode(result1), '098f6bcd4621d373cade4e832627b4f6');
    assert.equal(util.encode(result2), 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3');
    assert.equal(util.encode(result3), '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    assert.equal(util.encode(result4), 'ee26b0dd4af7e749aa1a8ee3c10ae9923f618980772e473f8819a5d4940e0db27ac185f8a0e1d5f84f88bc887fd67b143732c304cc5fa9ad8e6f57f50028a8ff');

});

test('native.crypto.digest.name', () => {
    // @ts-ignore
    const result0 = crypto.digest('MD5');
    assert.equal(result0, null);

    assert.throws(() => {
        // @ts-ignore
        crypto.digest('263', 'test');
    }, Error);

    const result1 = crypto.digest('MD5', 'test');
    const result2 = crypto.digest('SHA1', 'test');
    const result3 = crypto.digest('SHA256', 'test');
    const result4 = crypto.digest('SHA512', 'test');

    assert.equal(util.encode(result1), '098f6bcd4621d373cade4e832627b4f6');
    assert.equal(util.encode(result2), 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3');
    assert.equal(util.encode(result3), '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    assert.equal(util.encode(result4), 'ee26b0dd4af7e749aa1a8ee3c10ae9923f618980772e473f8819a5d4940e0db27ac185f8a0e1d5f84f88bc887fd67b143732c304cc5fa9ad8e6f57f50028a8ff');

});

test('native.crypto.hmac.name', () => {
    // @ts-ignore
    const result0 = crypto.hmac();
    assert.equal(result0, null);

    // @ts-ignore
    const result3 = crypto.hmac('263', 'test');
    assert.equal(result3, null);

    assert.throws(() => {
        // @ts-ignore
        crypto.hmac('SHA256', 'test', 100);
    }, Error);

    assert.throws(() => {
        // @ts-ignore
        crypto.hmac('263', 'test', '12345678');
    }, Error);

    const result1 = crypto.hmac('SHA256', 'test', '12345678');
    assert.equal(util.encode(result1), '7b7970bd474ce934bd20a9230ba42962e943961daa1541d6195eee8afdd44798');

    const result2 = crypto.hmac(crypto.MD_SHA256, 'test', '12345678');
    assert.equal(util.encode(result2), '7b7970bd474ce934bd20a9230ba42962e943961daa1541d6195eee8afdd44798');
});
