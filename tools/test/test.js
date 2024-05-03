import * as fs from '@tjs/fs';
import * as util from '@tjs/util';
import * as path from '@tjs/path';

async function test() {
    const basename = path.dirname(import.meta.url.substring(5));
    const filename = path.join(basename, 'test.json');
    console.log('filename:', filename);

    {
        const md5sum = await fs.filesum(filename, 'MD5');
        console.log('filesum:', md5sum);
    }

    {
        const md5sum = await fs.md5sum(filename);
        console.log('md5sum:', md5sum);
    }

    {
        const data = await fs.readFile(filename);
        const md5sum = util.hash(data, 'md5');
        console.log('hash:', md5sum);
    }
}

test();
