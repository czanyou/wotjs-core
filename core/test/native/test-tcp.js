// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as native from '@tjs/native';

import { test } from '@tjs/test';

test('native.tcp', async () => {
    const result = {};
    const output = [];
    const $context = {};

    const promise = new Promise((resolve, reject) => {
        $context.callback = () => {
            clearTimeout($context.timer);
            resolve(0);
        };

        $context.timer = setTimeout(() => {
            $context.callback = null;
            resolve(0);
        }, 1000);
    });

    async function createEchoServer() {
        /**
         * 
         * @param {native.TCP} server 
         */
        async function onServerConnection(server) {
            /** @type native.TCP | null */
            let connection = server.accept();
            // connection.setDebug(true);

            output.push('connection');
            // console.log('server:', 'connection:', connection);

            connection.onerror = function (error) {
                console.log('connection:', 'error:', error);
                output.push('pong-error');
            };

            connection.onmessage = function (data) {
                // console.log('connection:', 'message:', data);

                if (data) {
                    // echo
                    output.push('pong');
                    connection?.write('PONG');

                } else {
                    output.push('pong-end');
                    $context.connection = null;
                    connection = null;
                }
            };

            $context.connection = connection;
        }

        const server = new native.TCP();
        server.onconnection = function () {
            onServerConnection(server);
        };

        server.bind({ address: '127.0.0.1', port: 38090 });
        server.listen();

        return server;
    }

    async function createEchoClient(address) {
        const textDecoder = new TextDecoder();

        const client = new native.TCP();
        // client.setDebug(true);

        client.onerror = function (err) {
            console.log('client:', 'error:', err);
            result.hasError = true;
            output.push('ping-error');
        };

        client.onmessage = async function (data) {
            // console.log('client:', 'message:', data);

            if (!data) {
                output.push('ping-end');
                result.isEndOfFile = true;
                return;
            }

            result.hasData = true;

            if (!result.message) {
                output.push('ping2');
                const text = textDecoder.decode(data);
                assert.equal(text, 'PONG', 'sending strings works');

                result.message = true;

                await client.write(data);
                // console.log('send data', data);

            } else {
                // console.log('client data', data);
                output.push('exit');
                const text = textDecoder.decode(data);
                assert.equal(text, 'PONG', 'sending buffer works');

                if ($context.callback) {
                    $context.callback();
                }
            }
        };

        output.push('connect');
        await client.connect(address);
        output.push('connected');
        return client;
    }

    const server = await createEchoServer();
    $context.server = server;

    // connect
    const address = server.address();
    const client = await createEchoClient(address);
    result.conncted = true;

    $context.client = client;

    // send
    output.push('ping1');
    await client.write('PING');

    // console.log('await: promise');
    await promise;
    // console.log('await: end', output.join('->'));

    assert.equal(output.join('->'), 'connect->connection->connected->ping1->pong->ping2->pong->exit');
});
