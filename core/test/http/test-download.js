// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as http from '@tjs/http';
import * as util from '@tjs/util';

/**
 * 测试文件下载
 */
test('http - download', async () => {
    let server;
    try {
        // create a HTTP server
        const options = { port: 38088 };
        server = http.createServer(options, async (req, res) => {
            res.headers.set('Content-Length', '100');
            await res.writeHead();

            // 模拟发送长为 100 的文件内容
            for (let i = 0; i < 10; i++) {
                await res.write('1234567890');
                await util.sleep(10);
            }

            await res.end();
        });

        await server.start();

        // fetch
        const url = 'http://localhost:38088/get?foo=100&bar=test';
        const init = { debug: true, headers: { 'X-Test': 'http:get' } };
        const response = await fetch(url, init);

        assert.ok(response);
        assert.equal(response.status, 200);
        assert.ok(response.statusText);
        // console.log(response.statusText);

        // read response body
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

        // close the HTTP server
        server.close();

    } catch (e) {
        console.log('error:', e);
        server?.close();
    }
});
