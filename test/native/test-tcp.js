// @ts-check
import * as assert from '@tjs/assert';
import * as native from '@tjs/native';

const test = assert.test;


test('native.tcp', async () => {

    const result = {};
    const output = [];

    async function createEchoServer() {
        async function onServerConnection(server) {
            const connection = server.accept();
            output.push('connection');

            // console.log('server accept', connection);
            connection.onend = function () {
                output.push('pong-end');
            };

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
        }

        const server = new native.TCP();
        server.onconnection = function () {
            onServerConnection(server);
        };

        server.bind({ ip: '127.0.0.1', port: 38090 });
        server.listen();

        return server;
    }

    async function createEchoClient(address) {
        const textDecoder = new TextDecoder();

        const client = new native.TCP();
        client.onend = function () {
            // console.log('client end');
            result.isEnd = true;
            output.push('ping-end');
        };

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

            if (!client.message) {
                output.push('ping2');
                const text = textDecoder.decode(data);
                assert.equal(text, 'PONG', 'sending strings works');

                client.message = true;

                await client.write(data);
                // console.log('send data', data);

            } else {
                // console.log('client data', data);
                output.push('ping-exit');
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
    console.log(output.join('->'));

});
