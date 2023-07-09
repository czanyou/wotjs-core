// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as net from '@tjs/net';
import * as native from '@tjs/native';
import * as process from '@tjs/process';

const start = async () => {
    const stat = { start: 0, open: 0, message: 0, ended: 0 };

    /**
     * 
     * @param {*} serverAddress 
     * @returns {Promise<net.Socket>}
     */
    async function createEchoClient(serverAddress) {
        stat.start++;
        const client = new net.Socket();
        // client.setDebug(true);

        const promise = new Promise((resolve, reject) => {

            const onmessage = async function (event) {
                const data = event?.data;
                // console.log('onmessage:', data);

                if (!data) {
                    stat.ended++;
                    resolve(client);
                    return;
                }

                // const text = textDecoder.decode(data);
                // console.log('text', text);

                stat.message++;
            };

            client.onmessage = onmessage;

            client.onconnect = async function (event) {
                // console.log('onconnect:', client.readyState);

                await client.write('PING\r\n');
                stat.open++;

                // stat.ended++;
                // stat.message++;
                //  resolve(client);
            };

        });

        await client.connect(serverAddress);

        // console.log('state:', client.readyState, net.Socket.OPEN);
        await client.write('PING\r\n');
        stat.open++;

        return promise;
    }

    const serverAddress = '/tmp/test-pipe-server';
    console.time('stat');

    let rss = process.rss();
    console.log('start:', 'rss:', rss, serverAddress);

    for (let j = 0; j < 10; j++) {
        for (let i = 0; i < 1000; i++) {
            try {
                const client = await createEchoClient(serverAddress);

                client.close();
                // console.log(client);

            } catch (e) {
                console.log(e);
            }
        }

        native.runtime.gc();
        rss = process.rss();
        console.log('stop:', j, rss);
    }

    rss = process.rss();
    console.log('end:', 'rss:', rss);

    console.timeEnd('stat');
    console.log(stat);
};

start();
