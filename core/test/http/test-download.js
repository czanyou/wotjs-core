// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as http from '@tjs/http';
import * as util from '@tjs/util';

test('http - download', async () => {
    const options = { port: 38088 };
    const server = http.createServer(options, async (req, res) => {
        res.headers.set('Content-Length', '100');
        await res.writeHead();

        for (let i = 0; i < 10; i++) {
            await res.write('1234567890');
            await util.sleep(10);
        }

        await res.end();
    });

    try {

        await server.start();

        const url = 'http://localhost:38088/get?foo=100&bar=test';
        const init = { debug: true, headers: { 'X-Test': 'http:get' } };
        const response = await fetch(url, init);

        assert.ok(response);
        assert.equal(response.status, 200);
        assert.ok(response.statusText);

        // console.log(response.statusText);

        const body = response.body;
        const reader = body?.getReader();

        let total = 0;
        if (reader) {
            while (true) {
                const result = await reader.read();
                // console.log('result:', result);

                if (result?.done) {
                    break;

                } else if (result?.value) {
                    total += result.value.length;
                }
            }
        }

        // console.log('total', total);
        assert.equal(total, 100);

    } catch (e) {
        console.log('error:', e);

    } finally {
        server.close();
    }
});
