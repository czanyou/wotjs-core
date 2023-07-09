import * as http from '@tjs/http';

/* global TextDecoder */

async function createHttpServer() {
    let nextId = 0;

    // 创建 HTTP 服务器
    const options = { port: 8080 };
    const server = http.createServer(options, async function (req, res) {
        console.log(req.method, req.url);

        nextId++;

        await res.write('test');
        await res.write(String(nextId));
        await res.end();
    });

    await server.start();
}

const textDecoder = new TextDecoder();

async function doEchoServer(server) {
    const conn = await server.accept();

    setTimeout(() => { conn.close(); }, 1000);

    let data;
    conn.write('server\r\n> ');
    while (true) {
        data = await conn.read();
        if (!data) {
            break;
        }

        console.log(data.length, textDecoder.decode(data));
        // conn.write(data);
        conn.write('> ');
    }
}

async function createEchoServer() {
    const server = new native.TCP();
    const address = { address: '0.0.0.0', port: 8080 };
    server.listen(address);

    server.onconnection = async function () {
        console.log('onconnection');
        const conn = await server.accept();
        if (!conn) {
            return;
        }

        setTimeout(() => { conn.close(); }, 1000);

        let data;
        conn.write('server\r\n> ');
        while (true) {
            data = await conn.read();
            if (!data) {
                break;
            }
    
            console.log(data.length, textDecoder.decode(data));
            // conn.write(data);
            conn.write('> ');
        }
    };
}

(async () => {
    await createHttpServer();
})();
