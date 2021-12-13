// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as mqtt from '@tjs/mqtt';
import { assert, test, startTimeout, stopTimeout, waitTimeout } from '@tjs/assert';

test('net.mqtt - tcp', async () => {
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

    startTimeout(10000, () => {
        client.close();
    });

    async function onClose() {
        stopTimeout();
        await client.close();
    }

    client.onerror = function (event) {
        result.hasError = event.error;
    };

    client.onopen = (event) => {
        // console.log('onopen', event);
        result.connected = true;

        setTimeout(() => { client.subscribe('testtopic'); }, 0);
        setTimeout(() => { client.publish('testtopic', 'data'); }, 100);
    };

    client.onmessage = async (event) => {
        const message = event.data;
        // const payload = textDecoder.decode(message.payload);
        // console.log('onmessage', message.topic, payload);

        result.payload = message.payload;
        result.topic = message.topic;

        await onClose();
    };

    await waitTimeout();

    // console.log(result);
    assert.ok(result.connected, 'connected');
    assert.ok(result.payload, 'payload');
    assert.ok(result.topic, 'topic');

    // const textDecoder = new TextDecoder();
});
