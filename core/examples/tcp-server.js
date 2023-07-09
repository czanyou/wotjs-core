import * as net from '@tjs/net';
import * as native from '@tjs/native';

const start = async () => {
    const serverAddress = { address: '127.0.0.1', port: 7080 };

    const stat = { connection: 0 };
    const connections = new Set();
    
    let readPackets = 0;

    async function handleConnection(connection) {
        stat.connection++;

        // console.log('handleConnection:', connection.address(), connection.remoteAddress(), stat.connection);
        connection.onmessage = function (event) {
            // console.log('data', event);
            const data = event.data;
            if (!data) {
                connections.delete(connection);
                return;
            }
    
            readPackets++;
            // connection.write('PONG\r\n');
            // await connection.end();
            // await connection.close();
        };

        connections.add(connection);
    }

    function createEchoServer() {
        const server = net.createServer();
        server.listen(serverAddress);

        server.onconnection = function (event) {
            handleConnection(event.connection);
        };

        return server;
    }

    const server = createEchoServer();
    const address = server.address();
    console.log('address', address);

    setInterval(() => {
        native.runtime.gc();
        const rss = process.rss();
        console.log('stop:', `rss=${rss}`, readPackets);

    }, 1000);

    setTimeout(() => { server.close(); }, 1000 * 3600);
};

start();
