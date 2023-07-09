// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

import * as http from '@tjs/http';
const $textEncoder = new TextEncoder();

/* global */

test('http - get.json', async () => {
    const url = 'http://www.httpbin.org/get?foo=100';
    const config = { params: { bar: 'test' }, headers: { 'X-Test': 'http.get' } };
    const response = await http.get(url, config);
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.ok(response.statusText);

    const data = response.data;
    const args = data?.args;
    assert.equal(args.foo, '100');
    assert.equal(args.bar, 'test');

    const headers = data.headers;
    assert.equal(headers['X-Test'], 'http.get');
});

test('http - post.json', async () => {
    const url = 'http://www.httpbin.org/post?foo=100';
    const config = { params: { bar: 'test' }, headers: { 'X-Test': 'http.post', 'Content-Type': 'application/json' } };
    const response = await http.post(url, { test: 'post' }, config);
    assert.ok(response);
    assert.equal(response.status, 200);
    // console.log('response', response);

    // data
    const data = response.data;
    assert.ok(data);

    // data.args
    const args = data?.args;
    assert.equal(args.foo, '100');
    assert.equal(args.bar, 'test');

    // data.headers
    const headers = data.headers;
    assert.equal(headers['X-Test'], 'http.post');
    assert.equal(headers['Content-Type'], 'application/json');

    // data.json
    const json = data.json;
    assert.equal(json.test, 'post');
});

test('http - post.text', async () => {
    const url = 'http://www.httpbin.org/post';
    const config = { headers: {} };
    const response = await http.post(url, '<root>xml</root>', config);
    assert.ok(response);
    assert.equal(response.status, 200);
    // console.log('response', response);

    // data
    const data = response.data;
    assert.ok(data);

    // data.headers
    const headers = data.headers;
    assert.equal(headers['Content-Type'], 'text/plain;charset=UTF-8');

    // data.json
    assert.equal(data.data, '<root>xml</root>');
});

test('http - post.buffer', async () => {
    const url = 'http://www.httpbin.org/post';
    const config = { headers: {} };
    const body = $textEncoder.encode('<root>xml</root>');
    const response = await http.post(url, body, config);
    assert.ok(response);
    
    assert.equal(response.status, 200);

    // data
    const data = response.data;
    assert.ok(data);

    // data.headers
    const headers = data.headers;
    assert.equal(headers['Content-Length'], '16');

    // data.json
    assert.equal(data.data, '<root>xml</root>');
});

test('http - post.urlencoded', async () => {
    const url = 'http://www.httpbin.org/post';
    const config = { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
    const response = await http.post(url, { test: 'post', foo: 100, bar: 'test' }, config);
    assert.ok(response);
    assert.equal(response.status, 200);

    // data
    const data = response.data;
    assert.ok(data);

    // data.headers
    const headers = data.headers;
    assert.equal(headers['Content-Type'], 'application/x-www-form-urlencoded');

    // data.form
    const form = data.form;
    assert.equal(form.test, 'post');
    assert.equal(form.foo, '100');
    assert.equal(form.bar, 'test');
});

test('http - post.formdata', async () => {
    const url = 'http://www.httpbin.org/post';
    const config = { headers: { 'Content-Type': 'multipart/form-data' } };
    const formdata = new FormData();
    formdata.append('test', 'post');
    formdata.append('foo', '100');
    formdata.append('bar', 'test');

    const response = await http.post(url, formdata, config);
    assert.ok(response);
    // console.log(response);

    assert.equal(response.status, 200);

    // data
    const data = response.data;
    assert.ok(data);

    // data.headers
    const headers = data.headers;

    const value = headers['Content-Type'];
    const headerValue = new http.HeaderValue(value);

    assert.equal(headerValue.value, 'multipart/form-data');
    assert.ok(headerValue.params.boundary);
});
