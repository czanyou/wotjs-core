// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as mqtt from '@tjs/mqtt';

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

const mqttOptions = {};
mqttOptions.username = 'device';
mqttOptions.password = 'wot2019';
mqttOptions.protocolId = 'MQTT';
mqttOptions.reconnectPeriod = 1000;
mqttOptions.connectTimeout = 3 * 1000;
mqttOptions.keepalive = 60;
mqttOptions.reschedulePings = true;
mqttOptions.clean = true;

test('net.mqtt - bad hostname', async () => {
    const result = {};

    const url = 'mqtt://iot.localhost-bad.cn:1883';
    const options = { ...mqttOptions };
    const client = mqtt.connect(url, options);
    assert.ok(client);

    client.onerror = function (event) {
        /** @type Error */
        const error = event.error;
        console.log('error:', error.name, '-', error.code, '-', error.message);
        result.hasError = event.error;

        client.close();
    };

    client.onclose = function (event) {
        result.closed = true;
        console.log('close');
    };

    client.addEventListener('statechange', (event) => {
        console.log('statechange:', client.readyState);
    });

    try {
        await client.ready;
    
    } catch (e) {
        console.log('error:', e.message);
        result.error = e;
    }

    assert.equal(client.readyState, mqtt.MQTTClient.CLOSED);

    await client.close();

    assert.ok(result.error);
    assert.equal(result.closed, true);
    // console.log(client);
});
