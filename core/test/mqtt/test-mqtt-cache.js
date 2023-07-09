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
 * 测试断网续传功能
 */
test('net.mqtt - cache', async () => {
    const result = { message: 0 };

    // const url = 'mqtt://localhost:1883';

    let client1 = null;
    mqttOptions.host = 'localhost';
    
    mqttOptions.host = 'localhost';
    mqttOptions.username = 'tbd';
    mqttOptions.password = 'tbd@wot.js';

    // 1. create client1
    {
        const options = { ...mqttOptions };
        client1 = mqtt.connect(options);
        client1.onmessage = (event) => {
            console.log('message:', event.data?.payload);
            result.message++;
        };

        await client1.subscribe('test');
        // console.log(client1);

        await client1.ready;
        assert.equal(client1.readyState, mqtt.MQTTClient.OPEN);
    }

    // 2. create client2
    const options = { ...mqttOptions };
    const client2 = mqtt.connect(options);
    assert.ok(client2);

    client2.addEventListener('statechange', (event) => {
        console.log('statechange:', client2.readyState);
    });

    // 3. send message
    await client2.publish('test', 'test1');
    await client2.publish('test', 'test2');

    // console.log(client2.store);
    assert.equal(client2.store?.size(), 2);

    // 4. wait ready
    await client2.ready;

    const ack = await client2.publish('test', 'test3', { qos: 1 });
    console.log('ack:', ack);

    // console.log(client2.store);
    assert.equal(client2.store?.size(), 0);
    assert.equal(client2.readyState, mqtt.MQTTClient.OPEN);

    await util.sleep(1000);

    const ret = await client1.unsubscribe('test');
    console.log('unsubscribe:', ret);

    assert.equal(result.message, 3);

    await client2.close();
    await client1.close();

    await util.sleep(100);
    // console.log(client1);
});
