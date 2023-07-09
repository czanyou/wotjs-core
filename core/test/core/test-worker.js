// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import { dirname, join } from '@tjs/path';

test('worker', async () => {
    // @ts-ignore
    const __filename = import.meta.url.slice(7); // strip "file://"
    const __dirname = dirname(__filename);

    const filename = join(__dirname, 'helpers', 'worker.js');
    // console.log('filename:', filename);
    const worker = new Worker(filename);

    const promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            // console.log(worker);
            reject(new Error('woker timeout'));

            // worker.terminate();
        }, 1000);

        worker.onmessage = event => {
            // console.log('event', event.data);

            const data = JSON.stringify({ foo: 42, bar: 'baz!' });
            const recvData = JSON.stringify(event.data);
            assert.equal(data, recvData, 'Message received matches');
            worker.terminate();
            clearTimeout(timer);

            resolve(null);
        };
    });

    await promise;
});
