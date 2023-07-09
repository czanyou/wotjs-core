import * as storage from '../js/tjs/storage.js';

async function test() {
    const filename = '/tmp/test.db';
    const profile = new storage.FileStorage(filename);
    await profile.open();

    profile.setItem('a', 1);
    profile.setItem('b', 2);
    profile.setItem('c', true);
    profile.setItem('d', ['a']);
    profile.setItem('e', { e: 1 });
    profile.setItem('test', 100);
    profile.setItem('test', 100.9);
    profile.setItem('name', 'bar');

    // await profile.removeItem('b');
    profile.removeItem('far');

    let value = profile.getItem('test');
    console.log(value, 'test');

    value = profile.getItem('b');
    console.log(value, 'b');

    value = profile.getItem('c');
    console.log(value, 'c');

    value = profile.getItem('d');
    console.log(value, 'd');

    value = profile.getItem('e');
    console.log(value, 'e');

    value = profile.getItem('far');
    console.log(value, 'far');

    value = profile.getItem('name');
    console.log(value, 'name');

    console.log('size:', profile.fileSize);
    console.log('lines:', profile.lineCount);

    console.log(profile.values);

    profile.setItem('far', 1000);
    await profile.close();
}

async function test2() {
    const filename = '/tmp/test2.db';
    const profile = new storage.FileStorage(filename);
    await profile.open();

    profile.setItem('test1', 100);
    profile.setItem('test2', 100);

    console.log(profile.key(0));
    console.log(profile.key(1));
    console.log(profile.key(2));

    await profile.close();
}

async function test3() {
    const filename = '/tmp/test2.db';
    const profile = new storage.FileStorage(filename);

    await profile.open();
    profile.setItem('test1', 100);
    profile.setItem('test2', 100);
    await profile.close();

    await profile.open();
    console.log(profile.length);
    profile.clear();
    await profile.close();

    await profile.open();
    console.log(profile.length);
}

async function test4() {
    try {
        profile = new storage.FileStorage('c:/tmp/file');
        await profile.open();
    } catch (e) {
        console.log(e);
    }
}

test();
test3();
