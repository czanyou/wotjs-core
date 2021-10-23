// @ts-check
import * as assert from '@tjs/assert';
import * as config from '@tjs/config';

const test = assert.test;

test('config', async () => {
    let testConfig = await config.load('test');
    testConfig.set('test', 100);
    await testConfig.save();

    testConfig = await config.load('test');

    assert.equal(testConfig.get('test'), '100');
    assert.equal(testConfig.get('test', Number), 100);
    assert.equal(testConfig.get('test', Boolean), true);

});
