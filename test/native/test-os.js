// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';

const os = native.os;

test('native.os', () => {
    // console.log(os);
    assert.equal(os.platform, 'linux');
});
