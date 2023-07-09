#!/bin/env tjs
// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />

import * as fs from '@tjs/fs';
import * as config from '@tjs/config';
import * as util from '@tjs/util';
import * as process from '@tjs/process';

import * as oss from '../utils/oss.js';
import * as cmdline from '../utils/cmdline.js';

async function getOptions() {
    const profile = await config.load('user');
    const options = {
        accessKeyId: profile.getString('oss.accessKeyId') || profile.getString('oss.access-key-id'),
        accessKeySecret: profile.getString('oss.accessKeySecret') || profile.getString('oss.access-key-secret'),
        host: profile.getString('oss.host') || 'oss-cn-shenzhen.aliyuncs.com',
        bucket: profile.getString('oss.bucket') || ''
    };

    return options;
}

export const commands = {

    /**
     * 查看 buckets 列表
     * @returns 
     */
    async buckets() {
        try {
            const options = await getOptions();
            const result = await oss.buckets(options);
            // console.log('result', result, result.status, result.body);
            if (result.status != 200) {
                return console.print('buckets:', result.status, result.statusText);
            }

            const body = result.body?.ListAllMyBucketsResult;
            const buckets = body?.Buckets?.Bucket;
            const list = Array.isArray(buckets) ? buckets : [buckets];

            console.print('Buckets:');
            console.table(list, ['Name', 'Region', 'Location', 'StorageClass', 'CreationDate']); // , 'ExtranetEndpoint']);

        } catch (e) {
            return console.print('buckets:', e.message);
        }
    },

    /**
     * 查看文件内容
     * @param {string} filename 
     * @param {string=} format 
     */
    async cat(filename, format = 'text') {
        if (!filename) {
            console.print('Usage: tci oss cat <filename> [format]');
            return;
        }

        try {
            const options = await getOptions();
            const result = await oss.bucket(options.bucket, options).object(filename).get(format);
            if (result.status != 200) {
                return console.print('cat:', `'${filename}'`, result.status, result.statusText);
            }

            const body = result.body;
            console.print(body);

        } catch (e) {
            return console.print('cat:', e.message);
        }
    },

    async config() {
        const options = await getOptions();
        console.table(options);
    },

    /**
     * 下载文件
     * @param {string} filename 
     * @param {string=} output 
     */
    async get(filename, output) {
        if (!filename) {
            console.print('Usage: tci oss get <filename> <output>');
            return;

        } else if (!output) {
            console.print('Usage: tci oss get <filename> <output>');
        }

        try {
            const options = await getOptions();
            const result = await oss.bucket(options.bucket, options).object(filename).get();
            if (result.status != 200) {
                return console.print('get:', `'${filename}'`, result.status, result.statusText);
            }

            const body = /** @type ArrayBuffer */(result.body);
            if (output && body != null) {
                console.print('get:', body?.byteLength, 'bytes to:', output);
                fs.writeFile(output, body);

            } else {
                console.print('get:', body?.byteLength, 'bytes');
            }

        } catch (e) {
            return console.print('get:', e.message);
        }
    },

    /**
     * 查询文件列表
     * @param {string} prefix
     */
    async ls(prefix) {
        if (!prefix) {
            console.print('Usage: tjs oss ls [prefix]\r\n');
        }

        /** @param {any} value  */
        function toArray(value) {
            if (value == null) {
                return [];
            }

            return Array.isArray(value) ? value : [value];
        }

        const options = await getOptions();
        const result = await oss.bucket(options.bucket, options).list(prefix);
        if (result.status != 200) {
            return console.print('ls:', result.status, result.statusText);
        }

        const body = result.body?.ListBucketResult;

        const files = toArray(body?.Contents);
        if (files.length) {
            console.print('Files:');
            console.table(files, ['Key', 'Type', 'Size', 'StorageClass', 'LastModified']); // ETag
        }

        const dirs = toArray(body?.CommonPrefixes);
        if (dirs.length) {
            console.print('Dirs:');
            console.table(dirs);
        }
    },

    /**
     * 查看文件内容
     * @param {string} filename 
     */
    async meta(filename) {
        if (!filename) {
            console.print('Usage: tci oss stat <filename>');
            return;
        }

        try {
            const options = await getOptions();
            const result = await oss.bucket(options.bucket, options).object(filename).meta();
            if (result.status != 200) {
                return console.print('stat:', `'${filename}'`, result.status, result.statusText);
            }

            const headers = result.headers;
            const modified = headers.get('last-modified');
            const date = modified ? new Date(modified) : null;
            // console.print(headers);

            const info = {
                etag: headers.get('etag'),
                modified: date?.toISOString(),
                size: headers.get('content-length'),
                accessTime: headers.get('x-oss-last-access-time'),
                version: headers.get('x-oss-version-id')
            };

            console.table(info);

        } catch (e) {
            return console.print('stat:', e.message);
        }
    },

    /**
     * 新增或更新文件
     * @param {string} filename
     * @param {string} input  
     * @param {*} type  
     */
    async put(filename, input, type = 'text/plain') {
        if (!filename) {
            console.print('Usage: tci oss put <filename> [input]');
            return;
        }

        try {
            const options = await getOptions();
            const data = await fs.readFile(input);
            // eslint-disable-next-line no-unused-vars
            const callback = JSON.stringify({
                callbackUrl: 'https://www.baidu.com/',
                callbackBody: 'test'
            });

            const result = await oss.bucket(options.bucket, options).object(filename).put(data, type);
            console.print('put:', `'${filename}'`, result.status, result.statusText);

            const body = result.body;
            if (body) {
                console.print('put:', 'body:', body);
            }

        } catch (e) {
            return console.print('put:', e.message);
        }
    },

    /**
     * 删除文件
     * @param {string} filename 
     */
    async rm(filename) {
        if (!filename) {
            console.print('Usage: tci oss rm <filename>');
            return;
        }

        try {
            const options = await getOptions();
            const result = await oss.bucket(options.bucket, options).object(filename).delete();
            console.print('rm:', `'${filename}'`, result.status, result.statusText);

            const body = result.body;
            if (body) {
                console.print('rm:', 'body:', body);
            }

        } catch (e) {
            return console.print('rm:', e.message);
        }
    },

    /**
     * 查看文件内容
     * @param {string} filename 
     */
    async stat(filename) {
        if (!filename) {
            console.print('Usage: tci oss stat <filename>');
            return;
        }

        try {
            const options = await getOptions();
            const result = await oss.bucket(options.bucket, options).object(filename).stat();
            if (result.status != 200) {
                return console.print('stat:', `'${filename}'`, result.status, result.statusText);
            }

            const headers = result.headers;
            const modified = headers.get('last-modified');
            const date = modified ? new Date(modified) : null;
            // console.print(headers);

            const md5sum = headers.get('content-md5');

            const info = {
                etag: headers.get('etag'),
                md5sum,
                modified: date?.toISOString(),
                size: headers.get('content-length'),
                type: headers.get('content-type')
            };

            if (md5sum) {
                info.md5sum = util.encode(util.decode(md5sum, 'base64'), 'hex');
            }

            console.table(info);

        } catch (e) {
            return console.print('stat:', e.message);
        }
    }
};

export const command = {
    title: '阿里云对象存储命令行工具',
    subtitle: {
        buckets: '查询 bucket 列表',
        cat: '查询文件内容',
        config: '查询客户端配置',
        get: '下载文件',
        ls: '查询文件列表',
        put: '上传文件',
        rm: '删除文件',
        stat: '查询文件信息'
    },
    commands
};

cmdline.run(command, ...process.argv);
