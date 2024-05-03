// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as streams from '@tjs/streams';
import * as http from '@tjs/http';
import * as fs from '@tjs/fs';

async function main() {
    const options = { port: 8088 };
    const server = http.createServer(options, async (req, res) => {
        const result = {};
        result.headers = {};
        result.args = req.query;

        req.headers.forEach((value, key) => {
            result.headers[key] = value;
        });

        const body = await req.arrayBuffer();
        console.log('body:', body);

        result.total = body?.byteLength;
        await res.send(result);
    });

    await server.start();

    let total = 0;

    const filename = '/home/cz/Downloads/go1.19.2.linux-amd64.tar.gz';
    const file = await fs.open(filename, 'rb');
    const fileInfo = await file.stat();
    const contentLength = String(fileInfo.size);
    console.log('length:', contentLength);

    const BUFFER_SIZE = 32 * 1024;

    /** @type ReadableStream<Uint8Array> */
    const body = streams.createReadableStream({
        pull(controller) {
            async function readChunk() {
                const filedata = await file.read(BUFFER_SIZE);
                if (filedata == null) {
                    controller.close();
                    return;
                }

                const data = new Uint8Array(filedata);
                controller.enqueue(data);
                total += data.length;

                // console.log('data:', data.length, total, fileInfo.size);
                if (total >= fileInfo.size) {
                    controller.close();
                }
            }

            return readChunk();
        }
    });

    const url = 'http://localhost:8088/get?foo=100&bar=test';
    const init = { method: 'POST', body, headers: { 'Content-Length': contentLength } };
    const response = await fetch(url, init);

    console.log('total:', total, fileInfo.size);
    const data = await response.json();
    console.log(data);

    file.close();
    server.close();
}

main();
