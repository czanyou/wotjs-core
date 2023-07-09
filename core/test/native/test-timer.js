// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as native from '@tjs/native';

test('native.setTimout', async () => {
    const promise = new Promise((resolve, reject) => {
        const timer = native.setTimeout(() => {
            resolve(100);
        }, 1);

        assert.ok(!!timer);
    });

    const result = await promise;
    assert.equal(result, 100);
});
