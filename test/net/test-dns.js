// @ts-check
import { assert, test } from '@tjs/assert';

import * as dns from '@tjs/dns';

test('dns', async () => {
    let address = await dns.lookup('www.baidu.com', { family: 4, all: true });
    // console.log('www.baidu.com', address);
    assert.ok(address.length > 0, 'www.baidu.com');

    address = address[0];
    assert.ok(address.ip, 'www.baidu.com');

    address = await dns.lookup('localhost', { family: 4, all: true });
    address = address[0];
    // console.log('localhost', address);
    assert.equal(address.ip, '127.0.0.1');

    address = await dns.lookup('', { family: 4 });
    // console.log('', address);
    assert.equal(address, undefined);

    address = await dns.lookup('127.0.0.1', { family: 4 });
    // console.log('127.0.0.1', address);
    assert.equal(address.ip, '127.0.0.1');

    address = await dns.lookup('192.168.31.1');
    // console.log('192.168.31.1', address);
    assert.equal(address.ip, '192.168.31.1');

});
