// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as serial from '@tjs/serial';

const test = assert.test;

test('serial', async () => {
    assert.ok(serial != null);
    const port = await serial.requestDevice(0);
    assert.ok(port);
    // console.log(port);
});
