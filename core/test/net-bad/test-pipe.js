// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as net from '@tjs/net';

import * as assert from '@tjs/assert';
const test = assert.test;

test('net.pipe.bad', async () => {
    const path = '/tmp/test-pipe';
    try {
        await fs.unlink(path);
    } catch (e) {

    }

    const result = {};

    async function createEchoClient(serverAddress) {
        const client = net.connect(serverAddress);

        client.onmessage = async function (event) {
            const data = event.data;
            if (!data) {
                result.isEndOfFile = true;
            }
        };

        client.onclose = function (event) {
            console.log('onclose');
            onClose();
        };
    
        client.onerror = function (event) {
            console.log('onerror', event.error);
            result.error = event.error;
        };

        client.onopen = async function (event) {
            console.log('onopen');
            result.conntected = true;
        };

        return client;
    }
    
    const client = await createEchoClient({ path });

    assert.startTimeout(10000, () => {
        client.close();
    });

    function onClose() {
        assert.stopTimeout();
    }

    await assert.waitTimeout();
});
