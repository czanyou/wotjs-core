import * as net from '@tjs/net';

const start = async () => {
    const serverAddress = { address: '127.0.0.1', port: 7080 };

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
        server.listen(serverAddress);

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
