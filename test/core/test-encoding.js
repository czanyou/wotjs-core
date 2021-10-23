// @ts-check
import { assert, test } from '@tjs/assert';

import * as util from '@tjs/util';

const text = 'test123456';

test('textEncoder', () => {
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    const data = textEncoder.encode(text);
    assert.equal(data.length, text.length);
    const output = textDecoder.decode(data);
    // console.log(output);

    assert.equal(output, text);
});

test('window.atob', () => {
    const encoded = window.btoa(text);
    // console.log(encoded);

    const decoded = window.atob(encoded); // , 1);
    const output = decoded; // util.toString(decoded);
    // console.log(output, window.atob(encoded));

    assert.equal(output, text);
    assert.equal(window.atob(encoded), text);
});

test('string.length', () => {
    const text = 'abcde12345我的太阳𠮷😁';
    const buffer = util.toBuffer(text);

    assert.equal(text.length, 18);
    assert.equal(buffer.byteLength, 30);
    assert.equal(console.width(text), 22);
});
