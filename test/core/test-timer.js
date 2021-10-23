// @ts-check
import { assert, test } from '@tjs/assert';

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
                resolve();
            }, 100);
        });
    };

    await runner2();
    assert.ok(true, 'setTimeout timer should be supported');
});
