// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import * as jsonrpc from '../../../app/modules/utils/jsonrpc.js';

const test = assert.test;

test('net.jsonrpc - bad server', async () => {
    const name = '/tmp/test.socket';
    const client = jsonrpc.createClient(name);

    for (let i = 0; i < 100; i++) {
        try {
            const result = await client.call('test', [i]);
            // console.log('result:', result);
            assert.fail(result);

        } catch (err) {
            assert.ok(err);
            // console.log('error:', err.message);
        }
    }
});
