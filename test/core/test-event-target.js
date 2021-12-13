// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

test('EventTarget', async () => {

});

test('MessageEvent', async () => {
    const event = new MessageEvent('test', { data: 'data' });
    assert.equal(event.type, 'test');
    assert.equal(event.data, 'data');
});
