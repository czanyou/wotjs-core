// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as http from '@tjs/http';

/**
 * 测试 HTTP 服务器
 */
test('http - server', async () => {
    // create a HTTP server
    const options = { port: 28088 };
    const server = http.createServer(options, async (req, res) => {
        // response with request info.
        const result = {};
        result.args = req.query;

        result.headers = {};
        req.headers.forEach((value, key) => {
            result.headers[key.toLowerCase()] = value;
        });

        // console.log(result);
        await res.send(result);
    });

    await server.start();

    // create a HTTP client
    const url = 'http://localhost:28088/get?foo=100&bar=test';
    const init = { debug: false, headers: { 'X-Test': 'http:get' } };
    const response = await fetch(url, init);
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.ok(response.statusText);

    // read response body
    const data = await response.json();

    // check query paramsters
    const args = data?.args;
    assert.equal(args.foo, '100');
    assert.equal(args.bar, 'test');

    // check headers
    const headers = data.headers;
    assert.equal(headers['x-test'], 'http:get');

    // close the HTTP server
    server.close();
});
