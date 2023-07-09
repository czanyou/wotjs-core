// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as streams from '@tjs/streams';
import * as util from '@tjs/util';

test('readable-stream-releaseLock', async () => {

    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {

            let count = 11;
            controller.enqueue(new Uint8Array(count++)); // 1
            controller.enqueue(new Uint8Array(count++)); // 2

            setTimeout(() => {
                controller.enqueue(new Uint8Array(count++)); // 3
            }, 100);
        }
    });

    // 1. 读取并释放
    try {
        // 1.1 reader
        assert.equal(readable.locked, false);
        const reader = readable.getReader();
        assert.equal(readable.locked, true);

        // 1.2 read 1
        const data = await reader.read();
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 11);

        // 1.4 releaseLock
        reader.releaseLock();

        // 1.5
        await util.sleep(1);
        // assert.equal(isClosed, 'closed');
    } catch (e) {
        console.log(e);
    }

});

test('readable-stream-cancel-reader', async () => {

    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {

            let count = 11;
            controller.enqueue(new Uint8Array(count++)); // 1
            controller.enqueue(new Uint8Array(count++)); // 2

            setTimeout(() => {
                controller.enqueue(new Uint8Array(count++)); // 3
            }, 100);
        }
    });

    // 1. reader
    const reader = readable.getReader();

    // 2.1 read 1
    let data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 11);

    // 2.2 read 2
    data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 12);

    // 3. 取消这个 reader
    await reader.cancel();

    // 4. 不可再读
    data = await reader.read();
    assert.equal(data.done, true);
});

test('readable-stream-close-read', async () => {
    let isClosed = null;

    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {

            let count = 11;
            controller.enqueue(new Uint8Array(count++));
            controller.enqueue(new Uint8Array(count++));

            setTimeout(() => {
                controller.enqueue(new Uint8Array(count++));
                controller.close();

                controller.enqueue(new Uint8Array(count++));
            }, 100);
        }
    });

    // 1. reader
    const reader = readable.getReader();
    reader.closed.then(() => {
        isClosed = 'closed';

    }).catch(() => {
        isClosed = 'reject';
    });

    // 2.1 read 1
    let data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 11);

    // 2.2 read 2
    data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 12);

    // 2.3 read 3
    data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 13);

    // 1.2 closed
    await reader.closed;

    // 3. closed
    data = await reader.read();
    assert.equal(data.done, true);

    assert.equal(isClosed, 'closed');
    // console.log('end');
});

/**
 * 测试 closed promise
 */
test('readable-stream-closed-promise', async () => {
    let isClosed = false;

    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {

            let count = 11;
            controller.enqueue(new Uint8Array(count++));
            controller.enqueue(new Uint8Array(count++));

            setTimeout(() => {
                controller.enqueue(new Uint8Array(count++));

                isClosed = true;
                controller.close();

                controller.enqueue(new Uint8Array(count++));
            }, 100);
        }
    });

    // 1. reader
    const reader = readable.getReader();

    // 1.2 closed
    assert.equal(isClosed, false);
    await reader.closed;
    assert.equal(isClosed, true);

    // 2.1 read 1
    let data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 11);

    // 2.2 read 2
    data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 12);

    // 2.3 read 3
    data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 13);

    // 3. closed
    data = await reader.read();
    assert.equal(data.done, true);
});

/**
 * 测试同时发起 3 个读请求
 */
test('readable-stream-read3', async () => {

    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {

            let count = 11;
            controller.enqueue(new Uint8Array(count++)); // 1
            controller.enqueue(new Uint8Array(count++)); // 2

            setTimeout(() => {
                controller.enqueue(new Uint8Array(count++)); // 3
                controller.close();

                controller.enqueue(new Uint8Array(count++)); // 4
            }, 100);
        }
    });

    // 1. 读取并释放
    try {
        // 1.1 reader
        assert.equal(readable.locked, false);
        const reader = readable.getReader();
        assert.equal(readable.locked, true);

        // 1.2 read
        const read1 = reader.read();

        // 1.3 closed
        await reader.closed;

        // 1.4 read
        const read2 = reader.read();
        const read3 = reader.read();
        let data = await read1;
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 11);

        data = await read2;
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 12);

        data = await read3;
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 13);

        // 2. closed
        data = await reader.read();
        assert.equal(data.done, true);

    } catch (e) {
        console.log(e);
    }
});

