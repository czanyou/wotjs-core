// @ts-check
import * as wot from '@tjs/wot';

import * as assert from '@tjs/assert';

const test = assert.test;

test('wot', async () => {
    const did = 'test';
    const forms = {
        op: 'connect',
        did: did,
        href: 'mqtt://iot.wotcloud.cn/',
        username: 'device',
        password: 'wot2019'
    };

    const baseUrl = 'mqtt://iot.wotcloud.cn/things/' + did + '/';
    const td = {
        base2: baseUrl,
        properties: { value: {} },
        actions: { test: {} },
        forms: forms
    };

    const thing = await wot.produce(td);
    assert.ok(thing);

    assert.startTimeout(3000, () => {
        thing.destroy();
    });

    // eslint-disable-next-line no-unused-vars
    function onClose() {
        assert.stopTimeout();
        thing.destroy();
    }

    await thing.writeProperty('value', 1000);

    thing.setActionHandler('test', async function (params) {
        // console.log('test', params);
        return 100 * params;
    });

    thing.setPropertyReadHandler('value', async function (options) {
        // console.log('read', options);
        return 10000;
    });

    thing.setPropertyWriteHandler('value', async function (value, options) {
        // console.log('write', value, options);
        return 100;
    });

    await thing.expose();

    const servient = wot.servient();

    setTimeout(async () => {
        thing.emitPropertyChange('value');
        thing.emitPropertyChange('value');
        thing.emitPropertyChange('value');
        thing.emitEvent('test', 10086);
        const result = await thing.invokeAction('test', 10086);

        assert.ok(result);

    }, 1000);

    await assert.waitTimeout();
    // console.log(servient);
    await servient.destroy();
});
