// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as util from '@tjs/util';

const text = 'abc';

test('crypto.subtle.digest.MD5', async () => {
    const textEncoder = new TextEncoder();
    const subtle = window.crypto.subtle;

    const data = textEncoder.encode(text);
    const digest = await subtle.digest('MD5', data);
    assert.equal(digest.byteLength, 16);

    const value = util.encode(digest, 'hex');
    assert.equal(value, '900150983cd24fb0d6963f7d28e17f72');
});

test('crypto.subtle.digest.SHA256', async () => {
    const textEncoder = new TextEncoder();
    const subtle = window.crypto.subtle;

    const data = textEncoder.encode(text);
    const digest = await subtle.digest('SHA256', data);
    assert.equal(digest.byteLength, 32);

    const value = util.encode(digest, 'hex');
    assert.equal(value, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('crypto.subtle.digest.SHA512', async () => {
    const textEncoder = new TextEncoder();
    const subtle = window.crypto.subtle;

    const data = textEncoder.encode(text);
    const digest = await subtle.digest('SHA512', data);
    assert.equal(digest.byteLength, 64);

    const value = util.encode(digest, 'hex');
    assert.equal(value, 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f');
});

test('crypto.subtle.hmac', async () => {
    const textEncoder = new TextEncoder();
    const subtle = window.crypto.subtle;
    
    
});

test('crypto.getRandomValues', () => {
    const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
    const TypedArrayPrototypetoStringTag = Object.getOwnPropertyDescriptor(TypedArrayPrototype, Symbol.toStringTag)?.get;

    const types = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array];
    const arrayBuffer = new ArrayBuffer(256);

    for (const Type of types) {
        const typedArray = new Type(arrayBuffer);
        window.crypto.getRandomValues(typedArray);
        const arrayString = TypedArrayPrototypetoStringTag?.call(typedArray);
        assert.ok(typedArray, `getRandomValues works for ${arrayString}`);
    }

    const badTypes = [null, undefined, {}, '', NaN, 123];

    for (const type of badTypes) {
        // @ts-ignore
        assert.throws(() => { window.crypto.getRandomValues(type); }, TypeError, `throws TypeError for ${type}`);
    }

    assert.throws(() => { window.crypto.getRandomValues(new Uint8Array(largeBuf)); }, Error, 'large buffer length throws');
    const largeBuf = new ArrayBuffer(128 * 1024);
    assert.throws(() => { window.crypto.getRandomValues(new Uint8Array(largeBuf)); }, Error, 'large buffer length throws');
});
