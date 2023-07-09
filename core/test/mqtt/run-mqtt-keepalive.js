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
mqttOptions.reconnectPeriod = 1000;
mqttOptions.connectTimeout = 3 * 1000;
mqttOptions.keepalive = 60;
mqttOptions.reschedulePings = true;
mqttOptions.clean = true;

/**
 * 模拟 Keepalive 发生超时
 * - 客户端将自动重连
 */
test('net.mqtt - keepalive', async () => {

    const result = {};
    const url = 'mqtt://localhost:1883';

    const options = { ...mqttOptions };
    options.keepalive = 60;
    const client = mqtt.connect(url, options);
    assert.ok(client);

    client.onerror = function (event) {
        /** @type Error */
        const error = event.error;
        console.log('error:', error.name, '-', error.code, '-', error.message);
        result.hasError = event.error;
    };

    client.addEventListener('statechange', (event) => {
        const status = {
            state: client.readyState,
            retryCount: client.retryCount
        };

        console.log('statechange:', status);

        // 重连成功
        if (result.offline) {
            if (status.state == mqtt.MQTTClient.OPEN) {
                result.online = true;
            }
        }
    });

    client.onclose = function (event) {
        console.log('close');
        result.close = true;
    };

    // 掉线事件
    client.onoffline = function (event) {
        console.log('offline');
        result.offline = true;
    };

    await client.ready;

    const now = Date.now();

    // 模拟 keepalive 超时
    setTimeout(() => {
        console.log('set timeout...');

        // @ts-ignore
        client._lastPongTime = now - 3600 * 1000;

        // @ts-ignore
        client._lastPingTime = now;

    }, 3000);

    // 关闭重连
    setTimeout(() => {
        console.log('close...');
        client.close();
    }, 10000);

    while (!result.close) {
        await util.sleep(1000);
    }

    // console.log(result);
    assert.ok(result.offline);
    assert.ok(result.online);
    assert.ok(result.close);
});
