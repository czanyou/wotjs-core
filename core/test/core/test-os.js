// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as os from '@tjs/os';
import { assert, test } from '@tjs/assert';

test('os', () => {
    // console.log(Object.keys(os).sort());

    assert.ok(os.loadavg());
    assert.ok(os.hostname());
    assert.ok(os.homedir());
    assert.ok(os.cwd());
    assert.ok(os.cpus());
    assert.ok(os.exec);
    assert.ok(os.execFile);
    assert.ok(os.kill);
    assert.ok(os.reboot);
    assert.ok(os.signal);
    assert.ok(os.isatty);
    assert.ok(os.networkInterfaces());
    assert.ok(os.tmpdir());
    assert.ok(os.uname());

    assert.ok(os.uptime() > 0);
    assert.ok(os.freemem() > 0);
    assert.ok(os.totalmem() > os.freemem());
});

test('os.sleep', () => {
    os.sleep(null);
    os.sleep(0);
    os.sleep(1);
});

test('os.syslog', () => {
    os.openlog('test-process');
    os.syslog(3, 'test syslog error'); // LOG_ERR
    os.syslog(4, 'test syslog warn'); // LOG_WARNING
    os.syslog(6, 'test syslog info'); // LOG_INFO
    os.syslog(7, 'test syslog debug'); // LOG_DEBUG
});
