#!/usr/local/bin/tjs
// @ts-check

/// <reference path ="../../modules/types/index.d.ts" />

import * as process from '@tjs/process';
import * as os from '@tjs/os';

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('timezone', async () => {
    process.setenv('TZ', 'UTC-08:00');
    const value = process.getenv('TZ');
    // console.log('TZ', value);
    assert.equal(value, 'UTC-08:00');

    const now = new Date();
    console.log('now:', now.toLocaleString());

    const data = await os.exec('date');
    console.log('data', data);
});
