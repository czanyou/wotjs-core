// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as crypto from '@tjs/crypto';
import * as util from '@tjs/util';

import * as sax from './sax.js';

/** @type Object<string,(value: any) => boolean> */
const is = {
    string(value) {
        return typeof value == 'string';
    },
    array(value) {
        return Array.isArray(value);
    },
    object(value) {
        return typeof value == 'object';
    }
};

/**
 * 资源名：/path/to/resource?key=value...
 * @param {string} resourcePath
 * @param {Object<string,any>} parameters
 * @return {string}
 */
export function buildCanonicalizedResource(resourcePath, parameters) {
    let canonicalizedResource = `${resourcePath}`;
    let separatorString = '?';

    if (is.string(parameters) && parameters.trim() !== '') {
        canonicalizedResource += separatorString + parameters;

    } else if (is.array(parameters)) {
        parameters.sort();
        canonicalizedResource += separatorString + parameters.join('&');

    } else if (parameters) {
        const compareFunc = (entry1, entry2) => {
            if (entry1[0] > entry2[0]) {
                return 1;
            } else if (entry1[0] < entry2[0]) {
                return -1;
            }
            return 0;
        };

        const processFunc = (key) => {
            canonicalizedResource += separatorString + key;
            if (parameters[key] || parameters[key] === 0) {
                canonicalizedResource += `=${parameters[key]}`;
            }
            separatorString = '&';
        };

        Object.keys(parameters).sort(compareFunc).forEach(processFunc);
    }

    return canonicalizedResource;
};

/**
 * Header 名转小写
 * @param {Object<string,any>} headers 
 * @returns {Object<string,any>}
 */
export function lowercaseKeyHeaders(headers) {
    const lowercaseHeaders = {};
    if (is.object(headers)) {
        Object.keys(headers).forEach(key => {
            lowercaseHeaders[key.toLowerCase()] = headers[key];
        });
    }

    return lowercaseHeaders;
}

/**
 * @typedef {{children?: Element[], name?: string, text?: string}} Element
 */

/**
 * 解析 XML 字符串
 * @param {string} data XML 字符串
 * @returns {Object<string,any>}
 */
export function parseXmlString(data) {
    if (data == null) {
        return data;
    }

    /** @type Element */
    const result = {
        children: []
    };

    const stack = [result];
    let current = result;

    const parser = sax.parser(true, { trim: true, lowercase: true, position: false });
    parser.onerror = function (e) {
        console.log('onerror ', e);
    };

    parser.onopentag = function (node) {
        /** @type Element */
        const element = { name: node.name };
        delete current.text;

        if (!current.children) {
            current.children = [];
        }

        current.children.push(element);
        current = element;

        stack.push(element);
    };

    parser.onclosetag = function (node) {
        stack.pop();
        current = stack[stack.length - 1];
    };

    parser.ontext = function (text) {
        const count = current.children?.length;
        if (!count) {
            current.text = text;
        }
    };

    parser.onend = function () {
        console.log('onend');
    };

    // console.log('data:', data);
    parser.write(data);

    /**
     * @param {Element} element 
     * @returns {Object<string,any>}
     */
    function parse(element) {
        const ret = {};
        if (!element.children) {
            return ret;
        }

        for (const child of element.children) {
            if (!child.children) {
                ret[child.name] = child.text;
                continue;
            }

            const item = parse(child);
            const last = ret[child.name];
            if (last == null) {
                ret[child.name] = item;
                continue;
            }

            if (!Array.isArray(last)) {
                ret[child.name] = [last];
            }

            ret[child.name].push(item);
        }

        return ret;
    }

    return parse(result);
}

/**
 * ```
 * StringToSign =
 *  + METHOD + "\n"
 *  + CONTENT-MD5 + "\n"
 *  + CONTENT-TYPE + "\n"
 *  + DATE + "\n"
 *  + CanonicalizedOSSHeaders
 *  + CanonicalizedResource
 * ```
 * @param {String} method 方法名
 * @param {String} resourcePath 路径名
 * @param {Object} request 请求对象
 * @param {String=} expires Date
 * @return {String} String to sign
 */
