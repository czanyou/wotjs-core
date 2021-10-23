// @ts-check
import * as dns from '@tjs/dns';

import * as assert from '@tjs/assert';
import * as native from '@tjs/native';

const test = assert.test;


test('tcp.http.get', async () => {
    const client = new native.TCP();

    assert.startTimeout(10000, () => {
        client.close();
    });

    function onClose() {
        assert.stopTimeout();
    }

    const host = 'www.baidu.com'; // 'www.baidu.com';
    const address = await dns.lookup(host, { family: 4 });
    if (!Array.isArray(address)) {
        address.host = host;
        address.port = 80;
    }

    const result = {};

    client.onend = function () {
        result.isEnd = true;
        onClose();
    };

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
    await assert.waitTimeout();

    assert.ok(result.connected, 'connected');
    assert.ok(result.hasData, 'hasData');
    assert.ok(result.isEndOfFile, 'isEndOfFile');
    assert.ok(result.isEnd, 'isEnd');
    assert.ok(!result.hasError, 'hasError');
});
