// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as net from '@tjs/net';

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

const filename = '/tmp/test-pipe';

test('net.pipe - server:client', async () => {
    try {
        await fs.unlink(filename);
    } catch (e) {

    }

    const $context = {
        /** @type {net.Socket=} */
        connection: undefined,

        /** @type {net.Server=} */
        server: undefined,

        /** @type {net.Socket=} */
        client: undefined,
    };

    const textDecoder = new TextDecoder();
    const promise = new Promise((resolve, reject) => {
        const result = {
            isEndOfFile: false,
            connected: false,
        };

        /**
         * 
         * @param {net.Socket} connection 
         */
        async function handleConnection(connection) {
            $context.connection = connection;

            connection.onmessage = function (/** @type {*} */ event) {
                const data = event.data;
                // console.log('data', data);
                if (!data) {
                    return;
                }

                connection.write(data);
            };
        }

        function createEchoServer() {
            const server = net.createServer();
            server.listen(filename);

            server.onconnection = function (event) {
                // console.log('onconnection', event);
                handleConnection(event.connection);
            };

            return server;
        }

        /**
         * 
         * @param {*} serverAddress 
         * @returns 
         */
        async function createEchoClient(serverAddress) {
            const client = net.connect(serverAddress);

            /** @type {any} */
            let readBuffer = null;

            client.onmessage = async function (event) {
                const data = event.data;
                if (!data) {
                    result.isEndOfFile = true;
                    return;
                }

                // console.log('data', data);

                const text = textDecoder.decode(data);
                // console.log('text', text);

                if (!readBuffer) {
                    assert.equal(text, 'PING', 'sending strings works');
                    readBuffer = data;
                    await client.write(data);

                } else {
                    assert.equal(text, 'PING', 'sending a Uint8Array works');

                    onClose();
                }
            };

            client.onopen = async function (event) {
                // console.log('onopen');
                result.connected = true;
                await client.write('PING');
            };

            $context.client = client;
            return client;
        }

        const server = createEchoServer();

        $context.server = server;

        setTimeout(() => {
            const serverAddress = server.address();
            createEchoClient(serverAddress);
        });

        function onClose() {
            resolve(null);

            $context.server?.close();
            $context.client?.close();
            $context.connection?.close();
            // console.log('close', $context);
        }
    });

    await promise;
});
