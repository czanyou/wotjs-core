// @ts-check
/// <reference path ="../../types/index.d.ts" />

import * as jsonrpc from '@tjs/jsonrpc';
import * as assert from '@tjs/assert';

import { test } from '@tjs/test';

const TAG = 'rpc:';
const URL = 'tcp:127.0.0.1:8012';

/// ////////////////////////////////////////////////////////////////////////////
// RPC 客户端

export function getProxy() {
    const client = jsonrpc.proxy(URL, { debug: true });
    return client;
}

/// ////////////////////////////////////////////////////////////////////////////
// RPC 服务器

/**
 * @typedef {object} TciServer
 * RPC 服务端上下文
 */
const $context = {
    /** @type {jsonrpc.JsonrpcServer | null} */
    server: null,

    /** @type {jsonrpc.JsonrpcHandlerMap} */
    handlers: {
        async test(action) {
            // $context.server?.notify('100', 'haha', 1001);
            return { code: 0, message: 'test', action };
        }
    }
};

export default $context;

/** 
 * 运行 JSON-RPC 服务 
 */
async function createServer() {
    const server = jsonrpc.createServer(URL, $context.handlers);
    server.onerror = (error) => {
        console.error(TAG, 'error:', error && error.message);
    };

    server.onclose = () => {
        console.error(TAG, 'sever', 'close');
    };

    await server.start();

    $context.server = server;
    return server;
}

/**
 * 
 */
test('net.jsonrpc - createServer', async () => {
    const server = await createServer();

    // @ts-ignore
    const manager = jsonrpc.getManager();

    {
        const proxy = getProxy();
        const result = await proxy.test('test');
        console.log(result);
        assert.ok(result);

        manager.close();
    }

    {
        const proxy = getProxy();
        const requests = [];
        requests.push(proxy.test('test'));
        requests.push(proxy.test('test'));
        requests.push(proxy.test('test'));

        const result = await Promise.all(requests);
        console.log(result);
    }

    const clients = manager.clients;
    console.log('manager:', manager);

    // manager.close();
    for (const client of clients.values()) {
        client.close();
        console.log('client:', client);
    }

    server.close();
});
