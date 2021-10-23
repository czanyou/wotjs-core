function test() {
    console.print(' black   red     green   yellow  blue    magenta cyan    white');

    // eslint-disable-next-line no-undef

    function printColors(style) {
        console.write(style.black(' 1.TEST '));
        console.write(style.red(' 2.TEST '));
        console.write(style.green(' 3.TEST '));
        console.write(style.yellow(' 4.TEST '));
        console.write(style.blue(' 5.TEST '));
        console.write(style.magenta(' 6.TEST '));
        console.write(style.cyan(' 7.TEST '));
        console.write(style.white(' 8.TEST '));
        console.write('\n');
    }
    
    let style = console.colors.background;
    printColors(style);

    style = console.colors;
    printColors(style);

    style = console.colors.bright;
    printColors(style);
}

test();
