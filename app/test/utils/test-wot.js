// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as wot from '../../modules/utils/wot.js';

import * as assert from '@tjs/assert';

import { test } from '@tjs/test';

test('net.wot', async () => {
    let onResolve = null;
    const promise = new Promise((resolve, reject) => { onResolve = resolve; });

    const did = 'test';
    const forms = {
        op: 'connect',
        did,
        href: 'mqtt://localhost/$test/devices',
        username: 'device',
        password: 'wot2019',
        protocol: 'mqtt'
    };

    const td = {
        properties: { value: {} },
        actions: { test: {} },
        forms
    };

    const result = {

    };

    const thing = await wot.produce(td);
    assert.ok(thing);

    // eslint-disable-next-line no-unused-vars
    async function onClose() {
        await thing.destroy();

        onResolve();
    }

    await thing.writeProperty('value', 1000);

    thing.setActionHandler('test', async function (params) {
        // console.log('test', params);
        return 100 * Number(params);
    });

    thing.setPropertyReadHandler('value', async function (options) {
        // console.log('read', options);
        return 10000;
    });

    thing.setPropertyWriteHandler('value', async function (value, options) {
        // console.log('write', value, options);

    });

    const servient = wot.servient();

    servient.addEventListener('online', async (event) => {
        // console.info('wot: online');

        result.online = true;

        await thing.expose();

        setTimeout(async () => {
            // await thing.emitPropertyChange('value');
            // await thing.emitPropertyChange('value');

            // action
            const input = 10086;
            const output = await thing.invokeAction('test', input);
            // console.log('wot: output:', output);
            assert.equal(output, input * 100);

            // property
            await thing.emitPropertyChange('value');
            const value = await thing.readProperty('value');
            // console.log('wot: value:', value);
            // console.log('wot: properties:', thing.properties);
            assert.equal(value, 10000);

            // events
            await thing.emitEvent('test', 10086);
            // console.log('wot: events:', thing.events);

            result.close = true;

            // close
            await onClose();

        }, 10);
    });

    await servient.start(forms);

    await promise;
    // console.log(result);

    assert.ok(!!result.online);
    assert.ok(!!result.close);
    await servient.destroy();
});
