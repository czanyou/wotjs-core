// @ts-check
import * as mqtt from '@tjs/mqtt';
import * as assert from '@tjs/assert';
const test = assert.test;

/* global TextDecoder */

test('mqtt', async () => {
    const options = {};
    options.username = 'device';
    options.password = 'wot2019';
    options.protocolId = 'MQTT';
    options.reconnectPeriod = 1000;
    options.connectTimeout = 3 * 1000;
    options.keepalive = 60;
    options.reschedulePings = true;
    options.clean = true;

    const result = {};

    const url = 'mqtt://iot.wotcloud.cn:1883';
    const client = mqtt.connect(url, options);
    assert.ok(client);

    assert.startTimeout(10000, () => {
        client.close();
    });

    function onClose() {
        assert.stopTimeout();
        client.close();
    }

    const textDecoder = new TextDecoder();

    client.onerror = function (event) {
        // console.log('onerror', event.error);
        result.hasError = true;
    };

    client.onopen = function (event) {
        // console.log('onopen', event);
        result.connected = true;

        setTimeout(() => { client.subscribe('testtopic'); }, 500);
        setTimeout(() => { client.publish('testtopic', 'data'); }, 1000);
    };

    client.onlookup = function (event) {
        // console.log('lookup', event);
        result.lookup = true;
    };

    client.onmessage = function (event) {
        const message = event.data;
        const payload = textDecoder.decode(message.payload);

        assert.ok(payload);

        // console.log('onmessage', message.topic, payload);

        result.payload = payload;
        onClose();
    };

    await assert.waitTimeout();

    // console.log(result);
    assert.ok(result.connected, 'connected');
    assert.ok(result.lookup, 'lookup');
    assert.ok(result.payload, 'payload');
});
