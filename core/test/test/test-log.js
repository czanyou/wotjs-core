import Log from '@tjs/logs';

const tag = Log.tag(import.meta);

const colors = console.colors.colors();

function test() {

    // print colors
    console.print('; colors\n');
    for (const color in colors) {
        const value = colors[color];
        console.print('-', value, color, colors.none);
    }

    // test line
    Log.i(tag, 'line');

    // test format
    Log.e(tag, 'test: %d%', 99);

    Log.test();
}

test();
