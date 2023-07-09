// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as http from '@tjs/http';
import * as path from '@tjs/path';
import * as fs from '@tjs/fs';

/** @typedef {import("./restify.js").RestifyResponse} RestifyResponse */
/** @typedef {import("./restify.js").RestifyRequest} RestifyRequest */

/** @typedef {(req: RestifyRequest, res: RestifyResponse) => any} RestifyHandler  */
/** @typedef {{[method: string]: RestifyHandler}} RestifyMethodHandler */

export class UnauthorizedError extends Error {

}

export class RestifyRouter {
    /**
     * 
     * @param {string} name 
     */
    constructor(name) {
        /** @type {{[path: string]: RestifyRouter}} */
        this.routers = {};

        /** @type {RestifyMethodHandler} */
        this.handlers = {};

        if (name?.startsWith(':')) {
            name = name.substring(1);
        }

        this.name = name;
    }

    /**
     * 
     * @param {string} method 
     * @param {RestifyHandler} handler 
     */
    setHandler(method, handler) {
        this.handlers[method] = handler;
        return this;
    }

    /**
     * @param {string} method 
     * @param {string} pathname 
     * @param {RestifyHandler} handler 
     * @returns this
     */
    set(method, pathname, handler) {
        pathname = path.join('/', pathname);
        if (!method || !pathname) {
            return;
        }

        if (pathname == '/') {
            this.setHandler(method, handler);
            return;
        }

        const router = this.route(pathname);
        router?.setHandler(method, handler);
    }

    /**
     * 
     * @param {string} pathname 
     * @param {RestifyRouter} router 
     * @returns this
     */
    use(pathname, router) {
        pathname = path.join('/', pathname);
        if (pathname.endsWith('/')) {
            pathname = pathname.substring(0, pathname.length - 1);
        }

        if (!pathname) {
            return this;
        }

        const tokens = pathname.split('/');
        // console.log('use', tokens);

        /** @type RestifyRouter */
        let current = this;
        for (let i = 1; i < tokens.length - 1; i++) {
            const name = tokens[i];
            if (!name) {
                continue;
            }

            let dirname = name;
            if (dirname.startsWith(':')) {
                dirname = '*';
            }

            let router = current.routers[dirname];
            if (!router) {
                router = new RestifyRouter(name);
                current.routers[dirname] = router;
            }

            current = router;
        }

        const name = tokens[tokens.length - 1];
        if (!name) {
            return this;
        }

        current.routers[name] = router;
        return this;
    }

    /**
     * 
     * @param {string} pathname 
     * @returns this
     */
    route(pathname) {
        if (!pathname || pathname == '/') {
            return;
        }

        const tokens = pathname.split('/');
        // console.log('tokens', tokens);

        /** @type RestifyRouter */
        let current = this;
        for (let i = 0; i < tokens.length; i++) {
            const name = tokens[i];
            if (!name) {
                continue;
            }

            let dirname = name;
            if (dirname.startsWith(':')) {
                dirname = '*';
            }

            let router = current.routers[dirname];
            if (!router) {
                router = new RestifyRouter(name);
                current.routers[dirname] = router;
            }

            current = router;
        }

        return current;
    }

    /**
     * 
     * @param {string} path 
     * @param {RestifyHandler} func 
     * @returns this
     */
    all(path, func) {
        this.set('all', path, func);
        return this;
    }

    /**
     * 
     * @param {string} path 
     * @param {RestifyHandler} func 
     * @returns this
     */
    get(path, func) {
        this.set('GET', path, func);
        return this;
    }

    /**
     * 
     * @param {string} path 
     * @param {RestifyHandler} func 
     * @returns this
     */
    post(path, func) {
        this.set('POST', path, func);
        return this;
    }

    /**
     * 
     * @param {string} path 
     * @param {RestifyHandler} func 
     * @returns this
     */
    delete(path, func) {
        this.set('DELETE', path, func);
        return this;
    }

    /**
     * 
     * @param {string} path 
     * @param {RestifyHandler} func 
     * @returns this
     */
    put(path, func) {
        this.set('PUT', path, func);
        return this;
    }
}

/**
 * 
 * @param {string} name 
 * @returns {RestifyRouter}
 */
export function Router(name) {
    return new RestifyRouter(name);
}

const $properties = new WeakMap();

