// @ts-check
/// <reference path ="../types/index.d.ts" />

import * as native from '@tjs/native';
import * as process from '@tjs/process';
import * as util from '@tjs/util';

async function test() {
    let readPackets = 0;

    async function createEchoServer() {
        const server = new native.UDP();
        server.bind({ address: '127.0.0.1' });

        server.onerror = function (error) {
            console.log('onerror:', error);
        };

        server.onmessage = function (message) {
            if (message.address) {
                const data = 'b'.repeat(1024 * 32);
                server.send(data, message.address);
                readPackets++;
            }
        };

        return server;
    }

    // server
    const server = await createEchoServer();

    // client
    const serverAddress = server.address();

    let rss = process.rss();
    console.log('start:', rss);

    let sendPackets = 0;

    for (let j = 0; j < 1000; j++) {
        for (let i = 0; i < 1000; i++) {
            const data = 'a'.repeat(1024 * 32);

            const client = new native.UDP();
            await client.send(data, serverAddress);
            await util.sleep(1);
            client.close();
            sendPackets++;
        }

        native.runtime.gc();
        rss = process.rss();
        console.log('stop:', j, rss, sendPackets, readPackets);
    }

    // close
    server.close();
}

test();
