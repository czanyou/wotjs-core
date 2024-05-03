import sh from '@tjs/shell';

async function main() {
    const result = await sh.access('/tmp');
    sh.echo('access:', result);

    await sh.write('/tmp/test', 'test100');
    sh.echo('write:', sh.$0);

    await sh.write('/test/test', 'test100');
    sh.echo('write:', sh.$0, sh.error);

    await sh.append('/tmp/test', 'test200');
    sh.echo('append:', sh.$0, sh.error);

    const read = await sh.read('/tmp/test');
    sh.echo('read:', sh.$0, read);

    const md5sum = await sh.md5sum('/tmp/test');
    sh.echo('md5sum:', sh.$0, md5sum);

    const sha1sum = await sh.sha1sum('/tmp/test');
    sh.echo('sha1sum:', sh.$0, sha1sum);

    await sh.ln('/tmp/data', '/tmp/link');
    sh.echo('ln:', sh.$0, sh.error);

    const readlink = await sh.readlink('/tmp/link');
    sh.echo('readlink:', sh.$0, readlink);

    const realpath = await sh.realpath('/tmp/link');
    sh.echo('realpath:', sh.$0, realpath);

    const readdir = await sh.readdir('/tmp/link');
    sh.echo('readdir:', sh.$0, readdir);

    await sh.rm('/tmp/link');
    sh.echo('rm:', sh.$0, sh.error);

    sh.cd('/tmp');
    sh.echo('pwd:', sh.pwd());

    sh.echo('getenv:', sh.getenv('PATH'));
    sh.echo('homedir:', sh.homedir());
    sh.echo('hostname:', sh.hostname());
    sh.echo('tmpdir:', sh.tmpdir());
    sh.echo('uname:', sh.uname());
    sh.echo('uptime:', sh.uptime());

    sh.progress(90, 'test');
    sh.echo('');

    await sh.exec('cat', '/test');
    sh.echo('exec:', sh.$0, sh.error);

    const path = await sh.which('tjsc');
    sh.echo('path:', sh.$0, path);
}

main();
