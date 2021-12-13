// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';
import * as fs from '@tjs/fs';

const zlib = native.zlib;

const rawData = '1111111111111222222222223333333333344444444444555555555555'.repeat(10);
const zipname = '/tmp/test.zip';
const testfile = 'test.txt';

test('native.zlib.add', async () => {
    try {
        await fs.unlink(zipname);
    } catch (err) {

    }

    const textEncoder = new TextEncoder();
    const uncompressData = textEncoder.encode(rawData);
    const ret = zlib.add(zipname, testfile, uncompressData);
    assert.equal(ret, 1);

    const data = zlib.extract(zipname, testfile);
    const textDecoder = new TextDecoder();
    const output = textDecoder.decode(data);
    assert.equal(output, rawData);
});

test('native.zlib.Reader', () => {
    const textDecoder = new TextDecoder();

    const reader = new zlib.Reader();
    const ret = reader.open(zipname);
    assert.equal(ret, 1);

    const count = reader.count();
    assert.equal(count, 1);

    const stat = reader.stat(0);
    // console.log('stat', stat);
    assert.equal(stat.size, rawData.length);

    const data1 = reader.extract(0);
    assert.equal(textDecoder.decode(data1), rawData);

    const data2 = reader.extract(testfile);
    assert.equal(textDecoder.decode(data2), rawData);

    reader.close();
    reader.close();

    assert.equal(undefined, reader.extract(0));
});

test('native.zlib.compress', () => {
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

    assert.equal(textDecoder.decode(uncompressedData), rawData);
});
