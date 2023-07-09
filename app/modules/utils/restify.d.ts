import * as http from "@tjs/http"

/**
 * 请求消息
 */
export interface RestifyRequest extends http.IncomingMessage {
    app?: Restify;
    params?: {[key: string]: string};
}

/**
 * 应答消息
 */
export interface RestifyResponse extends http.ServerResponse {
    app?: Restify;
    onclose?(): any;
}

/**
 * REST API 服务器路由
 */
export interface RestifyRouter {
    all(path: string, func: any): this;
    delete(path: string, func: any): this;
    get(path: string, func: any): this;
    post(path: string, func: any): this;
    put(path: string, func: any): this;
    use(path: string, func: any): this;
}

export class UnauthorizedError extends Error {
    constructor(message: string);
}

type RestifyOptions = {};

/**
 * 代表一个 REST API 服务器
 */
export class Restify {
    constructor(options?: RestifyOptions);

    /**
     * 路由
     */
    readonly router?: RestifyRouter;

    /**
     * 根目录
     */
    readonly root?: string;

    /**
     * 
     * @param method 
     * @param path 
     * @param params 
     */
    getHandler(method: string, path: string, params?: any): RestifyHandler | undefined;

    /**
     * 
     * @param req 
     * @param res 
     */
    handleRequest(req: RestifyRequest, res: RestifyResponse): Promise<any>;

    /**
     * 启动 REST API 服务
     */
    start(): Promise<any>;

    /**
     * 添加路由
     * @param router 
     */
    use(router: RestifyRouter): this;
}

/**
 * 
 */
type RestifyHandler = (req: RestifyRequest, res: RestifyResponse) => any;

/**
 * 创建一个路由
 * @param name 
 */
export function Router(name: string): RestifyRouter;
