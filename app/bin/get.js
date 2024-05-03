#!/usr/local/bin/tjs
// @ts-check
/// <reference path ="../modules/types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as process from '@tjs/process';

import * as getopts from '../modules/utils/getopts.js';

/**
 * 下载 HTTP 文件
 * @param {string=} execute 
 * @param {string=} script 
 * @param  {...any} args 
 * @returns 
 */
async function get(execute, script, ...args) {
    const options = getopts.parse(args);
    // console.log('args', args, options)

    const url = options._[0];
    if (!url) {
        console.print('get: missing URL\n');
        console.print('Usage:');
        console.print('  tjs get [options] [URL]', '\n');
        console.print('Options:');
        console.print('  -O -o --output  Output filename');
        console.print('');
        return;
    }

    function parseString(value) {
        return String(value);
    }

    // console.log(options);
    // console.log(url);
    const filename = parseString(options.output || options.o || options.O || 'out');
    console.print(`get: Saving to: '${filename}'`);
    const file = await fs.open(filename + '.download', 'w', 0o666);

    /** @type any */
    const init = {};
    let percent = -1;

    /**
     * @param {number} readed 
     * @param {number} total 
     */
    function showProgressBar(readed, total) {
        const value = Math.floor(readed * 100 / total);
        if (value == percent) {
            return;
        }

        percent = value;
        const progress = Math.round(percent / 4);
        const line = '='.repeat(progress) + '-'.repeat(25 - progress);

        console.write(`\rDownloading [${line}] ${percent}%...`);

        if (percent >= 100) {
            console.print('\n');
        }
    }

    try {
        const response = await fetch(url, init);
        const headers = response.headers;
        const total = Number.parseInt(headers.get('content-length') || '');

        console.print(`get: type=${headers.get('content-type')}, size=${total}`);

        const statusCode = response.status;
        if (statusCode >= 300) {
            console.print(`get: Error ${statusCode}:`, response.statusText);
            return false;
        }

        let readed = 0;
        const body = response.body;
        const reader = body?.getReader();
        if (reader == null) {
            return false;
        }

        while (true) {
            // console.log('get:', 'read:', index++);
            const result = await reader.read();
            if (result.done) {
                await file.close();
                await fs.rename(filename + '.download', filename);
                break;
            }

            const data = result.value;
            if (data) {
                await file.write(data);
                readed += data.length;
                // console.log('get:', 'readed:', readed);

                if (total > 0) {
                    showProgressBar(readed, total);
                }
            }
        }

        console.print(`get: '${filename}' (${readed}) saved.\n`);

    } catch (e) {
        console.print('get:', e);
    }
}

get(...process.argv);
