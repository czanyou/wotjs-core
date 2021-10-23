// @ts-check
import { assert, test } from '@tjs/assert';
import * as util from '@tjs/util';

const text = 'test';

test('crypto.subtle.digest.MD5', async () => {
    const textEncoder = new TextEncoder();
    const subtle = window.crypto.subtle;

    const data = textEncoder.encode(text);
    const digest = await subtle.digest('MD5', data);
    assert.equal(digest.byteLength, 16);

    const value = util.encode(digest, 'hex');
    assert.equal(value, '098f6bcd4621d373cade4e832627b4f6');
});

test('crypto.subtle.digest.SHA256', async () => {
    const textEncoder = new TextEncoder();
    const subtle = window.crypto.subtle;

    const data = textEncoder.encode(text);
    const digest = await subtle.digest('SHA256', data);
    assert.equal(digest.byteLength, 32);

    const value = util.encode(digest, 'hex');
    assert.equal(value, '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
});

test('crypto.getRandomValues', () => {
    const TypedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
    const TypedArrayPrototypetoStringTag = Object.getOwnPropertyDescriptor(TypedArrayPrototype, Symbol.toStringTag).get;

    const types = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array];
    const arrayBuffer = new ArrayBuffer(256);

    for (const Type of types) {
        const typedArray = new Type(arrayBuffer);
        window.crypto.getRandomValues(typedArray);
        const arrayString = TypedArrayPrototypetoStringTag.call(typedArray);
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
