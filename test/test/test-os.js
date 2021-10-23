import * as os from '@tjs/os';
import { assert, test } from '@tjs/assert';

// console.log(os);

function testOs() {
    os.sleep();
    os.sleep(0);
    os.sleep(1);

    assert.ok(os.uptime() > 0);
    assert.ok(os.freemem() > 0);
    assert.ok(os.totalmem() > os.freemem());

    console.log('hostname', os.hostname());
    console.log('rss', os.rss());
    console.log('homedir', os.homedir());
    console.log('processTitle', os.processTitle());
    console.log('tmpdir', os.tmpdir());
    console.log('cwd', os.cwd());

    console.log('arch', os.arch);
    console.log('platform', os.platform);
    console.log('version', os.version);

    console.log('uname', os.uname());
    console.log('cpus', os.cpus().length);
    console.log('networkInterfaces', os.networkInterfaces().length);
    console.log('loadavg', os.loadavg().length);

    console.log('signal', os.signal.SIGSTOP);

    // console.log('kill', os.kill());
    console.log('uptime', os.uptime());

    console.print('printActiveHandles');
    os.printActiveHandles();

    console.print('printAllHandles');
    os.printAllHandles();
}

test('test os', testOs);
