#!/bin/env tjs
// @ts-check
/// <reference path ="../modules/types/index.d.ts" />
import * as native from '@tjs/native';
import * as process from '@tjs/process';
import shell from '@tjs/shell';

const TAG = 'run:';

/**
 * 运行脚本
 * @param {string} url 
 * @returns {Promise<boolean>}
 */
async function runStript(url) {
    try {
        shell.echo('fetch:', url);
        const response = await fetch(url);
        if (response.status != 200) {
            if (response.status == 404) {
                shell.echo('请检查是否存在这个文件:', url);
                return false;
            }

            console.error(TAG, 'runStript:', url, response.status, response.statusText);
            return false;
        }

        const script = await response.text();
        await native.runtime.evalScript(script, url);
        return true;

    } catch (e) {
        console.error(TAG, 'runStript:', e);
        return false;
    }
}

/**
 * 测试
 * @param {string=} execute 
 * @param {string=} script 
 * @param {string=} url 
 * @param  {...any} args 
 * @returns 
 */
async function run(execute, script, url, ...args) {
    if (!url) {
        console.print('Usage: tjs run <url>');
        return;
    }

    return await runStript(url);
}

run(...process.argv);
