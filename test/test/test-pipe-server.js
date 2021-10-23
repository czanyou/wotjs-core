import * as fs from '@tjs/fs';
import * as net from '@tjs/net';

const start = async () => {
    const serverAddress = '/tmp/test-pipe-server';
    try {
        await fs.unlink(serverAddress);
    } catch (e) {

    }

    const stat = { connection: 0 };

    async function handleConnection(connection) {
        stat.connection++;

        // console.log('handleConnection:', connection.address(), connection.remoteAddress(), stat.connection);
        connection.onmessage = async function (event) {
            // console.log('data', event);
            const data = event.data;
            if (!data) {
                return;
            }
    
            await connection.write('PONG\r\n');
            await connection.end();
            await connection.close();
        };
    }

    function createEchoServer() {
        const server = net.createServer();
        server.bind(serverAddress);
        server.listen();
    
        server.onconnection = function (event) {
            handleConnection(event.connection);
        };

        return server;
    }

    const server = createEchoServer();
    const address = server.address();
    console.log('address', address);

    setTimeout(() => { server.close(); }, 1000 * 3600);
};

start();
