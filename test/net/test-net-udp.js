// @ts-check
import assert, { test, sleep } from '@tjs/assert';

import * as net from '@tjs/net';

async function doEchoServer(server) {
    server.onerror = function (error) {
        console.log('onerror:', error);
    };

    server.onmessage = function (event) {
        // const textDecoder = new TextDecoder();
        // const message = JSON.parse(textDecoder.decode(event.data));
        // console.log('server.onmessage:', message, event.address);
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
    };
}

test('net.udp', async () => {
    // server
    const server = net.createSocket();
    assert.ok(server);

    server.bind({ address: '127.0.0.1', port: 3308 });
    await doEchoServer(server);
    const serverAddress = server.address();
    assert.ok(serverAddress);
    // console.log('serverAddress', serverAddress);

    // client
    const client = net.createSocket();
    await doEchoClient(client);

    // send 1
    const message = JSON.stringify({ type: 'subscribe', data: { name: 'test' } });
    await client.send(message, serverAddress);

    await sleep(1000);

    await client.close();
    await server.close();
});
