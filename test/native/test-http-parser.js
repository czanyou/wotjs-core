// @ts-check
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';

const http = native.http;
const parser = new http.Parser();

/**
 * 测试 HTTP 解析器
 */
test('native.http.parser', () => {
    let $context = {};
    const textDecoder = new TextDecoder();

    parser.onmessagebegin = function () {
        // console.log('onmessagebegin');

        $context.onmessagebegin = true;
    };

    parser.onstatus = function () {
        console.log('onstatus');
    };

    parser.onurl = function (url) {
        console.log('onurl', url);
    };

    parser.onheaderfield = function (name) {
        // console.log('onheaderfield', name);
    };

    parser.onheadervalue = function (value) {
        // console.log('onheadervalue', value);
    };

    parser.onheaderscomplete = function (message) {
        // console.log('onheaderscomplete', message);
        $context.message = message;
    };

    parser.onbody = function (body) {
        // console.log('onbody', body);
        $context.body = body;
    };

    parser.onmessagecomplete = function () {
        // console.log('onmessagecomplete');

        $context.onmessagecomplete = true;
    };

    // console.log('parser', parser);

    // GET
    parser.execute('GET /path HTTP/1.0\r\n');
    assert.equal($context.onmessagebegin, true, 'onmessagebegin');

    parser.execute('Content-Ty');
    parser.execute('pe: text');
    parser.execute('/html\r\n');
    parser.execute('Content-Length: 4\r\n\r\n');
    assert.equal($context.onmessagecomplete, undefined, 'onmessagecomplete is false');
    assert.equal($context.message.method, 1, 'message.method');
    assert.equal($context.message.url, '/path', 'message.url');

    parser.execute('bo');
    assert.equal(textDecoder.decode($context.body), 'bo');

    parser.execute('dy');
    assert.equal($context.onmessagecomplete, true, 'onmessagecomplete');
    assert.equal(textDecoder.decode($context.body), 'dy');

    // request
    const request = 'GET /path HTTP/1.0\r\nContent-Length: 4\r\n\r\nbody';
    parser.init(2);
    $context = {};
    parser.execute(request);
    assert.equal($context.message.method, 1, 'message.method');
    assert.equal($context.message.url, '/path', 'message.url');

    // response
    const response = 'HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nbody';
    parser.init(2);
    $context = {};
    parser.execute(response);
    assert.equal($context.message.statusCode, 200, 'message.status');
    assert.equal($context.message.statusText, 'OK', 'message.statusText');
    assert.equal(textDecoder.decode($context.body), 'body');

    // methods
    assert.equal(http.methods[1], 'GET');
});
