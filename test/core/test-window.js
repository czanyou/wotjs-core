// @ts-check
import { assert, test } from '@tjs/assert';

function testWindow() {
    // console.log('window', Object.keys(window).sort());

    assert.ok(window.AbortController);
    assert.ok(window.AbortSignal);
    assert.ok(window.alert);
    assert.ok(window.atob);
    assert.ok(window.Blob);
    assert.ok(window.btoa);
    assert.ok(window.clearInterval);
    assert.ok(window.clearTimeout);
    assert.ok(window.CloseEvent);
    assert.ok(window.console);
    assert.ok(window.crypto);
    assert.ok(window.CustomEvent);
    assert.ok(window.ErrorEvent);
    assert.ok(window.Event);
    assert.ok(window.EventTarget);
    assert.ok(window.fetch);
    assert.ok(window.File);
    assert.ok(window.Headers);
    assert.ok(window.localStorage);
    assert.ok(window.MessageEvent);
    assert.ok(window.navigator);
    assert.ok(window.process);
    assert.ok(window.PromiseRejectionEvent);
    assert.ok(window.prompt);
    assert.ok(window.Request);
    assert.ok(window.Response);
    assert.ok(window.sessionStorage);
    assert.ok(window.setInterval);
    assert.ok(window.setTimeout);
    assert.ok(window.TextDecoder);
    assert.ok(window.TextEncoder);
    assert.ok(window.URL);
    assert.ok(window.Worker);
    assert.ok(window.WoT);
}

test('window', testWindow);
