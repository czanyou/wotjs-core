// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('fetch - basic', async () => {
    const response = await fetch('http://www.baidu.com/?');
    assert.equal(response.status, 200, 'status is 200');
});

test('fetch - abort', async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    setTimeout(() => { controller.abort(); }, 500);

    try {
        await fetch('https://httpbin.org/delay/3', { signal });

    } catch (e) {
        assert.equal(e.name, 'AbortError', 'fetch was aborted');
    }
});

test('fetch - post and body', async () => {
    const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
    const response = await fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data
    });

    // console.log(response);

    assert.equal(response.status, 200, 'status is 200');
    const json = await response.json();
    // console.log(json, 'json');

    assert.equal(json.data, data, 'sent and received data match');
});
