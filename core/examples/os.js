import * as os from '@tjs/os';

import * as assert from '@tjs/assert';

function test() {
    os.sleep();
    os.sleep(0);
    os.sleep(1);

    assert.ok(os.uptime() > 0);
    assert.ok(os.freemem() > 0);
    assert.ok(os.totalmem() > os.freemem());

    console.print('hostname', os.hostname());
    console.print('homedir', os.homedir());
    console.print('tmpdir', os.tmpdir());
    console.print('cwd', os.cwd());

    console.print('arch', os.arch);
    console.print('platform', os.platform);
    console.print('version', os.version);

    console.print('uname', os.uname());
    console.print('cpus', os.cpus().length);
    console.print('networkInterfaces', os.networkInterfaces().length);
    console.print('loadavg', os.loadavg().length);

    console.print('signal', os.signal.SIGSTOP);

    // console.print('kill', os.kill());
    console.print('uptime', os.uptime());

    console.print('printHandles');
    os.printHandles();
}

test();
