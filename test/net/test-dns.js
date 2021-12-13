// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

import * as dns from '@tjs/dns';

test('dns.lookup - baidu', async () => {
    const result = await dns.lookup('www.baidu.com', { family: 4, all: true });
    const addresses = Array.isArray(result) ? result : [result];

    // console.log('www.baidu.com', address);
    assert.ok(addresses.length > 0, 'www.baidu.com');

    const address = addresses[0];
    assert.ok(address.address);
});

test('dns.lookup - localhost', async () => {
    const result = await dns.lookup('localhost', { family: 4, all: true });
    const addresses = Array.isArray(result) ? result : [result];
    const address = addresses[0];
    // console.log('localhost', address);
    assert.equal(address.address, '127.0.0.1');
});

test('dns.lookup - ip', async () => {
    // ''
    let result = await dns.lookup('', { family: 4 });
    assert.equal(result, undefined);

    // 127.0.0.1
    result = await dns.lookup('127.0.0.1', { family: 4 });
    let address = Array.isArray(result) ? result[0] : result;
    assert.equal(address.address, '127.0.0.1');

    // 192.168.31
    result = await dns.lookup('192.168.31.1');
    address = Array.isArray(result) ? result[0] : result;
    assert.equal(address.address, '192.168.31.1');

});
