// @ts-check
import { assert, test } from '@tjs/assert';

async function basicFetch() {
    const response = await fetch('http://www.baidu.com/get');
    assert.equal(response.status, 200, 'status is 200');
};

async function abortFetch() {
    const controller = new AbortController();
    const signal = controller.signal;

    setTimeout(() => {
        controller.abort();
    }, 500);

    try {
        await fetch('https://httpbin.org/delay/3', { signal });
    } catch (e) {
        assert.equal(e.name, 'AbortError', 'fetch was aborted');
    }
};

async function fetchWithPostAndBody() {
    const data = JSON.stringify({ foo: 'bar', bar: 'baz' });
    const response = await fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: data
    });

    // console.log(response);

    assert.equal(response.status, 200, 'status is 200');
    const json = await response.json();
    // console.log(json, 'json');

    assert.equal(json.data, data, 'sent and received data match');
};

test('basic fetch', basicFetch);
test('abort fetch', abortFetch);
test('post and body fetch', fetchWithPostAndBody);
