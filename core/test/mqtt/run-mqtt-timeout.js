// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as mqtt from '@tjs/mqtt';
import * as util from '@tjs/util';

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

const mqttOptions = {};
mqttOptions.username = 'device';
mqttOptions.password = 'wot2019';
mqttOptions.protocolId = 'MQTT';
mqttOptions.reconnectPeriod = 1 * 1000;
mqttOptions.connectTimeout = 3 * 1000;
mqttOptions.keepalive = 60;
mqttOptions.reschedulePings = true;
mqttOptions.clean = true;

/**
 * 模拟重试 5 次后重连成功
 */
test('net.mqtt - connect timeout', async () => {
    const result = {};
    const url = 'mqtt://localhost:18083';

    const options = { ...mqttOptions };
    const client = mqtt.connect(url, options);
    assert.ok(client);

    client.onerror = function (event) {
        /** @type Error */
        const error = event.error;
        console.log('onerror:', error.name, '-', error.code, '-', error.message);
        result.hasError = event.error;
    };

    client.addEventListener('statechange', (event) => {
        const status = {
            state: client.readyState,
            retryCount: client.retryCount
        };

        console.log('statechange', status);
        if (client.retryCount > 5) {
            // @ts-ignore
            client.setURL('mqtt://localhost:1883');
        }

        // 重连成功
        if (status.state == mqtt.MQTTClient.OPEN) {
            result.online = true;
        }
    });

    while (client.readyState != mqtt.MQTTClient.OPEN) {
        try {
            await client.ready;

        } catch (e) {
            console.log('ready:', e.message);
            await util.sleep(100);
        }
    }

    // console.log(result);
    assert.ok(result.online);
});
