// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as util from '@tjs/util';
import process from '@tjs/process';

import { dirname, join } from '@tjs/path';
import { assert, test } from '@tjs/assert';

// @ts-ignore
const __filename = import.meta.url.slice(7); // strip "file://"
const __dirname = dirname(__filename);

// console.log(fs);

async function testAccess() {
    const cwd = process.cwd();

    // access
    const result = await fs.access(cwd);
    assert.equal(result, 0);

    try {
        const result = await fs.access(cwd + 'test');
        assert.fail(result);

    } catch (e) {
        assert.equal(e.errno, -2);
    }

    // console.log('cwd', cwd);
    assert.ok(cwd);
}

async function testHashFile() {
    const filename = join(__dirname, 'helpers/worker.js');

    // hashFile
    const data = await fs.hashFile(filename, 'sha1');
    const hash1 = util.encode(data, 'hex');

    // readFile
    let filedata = await fs.readFile(filename, 'utf-8');
    filedata = filedata && String(filedata);
    assert.ok(filedata.length >= 0);
    // console.log('readFile', filedata.length);

    filedata = await fs.readFile(filename);
    if (filedata instanceof ArrayBuffer) {
        assert.ok(filedata.byteLength >= 0);
    }
    // console.log('readFile.byteLength:', filedata.length);

    // hashFile
    const hash2 = util.hash(filedata, 'sha1');
    assert.equal(hash2, hash1);
}

async function testStat() {
    const filename = join(__dirname, 'helpers/worker.js');

    const statInfo = await fs.stat(filename);
    // console.log(statInfo.size);
    assert.ok(statInfo.size >= 0);
}

async function testMkstemp() {
    const file = await fs.mkstemp('/tmp/test_file_XXXXXX');
    // console.log('mkstemp:', file.path);
    assert.ok(file.path);

    const filename = '/tmp/test_file_wotjs';
    try { await fs.unlink(filename); } catch (e) { }

    assert.equal(await fs.exists(filename), false);
    await fs.rename(file.path, filename);
    assert.equal(await fs.exists(filename), true);

    await fs.chmod(filename, 0o777);
    await fs.chown(filename, 1000, 1000);

    const statInfo = await fs.stat(filename);
    // console.log(statInfo.size);
    // console.log(statInfo.mode);
    // console.log(statInfo.gid);
    // console.log(statInfo.uid);

    assert.ok(statInfo.size >= 0);

    // assert.equal(Number.parseInt(statInfo.mode), 0o777);
    await fs.unlink(filename);
}

async function testMkdir() {
    const dir = await fs.mkdtemp('/tmp/test_dir_XXXXXX');
    // console.log('mkdtemp:', dir);

    await fs.rmdir(dir);

    const filename = '/tmp/test_dir_wotjs';
    try {
        await fs.mkdir(filename);
    } catch (e) {

    }

    await fs.rmdir(filename);
}

async function testOpendir() {
    const filename = join(__dirname, 'helpers/');

    const dir = await fs.opendir(filename);
    // console.log('opendir:', dir);
    assert.ok(dir);
    for await (const dirent of dir) {
        // console.log('dirent:', dirent);
        assert.ok(dirent.name);
    }

    const dirs = await fs.readdir(filename);
    // console.log('readdir:', dirs);
    assert.ok(dirs.length > 0);
}

async function testStatFs() {
    const filename = '/usr/local/bin/tjs';
    const realpath = await fs.realpath(filename);
    // console.log('realpath:', realpath);
    assert.ok(realpath);

    const statfs = await fs.statfs(filename);
    // console.log('statfs:', statfs.bfree);
    assert.ok(statfs.bfree > 0);
}

async function testOpen() {
    const filename = join(__dirname, 'helpers/worker.js');
    const file = await fs.open(filename, 'r');
    // console.log('file:', file);
    // console.log('path:', file.path);
    // console.log('fd:', file.fd);
    assert.ok(file);
    assert.ok(file.path);
    assert.ok(file.fd > 0);

    const stat = await file.stat();
    // console.log('stat:', stat.size);
    assert.ok(stat.size > 0);

    const data = await file.read();
    // console.log('read:', data.length);
    assert.equal(stat.size, data.byteLength);

    await file.close();
}

async function testAppendFile() {
    const filename = '/tmp/write.test';
    await fs.writeFile(filename, 'write\n');
    await fs.appendFile(filename, '12345\n');
    await fs.appendFile(filename, '67890\n');
    const data = await fs.readFile(filename, 'utf-8');
    // console.log(data);
    assert.equal(data, 'write\n12345\n67890\n');
}

test('fs.access', testAccess);
test('fs.appendFile', testAppendFile);
test('fs.hashFile', testHashFile);
test('fs.mkdir', testMkdir);
test('fs.mkstemp', testMkstemp);
test('fs.open', testOpen);
test('fs.opendir', testOpendir);
test('fs.stat', testStat);
test('fs.statfs', testStatFs);
