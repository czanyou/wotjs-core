// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as os from '@tjs/os';
import * as http from '@tjs/http';

/**
 * @param {string} cmdline 
 * @param {(message?: ArrayBuffer) => void} callback 
 * @param {number=} timeout 
 * @returns {Promise<os.ProcessResult>}
 */
async function exec(cmdline, callback, timeout) {
    const tokens = cmdline.split(' ');
    const command = tokens[0];
    const args = tokens.slice(1);
    console.log('exec:', command, args);

    /** @type os.ProcessOptions */
    const options = { stdout: 'pipe', stderr: 'pipe' };
    const subProcess = os.spawn(command, args, options);

    /** @type any */
    let timeoutTimer = setTimeout(() => {
        // console.log('timeout');
        subProcess.kill(os.signals.SIGINT);

        timeoutTimer = null;
    }, timeout || 3 * 1000);

    function onEnd() {
        if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = undefined;
        }
    }

    const stdout = subProcess.stdout;
    if (stdout) {
        stdout.onmessage = (message) => {
            // console.log('onmessage:', message);

            if (message == null) {
                onEnd();
            }

            callback(message);
        };
    }

    const stderr = subProcess.stderr;
    if (stderr) {
        stderr.onmessage = (message) => {
            // console.log('onmessage:', message);
            callback(message);
        };
    }

    const result = await subProcess.wait();

    onEnd();

    return result;
}

const index = /* html */`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Test</title>
</head>
<script>
async function main() {
    const textDecoder = new TextDecoder();
    try {
        const callback = {};
        const promise = new Promise((resolve, reject) => {
            callback.resolve = resolve;
            callback.reject = reject;
        });

        // fetch
        const url = '/exec?cmdline=ping+192.168.0.27';
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
                    console.log(textDecoder.decode(result.value));
                }
            }
        }

        await promise;

        console.log('close');

    } catch (e) {
        console.log('error:', e);
    }
}

main();
</script>
</html>
`;

async function main() {
    let server;
    try {
        // create a HTTP server
        const options = { port: 38088 };
        server = http.createServer(options, async (req, res) => {
            const pathname = req.path;
            console.log('path:', pathname);

            if (pathname == '/exec') {
                const cmdline = req.query.cmdline;
                if (!cmdline) {
                    res.setStatus(400);
                    res.send('Invalid cmdline');
                    return;
                }

                res.headers.set('Content-Type', 'text/plain; charset=utf-8');

                await exec(cmdline, (message) => {
                    // console.log('message', message);
                    if (message) {
                        res.write(message);
                    }
                });

                res.end();

            } else if (pathname == '/') {
                res.type('html');
                res.send(index);

            } else {
                res.setStatus(404);
                res.send('not found');
            }
        });

        await server.start();

    } catch (e) {
        console.log('error:', e);
        server?.close();
    }
}

main();
