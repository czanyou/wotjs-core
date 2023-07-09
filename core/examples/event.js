// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as native from '@tjs/native';
import * as process from '@tjs/process';
import * as util from '@tjs/util';

async function test() {
    try {
        await util.sleep(1000);

        let rss = process.rss();
        console.log('start:', 'rss:', rss);

        let sendPackets = 0;

        const client = new EventTarget();

        const data = 'b'.repeat(1 * 64);

        for (let j = 0; j < 1; j++) {
            for (let i = 0; i < 1; i++) {
                client.dispatchEvent(new MessageEvent('message', { data }));
                sendPackets++;
            }

            await util.sleep(1);

            native.runtime.gc();
            rss = process.rss();
            console.log('stop:', j, `rss=${rss}`, sendPackets);
        }

        rss = process.rss();
        console.log('end:', 'rss:', rss);

        const event = new MessageEvent('message', { data });
        console.log(event);

    } catch (e) {
        console.log(e);
    }
}

test();
