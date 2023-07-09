// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import * as fetch from '@tjs/fetch';
import * as http from '@tjs/http';
import * as util from '@tjs/util';

import { test } from '@tjs/test';

/**
 * 开始服务器
 * @returns 
 */
async function startServer() {
    const options = { port: 8088 };
    const server = http.createServer(options, async (req, res) => {
        const path = req.path;
        // console.log('path:', path);
        if (path == '/get') {
            await res.send('');
            return;
        }

        const result = { headers: {}, args: req.query };
        req.headers.forEach((value, key) => {
            result.headers[key] = value;
        });

        const type = req.headers.get('Content-Type');
        // console.log('type', type);

        if (!type) {
            result.data = await req.text();

        } else if (type?.startsWith('application/json')) {
            result.json = await req.json();

        } else if (type?.startsWith('application/x-www-form-urlencoded')) {
            const params = await req.form();
            result.form = {};
            params.forEach((value, key) => {
                result.form[key] = value;
            });

        } else if (type?.startsWith('multipart/form-data')) {
            result.formdata = await req.text();

        } else {
            result.data = await req.text();
        }

        if (type) {
            res.headers.set('Content-Type', type);
        }
        
        res.headers.set('Content-Type', 'application/json');
        await res.send(result);
    });

    await server.start();

    return server;
}

/**
 * 测试 POST
 */
test('http - post.json', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:8088/post?foo=100&bar=test';
        const body = JSON.stringify({ test: 'post' });
        const init = { debug: true, method: 'POST', headers: { 'X-Test': 'http:post', 'Content-Type': 'application/json' }, body };
        const response = await window.fetch(url, init);
        assert.ok(response);
        assert.equal(response.status, 200);
        // console.log('response', response);

        // data
        const data = await response.json();
        assert.ok(data);

        // console.log(data);

        // data.args
        const args = data?.args;
        assert.equal(args.foo, '100');
        assert.equal(args.bar, 'test');

        // data.headers
        const headers = data.headers;
        assert.equal(headers['x-test'], 'http:post');
        assert.equal(headers['content-type'], 'application/json');

        // data.json
        const json = data.json;
        assert.equal(json.test, 'post');

        const manager = fetch.getManager();
        if (!manager) {
            for (let i = 0; i < 10; i++) {
                await util.sleep(100);

                // send again
                const response = await window.fetch(url, init);
                assert.ok(response);
                assert.equal(response.status, 200);
            }

            await util.sleep(5000);
        }

        fetch.close();

    } finally {
        server.close();
    }
});

/**
 * 测试 GET
 * 请求返回空消息内容
 */
test('http - get', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:8088/get?foo=100&bar=test';
        const init = { debug: true, method: 'GET', headers: { 'X-Test': 'http:get' } };
        const response = await window.fetch(url, init);
        assert.ok(response);
        assert.equal(response.status, 200);
        // console.log('response', response);

        // data
        const data = await response.text();
        assert.ok(data == null);

        // console.log(data);
        fetch.close();

    } finally {
        server.close();
    }
});

/**
 * 测试 HEAD
 */
test('http - head.json', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:8088/post?foo=100&bar=test';
        const init = { debug: true, method: 'HEAD', headers: { 'X-Test': 'http:head' } };
        const response = await window.fetch(url, init);
        assert.ok(response);
        assert.equal(response.status, 200);
        // console.log('response', response);

        // data
        const data = await response.text();
        assert.ok(data == null);

        // console.log(data);
        fetch.close();

    } finally {
        server.close();
    }
});
