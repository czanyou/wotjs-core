#!/bin/env tjs
// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as path from '@tjs/path';
import * as fs from '@tjs/fs';
import * as os from '@tjs/os';
import * as process from '@tjs/process';

import { loadAll, runAll } from '@tjs/test';

/**
 * 测试
 * @param {string=} execute 
 * @param {string=} script 
 * @param  {...any} args 
 * @returns 
 */
async function test(execute, script, ...args) {
    if (args.length <= 0) {
        console.print('Run tests using built-in test runner.', '\n');
        console.print('Usage:');
        console.print('  tjs test <directories|files>', '\n');
        return;
    }

    /**
     * @param {string} pathname 
     */
    async function loadDirectory(pathname) {
        if (!await fs.exists(pathname)) {
            return;
        }

        const dirs = await fs.readdir(pathname);
        for (const dir of dirs) {
            // console.log(dir);
            if (dir.type == 1) { // file
                const filename = path.join(pathname, dir.name);
                await loadFilename(filename);

            } else if (dir.type == 2) { // dir
                const filename = path.join(pathname, dir.name);
                await loadDirectory(filename);
            }
        }
    }

    /**
     * @param {string} filename 
     */
    async function loadFilename(filename) {
        if (!filename) {
            return;

        } else if (!filename.endsWith('.js')) {
            return;
        }

        const name = path.basename(filename);
        if (!name.startsWith('test-')) {
            return;
        }

        // console.log('loadFilename:', filename);
        await loadAll(filename);
    }

    const cwd = os.cwd();
    for (let i = 0; i < args.length; i++) {
        const pathname = path.join(cwd, args[i]);
        if (!await fs.exists(pathname)) {
            continue;
        }

        const statInfo = await fs.stat(pathname);
        // console.log('statInfo:', statInfo);
        if (statInfo.type == 'directory') {
            await loadDirectory(pathname);

        } else if (statInfo.type == 'file') {
            await loadFilename(pathname);
        }
    }

    await runAll();

    console.print(`${process.version}@${process.execPath()}:${process.scriptPath()}`);
}

test(...process.argv);
