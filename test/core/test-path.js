// @ts-check
/// <reference path ="../../types/index.d.ts" />
import { assert, test } from '@tjs/assert';
import * as path from '@tjs/path';

test('path', async () => {
    assert.ok(path != null);
    assert.equal(path.basename('/var/www/html/index.html'), 'index.html');
    assert.equal(path.basename('/var/www/html/index.html', '.html'), 'index');
    assert.equal(path.extname('/var/www/html/index.html'), '.html');
    assert.equal(path.dirname('/var/www/html/index.html'), '/var/www/html');
    assert.equal(path.dirname('/var/www/html/'), '/var/www');
    assert.equal(path.dirname('/'), '/');
    assert.equal(path.dirname('var/www/html/'), 'var/www');
});

test('path.join', async () => {
    assert.ok(path != null);
    
    assert.equal(path.join('/', 'var', 'www', 'html/'), '/var/www/html/');
    assert.equal(path.join('/', 'var', 'www', '/html', '/'), '/var/www/html/');
    assert.equal(path.join('/', 'var', 'www', '//html'), '/var/www/html');
    assert.equal(path.join('/', 'var', 'www', '/', 'html'), '/var/www/html');
    assert.equal(path.join('/', 'var', 'www', '../../../../', 'html'), '/html');
    assert.equal(path.join('var', 'www', 'html'), 'var/www/html');
});

test('path.isAbsolute', async () => {
    assert.equal(path.isAbsolute('/var/www/html/index.html'), true);
    assert.equal(path.isAbsolute('var/www/html/index.html'), false);
});

test('path.parse', async () => {
    const data = path.parse('/var/www/html/index.html');
    assert.equal(data.root, '/');
    assert.equal(data.dir, '/var/www/html');
    assert.equal(data.base, 'index.html');
    assert.equal(data.ext, '.html');
    assert.equal(data.name, 'index');
    assert.equal(path.format(data), '/var/www/html/index.html');
});
