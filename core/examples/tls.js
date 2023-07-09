import * as dns from '@tjs/dns';
import * as assert from '@tjs/assert';
import * as native from '@tjs/native';

import { test } from '@tjs/test';

test('tls.http:get', async () => {
    let onResolve = null;
    const promise = new Promise((resolve, reject) => { onResolve = resolve });

    const client = new native.TLS();
    function onClose() {
        onResolve();
    }

    const host = 'localhost';
    const address = await dns.lookup(host, { family: 4 });
    address.host = host;
    address.port = 8883;
    const result = {};

    client.onerror = function (err) {
        console.log('client-error', err);
        result.hasError = true;
    };

    client.onopen = async function () {
        result.open = true;
    };

    client.onconnect = async function () {
        result.connected = true;
    };

    client.onmessage = function (data) {
        result.hasMessage = true;

        if (data) {
            // console.log('client-data:', data.byteLength);
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(data);
            assert.ok(text);
            // console.log(text.length);
            result.hasData = true;

        } else {
            result.endOfFile = true;
            onClose();
        }
    };

    await client.connect(address);
    await client.write(`GET /libs/bootstrap/4.4.1/css/bootstrap.min.css HTTP/1.0\r\nHost: ${host}\r\n\r\n`);

    await promise;

    console.log(result);
    assert.ok(result.connected, 'connected');
    assert.ok(result.hasData, 'hasData');
    assert.ok(result.endOfFile, 'endOfFile');
    assert.ok(result.open, 'open');
    assert.ok(!result.hasError, 'hasError');
});
