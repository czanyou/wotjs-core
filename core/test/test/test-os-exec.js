import * as os from '@tjs/os';
import { dirname, join } from '@tjs/path';

async function start() {
    // @ts-ignore
    const __filename = import.meta.url.slice(7); // strip "file://"
    const __dirname = dirname(__filename);
    const filename = join(__dirname, 'test-os-exec-sub.js');

    const subprocess = await os.execFile('tjs', [filename]);

    subprocess.send(100);
    
    subprocess.onmessage = (event) => {
        console.log('onmessage', event.data);
    };

    const timer = setInterval(() => {
        subprocess.send('test-main\nend-of-line\n\n');
    }, 100);

    setTimeout(() => {
        subprocess.send({ name: 'bar', value: 100 });
    }, 50);

    await subprocess.wait();
    clearInterval(timer);
}

start();
