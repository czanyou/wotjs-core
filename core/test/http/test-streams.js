// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

// @ts-ignore
import * as streams from '@tjs/streams';

function state(stream) {
    return stream._state;
}

test('fetch - streams - close', async () => {
    /** @type ReadableStreamDefaultController | null */
    let readController = null;
    const stream = streams.createReadableStream({
        start(controller) {
            readController = controller;
        }
    });

    if (!stream) {
        return;
    }

    assert.equal(state(stream), 'readable');

    setTimeout(() => {
        if (readController) {
            readController.enqueue('test1');
            readController.enqueue('test2');
            readController.close();
        }
    }, 10);

    const reader = stream.getReader();

    let result = await reader.read(); // 1
    assert.equal(result.done, false);

    await reader.closed;

    assert.equal(state(stream), 'closed');

    result = await reader.read(); // 2
    assert.equal(result.done, false);

    await reader.closed;

    result = await reader.read(); // done
    assert.equal(result.done, true);

    // console.log(stream);
});

test('fetch - streams - cancel', async () => {

    /** @type ReadableStreamDefaultController | null */
    let readController = null;
    const stream = streams.createReadableStream({
        start(controller) {
            readController = controller;

            readController?.enqueue('test1');
        }
    });

    assert.equal(state(stream), 'readable');

    const reader = stream.getReader();

    // 1. read `test1`
    let result = await reader.read(); // 1
    assert.equal(result.done, false);
    assert.equal(result.value, 'test1');

    setTimeout(async () => { }, 1000);

    // 2. cancel the stream
    setTimeout(async () => {
        if (reader) {
            await reader.cancel();
        }

    }, 10);

    // console.log('result', result);
    // 4. wait closed
    await reader.closed;

    // 5. read
    try {
        result = await reader.read(); // done
        assert.equal(result.done, true);

    } catch (e) {
        assert.equal(e?.message, 'onwer stream is null');
    }

    // console.log(stream);
});
