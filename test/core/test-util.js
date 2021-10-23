// @ts-check
import { assert, test } from '@tjs/assert';

import * as util from '@tjs/util';

const text = 'test123456';

test('util', async () => {
    assert.ok(util != null);

});

test('util.format.stringify', () => {
    assert.equal(util.format.stringify(999, 'bytes'), '999');
    assert.equal(util.format.stringify(1999, 'bytes'), '2KB');
    assert.equal(util.format.stringify(1999999, 'bytes'), '2MB');
    assert.equal(util.format.stringify(1999999999, 'bytes'), '2GB');
    assert.equal(util.format.stringify(1999999999999, 'bytes'), '2TB');

    assert.equal(util.format.stringify(1999, 'bytes', 2), '1.95KB');

    assert.equal(util.format.stringify(999, 'time'), '999ms');
    assert.equal(util.format.stringify(1999, 'time'), '2s');
    assert.equal(util.format.stringify(199999, 'time'), '3m');
    assert.equal(util.format.stringify(19999999, 'time'), '6h');
    assert.equal(util.format.stringify(1999999999, 'time'), '23d');

    assert.equal(util.format.stringify(1505, 'time', 1), '1.5s');
});

test('util.format.parse', () => {
    assert.equal(util.format.parseNumber('999', 'bytes'), 999);
    assert.equal(util.format.parseNumber('2KB', 'bytes'), 2 * 1024);
    assert.equal(util.format.parseNumber('2MB', 'bytes'), 2 * 1024 * 1024);
    assert.equal(util.format.parseNumber('2GB', 'bytes'), 2 * 1024 * 1024 * 1024);

    assert.equal(util.format.parseNumber('999ms', 'time'), 999);
    assert.equal(util.format.parseNumber('2s', 'time'), 2 * 1000);
    assert.equal(util.format.parseNumber('2m', 'time'), 2 * 60 * 1000);
    assert.equal(util.format.parseNumber('2h', 'time'), 2 * 60 * 60 * 1000);
    assert.equal(util.format.parseNumber('2d', 'time'), 2 * 24 * 60 * 60 * 1000);
});

test('util.toBuffer', () => {
    const data = util.toBuffer(text);
    assert.equal(data.byteLength, text.length);
    const output = util.toString(data);
    assert.equal(output, text);
});

test('util.encode.hex', () => {
    const data = util.toBuffer(text);
    const encoded = util.encode(data, 'hex');
    assert.equal(encoded.length, data.byteLength * 2);
    // console.log(encoded);

    const decoded = util.decode(encoded, 'hex');
    const output = util.toString(decoded);
    // console.log(output);

    assert.equal(output, text);
});

test('util.encode.base64', () => {
    const data = util.toBuffer(text);
    const encoded = util.encode(data, 'base64');
    assert.equal(encoded.length, data.byteLength * 16 / 10);
    // console.log(encoded);

    const decoded = util.decode(encoded, 'base64');
    const output = util.toString(decoded);
    // console.log(output);

    assert.equal(output, text);
});
