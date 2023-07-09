import * as native from '@tjs/native';
import * as process from '@tjs/process';

function testProcess() {
    console.print('native.args:', native.args);
    console.print('native.arg0:', native.arg0);
    console.print('native.command:', native.command);

    console.print('process.argv:', process.argv);
    console.print('process.scriptPath:', process.scriptPath());
    console.print('process.execPath:', process.execPath());
    console.print('process.command:', process.command);
}

testProcess();
