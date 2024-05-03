// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as http from '@tjs/http';
const $textEncoder = new TextEncoder();

/**
 * 创建一个 HTTP 测试服务器
 * - 这个服务器会返回客户端请求的内容
 * @returns {Promise<http.Server>}
 */
async function startServer() {
    const options = { port: 18088 };
    const server = http.createServer(options, async (req, res) => {
        const result = { headers: {}, args: req.query };
        req.headers.forEach((value, key) => {
            result.headers[key.toLowerCase()] = value;
        });

        // console.log('headers', req.headers);
        const type = req.headers.get('Content-Type');
        // console.log('type', type);

        if (!type) {
            result.data = await req.text();

        } else if (type.startsWith('application/json')) {
            result.json = await req.json();

        } else if (type.startsWith('application/x-www-form-urlencoded')) {
            const data = await req.text();

            const params = new URLSearchParams(data);
            result.form = {};
            params.forEach((value, key) => {
                result.form[key] = value;
            });

        } else if (type.startsWith('multipart/form-data')) {
            const formdata = await req.formData();

            const data = {};
            for (const [key, value] of formdata) {
                data[key] = value;
            }

            result.formdata = data;
            // console.log('formdata:', formdata);

        } else {
            const data = await req.text();
            res.headers.set('Content-Type', type);
            result.data = data;
        }

        res.headers.set('Content-Type', 'application/json');
        await res.send(result);
    });

    await server.start();

    return server;
}

/**
 * 测试发送 JSON 内容
 */
test('http - post.json', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:18088/post?foo=100&bar=test';
        const body = JSON.stringify({ test: 'post' });
        const init = { debug: false, method: 'POST', headers: { 'X-Test': 'http:post', 'Content-Type': 'application/json', Connection: 'close' }, body };
        const response = await fetch(url, init);
        assert.ok(response);
        assert.equal(response.status, 200);
        // console.log('response', response);

        // data
        const data = await response.json();
        assert.ok(data);

        // console.log(data);
        // console.log(response);

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

    } finally {
        server?.close();
    }
});

/**
 * 测试发送纯文本内容
 */
test('http - post.text', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:18088/post';
        const init = { debug: false, method: 'POST', headers: {}, body: '<root>xml</root>' };
        const response = await fetch(url, init);
        assert.ok(response);
        assert.equal(response.status, 200);
        // console.log('response', response);

        // data
        const data = await response.json();
        assert.ok(data);

        // data.headers
        const headers = data.headers;
        assert.equal(headers['content-type'], 'text/plain;charset=UTF-8');

        // data.json
        assert.equal(data.data, '<root>xml</root>');

    } finally {
        server?.close();
    }
});

/**
 * 测试发送二进制内容
 */
test('http - post.buffer', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:18088/post';
        const body = $textEncoder.encode('<root>xml</root>');
        const init = { debug: false, method: 'POST', headers: {}, body };
        const response = await fetch(url, init);
        assert.ok(response);

        assert.equal(response.status, 200);

        // data
        const data = await response.json();
        assert.ok(data);

        // data.headers
        const headers = data.headers;
        assert.equal(headers['content-length'], '16');

        // data.json
        assert.equal(data.data, '<root>xml</root>');

    } finally {
        server?.close();
    }
});

/**
 * 测试发送 URL 参数
 */
test('http - post.urlencoded', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:18088/post';
        const body = new URLSearchParams({ test: 'post', foo: '100', bar: 'test' });
        const init = { debug: false, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body };
        const response = await fetch(url, init);
        assert.ok(response);
        assert.equal(response.status, 200);

        // data
        const data = await response.json();
        assert.ok(data);

        // data.headers
        const headers = data.headers;
        assert.equal(headers['content-type'], 'application/x-www-form-urlencoded');

        // console.log(data);

        // data.form
        const form = data.form;
        assert.equal(form.test, 'post');
        assert.equal(form.foo, '100');
        assert.equal(form.bar, 'test');

    } finally {
        server?.close();
    }
});

/**
 * 测试同时发起 3 个请求
 */
test('http - post.all', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:18088/post';
        const formdata = new FormData();
        formdata.append('test', 'post');
        formdata.append('foo', '100');
        formdata.append('bar', 'test');

        const init = { debug: false, method: 'POST', headers: {}, body: formdata };

        const promises = [];
        promises.push(fetch(url, init));
        promises.push(fetch(url, init));
        promises.push(fetch(url, init));
        await Promise.all(promises);

    } finally {
        server?.close();
    }
});

/**
 * 测试发送表格内容
 */
test('http - post.formdata', async () => {
    const server = await startServer();
    try {
        const url = 'http://localhost:18088/post';
        const formdata = new FormData();
        formdata.append('test', 'post');
        formdata.append('foo', '100');
        formdata.append('bar', 'test');

        const init = { debug: false, method: 'POST', headers: {}, body: formdata };
        const response = await fetch(url, init);
        assert.ok(response);

        assert.equal(response.status, 200);

        // data
        const data = await response.json();
        assert.ok(data);
        // console.log(data);
        // console.log(response);

        // data.headers
        const headers = data.headers;

        const value = headers['content-type'];
        const headerValue = new http.HeaderValue(value);

        assert.equal(headerValue.value, 'multipart/form-data');
        assert.ok(headerValue.params.boundary);

    } finally {
        server?.close();
    }
});

/**
 * 测试支持的特性
 */
test('http - support', async () => {
    const support = {
        arrayBuffer: 'ArrayBuffer' in globalThis,
        formData: 'FormData' in globalThis,
        iterable: 'Symbol' in globalThis && 'iterator' in Symbol,
        searchParams: 'URLSearchParams' in globalThis,
        fileReader: 'FileReader' in globalThis,
        blob:
            'FileReader' in globalThis &&
            'Blob' in globalThis &&
            (function () {
                try {
                    // eslint-disable-next-line no-new
                    new Blob();
                    return true;
                } catch (e) {
                    return false;
                }
            })()
    };

    // console.log(support);
    assert.equal(support.arrayBuffer, true);
    assert.equal(support.formData, true);
    assert.equal(support.iterable, true);
    assert.equal(support.searchParams, true);
    assert.equal(support.blob, true);
    assert.equal(support.fileReader, true);

    const data = new FormData();
    // eslint-disable-next-line no-prototype-builtins
    const ret = FormData.prototype.isPrototypeOf(data);
    assert.equal(ret, true);
    assert.equal(data instanceof FormData, true);
});
