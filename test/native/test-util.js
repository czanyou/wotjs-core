// @ts-check
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';

const util = native.util;

test('native.util.hash', () => {
    const text = 'test';
    const data = util.textEncode(text);
    assert.equal(text.length, 4);
    // console.log('data:', data);

    // MD5
    const hash1 = util.hash(data, util.HASH_MD5);
    assert.equal(hash1.length, 16);

    const result = util.encode(hash1, util.CODE_HEX);
    assert.equal(result, '098f6bcd4621d373cade4e832627b4f6');

    // SHA1
    const hash2 = util.hash(data, util.HASH_SHA1);
    assert.equal(hash2.length, 20);

    const result2 = util.encode(hash2, util.CODE_HEX);
    assert.equal(result2, 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3');
});

test('native.util.text', () => {
    const text = 'test2014';
    const data = util.textEncode(text);
    assert.equal(text.length, 8);

    let output = util.textDecode(data);
    assert.equal(output, text);

    output = util.textDecode(data);
    assert.equal(output, text);
    // assert.equal(output, text);
});
