// @ts-check
import { assert, test } from '@tjs/assert';

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

test('FormData', async () => {
    const formData = new FormData();

    const blob = new Blob(['test blob'], { type: 'text/plain' });
    const file = new Blob(['test file'], { type: 'text/plain' });

    formData.append('test', 'value');
    formData.append('blob', blob);
    formData.append('file', file, 'testfile');
    // console.log(formData);

    // @ts-ignore
    const formBlob = formData.toBlob();
    assert.ok(formBlob.type);

    const text = await formBlob.text();
    assert.ok(text);
});
