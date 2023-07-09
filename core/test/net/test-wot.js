// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as wot from '@tjs/wot';

import * as assert from '@tjs/assert';

const test = assert.test;

test('net.wot', async () => {
    const did = 'test';
    const forms = {
        op: 'connect',
        did: did,
        href: 'mqtt://iot.wotcloud.cn/$test/devices',
        username: 'device',
        password: 'wot2019'
    };

    const td = {
        properties: { value: {} },
        actions: { test: {} },
        forms: forms
    };

    const result = {

    };

    const thing = await wot.produce(td);
    assert.ok(thing);

    assert.startTimeout(3000, () => {
        thing.destroy();
    });

    // eslint-disable-next-line no-unused-vars
    async function onClose() {
        assert.stopTimeout();
        await thing.destroy();
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

            // close
            await onClose();

            result.close = true;
        }, 10);
    });

    await servient.start(forms);

    await assert.waitTimeout();
    // console.log(result);

    assert.ok(result.online);
    assert.ok(result.close);
    await servient.destroy();
});
