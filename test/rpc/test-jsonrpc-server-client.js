// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as util from '@tjs/util';

import * as assert from '@tjs/assert';
import * as jsonrpc from '../../../app/modules/utils/jsonrpc.js';

const test = assert.test;

test('net.jsonrpc - server:client', async () => {
    const handles = {
        async test(value) {
            await util.sleep(100);
            return value * 100;
        }
    };

    const name = '/tmp/test.socket';
    const server = jsonrpc.createServer(name, handles);
    await util.sleep(100);

    const client = jsonrpc.createClient(name);

    let flags = 0;

    for (let i = 0; i < 10; i++) {
        client.call('test', [i]).then((result) => {
            // console.log('result:', result);
            flags++;

        }).catch((error) => {
            // console.log('error:', error.message);
            assert.ok(error);
            flags++;
        });
    }

    // eslint-disable-next-line no-unmodified-loop-condition
    while (flags < 10) {
        await util.sleep(1000);
        // console.log('flags', flags);
    }

    await server.close();
});
