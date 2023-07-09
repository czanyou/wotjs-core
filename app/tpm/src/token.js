// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />

import * as shell from '../../modules/system/shell.js';

/**
 * 供 CLI 调用的命令接口
 */
const commands = {

    /** 
     * 设置设备远程控制 token
     * @param {string} action
     */
    async renew(action) {
        if (action != 'renew') {
            console.print('Usage: tpm token renew <renew>');
            return;
        }

        const token = await shell.token('renew');
        console.print('token:', token, '\n');
    },

    /** 
     * 查询设备远程控制 token
     */
    async ls() {
        const token = await shell.token();
        console.print('token:', token, '\n');
    }
};

export const command = {
    title: '管理 Token',
    subtitle: {
        renew: '修改设备访问凭证',
        ls: '查看设备访问凭证'
    },
    commands
};
