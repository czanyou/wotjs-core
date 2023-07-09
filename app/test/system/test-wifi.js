// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as os from '@tjs/os';
import * as fs from '@tjs/fs';
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as wifi from '../../modules/system/wifi.js';

/**
 * remove
 * @param {string} filename 
 * @returns Promise<Error | undefined>
 */
async function remove(filename) {
    try {
        await fs.unlink(filename);

    } catch (err) {
        return err;
    }
}

test('wifi', async () => {
    const manager = new wifi.WifiManager();
    manager.basePath = os.tmpdir();

    const stat = await manager.getNetworkStatistics();
    // console.log('stat', stat);

    const info = await manager.getNetworkInterfaceInfo();
    // console.log('info', info);

    const quality = await manager.getSignalQuality();
    // console.log('quality', quality);

    const status = await manager.getStatus();
    // console.log('status', status);

    // checkConfigFile
    await remove(os.tmpdir() + '/wpa_supplicant.conf');
    let ret = await manager.checkConfigFile('test', '12345678');
    assert.equal(ret, true);

    ret = await manager.checkConfigFile('test', '12345678');
    assert.equal(ret, false);

    ret = await manager.checkConfigFile('test2', '12345678');
    assert.equal(ret, true);
});
