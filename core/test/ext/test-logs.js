// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as logs from '@tjs/logs';

import { test } from '@tjs/test';

test('logs', async () => {
    assert.ok(logs != null);
    
    assert.ok(logs.config);
});

test('os.syslog', () => {
    logs.syslog.open('test-process');
    logs.syslog.log(3, 'test syslog error'); // LOG_ERR
    logs.syslog.log(4, 'test syslog warn'); // LOG_WARNING
    logs.syslog.log(6, 'test syslog info'); // LOG_INFO
    logs.syslog.log(7, 'test syslog debug'); // LOG_DEBUG
});
