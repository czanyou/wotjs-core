import * as serial from '@tjs/serial';
import * as util from '@tjs/util';

class ATParser extends EventTarget {
    constructor() {
        super();

        this.buffer = '';
    }

    /**
     * 
     * @param {ArryBuffer} data 
     */
    execute(data) {
        if (!data) {
            return;
        }

        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(data);
        this.buffer = this.buffer + text;
        // console.log(this.buffer);

        while (true) {
            const line = this.readLine();
            if (line == null) {
                break;
            }

            // console.log('line', line)
            if (line == 'OK') {
                this.dispatchEvent(new Event('ok'));

            } else if (line == '') {
                this.dispatchEvent(new Event('endline'));

            } else {
                this.dispatchEvent(new MessageEvent('message', { data: line }));
            }
        }
    }

    /**
     * 
     * @returns {string}
     */
    readLine() {
        const buffer = this.buffer;
        const pos = buffer.indexOf('\n');
        if (pos < 0) {
            return;
        }

        /** @type string */
        const line = buffer.substring(0, pos + 1);
        this.buffer = buffer.substring(pos + 1);

        return line.trim();
    }
}

async function test() {
    /** @type serial.SerialPortOptions */
    const options = {
        baudRate: 115200,
        stopBits: 1,
        dataBits: 8,
        parity: 'none'
    };

    const device = '/dev/ttyUSB3';
    const handle = serial.open(device, options);
    if (!handle) {
        console.warn(`Failed to open ${device}`);
        return;
    }

    // const fd = handle.fileno();
    // serial.setDTR(fd, 0);
    // serial.setRTS(fd, 0);

    console.log('serial handle:', handle);

    const parser = new ATParser();
    parser.addEventListener('message', function (event) {
        /** @type {string} */
        const data = event.data;
        console.log('message:', data);
    });

    parser.addEventListener('ok', function (event) {

    });

    handle.onmessage = async function (data) {
        // console.log('message', data && data.length);
        parser.execute(data);
    };

    async function sendNextCommand(command) {
        console.log('write:', command);
        const ret = await handle.write(command);
        if (ret != command.length) {
            console.log('write', ret);
        }
    }

    const COMMANDS = [
        'AT\r\n',
        'AT+GMR\r\n',
        'AT+CPIN?\r\n'
    ];

    for (const command of COMMANDS) {
        await sendNextCommand(command);
        await util.sleep(1000);
    }
}

test();
