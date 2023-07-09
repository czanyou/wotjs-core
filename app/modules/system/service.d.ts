export interface Service {
	title: string
	start(): any
	stop(): any
}

/**
 * 检查指定的服务是否正在运行，如果没有则启动它
 * @param {string} name 
 * @return {Promise<boolean|undefined>}
 */
export function check(name: string): Promise<boolean|undefined>;

/**
 * 
 * @param {string} name 
 */
export function getService(name: string): Service | undefined;

/**
 * 
 * @param {string} name 
 */
export function get(name: string): Promise<{ [key: string]: any }>;

/**
 * 禁用/启用指定名称的服务
 * @param {string} name 服务名
 */
export function isDisabled(name: string): Promise<boolean>;

/**
 * 打印所有可以管理的服务的名称
 */
export function list(): Promise<void>;

/**
 * 返回指定的名称的行程的 pid
 * @param {string} name 名称
 * @returns {Promise<number|undefined>} pid
 */
export function pidof(name: string): Promise<number>;

/**
 * 打印所有可以管理的服务的运行状态
 * @param {string} [name] 
 */
export function ps(name?: string): Promise<void>;

/**
 * 禁用/启用指定名称的服务
 * @param {string} name 服务名
 * @param {boolean} disabled 是否禁用
 */
export function disable(name: string, disabled: boolean): Promise<void>;

/**
 * 重启指定名称的服务
 * @param {string} name 
 * @param {...any} args 
 */
export function restart(name: string, ...args: any[]): Promise<void>;

/**
 * 启动指定名称的服务
 * @param {string} name 
 * @param {...any} args 
 */
export function start(name: string, ...args: any[]): Promise<void>;

/**
 * 返回指定名称的服务的状态
 * @param {string} name 
 */
export function status(name: string): Promise<{ [key: string]: any }>;

/**
 * 停止指定名称的服务
 * @param {string} name 
 * @param {...any} args 
 */
export function stop(name: string, ...args: any[]): Promise<void>;
