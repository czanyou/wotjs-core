// @ts-check
/// <reference path ="../core/types/index.d.ts" />
import * as net from '@tjs/net';

async function main() {
    const socket = new net.UDPSocket();
    socket.setBroadcast(true);
    console.log(socket);
    socket.close();
}

main();
