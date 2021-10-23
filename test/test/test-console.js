function test() {
    // test level
    console.debug('debug');
    console.log('log');
    console.info('info');
    console.warn('warn');
    console.error('error');

    // test assert
    console.assert(true);
    console.assert(false, 'is false');

    // test trace
    console.trace('trace');

    console.log('buffer', [0, 1, 2, 3, 4, { a: 100 }]);

    const array1 = new Uint8Array(1024 * 1024);
    console.log(array1);
    console.log(array1.buffer);

    const array2 = new Uint32Array(1024);
    console.log(array2);
    console.log(array2.buffer);

    console.log(/test/);
    console.log(Error);
    console.log(new Date());

    const object = { a: 1, b: true, c: 10.5, d: 'test' };
    const object2 = { a: 1, b: true, d: 'test', e: { name: 100, data: '34343434334898989830496839583490583490895034585855' } };
    const object3 = { a: 1, b: true, c: 10.5, d: 'test' };
    console.print('== object:\n');
    console.table(object);

    const array3 = [100, null, [100], object, object2, object3];
    console.print('== array1:\n');
    console.table(array3);

    console.print('== array2:\n');
    console.table(['a', 4.5, 6]);

    const sets = new Set(['a', 4.5, 6]);
    console.print('== sets:\n');
    console.table(sets);

    const sets2 = new Set(array3);
    console.print('== sets2:\n');
    console.table(sets2);

    const map = new Map();
    map.set('a', 100);
    map.set('b', 9999);
    console.print('== map:\n');
    console.table(map);
}

test();
