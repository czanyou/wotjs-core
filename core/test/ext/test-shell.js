// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as assert from '@tjs/assert';
import * as shell from '@tjs/shell';
import * as os from '@tjs/os';

import { test } from '@tjs/test';

const handler = os.signal(os.signals.SIGUSR1, (signal) => {
    console.log(signal);
});

console.log('handler:', handler, handler.signum);

test('shell.access', async () => {
    const sh = shell.shell();
    assert.ok(sh != null);

    const execPath = sh.execPath;

    let ret = await sh.access(execPath);
    assert.equal(ret, 0);

    ret = await sh.access(execPath, shell.constants.X_OK);
    assert.equal(ret, 0);

    ret = await sh.access(execPath, shell.constants.R_OK);
    assert.equal(ret, 0);

    ret = await sh.access(execPath, shell.constants.W_OK);
    assert.equal(ret, 0);
});

/**
 * - append
 * - chmod
 * - chown
 * - exists
 * - getgid
 * - getuid
 * - join
 * - md5sum
 * - read
 * - sha1sum
 * - tmpdir
 * - write
 */
test('shell.write', async () => {
    const sh = shell.shell();

    const filename = sh.join(sh.tmpdir(), 'shell-test');
    await sh.rm(filename);

    // write & read
    await sh.write(filename, 'test');
    await sh.append(filename, '1234');

    assert.ok(await sh.exists(filename));
    let data = await sh.read(filename);
    assert.equal(data, 'test1234');

    // md5sum & sha1sum
    assert.equal(await sh.md5sum(filename), '16d7a4fca7442dda3ad93c9a726597e4');
    assert.equal(await sh.sha1sum(filename), '9bc34549d565d9505b287de0cd20ac77be1d3f2c');

    // truncate
    await sh.truncate(filename, 0);
    data = await sh.read(filename);
    // sh.echo(data);
    assert.equal(data, '');

    // chmod
    await sh.chmod(filename, 0o777);
    assert.equal(sh.$0, 0);

    const info = await sh.stat(filename);
    assert.equal(info.mode & 0o777, 0o777);

    // chown
    await sh.chown(filename, sh.getuid(), sh.getgid());
    // sh.echo(sh.error, sh.getuid(), sh.getgid());
    assert.equal(sh.$0, 0);
});

test('shell.cp.file', async () => {
    const sh = shell.shell();

    const filename = sh.join(sh.tmpdir(), 'shell-test');
    if (!await sh.exists(filename)) {
        await sh.write(filename, 'test');
    }

    const path = sh.join(sh.tmpdir(), 'shell-cp');
    await sh.rm(path, { recursive: true, force: true });

    // 1. 不存在的文件
    await sh.cp('/test/sh', path);
    assert.equal(sh.$0, -2);

    // 2. 同样的文件
    await sh.cp(filename, filename);
    assert.equal(sh.$0, 0);

    // 3. 复制到文件
    await sh.cp(filename, path);
    assert.equal(sh.$0, 0);
    await sh.rm(path);

    // 4. 复制到不存在的目录
    await sh.cp(filename, path + '/');
    // sh.echo(sh.error);
    assert.equal(sh.$0, -21);

    // 5. 复制到存在的目录
    await sh.mkdir(path);
    await sh.cp(filename, path);
    assert.equal(sh.$0, 0);

    await sh.cp(filename, path + '/');
    // sh.echo(sh.error);
    assert.equal(sh.$0, 0);
    assert.ok(await sh.exists(sh.join(path, sh.basename(filename))));
});

/**
 * - ln 
 * - readlink
 * - realpath
 */
test('shell.cp.dir', async () => {
    const sh = shell.shell();

    const filename = sh.join(sh.tmpdir(), 'shell-dir');
    await sh.rm(filename, { recursive: true, force: true });

    // 0. 创建源目录
    await sh.mkdir(filename);
    await sh.mkdir(filename + '/sub');
    await sh.write(filename + '/test', 'test');
    await sh.ln('sub', filename + '/link');

    const path = sh.join(sh.tmpdir(), 'shell-cp');
    await sh.rm(path, { recursive: true, force: true });

    // 1. 复制到文件
    await sh.cp(filename, path);
    assert.equal(sh.$0, 0);
    await sh.rm(path);

    // 2. 复制到不存在的目录
    await sh.cp(filename, path + '/');
    // sh.echo(sh.error);
    assert.equal(sh.$0, -17);

    // 3. 同样的文件
    await sh.mkdir(path, { recursive: true });
    await sh.cp(path, path);
    assert.equal(sh.$0, 0);

    // 5. 复制到存在的目录
    await sh.cp(filename, path, { recursive: true, force: true });
    // sh.echo(sh.error);
    assert.equal(sh.$0, 0);

    const dirs = await sh.readdir(path);
    sh.echo('dirs:', dirs);

    const readlink = await sh.readlink(path + '/link');
    sh.echo('readlink:', readlink);
    assert.equal(readlink, 'sub');

    const realpath = await sh.realpath(path + '/link');
    sh.echo('realpath:', realpath);
    // assert.equal(realpath, 'sub');

    // mv 文件
    await sh.mv(path + '/test', path + '/test2');
    assert.equal(sh.$0, 0);
    assert.ok(await sh.exists(path + '/test2'));

    // mv 目录
    await sh.mv(filename, path + '/test3');
    assert.equal(sh.$0, 0);
    assert.ok(await sh.exists(path + '/test3'));

    // rmdir 非空目录
    await sh.rmdir(path + '/test3');
    assert.equal(sh.$0, -39);

    // rmdir 空目录
    await sh.rmdir(path + '/test3/sub');
    assert.equal(sh.$0, 0);

    // unlink
    await sh.unlink(path + '/link');
    assert.equal(sh.$0, 0);
    assert.ok(!await sh.exists(path + '/link'));

    // unlink 不存在的文件
    await sh.unlink(path + '/link2');
    assert.equal(sh.$0, -2);
});

test('shell.env', async () => {
    const sh = shell.shell();
    sh.setenv('shell-env', 'test1234');
    assert.equal(sh.getenv('shell-env'), 'test1234');

    sh.unsetenv('shell-env');
    assert.equal(sh.getenv('shell-env'), undefined);
});

test('shell.homedir', async () => {
    const sh = shell.shell();

    // sh.echo(sh.homedir(), sh.hostname());
    assert.ok(sh.homedir());
    assert.ok(sh.hostname());
});

test('shell.which', async () => {
    const sh = shell.shell();

    assert.equal(await sh.which('tjs'), '/usr/local/bin/tjs');
    assert.equal(await sh.which('tjs2'), undefined);
});

test('shell.misc', async () => {
    const sh = shell.shell();

    assert.ok(sh.uptime());
    assert.ok(sh.arch);
    assert.ok(sh.args);
    assert.ok(sh.board);
    assert.ok(sh.platform);
    assert.ok(sh.pwd());
    assert.ok(sh.rootPath);
    assert.ok(sh.scriptPath);
    assert.ok(sh.execPath);
    assert.ok(sh.uname());
    assert.ok(sh.sleep(100));
});

test('shell.kill', async () => {
    const sh = shell.shell();

    // sh.kill(sh.pid, os.signals.SIGUSR1);
    // assert.equal(sh.$0, 0);
});
