// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as dns from '@tjs/dns';

import * as assert from '@tjs/assert';
import * as native from '@tjs/native';
import * as util from '@tjs/util';

import { test } from '@tjs/test';

test('native.tcp.http:get', async () => {
    let onResolve = null;
    const promise = new Promise((resolve, reject) => { onResolve = resolve; });

    await util.sleep(1000);

    const client = new native.TCP();

    function onClose() {
        onResolve(undefined);
    }

    const host = 'www.baidu.com'; // 'www.baidu.com';
    const addressInfo = await dns.lookup(host, { family: 4 });
    const address = { family: 4 };
    if (!Array.isArray(addressInfo)) {
        address.address = addressInfo.address;
        address.host = host;
        address.port = 80;
    }

    const result = {};

    client.onclose = function () {
        onClose();
    };

    client.onerror = function (err) {
        console.log('client-error', err);
        result.hasError = true;
    };

    client.onmessage = function (data) {
        if (data) {
            // console.log('client-data:', data.byteLength);
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(data);
            assert.ok(text.length > 0);

            result.hasData = true;

        } else {
            result.isEndOfFile = true;
            onClose();
        }
    };

    client.setNoDelay(true);
    client.setKeepAlive(true, 60000);
    await client.connect(address);
    result.connected = true;

    await client.write('GET / HTTP/1.0\r\nHost: www.baidu.com\r\n\r\n');

    await util.sleep(100);
    await promise;

    assert.ok(result.connected, 'connected');
    assert.ok(result.hasData, 'hasData');
    assert.ok(result.isEndOfFile, 'isEndOfFile');
    assert.ok(!result.hasError, 'hasError');
});
