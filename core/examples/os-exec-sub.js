import * as os from '@tjs/os';
import * as util from '@tjs/util';
import * as process from '@tjs/process';

async function start() {
    console.log(os.isatty(0));

    const stdin = process.stdin();

    const parser = new util.MessageParser();
    parser.addEventListener('message', (event) => {
        // console.error('event', event.data);

        const data = event.data?.data;
        if (data != null) {
            process.send(event.data?.data);
        }
    });

    for (let i = 0; i < 3; i++) {
        const data = await stdin.read();
        if (data == null) {
            break;
        }

        parser.execute(data);
    }
}

start();
