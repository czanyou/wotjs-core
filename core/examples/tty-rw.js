import * as util from '@tjs/util';
import * as native from '@tjs/native';

async function test() {
    const stdout = new native.TTY(native.STDOUT_FILENO, true);

    const stdin = new native.TTY(native.STDIN_FILENO, true);
    await stdout.write('Shell > ');
    stdin.setMode(native.TTY.MODE_RAW);

    while (true) {
        const result = await stdin.read();
        if (!result) {
            continue;
        }

        const buffer = new Uint8Array(result);
        if (buffer[0] == 0x03) {
            break;

        } else if (buffer[0] == 127) {
            // TODO:

        } else if (buffer[0] == 0x0d) {
            await stdout.write('\r\nShell > ');

        } else if (buffer[0] > 32) {
            await stdout.write(util.toString(result));
        }
    }

    stdin.setMode(native.TTY.MODE_NORMAL);
    await stdout.write('\r\n');
    stdin.close();
}

test();
