// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';
// tjs -e "console.log(Object.keys(native).sort())"

// console.log('native.signals', native.signals);

test('native.signal', () => {
    assert.ok(native.signal);
    assert.equal(native.signals.SIGKILL, 9);

    // 不同平台取值不同
    // assert.equal(native.signals.SIGUSR1, 16);
    // assert.equal(native.signals.SIGUSR2, 17);

    const result = {};

    // console.log(native.signal);
    const handler = native.signal(native.signals.SIGUSR1, function (signalCode) {
        result.signalCode = signalCode;
        console.log('signalCode', signalCode);
    });

    assert.ok(handler);

    const pid = native.os.pid();
    native.os.kill(pid, native.signals.SIGUSR1);
    // console.log(pid, result);

    setTimeout(() => {}, 100);
});
