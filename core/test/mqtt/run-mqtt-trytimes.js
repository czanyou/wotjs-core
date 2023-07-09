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
 * 模拟发生网络错误。
 * - 断线后自动重连
 */
test('net.mqtt - connect timeout', async () => {

    const result = {};
    const url = 'mqtt://localhost:1883';

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

    // 模拟断线重连
    setTimeout(() => {
        console.log('disconnect...');
        // @ts-ignore
        client._onSocketClose();

    }, 3000);

    // 关闭重连
    setTimeout(() => {
        console.log('close...');
        client.close();
    }, 6000);

    while (!result.close) {
        await util.sleep(1000);
    }

    // console.log(result);
    assert.ok(result.offline);
    assert.ok(result.online);
    assert.ok(result.close);
});
