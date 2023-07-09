// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('timer.Promise', async () => {
    // promise
    const runner1 = () => Promise.resolve();
    await runner1();
    assert.ok(true, 'Promise microtask should be supported');
});

test('timer.setTimeout', async () => {
    // setTimeout
    const runner2 = () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(undefined);
            }, 100);
        });
    };

    await runner2();
    assert.ok(true, 'setTimeout timer should be supported');
});
