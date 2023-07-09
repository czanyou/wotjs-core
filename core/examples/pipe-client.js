import * as native from '@tjs/native';

const start = async () => {
    const stat = { start: 0, open: 0, message: 0, ended: 0 };

    /**
     * 
     * @param {*} serverAddress 
     * @returns {Promise<net.Socket>}
     */
    async function createEchoClient(serverAddress) {
        stat.start++;
        const client = new native.Pipe();
        // client.setDebug(true);

        const promise = new Promise((resolve, reject) => {

            client.onmessage = async function (data) {
                if (!data) {
                    stat.ended++;
                    resolve(client);
                    return;
                }

                // const text = textDecoder.decode(data);
                // console.log('text', text);

                stat.message++;
            };

            client.onconnect = async function (event) {
                await client.write('PING\r\n');
                stat.open++;

                // stat.ended++;
                // stat.message++;
                //  resolve(client);
            };
        });

        await client.connect(serverAddress);
        await client.write('PING\r\n');
        stat.open++;

        return promise;
    }

    const serverAddress = '/tmp/test-pipe-server';
    // console.time('stat');

    let rss = process.rss();
    console.log('start:', 'rss:', rss, serverAddress);

    for (let j = 0; j < 100; j++) {
        for (let i = 0; i < 1000; i++) {
            const client = await createEchoClient(serverAddress);
            client.close();
        }

        native.runtime.gc();
        rss = process.rss();
        console.log('stop:', j, rss);
    }

    rss = process.rss();
    console.log('end:', 'rss:', rss);

    // console.timeEnd('stat');
    console.log(stat);
};

start();
