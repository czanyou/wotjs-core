// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as net from '@tjs/net';

import * as assert from '@tjs/assert';
const test = assert.test;

test('net.tcp - http.timeout', async () => {
    const host = 'www.google.com';
    const port = 80;

    const client = new net.TCPSocket();
    const result = {};

    assert.startTimeout(10000, () => {
        client.close();
    });

    function onClose() {
        assert.stopTimeout();
        client.close();
    }
    
    client.onopen = async function () {
        assert.ok(!client.connecting, 'connecting is false');
        const address = client.address();
        assert.ok(address);

        result.connected = true;
        // console.log('address', address);
        await client.write(`GET / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
    };

    client.ontimeout = function () {
        result.timeout = true;
        onClose();
    };

    client.onclose = function () {
        result.closed = true;
        onClose();
    };

    client.onerror = function (event) {
        result.error = event.error;
        result.hasError = true;
    };

    client.onmessage = function (event) {
        const data = event.data;
        if (!data) {
            result.endOfFile = true;

            onClose();
        }
    };

    assert.ok(!client.connecting, 'connecting is false');
    client.setTimeout(1000);
    assert.equal(client.timeout, 1000);

    client.connect(port, host);
    assert.ok(client.connecting, 'connecting is true');

    await assert.waitTimeout();

    // console.log(result);
    assert.ok(result.timeout, 'timeout');
    assert.ok(result.closed, 'closed');
});
