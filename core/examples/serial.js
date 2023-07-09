// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as serial from '../js/tjs/serial.js';

import { test } from '@tjs/test';

test('serial', async () => {
    serial.setDeviceInfos({ 'uart.0.name': 'uart1', 'uart.0.device': '/dev/ttyUSB0' });

    assert.ok(serial != null);
    const ports = [];
    serial.requestPort({ name: 'uart1' });
    ports[0] = await serial.requestPort({ name: 'uart1' });
    ports[1] = await serial.requestPort({ name: 'uart1' });

    await Promise.race(ports);

    const port = ports[0];

    assert.ok(port != null);
    if (!port) {
        return;
    }

    // @ts-ignore
    port.handle = {
        write(data) {
            port.dispatchEvent(new MessageEvent('message', { data: 'PONG' }));
        }
    };

    assert.ok(port);

    port.addEventListener('message', (event) => {
        // @ts-ignore
        //  console.log('message', event?.data);
    });

    /** @type serial.SerialPortOptions */
    const options = { baudRate: 9600 };
    await port.open(options);
    // console.log(port);

    await port.write('PING');
});
