// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as mqtt from '@tjs/mqtt';

import { assert, test, startTimeout, stopTimeout, waitTimeout } from '@tjs/assert';

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
    options.secure = true;

    const result = {};

    const url = 'mqtts://iot.wotcloud.cn:8883';
    const client = mqtt.connect(url, options);
    assert.ok(client);

    startTimeout(10000, () => {
        client.close();
    });

    function onClose() {
        stopTimeout();
        client.close();
    }

    const textDecoder = new TextDecoder();

    client.onerror = function (event) {
        result.hasError = event.error;
    };

    client.onopen = function (event) {
        // console.log('onopen', event);
        result.connected = true;

        setTimeout(() => { client.subscribe('testtopic'); }, 0);
        setTimeout(() => { client.publish('testtopic', 'data'); }, 100);
    };

    client.onmessage = function (event) {
        const message = event.data;
        const payload = textDecoder.decode(message.payload);

        result.payload = payload;
        result.topic = message.topic;
        onClose();
    };

    await waitTimeout();

    if (!client.authorized) {
        console.log(client.authorizationError);
    }
    // console.log(result);

    assert.ok(result.connected, 'connected');
    assert.ok(result.payload, 'payload');
    assert.ok(result.topic, 'topic');
});
