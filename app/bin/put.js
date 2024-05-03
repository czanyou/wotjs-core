#!/bin/env tjs
// @ts-check
/// <reference path ="../modules/types/index.d.ts" />
import * as fs from '@tjs/fs';
import * as process from '@tjs/process';

import * as getopts from '../modules/utils/getopts.js';

/**
 * 
 * @param {string=} execute 
 * @param {string=} script 
 * @param  {...any} args 
 * @returns 
 */
async function put(execute, script, ...args) {
    const options = getopts.parse(args);
    // console.log('args', args, options)

    const filename = options._[0];
    const url = options._[1];

    if (!filename || !url) {
        console.print('put: missing URL', '\n');
        console.print('Usage:');
        console.print('  tjs put [options] [file] [URL]', '\n');
        return;
    }

    // eslint-disable-next-line no-unused-vars
    function parseString(value) {
        return String(value);
    }

    // console.log(options);
    // console.log(url);
    console.print(`put: File: '${filename}'`);

    let percent = -1;

    /**
     * @param {number} readed 
     * @param {number} total 
     */
    // eslint-disable-next-line no-unused-vars
    function showProgressBar(readed, total) {
        const value = Math.floor(readed * 100 / total);
        if (value == percent) {
            return;
        }

        percent = value;
        const progress = Math.round(percent / 4);
        const line = '='.repeat(progress) + '-'.repeat(25 - progress);

        console.write(`\rUploading [${line}] ${percent}%...`);

        if (percent >= 100) {
            console.print('\n');
        }
    }

    const filedata = await fs.readFile(filename);
    const file = new File([filedata], filename);

    // @ts-ignore
    console.print(`put: Size: ${filedata.length}\n`);

    try {
        const init = { method: 'POST', body: file };
        const response = await fetch(url, init);

        const statusCode = response.status;
        if (statusCode >= 300) {
            console.print(`put: Error: ${statusCode}`, response.statusText);
            return false;
        }

        console.print(`put: '${filename}' uploaded.\n`);

    } catch (e) {
        console.print('put:', e);
    }
}

put(...process.argv);
