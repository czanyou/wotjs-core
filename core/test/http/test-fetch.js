// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

// @ts-ignore
import * as fetch from '@tjs/fetch';
import * as streams from '@tjs/streams';
import * as util from '@tjs/util';

test('fetch - Body', async () => {
    // console.log(fetch);

    /** @type Body | any */
    // @ts-ignore
    const body = new fetch.Body();
    assert.equal(body.bodyUsed, false);

    // 1. Body is null

    const raw = await body.processBody();
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

test('fetch - Request', async () => {
    try {
        const body = '100';
        // @ts-ignore
        const request = new fetch.Request('', { method: 'POST', body });

        const data = await request.text();
        // console.log('data', data);
        assert.equal(data, '100');

    } catch (e) {
        console.log(e);
    }
});

test('fetch - Request - stream', async () => {
    try {
        let total = 0;
        const stream = new streams.ReadableStream({
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

        const body = request.body;
        const reader = body.getReader();
        // console.log('data', body);

        let data = '';

        while (true) {
            const result = await reader.read();
            if (result.done) {
                break;
            }

            data += util.toString(result.value);
        }
        // const data = await request.text();
        // console.log('data', data);
        assert.equal(data, '000100200300400500600700800900');

    } catch (e) {
        console.log(e);
    }
});

test('fetch - Response - stream', async () => {
    try {
        /** @type ReadableStreamDefaultController | null */
        let readController = null;
        const stream = new streams.ReadableStream({
            start(controller) {
                readController = controller;
            }
        });

        // @ts-ignore
        const response = new fetch.Response(stream);

        setTimeout(() => {
            readController?.enqueue(util.toBuffer('200'));
            readController?.close();
        }, 10);

        // @ts-ignore
        readController?.enqueue(util.toBuffer('100'));
        const data = await response.text();
        // console.log('data', data);
        assert.equal(data, '100200');

    } catch (e) {
        console.log(e);
    }
});

test('fetch - Response - stream', async () => {
    try {
        /** @type ReadableStreamDefaultController | null */
        let readController = null;
        const stream = new streams.ReadableStream({
            start(controller) {
                readController = controller;
            }
        });

        // @ts-ignore
        const response = new fetch.Response(stream);
        let count = 0;

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

        const body = response.body;
        const reader = body.getReader();
        // console.log('data', body);

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
    }
});
