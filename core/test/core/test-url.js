// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

test('url.URL', async () => {
    // http
    let urlString = 'http://www.baidu.com:80/test?q=name#home';
    let url = new URL(urlString);
    assert.equal(url.hostname, 'www.baidu.com');
    assert.equal(url.protocol, 'http:');
    assert.equal(url.pathname, '/test');
    assert.equal(url.search, '?q=name');
    assert.equal(url.hash, '#home');

    // https
    urlString = 'https://www.baidu.com:443/test';
    url = new URL(urlString);
    assert.equal(url.hostname, 'www.baidu.com');

    // tcp
    urlString = 'tcp://www.baidu.com:443';
    url = new URL(urlString);
    // console.log(url);
    assert.equal(url.protocol, 'tcp:');
    assert.equal(url.hostname, 'www.baidu.com');
    assert.equal(url.port, '443');

    urlString = 'tcp:192.168.1.11:443';
    url = new URL(urlString);
    // console.log(url);
    assert.equal(url.protocol, 'tcp:');
    assert.equal(url.hostname, '192.168.1.11');
    assert.equal(url.port, '443');

    // udp
    urlString = 'udp://www.baidu.com:443';
    url = new URL(urlString);
    assert.equal(url.protocol, 'udp:');
    assert.equal(url.hostname, 'www.baidu.com');
    assert.equal(url.port, '443');

    // mqtt
    urlString = 'mqtt://www.baidu.com:2883/test';
    url = new URL(urlString);
    assert.equal(url.hostname, 'www.baidu.com');
    assert.equal(url.port, '2883');
    assert.ok(url.toString() != null);

    // mqtts
    urlString = 'mqtts://www.baidu.com:1883/test';
    url = new URL(urlString);
    assert.equal(url.hostname, 'www.baidu.com');
    assert.equal(url.port, '1883');
    assert.ok(url.toString() != null);

    // data
    urlString = 'data:text/javascript;base64,test';
    url = new URL(urlString);
    assert.equal(url.protocol, 'data:');
    assert.equal(url.pathname, 'text/javascript;base64,test');
    // console.log(url.toString());
});

test('url.URLSearchParams', async () => {
    const params = new URLSearchParams('q=%40&a=100');
    assert.ok(params.has('a'));
    assert.ok(!params.has('b'));
    assert.ok(params.has('q'));
    assert.equal(params.get('q'), '@');
    assert.equal(params.get('a'), '100');
    assert.equal(params.toString(), 'q=%40&a=100');

    params.append('a', '200');
    params.delete('q');
    params.set('c', '300');
    assert.equal(params.getAll('a'), ['100', '200']);
    assert.ok(!params.has('q'));
    assert.equal(params.get('c'), '300');
    
    assert.equal(params.toString(), 'a=100&a=200&c=300');
});
