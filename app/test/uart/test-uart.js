// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as assert from '@tjs/assert';
import { test } from '@tjs/test';

import * as uart from '../../modules/vendor/uart.js';

export async function testUart() {
    const commands = {
        test: { command: 'AT', result: '' },
        gmr: { command: 'AT+GMR', result: '+VER' },
        mac: { command: 'AT+MAC', result: '+MAC', readonly: true },
        name: { command: 'AT+NAME', result: '+NAME', readonly: true },
        state: { command: 'AT+STATE', result: '+STATE', readonly: true },
        advdata: { command: 'AT+ADVDATA', result: '+ADVDATA', readonly: true },
        meshinfo: { command: 'AT+MESHINFO', result: '', readonly: true },
        meshls: { command: 'AT+MESHLS', result: '', readonly: true },
        meshadd: { command: 'AT+MESHADD', result: '', readwrite: true },
        meshrm: { command: 'AT+MESHRM', result: '', readwrite: true }
    };

    const options = { name: 'bluetooth', baudRate: 115200 };
    const client = new uart.ATClient(options);
    client.commands = commands;

    try {
        client.addEventListener('notification', (event) => { // @ts-ignore
            const data = event.data;
            if (data?.type) {
                // TODO:
            }
        });

        await client.start();

        async function invoke(command, param1, param2) {
            const result = await client.invoke(command, param1, param2);
            console.log(command + ':', result?.ok, result?.data);
        }

        await invoke('test');
        /*
        await invoke('gmr');
        await invoke('mac');
        await invoke('name');
        await invoke('state');
        await invoke('advdata');
        // */
        await invoke('meshinfo');
        await invoke('meshls');
        await invoke('meshrm', '01020304050607080900010203040506', '0003');
        await invoke('meshadd', '01020304050607080900010203040507', '0007');

        console.print(client.logs.join('\r\n'));
        await client?.close();

    } catch (e) {
        console.print(client.logs.join('\r\n'));
        await client?.close();
        console.warn('uart:', 'Start uart failed:', e);
    }
}

test('uart', async () => {
    await testUart();
});
