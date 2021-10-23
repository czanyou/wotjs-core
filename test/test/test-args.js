import { assert, test } from '@tjs/assert';

import * as native from '@tjs/native';
function testProcess() {
    console.log('native.args:', native.args);
    console.log('native.arg0:', native.arg0);
    console.log('native.applet:', native.applet);

    console.log('process.argv:', process.argv);
    console.log('process.script:', process.script);
    console.log('process.applet:', process.applet);

    assert.ok(Array.isArray(process.argv), 'process.argv is an array');
}

test('test process', testProcess);
