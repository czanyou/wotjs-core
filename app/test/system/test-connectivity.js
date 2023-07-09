// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as connectivity from '../../modules/system/connectivity.js';

test('connectivity.ethernet', () => {
    // eslint-disable-next-line no-unused-vars
    const ethernet = new connectivity.EthernetManager();
});

test('connectivity.Connectivity', async () => {
    const connect = new connectivity.Connectivity();

    // checkDhcpConfig
    let ret = await connect.checkDhcpConfig();
    assert.equal(ret, true);

    ret = await connect.checkDhcpConfig();
    assert.equal(ret, false);

    // checkNetworkConfig
    ret = await connect.checkNetworkConfig();
    assert.equal(ret, true);

    ret = await connect.checkNetworkConfig();
    assert.equal(ret, false);

    // loadNetworkConfig
    await connect.loadNetworkConfig();
    const config = connect.options;
    // console.log('config', config);

    assert.ok(config.enabled != null);
    assert.ok(config.hostname != null);
    assert.ok(config.interface != null);
    assert.ok(config.mode != null);
    assert.ok(config.type != null);

    const networkType = config.type || 'ethernet';

    // getNameServers
    const dns = await connect.getNameServers();
    assert.ok(Array.isArray(dns));
    // console.log(dns);

    // getNetworkInterfaceName
    const name = connect.getNetworkInterfaceName('wifi');
    // console.log(name);
    assert.equal(name, 'wlan0');

    // getDhcpInfo
    const dhcp = await connect.getDhcpInfo();
    // console.log('dhcp', dhcp);
    assert.equal(dhcp.interface, undefined);

    // getNetworkInterfaceInfo
    let iface = await connect.getNetworkInterfaceInfo('ethernet');
    if (!iface) {
        iface = await connect.getNetworkInterfaceInfo('wifi');
    }

    // console.log('ethernet', ethernet);
    assert.ok(iface.type != null);
    
    // getActiveNetworkInfo
    const info = await connect.getActiveNetworkInfo();
    // console.log('info', info);

    assert.ok(info.name != null);
    assert.ok(info.ip != null);
    assert.ok(info.gateway != null);
    assert.ok(Array.isArray(info.dns));
    // assert.equal(info.type, networkType);

    // getNetworkPreference
    const preference = connect.getNetworkPreference();
    assert.equal(preference, networkType);

    // getRoutes
    const routes = await connect.getRoutes();
    // console.log('routes', routes.length);
    assert.ok(Array.isArray(routes));

    // getNetworkPreference
    let stat = await connect.getNetworkStatistics('ethernet');
    if (!stat) {
        stat = await connect.getNetworkStatistics('wifi');
    }

    // console.log('stat', stat);
    assert.ok(stat.rxBytes && (stat.rxBytes > 0));
});
