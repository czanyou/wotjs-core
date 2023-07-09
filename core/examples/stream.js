// @ts-check
import * as fs from '@tjs/fs';

async function test() {
    const filename = '/tmp/influxdb2-client.tar.gz';

    /** @type ReadableStream<Uint8Array> */
    const stream = await fs.readableStream(filename);
    if (stream instanceof ReadableStream) {
        console.log('stream is ReadableStream');
    }

    const stat = await fs.stat(filename);

    // const st = window.crypto.subtle.digest;

    let totalSize = 0;

    const reader = stream.getReader();
    while (true) {
        const ret = await reader.read();
        if (ret.done) {
            break;
        }

        totalSize += ret.value.length;
        console.log(ret.value);
    }

    // console.log(stream);
    stream.cancel();

    console.log('size:', totalSize, stat.size);

    const data = await fs.filesum(filename, 'SHA256');
    console.log(data);
}

test();
