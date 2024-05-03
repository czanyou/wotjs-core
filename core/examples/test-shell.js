// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as os from '@tjs/os';
import * as http from '@tjs/http';
import * as util from '@tjs/util';

/**
 * @param {(message?: ArrayBuffer) => void} callback 
 * @param {number=} timeout 
 * @returns {Promise<os.ProcessResult>}
 */
async function exec(callback, timeout) {
    /** @type os.ProcessOptions */
    const options = { stdout: 'pipe', stderr: 'pipe' };
    const subProcess = os.spawn('ping', ['www.baidu.com'], options);

    /** @type any */
    let timeoutTimer = setTimeout(() => {
        // console.log('timeout');
        subProcess.kill(os.signals.SIGINT);

        timeoutTimer = null;
    }, timeout || 3 * 1000);

    let isEnd = false;

    function onEnd() {
        if (!isEnd) {
            isEnd = true;
            callback();
        }

        if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = undefined;
        }
    }

    const stdout = subProcess.stdout;
    if (stdout) {
        stdout.onmessage = (message) => {
            if (message == null) {
                onEnd();

                stdout.close();
                return;
            }

            callback(message);
        };
    }

    const stderr = subProcess.stderr;
    if (stderr) {
        stderr.onmessage = (message) => {
            if (message == null) {
                onEnd();
                return;
            }

            callback(message);
        };
    }

    const result = await subProcess.wait();

    onEnd();

    return result;
}

async function main() {
    let server;
    try {
        // create a HTTP server
        const options = { port: 38088 };
        server = http.createServer(options, async (req, res) => {
            // res.writeHead();

            exec((message) => {
                // console.log('message', message);

                if (message == null) {
                    res.end();
                    return;
                }

                res.write(message);
            });
        });

        await server.start();

        const callback = {};
        const promise = new Promise((resolve, reject) => {
            callback.resolve = resolve;
            callback.reject = reject;
        });

        // fetch
        const url = 'http://localhost:38088/get?foo=100&bar=test';
        const init = { debug: false, headers: {} };
        const response = await fetch(url, init);
        // console.log('headers:', response.headers);

        // read response body
        const body = response.body;
        const reader = body?.getReader();

        if (reader) {
            while (true) {
                const result = await reader.read();
                // console.log('result:', result);

                if (result?.done) {
                    console.log('eof');
                    callback.resolve({});
                    break;

                } else if (result?.value) {
                    console.write(util.toString(result.value));
                }
            }
        }

        await promise;

        console.log('close');
        server.close();

    } catch (e) {
        console.log('error:', e);
        server?.close();
    }
}

main();
