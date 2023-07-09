// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

test('fetch - basic', async () => {
    const response = await fetch('http://www.baidu.com/?');
    assert.equal(response.status, 200, 'status is 200');
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
