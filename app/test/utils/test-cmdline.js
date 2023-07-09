// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as cmdline from '../../modules/utils/cmdline.js';

test('cmdline - find', () => {
    const names = { test: 0, test1: 1, test2: 2, foo: 'bar' };
    assert.equal(cmdline.find(names, '')?.value, undefined);
    assert.equal(cmdline.find(names, 'test3')?.value, undefined);
    assert.equal(cmdline.find(names, 'test')?.value, 0);
    assert.equal(cmdline.find(names, 'tes')?.value, 0);
    assert.equal(cmdline.find(names, 'te')?.value, 0);
    assert.equal(cmdline.find(names, 't')?.value, 0);

    assert.equal(cmdline.find(names, 'test1')?.value, 1);
    assert.equal(cmdline.find(names, 'test2')?.value, 2);
    assert.equal(cmdline.find(names, 'foo')?.value, 'bar');
});

test('cmdline - parseAppName', () => {
    // /path/to/:app/app.js
    assert.equal(cmdline.parseAppName('/app.js'), '');
    assert.equal(cmdline.parseAppName('foo/app.js'), 'foo');
    assert.equal(cmdline.parseAppName('/foo/app.js'), 'foo');
    assert.equal(cmdline.parseAppName('test/foo/app.js'), 'foo');
    assert.equal(cmdline.parseAppName('/test/foo/app.js'), 'foo');

    // :app
    assert.equal(cmdline.parseAppName('foo'), 'foo');
    assert.equal(cmdline.parseAppName('/foo'), 'foo');
    assert.equal(cmdline.parseAppName('foo.js'), 'foo');
    assert.equal(cmdline.parseAppName('/foo.js'), 'foo');
    assert.equal(cmdline.parseAppName('/foo.app'), 'foo.app');
});

test('cmdline - config', async () => {
    const $config = cmdline.command('test');
    await $config.commands.unset('foo');

    // set
    let ret = await $config.commands.set('foo=bar');
    assert.equal(ret, true);

    ret = await $config.commands.set('foo=bar');
    assert.equal(ret, undefined);

    let value = await $config.commands.get('foo');
    assert.equal(value, 'bar');

    // unset
    ret = await $config.commands.unset('foo');
    assert.equal(ret, true);

    ret = await $config.commands.unset('foo');
    assert.equal(ret, undefined);

    value = await $config.commands.get('foo');
    assert.equal(value, undefined);
});

test('cmdline - execute', async () => {
    const commands = {
        commands: {
            test: (params) => { return params; }
        }
    };

    let result = await cmdline.execute(commands, ':app', 'test', 100);
    assert.equal(result, 100);

    result = await cmdline.execute(commands, ':app', 't', 100);
    assert.equal(result, 100);

    result = await cmdline.execute(commands, ':app', 'test2', 100);
    assert.equal(result, false);

});

test('cmdline - run1', async () => {
    const commands = {
        title: '',
        commands: {
            test: (params) => { return params; }
        },
        subcommands: {
            foo: {
                commands: {
                    test: (params) => { return params + '$'; }
                }
            }
        }
    };

    // test
    let result = await cmdline.run(commands, 'exec', 'script', 'test', '100');
    assert.equal(result, '100');

    result = await cmdline.run(commands, 'exec', 'script', 't', '100');
    assert.equal(result, '100');

    result = await cmdline.run(commands, 'exec', 'script', 'test2', '100');
    assert.equal(result, false);

    // foo.test
    result = await cmdline.run(commands, 'exec', 'script', 'foo', 'test', '100');
    assert.equal(result, '100$');

    result = await cmdline.run(commands, 'exec', 'script', 'f', 't', '100');
    assert.equal(result, '100$');

    result = await cmdline.run(commands, 'exec', 'script', 'foo', 'test2', '100');
    assert.equal(result, false);

});

test('cmdline - run2', async () => {
    const commands = {
        title: '',
        commands: {
            get: (params) => { return params; }
        },
        subcommands: {
            foo: {
                commands: {
                    bar: (params) => { return params + '$'; }
                }
            }
        }
    };

    // test
    let result = await cmdline.run(commands, 'tjs', 'test.js', 'get', '100');
    assert.equal(result, '100');

    result = await cmdline.run(commands, 'tjs', 'test.js', 'foo', 'bar', '100');
    assert.equal(result, '100$');
});
