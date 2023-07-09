// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as tls from '@tjs/tls';

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

//* //

test('net.tls - http:get - baidu', async () => {
    let onResolve = null;
    const promise = new Promise((resolve, reject) => { onResolve = resolve; });

    const host = 'www.baidu.com';
    const port = 443;
    const client = new tls.TLSSocket();
    const result = {};

    function onClose() {
        client.close();

        if (onResolve) {
            onResolve();
            onResolve = null;
        }
    }

    client.onopen = async function () {
        result.connected = true;
        result.address = client.localAddress();
        result.remoteAddress = client.remoteAddress();
        
        await client.write(`GET / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
    };

    client.onlookup = function (event) {
        // console.log('event:', 'onlookup', event.address);
        result.lookup = event.address;
    };

    client.onconnect = function (event) {
        // console.log('event:', 'onconnect');
    };

    client.onclose = function (event) {
        // console.log('event:', 'onclose');
        result.closed = true;
        onClose();
    };

    client.onerror = function (event) {
        // console.log('event:', 'onerror');
        result.hasError = true;
    };

    client.onmessage = function (event) {
        const data = event.data;
        // console.log('event:', 'onmessage', data?.byteLength);

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

    client.connect(port, host);
    assert.equal(client.readyState, tls.TLSSocket.CONNECTING);

    await promise;

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

// */