test('readable-stream-cancel-read3', async () => {
    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {
            let count = 11;
            controller.enqueue(new Uint8Array(count++)); // 1

            setTimeout(() => {
                controller.enqueue(new Uint8Array(count++)); // 2
                controller.enqueue(new Uint8Array(count++)); // 3
                controller.close();
            }, 100);
        }
    });

    // 1. 读取并释放
    try {
        // 1.1 reader
        assert.equal(readable.locked, false);
        const reader = readable.getReader();
        assert.equal(readable.locked, true);

        // 2.1 read
        const read1 = reader.read();
        const read2 = reader.read();

        // 2.2 cancel
        reader.cancel();

        // 2.3 read
        const read3 = reader.read();

        let data = await read1;
        assert.equal(data.done, false);

        data = await read2;
        assert.equal(data.done, true);

        data = await read3;
        assert.equal(data.done, true);

    } catch (e) {
        console.log(e);
    }
});

test('readable-stream-close-getReader', async () => {
    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {
            controller.close();
        }
    });

    // 1. 读取并释放
    try {
        // 1.1 reader
        assert.equal(readable.locked, false);
        const reader = readable.getReader();
        assert.equal(readable.locked, true);

        await reader.closed;

        // 2.1 read 1
        const data = await reader.read();
        assert.equal(data.done, true);

    } catch (e) {
        console.log(e);
    }
});

test('readable-stream-cancel-getReader', async () => {
    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {
        }
    });

    // 1. 读取并释放
    try {
        readable.cancel();

        // 1.1 reader
        assert.equal(readable.locked, false);
        const reader = readable.getReader();
        assert.equal(readable.locked, true);

        await reader.closed;

        // 2.1 read 1
        const data = await reader.read();
        assert.equal(data.done, true);

    } catch (e) {
        console.log(e);
    }
});

/**
 * 测试拉数据模式
 */
test('readable-stream-pull', async () => {
    let count = 11;

    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {

        },
        pull: (controller) => {
            controller.enqueue(new Uint8Array(count++)); // 1
            if (count == 14) {
                controller.close();
            }

            return Promise.resolve(undefined);
        }
    });

    // 1. 读取并释放
    try {
        // 1.1 reader
        assert.equal(readable.locked, false);
        const reader = readable.getReader();
        assert.equal(readable.locked, true);

        // 2.1 read 1
        let data = await reader.read();
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 11);

        // 2.2 read 2
        data = await reader.read();
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 12);

        // 2.3 read 3
        data = await reader.read();
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 13);

        // 3.1 closed
        await reader.closed;

        // 3.2. closed
        data = await reader.read();
        assert.equal(data.done, true);

    } catch (e) {
        console.log(e);
    }
});

/**
 * 测试拉数据模式
 */
test('readable-stream-pull3', async () => {
    let count = 11;
    let pullCount = 0;

    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {

        },
        pull: (controller) => {
            pullCount++;

            controller.enqueue(new Uint8Array(count++)); // 1
            controller.enqueue(new Uint8Array(count++)); // 2

            if (count >= 14) {
                controller.close();
            }

            return Promise.resolve(undefined);
        }
    });

    // 1. 读取并释放
    try {
        // 1.1 reader
        assert.equal(readable.locked, false);
        const reader = readable.getReader();
        assert.equal(readable.locked, true);

        // 2.1 read 1
        let data = await reader.read();
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 11);

        // 2.2 read 2
        data = await reader.read();
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 12);

        // 2.3 read 3
        data = await reader.read();
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 13);

        // 2.3 read 4
        data = await reader.read();
        assert.equal(data.done, false);
        assert.equal(data.value?.length, 14);

        // 3.2. closed
        data = await reader.read();
        assert.equal(data.done, true);

        assert.equal(pullCount, 2);

    } catch (e) {
        console.log(e);
    }
});

/**
 * 测试拉数据模式
 */
test('readable-stream-error', async () => {
    /** @param {Event} event */
    function onUnhandledRejection(event) {
        event.preventDefault();
    }

    window.onunhandledrejection = onUnhandledRejection;

    /** @type ReadableStream<Uint8Array> */
    const readable = new streams.ReadableStream({
        start: (controller) => {
            let count = 11;

            setTimeout(() => {
                controller.enqueue(new Uint8Array(count++)); // 1
                controller.enqueue(new Uint8Array(count++)); // 2
                controller.error(new Error('error-closed'));
                // console.log('error');
                controller.enqueue(new Uint8Array(count++)); // 3
            }, 100);
        }
    });

    // 1. 读取并释放

    // 1.1 reader
    assert.equal(readable.locked, false);
    const reader = readable.getReader();
    assert.equal(readable.locked, true);

    // 2.1 read 1
    let data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 11);
    // console.log('error1');

    // 2.2 read 2
    data = await reader.read();
    assert.equal(data.done, false);
    assert.equal(data.value?.length, 12);
    // console.log('error2');

    try {
        // 3.1 closed
        await reader.closed;
        assert.fail('error-closed');

    } catch (e) {
        assert.equal(e.message, 'error-closed');
    }

    try {
        // 3.2. closed
        data = await reader.read();
        assert.fail('error-closed');

    } catch (e) {
        assert.equal(e.message, 'error-closed');

    } finally {
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
    }
});
