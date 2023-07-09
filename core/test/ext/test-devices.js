// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as devices from '@tjs/devices';

import { test } from '@tjs/test';

test('devices', async () => {
    assert.ok(devices != null);
    
    const device = await devices.requestWatchdog({ name: 'watchdog' });
    // assert.ok(device != null);
    // console.log(device);
});
