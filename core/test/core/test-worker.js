// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

import { dirname, join } from '@tjs/path';

function testWorker() {
    // @ts-ignore
    const __filename = import.meta.url.slice(7); // strip "file://"
    const __dirname = dirname(__filename);

    // console.log('__dirname:', __dirname);

    const data = JSON.stringify({ foo: 42, bar: 'baz!' });

    const filename = join(__dirname, 'helpers', 'worker.js');
    const worker = new Worker(filename);

    const timer = setTimeout(() => {
        worker.terminate();
    }, 1000);

    worker.onmessage = event => {
        // console.log('event', event.data);

        const recvData = JSON.stringify(event.data);
        assert.equal(data, recvData, 'Message received matches');
        worker.terminate();
        clearTimeout(timer);
    };
}

test('worker', testWorker);
