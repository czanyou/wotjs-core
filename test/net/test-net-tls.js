// @ts-check
import * as tls from '@tjs/tls';

import * as assert from '@tjs/assert';
const test = assert.test;

test('tls.http.get', async () => {
    const host = 'www.baidu.com';
    const port = 443;
    const client = new tls.TLSSocket();
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

        result.connected = true;
        result.address = client.address();
        result.remoteAddress = client.remoteAddress();
        
        await client.write(`GET / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
    };

    client.onlookup = function (event) {
        result.lookup = event.address;
    };

    client.onend = function () {
        result.ended = true;
        onClose();
    };

    client.onclose = function () {
        result.closed = true;
        onClose();
    };

    client.onerror = function (event) {
        console.log('client-error', event.error);
        result.hasError = true;
    };

    client.onmessage = function (event) {
        const data = event.data;
        if (data) {
            // console.log('client-data:', data.byteLength);
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(data);
            assert.ok(text && text.length > 0);
            result.hasData = true;

        } else {
            result.endOfFile = true;
            onClose();
        }
    };

    assert.ok(!client.connecting, 'connecting is false');
    client.connect(port, host);
    assert.ok(client.connecting, 'connecting is true');

    await assert.waitTimeout();

    // console.log(result, client);

    assert.ok(client.bytesRead > 0);
    assert.ok(client.bytesWritten > 0);

    // lookup
    const lookup = result.lookup;
    assert.ok(lookup.address);
    assert.equal(lookup.family, 4);

    // address
    const address = result.address;
    assert.ok(address);
    assert.ok(address.address);
    assert.equal(address.family, 4);
    assert.ok(address.port);

    // remoteAddress
    const remoteAddress = result.remoteAddress;
    assert.ok(remoteAddress);
    assert.ok(remoteAddress.address);
    assert.equal(remoteAddress.family, 4);
    assert.equal(remoteAddress.port, port);
});
