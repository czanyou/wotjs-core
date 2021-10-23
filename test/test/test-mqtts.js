import * as mqtt from '@tjs/mqtt';
import { assert, test } from '@tjs/assert';

/* global TextDecoder */

test('mqtt', async () => {
    const host = 'iot.wotcloud.cn';
    const port = 8883;
    const options = { host, port };
    options.username = 'device';
    options.password = 'wot2019';
    options.protocolId = 'MQTT';
    options.reconnectPeriod = 1000;
    options.connectTimeout = 3 * 1000;
    options.keepalive = 60;
    options.reschedulePings = true;
    options.clean = true;
    options.secure = true;

    const client = mqtt.connect(options);
    assert.ok(client);

    const textDecoder = new TextDecoder();

    let timeoutTimer = setTimeout(() => { client.close(); }, 60000);
    function onClose() {
        if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
        }

        client.close();
    }

    client.onerror = function (event) {
        console.log('onerror', event.error);
    };

    client.onmessage = function (event) {
        const message = event.data;
        const payload = message.payload;

        const data = textDecoder.decode(new Uint8Array(payload));
        console.log('onmessage', message.topic, data);

        onClose();
    };

    client.onopen = function (event) {
        console.log('onopen');

        setTimeout(async () => { await client.subscribe('testtopic'); }, 1000);
        setTimeout(async () => { await client.publish('testtopic', '[data-tls]'); }, 2000);
    };

    client.onlookup = function (event) {
        const address = event.address;
        console.log('lookup', address);
    };

    client.onclose = function (event) {
        console.log('close');
    };

    client.onpacketsend = function (event) {
        console.log('onpacketsend');
    };

    client.packetreceive = function (event) {
        console.log('packetreceive');
    };
    
    client.ondisconnect = function (event) {
        console.log('disconnect');
    };

    client.onoffline = function (event) {
        console.log('offline');
    };

    client.onend = function (event) {
        console.log('end');
    };

});
