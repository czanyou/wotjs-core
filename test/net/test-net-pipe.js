// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as net from '@tjs/net';

import * as assert from '@tjs/assert';
const test = assert.test;

const filename = '/tmp/test-pipe';

test('net.pipe - server:client', async () => {
    try {
        await fs.unlink(filename);
    } catch (e) {

    }

    const textDecoder = new TextDecoder();
    const result = {};
    const $context = {};

    async function handleConnection(connection) {
        connection.onmessage = function (event) {
            // console.log('data', event);
            const data = event.data;
            if (!data) {
                return;
            }
    
            connection.write(data);
        };

        $context.connection = connection;
    }

    function createEchoServer() {
        const server = net.createServer();
        server.listen(filename);

        server.onconnection = function (event) {
            handleConnection(event.connection);
        };

        return server;
    }

    function createEchoClient(serverAddress) {
        const client = net.connect(serverAddress);
        let readBuffer = null;
    
        client.onmessage = async function (event) {
            const data = event.data;
            if (!data) {
                result.isEndOfFile = true;
                return;
            }
    
            const text = textDecoder.decode(data);
            // console.log('text', text);
    
            if (!readBuffer) {
                assert.equal(text, 'PING', 'sending strings works');
                readBuffer = data;
                await client.write(data);
    
            } else {
                assert.equal(text, 'PING', 'sending a Uint8Array works');
    
                client.close();
                server.close();
                onClose();
            }
        };
    
        client.onopen = async function (event) {
            result.conntected = true;
            await client.write('PING');
        };

        return client;
    }
    
    const server = createEchoServer();

    const serverAddress = server.address();
    const client = createEchoClient(serverAddress);

    assert.startTimeout(10000, () => {
        client.close();
        server.close();
    });

    function onClose() {
        assert.stopTimeout();
    }

    await assert.waitTimeout();
});
