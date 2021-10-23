// @ts-check
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';

test('native.udp', async () => {
    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder();
    const output = [];

    async function createEchoServer() {
        const server = new native.UDP();
        server.bind({ address: '127.0.0.1' });

        server.onerror = function (error) {
            console.log('onerror:', error);
        };

        server.onmessage = function (message) {
            const text = textDecoder.decode(message.data);
            // console.log(text);
            assert.equal(text, 'PING', 'recving strings works');

            output.push('pong');
            server.send('PONG', message.address);
        };

        return server;
    }

    // server
    const server = await createEchoServer();

    // client
    const serverAddress = server.address();
    const client = new native.UDP();

    // send 1
    output.push('ping1');
    client.send('PING', serverAddress);
    // console.log('ping', serverAddress);

    // read 1
    let rinfo, text;
    rinfo = await client.recv();
    text = textDecoder.decode(rinfo.data);
    assert.equal(text, 'PONG', 'sending strings works');
    assert.equal(serverAddress, rinfo.address, 'source address matches');

    // send 2
    output.push('ping2');
    client.send(textEncoder.encode('PING'), serverAddress);

    // read 2
    rinfo = await client.recv();
    text = textDecoder.decode(rinfo.data);
    assert.equal(text, 'PONG', 'sending a Uint8Array works');
    assert.throws(() => { client.send(1234, serverAddress); }, TypeError, 'sending anything else gives TypeError');

    output.push('ping-exit');

    // close
    client.close();
    server.close();

    console.log(output.join('->'));
});
