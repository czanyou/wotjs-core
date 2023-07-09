import * as devices from '@tjs/devices';
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('watchdog', async () => {
    const watchdog = await devices.requestWatchdog({ name: 'watchdog' });
    watchdog.open();
    // console.log(watchdog);
    // console.log(watchdog.isEnabled());
    // console.log(watchdog.getTimeout());

    watchdog.setTimeout(60);
    watchdog.enable();
    // console.log(watchdog.isEnabled());
    // console.log(watchdog.getTimeout());
    // console.log(watchdog.keepalive());

    assert.equal(watchdog.keepalive(), 0);
    assert.equal(watchdog.getTimeout(), 60);

    watchdog.disable();
    watchdog.close();
});

test('watchdog keepalive', async () => {
    const watchdog = await devices.requestWatchdog({ name: 'watchdog' });

    return new Promise((resolve, reject) => {

        watchdog.open();
        watchdog.setTimeout(5);
        watchdog.enable();

        const timer = setInterval(() => {
            watchdog.keepalive();
            const timeout = watchdog.getTimeout();
            console.log(timeout);
        }, 1000);

        setTimeout(() => {
            watchdog.disable();
            watchdog.close();

            clearInterval(timer);
            resolve();
        }, 10000);
    });
});
