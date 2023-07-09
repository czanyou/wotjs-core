// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as assert from '@tjs/assert';
import * as http from '@tjs/http';
import { test } from '@tjs/test';

import * as restify from '../../modules/utils/restify.js';

test('restify', async () => {
    const server = new restify.Restify({ root: 'test' });
    assert.equal(server.root, 'test');
    // console.log(server.router);

    const router = restify.Router('root');
    router.get('/', (req, res) => {
        // console.log('req', res, req.path, req.query);
    });

    server.use(router);

    const req = new http.IncomingMessage({ method: 1, url: '/?test=100' });
    const res = new http.ServerResponse();
    await server.handleRequest(req, res);
});
