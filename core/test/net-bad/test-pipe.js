// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as net from '@tjs/net';

import { test } from '@tjs/test';

test('net.pipe.bad', async () => {
    const path = '/tmp/test-pipe';
    try {
        await fs.unlink(path);
    } catch (e) {

    }

    const result = {};
    const $context = {};
    
    const promise = new Promise((resolve, reject) => {
        $context.callback = () => {
            clearTimeout($context.timer);
            resolve(0);
        };

        $context.timer = setTimeout(() => {
            $context.callback = null;
            resolve(0);
        }, 1000);
    });

    async function createEchoClient(serverAddress) {
        const client = net.connect(serverAddress);

        client.onmessage = async function (event) {
            const data = event.data;
            if (!data) {
                result.isEndOfFile = true;
            }
        };

        client.onclose = function (event) {
            // console.log('onclose');
            
            if ($context.callback) {
                $context.callback();
            }
        };
    
        client.onerror = function (event) {
            // console.log('onerror', event.error);
            result.error = event.error;
        };

        client.onopen = async function (event) {
            console.log('onopen');
            result.conntected = true;
        };

        return client;
    }
    
    await createEchoClient({ path });

    await promise;
});
