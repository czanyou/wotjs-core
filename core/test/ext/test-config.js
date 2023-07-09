// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as config from '@tjs/config';

import { test } from '@tjs/test';

test('config', async () => {
    // save
    let testConfig = await config.load('test');
    testConfig.setItem('test', 100);
    testConfig.set({ foo: 'bar', b: true });
    testConfig.removeItem('foo');
    await testConfig.save();

    // load
    testConfig = await config.load('test');
    assert.equal(testConfig.getItem('test'), '100');
    assert.equal(testConfig.getNumber('test'), 100);
    assert.equal(testConfig.getBoolean('test'), true);
    assert.equal(testConfig.getBoolean('b'), true);
    assert.equal(testConfig.getItem('foo'), undefined);

    // clear
    testConfig.clear();
    assert.equal(testConfig.getItem('test'), undefined);

    // getObject
    testConfig.set({ foo: '100', 'foo.1': 'bar1', 'foo.2': 'bar2', 'foo.4.name': 'bar4', 'foo.4.id': 't4' });
    let object = testConfig.getObject('foo');
    // console.log(object);
    assert.equal(object && object['1'], 'bar1');
    assert.equal(object && object['2'], 'bar2');
    assert.equal(object && object['4.name'], 'bar4');
    assert.equal(object && object['4.id'], 't4');

    object = testConfig.getObject();
    assert.equal(object?.foo, '100');

    // getArray
    const array = testConfig.getArray('foo');
    // console.log(array);
    assert.equal(array?.length, 3);
    assert.equal(array && array[0].value, 'bar1');
    assert.equal(array && array[1].value, 'bar2');
    assert.equal(array && array[2].name, 'bar4');
    assert.equal(array && array[2].id, 't4');
});

test('config - parse', async () => {
    // save
    const testConfig = new config.Config('test');
    testConfig.parse(`[test]
name=bar
id=t1
[test.data]
index=4
value=true`);

    // 1. getObject
    // console.log(testConfig.getObject());
    const object = testConfig.getObject();
    assert.equal(object && object['test.name'], 'bar');
    assert.equal(object && object['test.data.index'], '4');
    const sections = testConfig.sections;
    assert.equal(sections[0], 'test');
    assert.equal(sections[1], 'test.data');
    assert.equal(sections[2], undefined);

    testConfig.sections = ['test'];
    assert.equal(testConfig.stringify(), `
[test]
name=bar
id=t1
data.index=4
data.value=true
`);
});

test('config - set', async () => {
    // save
    const testConfig = new config.Config('test');
    testConfig.set({
        test: 100,
        foo: {
            id: 1,
            name: 'foo',
            list: [
                {
                    id: 1,
                    name: 'bar1',
                    enabled: false,
                    data: { name: 'hi' },
                    value: []
                }
            ]
        },
        keys: ['a', 'b', 'c', 1, 2, 3, true, false, { name: ['bar'] }, [{ v: 100 }], null]
    });

    // 1. getString
    // console.log(testConfig.sections);
    // console.log(testConfig.data);
    assert.equal(testConfig.getString('test'), '100');
    assert.equal(testConfig.getString('foo.id'), '1');
    assert.equal(testConfig.getString('foo.name'), 'foo');
    assert.equal(testConfig.getString('foo.list.0.id'), '1');
    assert.equal(testConfig.getString('foo.list.0.name'), 'bar1');
    assert.equal(testConfig.getString('foo.list.0.enabled'), 'false');
    assert.equal(testConfig.getString('keys.0'), 'a');
    assert.equal(testConfig.getString('keys.3'), '1');
    assert.equal(testConfig.getString('keys.6'), 'true');
    assert.equal(testConfig.getString('keys.7'), 'false');
    assert.equal(testConfig.getString('keys.8'), undefined);
    assert.equal(testConfig.getString('keys.9'), undefined);
    assert.equal(testConfig.getString('keys.10'), undefined);

    // 2. getArray

    // array
    let values = testConfig.getArray('keys');
    // console.log(values);
    assert.equal(values && values[0].value, 'a');
    assert.equal(values && values[1].value, 'b');

    // array
    values = testConfig.getArray('foo.list');
    // console.log(values);
    assert.equal(values && values[0].id, '1');
    assert.equal(values && values[0].name, 'bar1');

    // 3. getObject

    // flat object
    let object = testConfig.getObject('foo');
    // console.log(object);
    assert.equal(object && object['list.0.id'], '1');
    assert.equal(object && object['list.0.name'], 'bar1');

    // object
    object = testConfig.getObject('foo', { flat: false });
    // console.log(object);
    assert.equal(object?.list['0'].id, '1');
    assert.equal(object?.list['0'].name, 'bar1');
});

test('config - section', async () => {
    // 1. parse
    const testConfig = new config.Config('test');
    testConfig.parse(`[test]
name=bar
id=t1
[test.data]
index=4
value=true`);

    // 2. renameSection: test -> vici
    testConfig.renameSection('test', 'vici');
    testConfig.sections = ['vici'];
    // console.log(testConfig.stringify());

    assert.equal(testConfig.getItem('vici.data.index'), '4');
    assert.equal(testConfig.getItem('vici.id'), 't1');

    // 3. removeSection: vici.data.*
    testConfig.removeSection('vici.data');
    assert.equal(testConfig.getItem('vici.data.index'), undefined);
    // console.log(testConfig);

    // 4. removeSection: vici.*
    testConfig.removeSection('vici');
    assert.equal(testConfig.getItem('vici.id'), undefined);
    // console.log(testConfig);
});

test('config - toObject', async () => {
    // 1. parse
    const testConfig = new config.Config('test');
    testConfig.parse(`[test.a1]
#name1 342
name=bar
id=t1

#test2
[test.a2]

#index4

# index3
index=4

# a4
#a3

options.name=a4
value=true`);

    const result = testConfig.toObject();
    assert.ok(result);
    // console.log('result:', result);

    const array = testConfig.getArray('test');
    assert.ok(array);
    // console.log('array:', array);

    const object = testConfig.getObject('test', { flat: false });
    assert.ok(object);
    // console.log('object:', object);

    const text = testConfig.stringify();
    assert.ok(text);
    // console.log('stringify:', text);
});
