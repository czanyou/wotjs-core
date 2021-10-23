// @ts-check
import { assert, test } from '@tjs/assert';

import * as http from '@tjs/http';
const $textEncoder = new TextEncoder();

test('http.upload.text', async () => {
    const url = 'http://www.httpbin.org/post';
    const config = { headers: { 'Content-Type': 'application/octet-stream' } };
    const body = $textEncoder.encode('<root>xml</root>');
    const response = await http.post(url, body, config);
    assert.ok(response);
    assert.equal(response.status, 200);
    // console.log('response', response);

    // data
    const data = response.data;
    assert.ok(data);
});
