// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as util from '@tjs/util';
import * as native from '@tjs/native';

const $context = {
    callback: () => { console.log('onclose'); }
};

async function test() {
    console.log('1');
    
    let handle = new native.TCP();
    handle.setDebug(true);

    const timer = setTimeout(() => {
        console.log('timeout');
        // handle.onclose();
        // handle.close();
        native.os.printHandles();

        handle = null;
    }, 100);

    console.log('timer:', timer);

    // native.os.printHandles();
    // native.os.printMemoryUsage();

    handle.onclose = $context.callback;
    // handle.close();
}

test();
