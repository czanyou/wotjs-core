// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as http from '@tjs/http';

test('http - server', async () => {
    // server
    const options = { port: 28088 };
    const server = http.createServer(options, async (req, res) => {
        const result = {};
        result.headers = {};
        result.args = req.query;

        req.headers.forEach((value, key) => {
            result.headers[key] = value;
        });

        // console.log(result);

        await res.send(result);
    });

    await server.start();

    // client
    const url = 'http://localhost:28088/get?foo=100&bar=test';
    const config = { debug: true, headers: { 'X-Test': 'http:get' } };
    const response = await fetch(url, config);
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.ok(response.statusText);

    // response
    const data = await response.json();
    // console.log('response.body', data);

    const args = data?.args;
    assert.equal(args.foo, '100');
    assert.equal(args.bar, 'test');

    const headers = data.headers;
    assert.equal(headers['x-test'], 'http:get');

    server.close();
});
