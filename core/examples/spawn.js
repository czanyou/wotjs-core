// @ts-check
/// <reference path ="../types/index.d.ts" />
import * as os from '@tjs/os';

async function test() {
    /** @type os.ProcessOptions */
    const options = { stdout: 'pipe' };
    const subProcess = os.spawn('top', [], options);
    console.log(subProcess.pid);
    console.log(subProcess.connected);
    console.log(subProcess.stdout);

    setTimeout(() => {
        subProcess.kill(os.signals.SIGINT);
    }, 2000);

    const stdout = subProcess.stdout;
    if (stdout) {
        stdout.onmessage = (message) => {
            console.log(message);
        };
    }

    const result = await subProcess.wait();
    console.log(result);
}

test();
