// @ts-check
/// <reference path ="../../types/index.d.ts" />
import assert, { test, sleep } from '@tjs/assert';

import * as net from '@tjs/net';

test('net.udp - server:client', async () => {
    const $result = {};

    async function doEchoServer(server) {
        server.onerror = function (error) {
            console.log('onerror:', error);
        };

        server.onmessage = function (event) {
            // const textDecoder = new TextDecoder();
            // const message = JSON.parse(textDecoder.decode(event.data));
            // console.log('server.onmessage:', message, event.address);

            $result.serverData = 1;
            server.send(event.data, event.address);
        };
    }

    async function doEchoClient(client) {
        client.onerror = function (error) {
            console.log('onerror:', error);
        };

        client.onmessage = function (event) {
            // const textDecoder = new TextDecoder();
            // const message = JSON.parse(textDeocder.decode(event.data));
            // console.log('client.onmessage:', message);

            $result.clientData = 1;
        };
    }

    // server
    const server = net.createSocket();
    assert.ok(server);

    try {
        const address = { address: '127.0.0.1', port: 13309 };
        server.bind(address);

    } catch (err) {
        console.log(err);
    }

    await doEchoServer(server);
    const serverAddress = server.address();
    assert.ok(serverAddress);

    // client
    const client = net.createSocket();
    client.connect(serverAddress);
    await doEchoClient(client);

    // send 1
    const message = JSON.stringify({ type: 'subscribe', data: { name: 'test' } });
    await client.send(message);

    await sleep(100);

    client.disconnect();
    await client.close();
    await server.close();

});
