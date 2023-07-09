// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('AbortController', async () => {
    assert.ok(true);

    const controller = new AbortController();
    const signal = controller.signal;

    const context = {
        /** @type Event|undefined */
        lastEvent: undefined
    }

    signal.addEventListener('abort', event => {
        // console.log('abort', event);
        context.lastEvent = event;
    });

    assert.equal(signal.aborted, false);

    controller.abort();
    assert.equal(signal.aborted, true);
    
    assert.equal(context.lastEvent?.type, 'abort');
});

