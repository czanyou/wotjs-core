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
    const options = {
        baudRate: 115200,
        stopBits: 1,
        dataBits: 8,
        parity: 'none',
        device: '/dev/ttyS0'
    };

    // const handle = serial.open('/dev/ttyS0', options);
    const handle = serial.open(options.device, options);
    if (!handle) {
        return;
    }
    const fd = handle.fileno();
    serial.setDTR(fd, 0);
    serial.setRTS(fd, 0);

    console.log('serial', handle);
    const parser = new ATParser();

    let state = 0;

    parser.addEventListener('message', function (event) {
        /** @type {string} */
        const data = event.data;
        console.log(data);

        const lastState = state;

        if (data.startsWith('+MOT')) {
            state = 2;

        } else if (data.startsWith('+MAC')) {
            state = 3;

        } else if (data.startsWith('+VER')) {
            state = 4;

        } else if (data.startsWith('+BAUD')) {
            state = 5;

        } else if (data.startsWith('+STATE')) {
            state = 1;

        } else {
            return;
        }

        if (lastState != state) {
            setTimeout(() => {
                sendNextCommand();
            }, 1000);
        }
    });

    parser.addEventListener('ok', function (event) {
        if (state == 0) {
            state = 1;
        }
    });

    handle.onmessage = async function (data) {
        // console.log('message', data && data.length);

        parser.execute(data);
    };

    function sendNextCommand() {
        const COMMANDS = [
            'AT\r\n',
            'AT+MOT=0,1\r\n',
            'AT+MAC?\r\n',
            'AT+GMR\r\n',
            'AT+BAUD?\r\n',
            'AT+STATE?\r\n',
            'AT\r\n'
        ];

        const command = COMMANDS[state] || 'AT\r\n';
        console.log('write', command);
        const ret = handle.write(command);
        if (ret != command.length) {
            console.log('write', ret);
        }
    }

    setInterval(() => {
        sendNextCommand();
    }, 1000);

    // sendNextCommand();
}

test();
