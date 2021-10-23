// @ts-check
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';
import * as fs from '@tjs/fs';

const zlib = native.zlib;

const rawData = "1111111111111222222222223333333333344444444444555555555555".repeat(10);
const zipname = '/tmp/test.zip';

test('add', async () => {
    await fs.unlink(zipname);

    const textEncoder = new TextEncoder();
    const uncompressData = textEncoder.encode(rawData);
    const ret = zlib.add(zipname, 'test.txt', uncompressData);
    assert.equal(ret, 1);

    const data = zlib.extract(zipname, 'test.txt');
    const textDecoder = new TextDecoder();
    const output = textDecoder.decode(data);
    assert.equal(output, rawData);
});

test('Reader', () => {
    const textDecoder = new TextDecoder();

    const reader = new zlib.Reader();
    const ret = reader.open('/tmp/test.zip');
    assert.equal(ret, 1);

    const count = reader.count();
    assert.equal(count, 1);

    const stat = reader.stat(0);
    // console.log('stat', stat);
    assert.equal(stat.size, rawData.length);

    const data1 = reader.extract(0);
    assert.equal(textDecoder.decode(data1), rawData);

    const data2 = reader.extract('test.txt');
    assert.equal(textDecoder.decode(data2), rawData);

    reader.close();
    reader.close();

    assert.equal(undefined, reader.extract(0));
});

test('compress', () => {
    const textEncoder = new TextEncoder();
    const uncompressData = textEncoder.encode(rawData);
    // console.log('uncompressData', uncompressData);

    const uncompressSize = uncompressData.length;
    const compressedData = zlib.compress(uncompressData);
    // console.log('compressedData', compressedData);

    const uncompressedData = zlib.uncompress(compressedData, uncompressSize);
    const textDecoder = new TextDecoder();
    // console.log('uncompressedData', uncompressedData);
    // console.log('uncompressedData', textDecoder.decode(uncompressedData));

    assert.equal(textDecoder.decode(uncompressedData), rawData)
});
