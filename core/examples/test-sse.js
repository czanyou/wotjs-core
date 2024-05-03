// @ts-check
/// <reference path ="../types/index.d.ts" />

import { test } from '@tjs/test';

import * as http from '@tjs/http';
import * as util from '@tjs/util';

class EventSource extends EventTarget {
    /**
     * @param {string} url 
     * @param {*=} options 
     */
    constructor(url, options) {
        super();

        this.url = url;
        this.readyState = 0; // 0: connecting, 1: open, 2: closed
        this.withCredentials = options?.withCredentials || false;
        this.start();
    }

    close() {
        this.readyState = 2;
    }

    async start() {
        try {
            const init = { debug: false, headers: {} };
            const response = await fetch(this.url, init);

            // console.log(response.headers);
            if (response?.status != 200) {
                // error
                const error = new Error(response?.statusText);
                const event = new ErrorEvent('error', { error });
                this.dispatchEvent(event);
                return;
            }

            // open
            this.readyState = 1;

            const event = new MessageEvent('open', {});
            this.dispatchEvent(event);

            // read response body
            const body = response.body;
            const reader = body?.getReader();

            if (reader == null) {
                return;
            }

            const dataBuffer = [];
            let readBuffer = '';
            let eventName = '';

            while (true) {
                const result = await reader.read();
                if (result?.done) {
                    break;

                } else if (!result?.value) {
                    continue;
                }

                const value = util.toString(result.value);
                readBuffer = readBuffer + value;
                let offset = 0;
                while (true) {
                    const pos = readBuffer.indexOf('\n', offset);
                    if (pos < 0) {
                        if (offset) {
                            readBuffer = readBuffer.substring(offset);
                        }
                        break;
                    }

                    const line = readBuffer.substring(offset, pos).trim();
                    // console.log('line:', line);

                    if (line.startsWith('event:')) {
                        eventName = line.substring(6).trim();

                    } else if (line.startsWith('data:')) {
                        dataBuffer.push(line.substring(6).trim());

                    } else if (line == '') {
                        const data = dataBuffer.join('\r\n');
                        dataBuffer.splice(0);

                        const event = new MessageEvent(eventName || 'message', { data });
                        this.dispatchEvent(event);
                    }

                    offset = pos + 1;
                }
            }

        } catch (error) {
            this.readyState = 0;

            const event = new ErrorEvent('error', { error });
            this.dispatchEvent(event);
        }
    }
}

class EventSourceServer {
    /**
     * @param {http.IncomingMessage} req 
     * @param {http.ServerResponse} res 
     */
    async handle(req, res) {
        // res.headers.set('Content-Length', '100');
        res.headers.set('Content-Type', 'text/event-stream');
        res.headers.set('Cache-Control', 'no-cache');
        res.headers.set('Connection', 'keep-alive');
        res.headers.set('Access-Control-Allow-Origin', '*');
        await res.writeHead();

        // 模拟发送长为 100 的文件内容
        for (let i = 0; i < 10; i++) {
            await this.sendEvent(res, 'data', i + ': 1234567890');
            await util.sleep(1000);
        }

        await this.sendEvent(res, 'close', '');
        await res.end();
    }

    /**
     * @param {http.ServerResponse} res 
     * @param {string} event 
     * @param {string} data 
     */
    async sendEvent(res, event, data) {
        await res.write(`event: ${event}\r\ndata: ${data}\r\n\r\n`);
    }
}

/**
 * 测试文件下载
 */
test('http - sse', async () => {
    let server;
    try {
        const manager = new EventSourceServer();

        // create a HTTP server
        const options = { port: 38089 };
        server = http.createServer(options, async (req, res) => {
            await manager.handle(req, res);
        });

        await server.start();

        const callback = {};
        const promise = new Promise((resolve, reject) => {
            callback.resolve = resolve;
            callback.reject = reject;
        });

        // fetch
        const url = 'http://localhost:38089/get?foo=100&bar=test';
        const eventSource = new EventSource(url);
        eventSource.addEventListener('data', (event) => {
            // @ts-ignore
            console.log('data:', event.data);
        });

        eventSource.addEventListener('close', (event) => {
            eventSource.close();

            callback.resolve({});
        });

        await promise;

        // console.log('total', total);
        // assert.equal(total, 100);

        // close the HTTP server
        server.close();

    } catch (e) {
        console.log('error:', e);
        server?.close();
    }
});
