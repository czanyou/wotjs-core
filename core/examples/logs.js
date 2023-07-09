import * as logs from '@tjs/logs';

const colors = console.colors.COLORS;

function test() {

    // print colors
    console.print('; colors\n');
    for (const color in colors) {
        const value = colors[color];
        console.print('-', value, color, colors.none);
    }

    logs.config({ type: 'syslog' });

    console.info('test');
}

test();
