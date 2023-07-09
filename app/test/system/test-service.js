// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as service from '../../modules/system/service.js';
import * as services from '../../modules/vendor/services.js';

test('service', () => {
    const result = service.getService('tcd');
    assert.equal(result?.title, 'WoT.js config daemon');
});

test('services', () => {
    const result = services.getServices('linux');
    assert.equal(result.tcd?.title, 'WoT.js config daemon');
});
