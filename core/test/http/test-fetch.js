// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

// @ts-ignore
import * as fetch from '@tjs/fetch';
import * as streams from '@tjs/streams';
import * as util from '@tjs/util';

/**
 * 测试 Body 类
 */
test('fetch - Body', async () => {
    // console.log(fetch);

    /** @type Body | any */
    // @ts-ignore
    const body = new fetch.Body();
    assert.equal(body.bodyUsed, false);

    // 1. Body is null

    const raw = await body._processBody();
    assert.equal(raw, undefined);
    // console.log(raw);

    const type = await body._getBodyType(raw);
    assert.ok(type);
    // console.log(type);

    // Body is null
    let data = await body.text();
    assert.equal(body.bodyUsed, true);
    // console.log('text0', data);
    assert.equal(data, undefined);

    // 2. Body is 'test1'

    // _initBody with text
    body._bodyUsed = false;
    body._initBody('test1');

    data = await body.text();
    assert.equal(body.bodyUsed, true);
    // console.log('text1', data);
    assert.equal(data, 'test1');

    // 3. Body is stream
    
    let readController = null;
    const stream = new ReadableStream({
        start(controller) {
            readController = controller;
        }
    });

    body._bodyUsed = false;
    body._initBody(stream);

    setTimeout(() => {
        readController.enqueue(util.toBuffer('test2'));
        readController.close();
        body.end();
    }, 10);

    data = await body.text();
    assert.equal(body.bodyUsed, true);
    // console.log('body:', data);
    assert.equal(data, 'test2');
});

/**
 * 测试 Request 类
 */
test('fetch - Request', async () => {
    try {
        const body = '100';
        // @ts-ignore
        const request = new fetch.Request('', { method: 'POST', body });

        // read as text
        const data = await request.text();
        assert.equal(data, '100');

    } catch (e) {
        console.log(e);
    }
});

/**
 * 测试 Request 类
 */
test('fetch - Request - stream', async () => {
    try {
        // send as stream
        let total = 0;
        const stream = streams.createReadableStream({
            pull(controller) {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        const data = util.toBuffer(total + '00');
                        controller.enqueue(new Uint8Array(data));
                        total++;

                        if (total >= 10) {
                            // console.log(stream);
                            controller.close();
                        }

                        resolve();
                    }, 10);
                });
            }
        });

        // @ts-ignore
        const request = new fetch.Request('', { method: 'POST', body: stream });

        // read as text
        const reader = request.body.getReader();
        let data = '';
        while (true) {
            const result = await reader.read();
            if (result.done) {
                break;
            }

            data += util.toString(result.value);
        }
        
        assert.equal(data, '000100200300400500600700800900');

    } catch (e) {
        console.log(e);
    }
});

/**
 * 测试 Response 类
 */
test('fetch - Response - stream - text()', async () => {
    try {
        /** @type {ReadableStreamDefaultController=} */
        let readController;
        const stream = streams.createReadableStream({
            start(controller) {
                readController = controller;
            }
        });

        // @ts-ignore
        const response = new fetch.Response(stream);

        // enqueue
        setTimeout(() => {
            readController?.enqueue(util.toBuffer('200'));
            readController?.close();
        }, 10);

        readController?.enqueue(util.toBuffer('100'));

        // read as text
        const data = await response.text();
        assert.equal(data, '100200');

    } catch (e) {
        console.log(e);
        assert.fail(e);
    }
});

/**
 * 测试 Response 类的 body.getReader 接口
 */
test('fetch - Response - stream - getReader', async () => {
    try {
        /** @type {ReadableStreamDefaultController=} */
        let readController;
        const stream = streams.createReadableStream({
            start(controller) {
                readController = controller;
            }
        });

        // @ts-ignore
        const response = new fetch.Response(stream);
        let count = 0;

        // enqueue
        function onEnqueue() {
            setTimeout(() => {
                readController?.enqueue(util.toBuffer(count + '00'));

                if (count++ >= 10) {
                    readController?.close();

                } else {
                    onEnqueue();
                }
            }, 10);
        }

        onEnqueue();

        // get reader
        const reader = response.body.getReader();

        let data = '';
        while (true) {
            const result = await reader.read();
            if (result.done) {
                break;
            }

            data += util.toString(result.value);
        }

        // console.log('data', data);
        assert.equal(data, '0001002003004005006007008009001000');

    } catch (e) {
        console.log(e);
        assert.fail(e);
    }
});
