// @ts-check
import * as net from '@tjs/net';

import * as assert from '@tjs/assert';
const test = assert.test;

test('tcp.http.get', async () => {
    const client = new net.TCPSocket();

    const host = 'iot.wotcloud.cn';
    const port = 80;
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
        
        // console.log('address', client.address());
        await client.write(`GET / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
    };

    client.onlookup = function (event) {
        result.lookup = event.address;
        onClose();
    };

    client.onend = function (event) {
        result.ended = true;
        onClose();
    };

    client.onclose = function (event) {
        result.closed = true;
        assert.equal(client.readyState, client.CLOSED, 'readyState is closed');
        onClose();
    };

    client.onerror = function (err) {
        console.log('client-error', err);
        result.hasError = true;
    };

    client.onmessage = function (event) {
        const data = event.data;
        if (data) {
            // console.log('client-data:', data.length);
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(data);
            assert.ok(text);

        } else {
            result.endOfFile = true;

            client.close();
            onClose();
        }
    };

    assert.ok(!client.connecting, 'connecting is false');
    client.connect(port, 'iot.wotcloud.cn');
    assert.ok(client.connecting, 'connecting is true');

    await assert.waitTimeout();

    // console.log(result);
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

test('tcp.http.get.timeout', async () => {
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
