// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as util from '@tjs/util';

import * as assert from '@tjs/assert';
import * as jsonrpc from '../../../app/modules/utils/jsonrpc.js';

const test = assert.test;

test('net.jsonrpc - method not.found', async () => {
    const name = '/tmp/test.socket';
    const server = jsonrpc.createServer(name, null);
    await util.sleep(100);

    const client = jsonrpc.createClient(name);

    for (let i = 0; i < 10; i++) {
        try {
            const result = await client.call('test', [i]);
            // console.log('result:', result);
            assert.fail(result);

        } catch (err) {
            // console.log('error:', err.message);
            assert.ok(err);
        }
    }

    await server.close();
});
