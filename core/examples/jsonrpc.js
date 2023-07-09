import * as jsonrpc from '@tjs/jsonrpc';
import * as native from '@tjs/native';
import * as process from '@tjs/process';
import * as util from '@tjs/util';

async function main() {
    let result = await jsonrpc.call('tcp://localhost:13333');
    console.log(result);

    let readPackets = 0;

    const handlers = {
        test: () => {
            readPackets++;
            const data = 'b'.repeat(1024 * 32);
            return data;
        }
    };

    const server = jsonrpc.createServer(13333, '127.0.0.1', handlers);
    server.addEventListener('error', (event) => {
        console.log('server:', event.error.message);
    });

    await server.start();

    // console.log('server', server);

    await util.sleep();
    const client = jsonrpc.connect('tcp://localhost:13333');
    await client.connected;

    let rss = process.rss();
    console.log('start:', rss);

    let sendPackets = 0;

    for (let j = 0; j < 1000; j++) {
        for (let i = 0; i < 1000; i++) {
            const data = 'a'.repeat(1024 * 32);
            result = await client.call('test', [data]);
            sendPackets++;
        }

        native.runtime.gc();
        rss = process.rss();
        console.log('stop:', j, rss, sendPackets, readPackets);
    }

    console.log(result);

    server.close();
    console.log('server', server);
}

main();
