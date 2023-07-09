import * as http from '@tjs/http';
import * as process from '@tjs/process';

async function createHttpServer() {
    let nextId = 0;

    // 创建 HTTP 服务器
    const options = { port: 8080 };
    const server = http.createServer(options, async function (req, res) {
        // console.log(req.method, req.url);

        nextId++;

        await res.write('test');
        await res.write(String(nextId));
        await res.end();
    });

    await server.start();
    return server;
}

async function request(url) {
    // console.log(url);
    const response = await window.fetch(url);
    const body = await response.text();
    const headers = response.headers;
    // console.log('response', response.url, response.status, response.statusText, headers.get('Content-Length'), body.length);
}

async function createHttpClient() {
    let rss = process.rss();
    console.log('start:', rss);

    for (let j = 0; j < 1000; j++) {
        const url = 'http://localhost:8080/test';
        for (let i = 0; i < 1000; i++) {
            await request(url);
        }

        rss = process.rss();
        console.log('stop:', j, rss);
    }
}

async function main() {
    const server = await createHttpServer();
    await createHttpClient();

    server.close();

    console.log(server);
}

main();
