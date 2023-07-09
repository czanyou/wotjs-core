// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';

function logStatus(status) {
    // console.log(JSON.stringify(status));
}

const exepath = native.exepath();
const textDecodder = new TextDecoder();

test('native.process: cat without pipe', async () => {
    let status;

    // cat & kill
    const proc = native.spawn('cat');
    // console.log(`proc PID: ${proc.pid}`);
    proc.kill(native.signals.SIGTERM);
    status = await proc.wait();
    logStatus(status);

    status = await proc.wait();
    logStatus(status);
});

test('native.process: cat with pipe', async () => {
    // cat & read
    const proc = native.spawn('cat', { stdin: 'pipe', stdout: 'pipe' });
    // console.log(`proc PID: ${proc.pid}`);
    // console.log('stdin:', proc.stdin.fileno());
    // console.log('stdout:', proc.stdout.fileno());

    proc.stdin.write('hello!');
    let buffer = await proc.stdout.read();
    assert.equal(textDecodder.decode(buffer), 'hello!');
   
    proc.stdin.write('hello again!');
    buffer = await proc.stdout.read();
    assert.equal(textDecodder.decode(buffer), 'hello again!');
   
    proc.kill(native.signals.SIGTERM);
    const status = await proc.wait();
    logStatus(status);

    assert.equal(status.code, 0);
    assert.equal(status.signal, native.signals.SIGTERM);
});

test('native.process: tjs -e log', async () => {
    // tjs -e
    const args = [exepath, '-e', 'console.log(1+1)'];
    const proc = native.spawn(args, { stdout: 'pipe' });
    // console.log(`proc PID: ${proc.pid}`);
    const status = await proc.wait();
    logStatus(status);

    assert.equal(status.code, 0);
    assert.equal(status.signal, 0);
});

test('native.process: tjs -e exit', async () => {
    // tjs -e
    const args = [exepath, '-e', 'process.exit(10)'];
    const proc = native.spawn(args, { stdout: 'pipe' });
    // console.log(`proc PID: ${proc.pid}`);
    const status = await proc.wait();
    assert.equal(status.code, 10);
    assert.equal(status.signal, 0);
    logStatus(status);
});

test('native.process: tjs -e environ', async () => {
    // tjs -e
    const args = [exepath, '-e', 'console.log(JSON.stringify(process.environ()))'];
    const proc = native.spawn(args, { env: { FOO: 'BAR', SPAM: 'EGGS' }, stdout: 'pipe' });
    // console.log(`proc PID: ${proc.pid}`);
    const status = await proc.wait();
    logStatus(status);
});
