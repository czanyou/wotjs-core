// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import * as formdata from '@tjs/form-data';
import { test } from '@tjs/test';

test('Blob', async () => {
    const blob = new Blob(['test', '100'], { type: 'text/plain' });
    // console.log('blob', blob);

    assert.equal(blob.type, 'text/plain');
    assert.equal(blob.size, 7);

    const text = await blob.text();
    assert.equal(text, 'test100');

    const buffer = await blob.arrayBuffer();
    assert.equal(buffer.byteLength, 7);

    const newBlob = blob.slice(0, 4, 'text/plain');
    assert.ok(newBlob);
    // console.log(newBlob);

    const newText = await newBlob.text();
    assert.equal(newText, 'test');
});

test('File', async () => {
    const file = new File(['test', '100'], 'test.bin');
    // console.log('file', file);

    assert.equal(file.type, 'application/octet-stream');
    assert.equal(file.size, 7);
    assert.equal(file.name, 'test.bin');

    const text = await file.text();
    assert.equal(text, 'test100');
});

test('FileReader', async () => {
    const blob = new Blob(['test', '100'], { type: 'text/plain' });

    const reader = new FileReader();
    const promise = new Promise(function (resolve, reject) {
        reader.onload = function () {
            resolve(reader.result);
        };

        reader.onerror = function () {
            reject(reader.error);
        };
    });

    reader.readAsArrayBuffer(blob);

    await promise;

    // console.log('reader', reader);
});

test('FormData', async () => {
    const formData = new FormData();

    const blob = new Blob(['test blob'], { type: 'text/plain' });
    const file = new File(['test file'], 'test', { type: 'text/plain' });

    formData.append('test', 'value');
    formData.append('blob', blob);
    formData.append('file', file, 'test-file');
    console.log('formData:', formData);

    assert.equal(formData.get('test'), 'value');

    {
        const blob = formData.get('blob');
        assert.ok(blob instanceof Blob);

        if (blob instanceof Blob) {
            assert.equal(blob.type, 'text/plain');
            assert.equal(await blob.text(), 'test blob');
            assert.equal(blob.name, 'blob');
            // console.log('blob:', blob);
        }
    }

    {
        const file = formData.get('file');
        assert.ok(file instanceof File);

        if (file instanceof File) {
            assert.equal(file.type, 'text/plain');
            assert.equal(await file.text(), 'test file');
            assert.equal(file.name, 'test-file');
        }
    }

    // test
    formData.set('test', 'value2');
    assert.equal(formData.get('test'), 'value2');

    // @ts-ignore
    const formBlob = formData.toBlob();
    assert.ok(formBlob.type);

    const text = await formBlob.text();
    assert.ok(text);
    // console.print(text);

    const textEncoder = new TextEncoder();
    const result = formdata.parse(textEncoder.encode(text));
    // console.log(result._rawData);

    {
        const blob = result.get('blob');
        assert.ok(blob instanceof Blob);

        if (blob instanceof Blob) {
            assert.equal(blob.type, 'text/plain');
            assert.equal(await blob.text(), 'test blob');
        }
    }

    {
        const file = result.get('file');
        assert.ok(file instanceof File);

        if (file instanceof File) {
            assert.equal(file.type, 'text/plain');
            assert.equal(await file.text(), 'test file');
            assert.equal(file.name, 'test-file');
        }
    }
});
