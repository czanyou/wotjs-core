import * as net from '@tjs/net';

const start = async () => {
    const textDecoder = new TextDecoder();
    const stat = { start: 0, open: 0, message: 0, ended: 0 };

    function createEchoClient(serverAddress) {
        stat.start++;

        return new Promise((resolve, reject) => {
            const client = net.connect(serverAddress);

            client.onmessage = async function (event) {
                const data = event.data;
                if (!data) {
                    stat.ended++;
                    resolve(client);
                    return;
                }

                // const text = textDecoder.decode(data);
                // console.log('text', text);

                stat.message++;
            };

            client.onopen = async function (event) {
                await client.write('PING\r\n');
                stat.open++;
            };
        });
    }

    const serverAddress = '/tmp/test-pipe-server';
    // console.time('stat');

    for (let i = 0; i < 1000; i++) {
        const client = await createEchoClient(serverAddress);
        await client.end();
        await client.close();
    }

    // console.timeEnd('stat');
    console.log(stat);
};

start();
