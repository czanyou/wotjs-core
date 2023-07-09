// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as native from '@tjs/native';
import * as process from '@tjs/process';
import * as util from '@tjs/util';

async function test() {

    let server = null;
    const connections = new Set();
    let readPackets = 0;

    async function createServer() {

        /**
         * @param {native.TCP} server 
         */
        async function onServerConnection(server) {
            /** @type native.TCP | null */
            const connection = server.accept();
            // connection.setDebug(true);

            console.log('server:', 'connection:', connection.id(), connection.fileno());
            connection.onerror = function (error) {
                console.log('connection:', 'error:', error);
            };

            connection.onmessage = function (data) {
                if (data == null) {
                    connections.delete(connection);
                    return;
                }

                readPackets++;

                // echo
                // const response = 'b'.repeat(1024 * 64);
                // connection?.write(response);
            };

            connection.resume();
            connections.add(connection);
        }

        server = new native.TCP();
        // server.setDebug(true);

        server.onclose = function () {
            console.log('server:', 'close');
        };

        server.onerror = function (error) {
            console.log('server:', 'error:', error);
        };

        server.onconnection = function () {
            onServerConnection(server);
        };

        server.bind({ address: '127.0.0.1', port: 38091 });
        server.listen();

        console.log('server:', server.id(), server.fileno());
        return server;
    }

    async function createClient(address) {
        // address = { address: '127.0.0.1', port: 7080 };

        const client = new native.TCP();
        // client.setDebug(true);

        client.onerror = function (err) {
            console.log('client:', 'error:', err);
        };

        client.onmessage = async function (data) {
            // console.log('client:', 'message:', data);
        };

        await client.connect(address);

        console.log('client:', client.id(), client.fileno());
        return client;
    }

    try {
        const server = await createServer();

        const address = server.address();

        await util.sleep(1000);

        let rss = process.rss();
        console.log('start:', 'rss:', rss);

        let sendPackets = 0;

        const client = await createClient(address);

        const data = 'b'.repeat(1024 * 64);

        for (let j = 0; j < 1000; j++) {
            for (let i = 0; i < 1000; i++) {
                await client.write(data);
                sendPackets++;
            }

            await util.sleep(1000);

            native.runtime.gc();
            rss = process.rss();
            console.log('stop:', j, `rss=${rss}`, sendPackets, readPackets);
        }

        console.log('close:', server, address);
        server.close();
        client.close();

        rss = process.rss();
        console.log('end:', 'rss:', rss);

    } catch (e) {
        console.log(e);
    }
}

test();
