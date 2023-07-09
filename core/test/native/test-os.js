// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as native from '@tjs/native';

const os = native.os;

test('native.os', () => {
    // console.log(os);
    assert.equal(os.platform, 'linux');
});
