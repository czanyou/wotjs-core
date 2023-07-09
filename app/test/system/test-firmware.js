// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as util from '@tjs/util';
import { test } from '@tjs/test';

import * as firmware from '../../modules/system/firmware.js';

test('firmware', async () => {
    const updater = new firmware.Updater();
    const uri = await updater.getFirmwareInfoURL();
    // console.log('uri:', uri?.toString());

    const name = await updater.getInstallFilename();
    // console.log('name:', name);
    assert.equal(name, 'data1');

    const pathName = await updater.getInstallPath();
    // console.log('pathName:', pathName);
    assert.equal(pathName, '/usr/local/tjs/v1');

    const filename = await updater.getProcessExecPath('tjs');
    // console.log('filename:', filename);

    const format = await updater.getFirmwareFormat(filename || '');
    // console.log('format:', format);

    updater.showProgressBar('test', 900, 900);
});

/*
test('firmware.utils', async () => {
	for (let i = 0; i <= 10; i++) {
		firmware.utils.showProgressBar(i * 10, "test");
		await util.sleep(100);
	}
});
// */
