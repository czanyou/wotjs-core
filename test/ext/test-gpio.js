// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import * as gpio from '@tjs/gpio';

const test = assert.test;

test('gpio', async () => {
    assert.ok(gpio != null);
    
    const port = await gpio.requestDevice(0);
    // assert.ok(port);
    // console.log(port);
});