export class Restify {
    /**
     * 
     * @param {*} options 
     */
    constructor(options) {
        $properties.set(this, {
            options: { ...options },

            /** @type RestifyRouter */
            router: new RestifyRouter(''),

            /** @type string */
            root: options?.root
        });
    }

    get options() {
        return $properties.get(this).options;
    }

    /** @returns {string} */
    get root() {
        return $properties.get(this).root;
    }

    /** @returns {RestifyRouter} */
    get router() {
        return $properties.get(this).router;
    }

    /**
     * 
     * @param {string} pathname 
     * @param {*} params 
     * @returns {RestifyRouter|undefined}
     */
    getRouter(pathname, params) {
        let router = this.router;
        if (!router) {
            return;
        }

        pathname = path.join('/', pathname);

        const tokens = pathname.split('/');
        for (let i = 1; i < tokens.length; i++) {
            const name = tokens[i];
            if (!name) {
                continue;
            }

            // console.log(name, routers);
            const routers = router.routers;
            router = routers[name];
            if (!router) {
                router = routers['*'];
                if (!router) {
                    break;
                    // router = routers['/'];
                }

                if (params) {
                    params[router.name] = name;
                }
            }
        }

        return router;
    }

    /**
     * 
     * @param {string} method 
     * @param {string} pathname 
     * @param {*} params 
     * @returns {RestifyHandler|undefined}
     */
    getHandler(method, pathname, params) {
        const router = this.getRouter(pathname, params);
        if (!router) {
            return;
        }

        // @ts-ignore
        return router.handlers[method] || router.handlers.all;
    }

    /**
     * 
     * @param {RestifyRequest} req 
     * @param {RestifyResponse} res 
     * @returns 
     */
    async handleRequest(req, res) {
        // console.log(req.method, req.url);

        // request
        // @ts-ignore
        req.app = this;

        // response
        // @ts-ignore
        res.app = this;

        res.onclose = () => {
            // console.log('handleRequest');
        };

        try {
            // @ts-ignore
            const pathname = req.path;
            // console.log(req.method, req.url, this.router, this.root);

            if (pathname.startsWith('/static/')) {
                this.sendFile(req, res);
                return;
            }

            res.headers.set('Access-Control-Allow-Origin', '*');
            res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,POST,OPTIONS,DELETE');
            res.headers.set('Access-Control-Allow-Headers', '*');

            req.params = {};
            const handler = this.getHandler(req.method, req.path, req.params);
            // console.log(req.method, req.url, handler);
            if (handler) {
                await handler(req, res);
                return;
            }

            this.sendFile(req, res);

        } catch (err) {
            if (err instanceof UnauthorizedError) {
                return await res.send({ code: 401, error: err.message });
            }

            // 500
            res.setStatus(200);
            res.headers.set('Content-Type', 'application/json');
            await res.write(JSON.stringify(err));
            await res.end();
        }
    }

    /**
     * 
     * @param {*} filename 
     */
    getMimeType(filename) {
        const extname = path.extname(filename);
        // console.log('extname', extname);

        const mimetypes = { '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.json': 'application/json' };
        return mimetypes[extname] || 'text/html';
    }

    async sendFile(req, res) {
        const pathname = req.path;
        let filename = path.join(this.root, pathname);

        // console.log('sendFile', filename);
        try {
            if (filename.endsWith('/')) {
                filename += 'index.html';
            }

            const info = await fs.stat(filename);
            const data = /** @type ArrayBuffer */(await fs.readFile(filename));

            // console.log(info);
            const modified = new Date(info.mtime * 1000);

            res.setStatus(200);
            res.headers.set('Content-Type', this.getMimeType(filename));
            res.headers.set('Content-Length', data.byteLength);
            res.headers.set('Last-Modified', modified.toUTCString());

            await res.write(data);
            await res.end();

        } catch (e) {
            res.setStatus(404);
            res.headers.set('Content-Type', 'text/html');
            await res.write(res.status + ' ' + res.statusText);
            await res.end();
        }
    }

    async start() {
        // 创建 HTTP 服务器
        const options = this.options;
        const server = http.createServer(options, (req, res) => {
            return this.handleRequest(req, res);
        });

        server.onerror = (error) => {
            console.error('restify:', 'Error:', error.error);
        };

        await server.start();

        this.server = server;
        return server;
    }

    /**
     * 
     * @param {RestifyRouter} router 
     */
    use(router) {
        // console.log(router);
        $properties.get(this).router = router;
    }
}
