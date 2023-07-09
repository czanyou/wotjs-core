// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as native from '@tjs/native';
import * as process from '@tjs/process';
import * as util from '@tjs/util';

async function test() {
    const $context = {
        total: 0
    };

    let server = null;

    async function createEchoServer() {
        /**
         * @param {native.TCP} server 
         */
        async function onServerConnection(server) {
            /** @type native.TCP | null */
            const connection = server.accept();
            connection.setDebug(true);

            console.log('server:', 'connection:', connection.id(), connection.fileno());

            connection.onerror = function (error) {
                console.log('connection:', 'error:', error);
            };

            connection.onmessage = function (data) {
                native.runtime.gc();

                console.log('connection:', 'message:', data);

                if (data) {
                    // echo
                    connection?.write('PONG');

                } else {
                    $context.connection = null;
                }
            };

            $context.connection = connection;
        }

        server = new native.TCP();
        server.setDebug(true);

        server.onclose = function () {
            console.log('server:', 'close');
        };

        server.onerror = function (error) {
            console.log('server:', 'error:', error);
        };

        server.onconnection = function () {
            onServerConnection(server);
        };

        server.bind({ address: '127.0.0.1', port: 38090 });
        server.listen();

        console.log('server:', server.id(), server.fileno());
        return server;
    }

    async function createEchoClient(address) {
        const client = new native.TCP();
        client.setDebug(true);

        $context.client = client;

        const promise = new Promise((resolve, reject) => {

            client.onerror = function (err) {
                console.log('client:', 'error:', err);
                reject(err);
            };

            client.onmessage = async function (data) {
                console.log('client:', 'message:', data);
                resolve(data);
            };
        });

        await client.connect(address);
        console.log('client:', client.id(), client.fileno());

        // send
        await client.write('PING');

        const result = await promise;

        client.close();
        return result;
    }

    try {
        const server = await createEchoServer();
        $context.server = server;

        setInterval(() => {
            console.log('timeout', server.id());

            // console.log('client:', $context.client);
            // console.log('server:', $context.server);
            // server.close();
        }, 1000);

        const address = server.address();

        await util.sleep(1000);

        let rss = process.rss();
        console.log('start:', 'rss:', rss);

        for (let j = 0; j < 1; j++) {
            for (let i = 0; i < 1; i++) {
                const data = await createEchoClient(address);
                console.log(address, data);
            }

            rss = process.rss();
            console.log('stop:', j, rss);
        }

        console.log('close:', server, address);
        server.close();

        rss = process.rss();
        console.log('end:', 'rss:', rss);

    } catch (e) {
        console.log(e);
    }
}

test();
