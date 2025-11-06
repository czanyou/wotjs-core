// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as mqtt from '@tjs/mqtt';

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('net.mqtt - tcp', async () => {
    const options = {
        username: 'device',
        password: 'wot2019',
        protocolId: 'MQTT',
        reconnectPeriod: 1000,
        connectTimeout: 3 * 1000,
        keepalive: 60,
        reschedulePings: true,
        clean: true,
    };

    const result = {
        hasError: false,
        connect: false,
        close: false,
        offline: false,
        open: false,
        payload: null,
        topic: null,
    };

    // const url = 'mqtt://localhost:1883';
    const url = 'mqtt://iot.wotcloud.cn:1883';

    const $context = {
        /** @type {any} */
        callback: null,

        /** @type {any} */
        timer: null,
    };

    const promise = new Promise((resolve, reject) => {
        $context.callback = () => {
            clearTimeout($context.timer);
            resolve(0);
        };

        $context.timer = setTimeout(() => {
            $context.callback = null;
            resolve(0);
        }, 1000);
    });

    // console.log('mqtt:', 'connect:', url);
    const client = mqtt.connect(url, options);
    assert.ok(client);

    async function onClose() {
        await client.close();

        if ($context.callback) {
            $context.callback();
        }
    }

    client.onerror = function (event) {
        result.hasError = event.error;
    };

    client.onclose = function (event) {
        result.close = true;
    };

    client.onconnect = function (event) {
        result.connect = true;
    };

    client.onoffline = function (event) {
        result.offline = true;
    };

    client.onopen = (event) => {
        result.open = true;

        setTimeout(async () => {
            const ret = await client.subscribe('testtopic');
            console.log('mqtt:', 'suback:', ret);

            assert.equal(ret.qos, 0);
        }, 0);

        setTimeout(async () => {
            await client.publish('testtopic', 'data', { qos: 1 });
            // console.log('mqtt:', 'publish:', ret);
            // assert.equal(ret?.type, 4);
        }, 100);
    };

    client.onmessage = async (event) => {
        // console.log('onmessage', event);

        const message = event.data;
        if (!message) {
            return;
        }

        // const payload = textDecoder.decode(message.payload);
        // console.log('onmessage', message.topic, payload);

        result.payload = message.payload;
        result.topic = message.topic;

        const ret = await client.unsubscribe('testtopic');
        assert.equal(ret?.type, 11);
        // console.log('mqtt:', 'unsuback:', ret);

        await onClose();
    };

    await client.ready;
    // assert.equal(ret.type, 2);
    // console.log('mqtt:', 'connected:', ret);

    await promise;

    // console.log('result:', result);
    assert.ok(result.open, 'open');
    assert.ok(result.payload, 'payload');
    assert.ok(result.topic, 'topic');
});
