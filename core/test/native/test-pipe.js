// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as native from '@tjs/native';

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

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
        try {
            await fs.unlink('/tmp/test-pipe');
        } catch (e) {

        }

        const server = new native.Pipe();

        server.onconnection = async function () {
            const connection = server.accept();
            // console.log('connection', connection);
            result.connection = true;
            output.push('connection');

            connection.onerror = function () {
                output.push('pong-error');
            };

            connection.onmessage = function (data) {
                if (!data) {
                    output.push('exit');
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

            $context.connection = connection;
        };

        server.bind('/tmp/test-pipe');
        server.listen();

        return server;
    }

    function createEchoClient() {
        const client = new native.Pipe();

        client.onerror = function () {
            output.push('ping-error');
        };
    
        client.onmessage = async function (data) {
            // console.log('client.data', data);
    
            if (!data) {
                output.push('exit');
                result.endOfFile = true;
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
                    output.push('exit');
                    assert.equal(text, 'PONG', 'sending a Uint8Array works');
                    result.isExit = true;
                    
                    if ($context.callback) {
                        $context.callback();
                    }
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

    await promise;

    assert.equal(output.join('->'), 'connect->connection->connected->ping1->pong->ping2->pong->exit');

    assert.ok(result.connected, 'connected');
    assert.ok(result.connection, 'connection');
    assert.ok(result.clientData, 'clientData');
    assert.ok(result.serverData, 'serverData');
    assert.ok(result.isExit, 'isExit');
});