export function canonicalString(method, resourcePath, request, expires) {
    request = request || {};
    const headers = lowercaseKeyHeaders(request.headers);
    const OSS_PREFIX = 'x-oss-';
    const ossHeaders = [];
    const headersToSign = {};

    let signContent = [
        method.toUpperCase(),
        headers['content-md5'] || '',
        headers['content-type'],
        expires || headers['x-oss-date'] || headers.date
    ];

    Object.keys(headers).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey.indexOf(OSS_PREFIX) === 0) {
            headersToSign[lowerKey] = String(headers[key]).trim();
        }
    });

    Object.keys(headersToSign).sort().forEach((key) => {
        ossHeaders.push(`${key}:${headersToSign[key]}`);
    });

    signContent = signContent.concat(ossHeaders);
    signContent.push(buildCanonicalizedResource(resourcePath, request.parameters));

    return signContent.join('\n');
};

/**
 * 计算数字签名
 * 
 * `hmac("SHA1", canonicalString.buffer, accessKeySecret).base64()`
 * @param {string} accessKeySecret 账号访问密钥
 * @param {string} canonicalString String to sign
 * @returns {string} signature
 */
export function signature(accessKeySecret, canonicalString, headerEncoding = 'utf-8') {
    const data = util.toBuffer(canonicalString);
    const result = crypto.hmac('SHA1', data, accessKeySecret);
    return util.encode(result, 'base64');
};

/**
 * 生成认证头
 * get author header
 *
 * Header: `"Authorization: OSS " + AccessKeyId + ":" + Signature`
 *
 * ```
 * Signature = base64(hmac-sha1(AccessKeySecret + "\n"
 *  + VERB + "\n"
 *  + CONTENT-MD5 + "\n"
 *  + CONTENT-TYPE + "\n"
 *  + DATE + "\n"
 *  + CanonicalizedOSSHeaders
 *  + CanonicalizedResource))
 * ```
 * @param {string} method 方法名，如 GET
 * @param {string} resource 资源路径，如 /
 * @param {Object<string,any>=} parameters 
 * @param {Object<string,any>=} headers 
 * @param {Options=} options 
 * @return {string} Header value
 */
export function authorization(method, resource, parameters, headers, options) {
    const stringToSign = canonicalString(method.toUpperCase(), resource, { headers, parameters });

    const accessKeyId = options?.accessKeyId;
    const accessKeySecret = options?.accessKeySecret;
    const headerEncoding = options?.headerEncoding;
    if (!accessKeySecret) {
        return '';
    }

    // console.log('stringToSign', stringToSign);
    return `OSS ${accessKeyId}:${signature(accessKeySecret, stringToSign, headerEncoding)}`;
}

/**
 * @typedef {{method?: string, bucket?: string, object?: string, body?: string|ArrayBuffer, type?: string, format?: string, callback?: string, parameters?: Object<string,string>}} RequestInit 
 * @typedef {{status: number, statusText: string, body: any, type?: string, headers: Object<string,any>}} Result
 * @typedef {{accessKeyId:string, accessKeySecret:string, headerEncoding?:string, host:string}} Options
 */

/**
 * 发起 HTTP 请求
 * @param {RequestInit} init 
 * @param {Options=} options 
 * @returns {Promise<Result>}
 */
