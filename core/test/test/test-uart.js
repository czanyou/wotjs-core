import assert from '@tjs/assert';

import * as native from '@tjs/native';

const uart = native.uart;

async function test() {
    const fd = uart.open('/dev/ttyUSB0', 115200, uart.PARITY_NONE, 8, 1);
    assert.equal(fd > 0, true);
    assert.equal(native.isatty(fd), true);

    if (!fd) {
        return;
    }

    const handle = new uart.UART(fd);
    // console.log('uart', handle);

    const textDecoder = new TextDecoder();

    handle.onmessage = async function (data) {
        console.log('message', data, textDecoder.decode(data));
    };

    const timer = setInterval(() => {
        const ret = handle.write('TEST 100\n');
        assert.equal(ret, 9);
        // console.log('write', ret);

    }, 1000);

    setTimeout(() => {
        clearInterval(timer);
        handle.close();
    }, 2000);
}

test();
