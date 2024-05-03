import * as fs from '@tjs/fs';

async function test() {
    // await fs.rm('/tmp/test/a', { recursive: true, force: false });
    // await fs.mkdir('/tmp/test/a/b/c/d', { recursive: true });
    await fs.rm('/tmp/a', { recursive: true, force: true });
    await fs.rm('/tmp/test/g', { recursive: true, force: true });

    await fs.cp('/tmp/test/', '/tmp/a/', { recursive: true, force: true });

    await fs.mkdir('/tmp/test/g', { recursive: true });

    // 复制文件到指定的目录
    await fs.cp('/tmp/test/c', '/tmp/test/g/', { recursive: true });

    // 复制文件到指定的目录
    await fs.cp('/tmp/test/c', '/tmp/test/g/b', { recursive: true });
    await fs.cp('/tmp/test/c', '/tmp/test/g/d/c', { recursive: true });
}

test();
