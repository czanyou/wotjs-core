// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as mqtt from '@tjs/mqtt';
import * as process from '@tjs/process';
import * as native from '@tjs/native';
import * as util from '@tjs/util';

/* global TextDecoder */

const topic = 'test-topic';

async function test() {
    /** @type mqtt.MQTTClientOptions */
    const options = {};
    options.host = '127.0.0.1';
    options.port = 1883;
    options.username = 'tbd';
    options.password = 'tbd@wot.js';
    options.reconnectPeriod = 1000;
    options.connectTimeout = 3 * 1000;
    options.keepalive = 60;
    options.reschedulePings = true;
    options.clean = true;
    options.secure = false;

    const client = mqtt.connect(options);

    const textDecoder = new TextDecoder();

    /** @type any */
    let timeoutTimer = setTimeout(() => {
        client?.close();

        setTimeout(() => {
            onClose();

        }, 5 * 1000);
    }, 100 * 1000);

    /** @type any */
    let sendTimer = null;

    let sending = false;
    let readPackets = 0;
    let readBytes = 0;
    let sendPackets = 0;
    let sendBytes = 0;

    async function onSend() {
        if (sending) {
            // console.log('skip: sending...');
            return;
        }

        try {
            sending = true;
            for (let i = 0; i < 1000; i++) {
                const message = '[data-test]'.repeat(100);
                await client.publish(topic, message);
                sendPackets++;
                sendBytes += message.length;

                await util.sleep(0);
            }

            native.runtime.gc();
            const rss = process.rss();
            console.print('test:', `rss=${rss}, readPackets=${readPackets}, readBytes=${readBytes}, sendPackets=${sendPackets}, sendBytes=${sendBytes}`);

        } finally {
            sending = false;
        }
    }

    function onClose() {
        if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
        }

        if (sendTimer) {
            clearInterval(sendTimer);
            sendTimer = null;
        }

        client.close();
    }

    client.onerror = function (event) {
        console.log('onerror', event.error);
    };

    client.onmessage = function (event) {
        const message = event.data;
        if (message == null) {
            return;
        }

        const payload = message.payload;

        const data = textDecoder.decode(new Uint8Array(payload));
        // console.log('onmessage', message.topic, data);

        readPackets++;
        readBytes += data.length;
    };

    client.onopen = function (event) {
        console.log('onopen');

        const rss = process.rss();
        console.log('start:', rss);

        setTimeout(async () => { await client.subscribe(topic); }, 100);
        sendTimer = setInterval(() => {
            onSend();
        }, 1000);
    };

    client.onclose = function (event) {
        console.log('close');
    };

    client.onpacketsend = function (event) {
        // console.log('onpacketsend');
    };

    client.onpacketreceive = function (event) {
        // console.log('packetreceive');
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

}

test();
