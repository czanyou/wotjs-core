// @ts-check

import { assert, test } from '@tjs/assert';
import * as native from '@tjs/native';

test('native.args', () => {
    assert.equal(native.arg0, 1);
    assert.equal(native.applet, undefined);

    assert.ok(native.args);
    assert.ok(native.arch, 'native.arch is defined');
    assert.ok(native.board);
    assert.ok(native.root, 'native.root is defined');
});

test('native.consts', () => {
    assert.equal(native.AF_INET, 2);
    assert.equal(native.AF_INET6, 10);
    assert.equal(native.AF_UNSPEC, 0);

    assert.equal(native.STDIN_FILENO, 0);
    assert.equal(native.STDOUT_FILENO, 1);
    assert.equal(native.STDERR_FILENO, 2);
});

test('native.version', () => {
    assert.ok(native.version, 'native.version is defined');
    assert.ok(native.versions, 'native.versions is defined');
    assert.ok(native.versions.build, 'native.versions.build is defined');
    assert.ok(native.versions.http_parser, 'native.versions.http_parser is defined');
    assert.ok(native.versions.mbedtls, 'native.versions.mbedtls is defined');
    assert.ok(native.versions.quickjs, 'native.versions.quickjs is defined');
    assert.ok(native.versions.tjs, 'native.versions.tjs is defined');
    assert.ok(native.versions.uv, 'native.versions.uv is defined');
});