export async function request(init, options) {
    // url: http://$bucket.$host/$object
    let url = 'http://';
    if (init.bucket) {
        url += init.bucket + '.';
    }

    url += options?.host;
    url += init.object || '/'; // 文件 (object) 路径

    const uri = new URL(url);
    const params = init.parameters;
    // console.log('params:', params);
    if (params) {
        for (const key in params) {
            const value = params[key];
            if (value != null) {
                uri.searchParams.set(key, value);
            }
        }
    }

    // resource: /$bucket/$object
    let resource = '/';
    if (init.bucket) {
        resource += init.bucket;
        resource += init.object || '/';
    }

    const method = init.method || 'GET';
    const parameters = uri.searchParams.entries;
    const body = init.body;

    // headers
    const now = new Date();
    const headers = { Date: now.toUTCString() };
    if (body) {
        headers['Content-Type'] = init.type || 'text/plain';
    }

    if (init?.callback) {
        console.log('callback:', init.callback);
        headers['x-oss-callback'] = util.encode(util.toBuffer(init.callback), 'base64');
    }

    // authorization
    headers.authorization = authorization(method, resource, parameters, headers, options);

    // fetch
    // console.log('url:', uri.toString());
    const response = await fetch(uri.toString(), { method, headers, body });

    /** @type string */
    let type = '';

    /** @type any body */
    let data;
    if (response.status != 200) {
        const text = await response.text();
        data = parseXmlString(text);
        type = 'json';

    } else if (init.format == 'json') {
        data = await response.json();
        type = 'json';

    } else if (init.format == 'xml') {
        const text = await response.text();
        data = parseXmlString(text);
        type = 'json';

    } else if (init.format == 'text') {
        data = await response.text();
        type = 'text';

    } else {
        data = await response.arrayBuffer();
        type = 'arrayBuffer';
    }

    // result
    return { status: response.status, statusText: response.statusText, body: data, headers: response.headers, type };
}

/**
 * 上传文件
 * @param {string} bucket Bucket name
 * @param {string} object Object name
 * @param {string|ArrayBuffer} body Object content
 * @param {string} type 
 * @param {Options=} options 
 */
export async function upload(bucket, object, body, type, options) {
    return await request({ method: 'PUT', bucket, object, body, type }, options);
}

/**
 * Bucket 列表
 * @param {Options=} options 
 * @returns {Promise<Result>}
 */
export async function buckets(options) {
    return await request({ method: 'GET', format: 'xml' }, options);
}

/**
 * Bucket 管理
 * @param {string} bucket 
 * @param {Options=} options 
 * @returns 
 */
export function bucket(bucket, options) {
    return {
        /**
         * 查询列表
         * @param {string} prefix 
         * @returns {Promise<Result>}
         */
        async list(prefix) {
            // max-keys: 100 (0~1000), marker: test.txt
            const delimiter = '/';
            const parameters = { prefix, delimiter };
            return await request({ method: 'GET', bucket, format: 'xml', parameters }, options);
        },
        /**
         * 对象管理
         * @param {string} object 
         * @returns
         */
        object(object) {
            if (!object) {
                object = '/';

            } else if (!object.startsWith('/')) {
                object = '/' + object;
            }

            return {
                /**
                 * 删除文件
                 * @returns {Promise<Result>}
                 */
                async delete() {
                    return await request({ method: 'DELETE', bucket, object, format: 'xml' }, options);
                },
                /**
                 * 下载文件
                 * @param {string=} format `text`, `xml`, `json`
                 * @returns {Promise<Result>}
                 */
                async get(format) {
                    return await request({ method: 'GET', bucket, object, format }, options);
                },
                /**
                 * 上传文件
                 * @param {string|ArrayBuffer} body 
                 * @param {string=} type Mime type
                 * @param {string=} callback 
                 * @returns {Promise<Result>}
                 */
                async post(body, type, callback) {
                    return await request({ method: 'POST', bucket, object, body, type, callback }, options);
                },
                /**
                 * 上传并覆盖文件
                 * @param {string|ArrayBuffer} body 
                 * @param {string=} type Mime type
                 * @param {string=} callback 
                 * @returns {Promise<Result>}
                 */
                async put(body, type, callback) {
                    return await request({ method: 'PUT', bucket, object, body, type, callback }, options);
                },
                /**
                 * 
                 * @returns 
                 */
                async stat() {
                    return await request({ method: 'GET', bucket, object: object + '?objectMeta' }, options);
                }
            };
        }
    };
}
