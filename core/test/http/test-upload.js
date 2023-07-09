// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as streams from '@tjs/streams';

import * as http from '@tjs/http';

test('http - upload', async () => {
    const options = { port: 48088 };
    const server = http.createServer(options, async (req, res) => {
        const result = {};
        result.headers = {};
        result.args = req.query;

        req.headers.forEach((value, key) => {
            result.headers[key] = value;
        });

        result.data = await req.text();
        await res.send(result);
    });

    await server.start();

    let total = 0;

    /** @type ReadableStream<Uint8Array> */
    const body = new streams.ReadableStream({
        pull(controller) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const data = new Uint8Array([61, 62, 63, 64, 65, 66, 67, 68, 69, 60]);
                    controller.enqueue(data);
                    total += data.length;

                    if (total >= 100) {
                        controller.close();
                    }

                    resolve();
                }, 10);
            });
        }
    });

    const url = 'http://localhost:48088/get?foo=100&bar=test';
    const init = { debug: true, method: 'POST', body, headers: { 'Content-Length': '100' } };
    const response = await fetch(url, init);
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.ok(response.statusText);

    const data = await response.json();
    // console.log(data);
    assert.equal(data.data.length, 100);

    server.close();
});
