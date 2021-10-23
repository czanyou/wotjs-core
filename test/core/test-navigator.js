// @ts-check
import { assert, test } from '@tjs/assert';

function testWindow() {
    // console.log('navigator', Object.keys(navigator).sort());

    assert.ok(window.navigator);

    assert.ok(navigator.bluetooth);
    assert.ok(navigator.board);
    assert.ok(navigator.devices);
    assert.ok(navigator.geolocation);
    assert.ok(navigator.language);
    assert.ok(navigator.languages);
    assert.ok(navigator.mediaCapabilities);
    assert.ok(navigator.mediaDevices);
    assert.ok(navigator.onLine);
    assert.ok(navigator.platform);
    assert.ok(navigator.root);
    assert.ok(navigator.serial);
    assert.ok(navigator.userAgent);
    assert.ok(navigator.vendor);
}

test('navigator', testWindow);
