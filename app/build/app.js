#!/bin/env tjs

// @ts-check
/// <reference path ="../modules/types/index.d.ts" />
import * as process from '@tjs/process';

import * as cmdline from '../modules/utils/cmdline.js';
import * as build from './src/build.js';
import * as link from './src/link.js';

const $commands = {
    title: 'This is a build tool for WoT.js',
    commands: {
        /** 
         * 打包指定的固件镜像文件
         * @param {string} board, 
         * @param {string=} pathname 
         */
        pack(board, pathname) {
            if (!board) {
                console.print('Create a tarball for a board\n');
                console.print('Usage: tjs build pack <board>');
            }

            build.pack(board, pathname);
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
        }
    }
};

cmdline.run($commands, ...process.argv);
