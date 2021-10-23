// @ts-check
import * as fs from '@tjs/fs';
import * as native from '@tjs/native';

import { assert, test, startTimeout, stopTimeout, waitTimeout } from '@tjs/assert';

/**
 * 测试有名管道通信
 * - Start
 * - Client ... connect ... Server
 * - Client ... PING => ... Server
 * - Client ... <= PONG ... Server
 * - Client ... PING => ... Server
 * - Client ... <= PONG ... Server
 * - End
 */
test('native.pipe', async () => {
    const textDecoder = new TextDecoder();
    const result = {};
    const output = [];

    async function createEchoServer() {
        try {
            await fs.unlink('/tmp/test-pipe');
        } catch (e) {

        }

        const server = new native.Pipe();
        server.bind('/tmp/test-pipe');
        server.listen();

        server.onconnection = async function () {
            const connection = await server.accept();
            // console.log('connection', connection);
            result.connection = true;
            output.push('connection');

            connection.onopen = function () {
                output.push('pong-open');
            };

            connection.onclose = function () {
                output.push('pong-close');
            };

            connection.onerror = function () {
                output.push('pong-error');
            };

            connection.onmessage = function (data) {
                if (!data) {
                    output.push('pong-end');
                    result.connectionEnd = true;
                    return;
                }

                try {
                    output.push('pong');
                    result.serverData = data;
                    connection.write('PONG');

                } catch (error) {
                    assert.fail(error);
                }
            };
        };

        return server;
    }

    function createEchoClient() {
        const client = new native.Pipe();

        client.onopen = function () {
            output.push('ping-open');
        };
    
        client.onclose = function () {
            output.push('ping-close');
        };
    
        client.onerror = function () {
            output.push('ping-error');
        };
    
        client.onmessage = async function (data) {
            // console.log('client.data', data);
    
            if (!data) {
                output.push('ping-end');
                result.endOfFile = true;
                onClose();
                return;
            }
    
            try {
                const text = textDecoder.decode(data);
    
                if (!result.clientData) {
                    assert.equal(text, 'PONG', 'sending strings works');
                    result.clientData = data;
    
                    output.push('ping2');
                    await client.write(data);
    
                } else {
                    output.push('ping-exit');
                    assert.equal(text, 'PONG', 'sending a Uint8Array works');
                    result.isExit = true;
                    onClose();
                }
    
            } catch (error) {
                assert.fail(error);
            }
        };
    
        return client;
    }

    const server = await createEchoServer();

    // connect
    output.push('connect');
    const client = createEchoClient();
    const serverAddress = server.address();
    await client.connect(serverAddress);
    result.connected = true;
    output.push('connected');

    // send
    output.push('ping1');
    await client.write('PING');

    // bad send
    // @ts-ignore
    assert.throws(() => { client.write(1234); }, TypeError, 'sending anything else gives TypeError');

    startTimeout(10000, () => {
        // client.close();
        // server.close();
    });

    function onClose() {
        stopTimeout();

        // client.close();
        // server.close();
    }

    await waitTimeout();

    console.log(output.join('->'));

    assert.ok(result.connected, 'connected');
    assert.ok(result.connection, 'connection');
    assert.ok(result.clientData, 'clientData');
    assert.ok(result.serverData, 'serverData');
    assert.ok(result.isExit, 'isExit');
});
