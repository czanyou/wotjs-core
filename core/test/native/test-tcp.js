// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as native from '@tjs/native';

const test = assert.test;

test('native.tcp', async () => {

    const result = {};
    const output = [];
    const $context = {};

    async function createEchoServer() {
        async function onServerConnection(server) {
            const connection = server.accept();
            output.push('connection');

            connection.onerror = function () {
                output.push('pong-error');
            };

            connection.onmessage = function (data) {
                if (data) {
                    // echo
                    output.push('pong');
                    connection.write('PONG');

                } else {
                    output.push('pong-end');
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

        client.onerror = function (err) {
            console.log('client error', err);
            result.hasError = true;
            output.push('ping-error');
        };

        client.onmessage = async function (data) {
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

                onClose();
            }
        };

        output.push('connect');
        await client.connect(address);
        output.push('connected');
        return client;
    }

    const server = await createEchoServer();

    // connect
    const address = server.address();
    const client = await createEchoClient(address);
    result.conncted = true;

    // send
    output.push('ping1');
    await client.write('PING');

    assert.startTimeout(10000, () => {
        client.close();
        server.close();
    });

    function onClose() {
        assert.stopTimeout();
    }

    await assert.waitTimeout();

    assert.equal(output.join('->'), 'connect->connection->connected->ping1->pong->ping2->pong->exit');
});
