// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

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
    
});
