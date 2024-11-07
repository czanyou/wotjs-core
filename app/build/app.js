#!/bin/env tjs

// @ts-check
/// <reference path ="../modules/types/index.d.ts" />
import * as process from '@tjs/process';
import shell from '@tjs/shell';

import * as cmdline from '../modules/utils/cmdline';
import * as getopts from '../modules/utils/getopts';
import * as link from './src/link';
import * as bundle from './src/bundle';

async function checkProjectRoot() {
    const basePath = shell.pwd();
    const colors = console.colors;
    // console.print('cwd:', basePath);

    try {
        const filename = shell.join(basePath, '/core/tjs/include/tjs.h');
        return await shell.exists(filename);

    } catch (e) {
        console.print(colors.red('Error: current directory is not TJS project root.'));
        return false;
    }
}

const $commands = {
    title: 'This is a build tool for WoT.js',
    commands: {
        /**
         * 打包
         * @param  {...string} args 
         * @returns 
         */
        async bundle(...args) {
            const options = getopts.parse(args, {
                alias: {
                    'basepath': 'b',
                    'exepath': 'e',
                    'output': 'o',
                    'libname': 'l'
                },
                default: {
                    'output': './build/tjs'
                }
            });

            const bundler = new bundle.Bundler();
            if (options.basepath) {
                bundler.basepath = String(options.basepath);
            }

            if (options.exepath) {
                bundler.exepath = String(options.exepath);
            }

            if (options.libname) {
                bundler.libname = String(options.libname);
            }

            if (options.output) {
                bundler.outpath = String(options.output);
            }

            // @ts-ignore
            return await bundler.bundle(options._);
        },

        /** 
         * 创建链接文件
         * @param {string} board 
         */
        link(board) {
            if (!board) {
                console.print('Symlink current source folder\n\nUsage: tjs build link <board>\n');
            }

            link.link(board);
        },

        /** 
         * 删除链接文件
         * @param {string} board 
         */
        unlink(board) {
            if (!board) {
                console.print('Remove source folder links\n\nUsage: tjs build unlink\n');
            }

            link.unlink(board);
        },

        /**
         * 更新 CMake 项目版本号配置文件
         * - CMakeVersion.cmake
         * @param {string} filename 配置文件名
         */
        async version(filename) {
            if (!await checkProjectRoot()) {
                return;
            }

            const colors = console.colors;
            filename = shell.join(shell.pwd(), filename);
            console.log('Version Filename:', filename);

            const data = await shell.read(filename);
            console.log('Current Version:', data);
            const code = process.versions.code;

            const date = new Date();
            const version = `${date.getFullYear() % 100}.${date.getMonth() + 1}.${date.getDate()}.${code + 1}`;
            console.log('New Version:', colors.green(version));

            await shell.write(filename, `set(TJS_PROJECT_VERSOIN ${version})\n`);
        }
    }
};

cmdline.run($commands, ...process.argv);
