// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as net from '@tjs/net';

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('net.tcp - http.timeout', async () => {
    const $context = {};
    
    const promise = new Promise((resolve, reject) => {
        $context.callback = () => {
            clearTimeout($context.timer);
            resolve(0);
        };

        $context.timer = setTimeout(() => {
            $context.callback = null;
            resolve(0);
        }, 5000);
    });

    const host = 'www.google.com';
    const port = 80;

    const client = new net.Socket();
    const result = {};

    function onClose() {
        client.close();

        if ($context.callback) {
            $context.callback();
        }
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

    await promise;

    // console.log(result);
    // assert.ok(result.timeout, 'timeout');
    // assert.ok(result.closed, 'closed');
});
