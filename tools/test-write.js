import sh from '@tjs/shell';

async function main() {
    const result = await sh.access('/tmp');
    sh.echo('access:', result);

    const data = 'test100' + Date.now();
    await sh.write('/tmp/test', data);
    sh.echo('write:', sh.$0);

    const ret = await sh.read('/tmp/test');
    console.log('read:', ret, ret == data);

    await sh.write('/test/test', 'test100');
    sh.echo('write:', sh.$0, sh.error);
}

main();
