// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as devices from '@tjs/devices';

const test = assert.test;

test('devices', async () => {
    assert.ok(devices != null);
    
    const device = await devices.requestDevice(0);
    assert.ok(device);
    // console.log(device);
});
