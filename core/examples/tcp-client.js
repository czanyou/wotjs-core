import * as net from '@tjs/net';

const start = async () => {
    const stat = { start: 0, open: 0, message: 0, ended: 0 };

    async function createEchoClient(serverAddress) {
        stat.start++;

        const client = net.connect(serverAddress);

        return new Promise((resolve, reject) => {

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

    // console.time('stat');
    const serverAddress = { host: '127.0.0.1', port: 7080 };

    for (let i = 0; i < 1000; i++) {
        const client = await createEchoClient(serverAddress);
        await client.end();
        await client.close();
    }

    // console.timeEnd('stat');
    console.log(stat);
};

start();
