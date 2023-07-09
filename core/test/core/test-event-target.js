// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import * as events from '@tjs/event-target';
import { test } from '@tjs/test';

test('EventTarget', async () => {
    const eventTarget = new events.EventTarget();
    // console.log(eventTarget);
});

test('MessageEvent', async () => {
    const event = new MessageEvent('test', { data: 'data' });
    assert.equal(event.type, 'test');
    assert.equal(event.data, 'data');
});
