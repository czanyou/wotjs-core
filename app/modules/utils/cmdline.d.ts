/**
 * A tool for rapidly building command line apps
 * - 支持子命令
 * - 自动显示帮助信息
 */

type Command = Function;

/**
 * 子命令列表
 */
type SubCommands = { [key: string]: Command };

type ManageCommand = {
    title?: string,
    description?: string,
    subtitle?: { [key: string]: string },
    commands: { [key: string]: Command }
};

type ManageCommands = { [key: string]: ManageCommand };

/**
 * 命令列表
 */
type Commands = {
    title?: string,
    description?: string,
    subtitle?: { [key: string]: string },
    subcommands?: { [key: string]: ManageCommand },
    commands?: { [key: string]: Command };
}

// ////////////////////////////////////////////////////////////////////////////
// 参数配置

/**
 * 返回指定类型的参数配置命令列表
 * @param type 'user'|'network'
 */
export function command(type: 'user' | 'network' | string): ManageCommand;

/**
 * 读取参数
 * @param type 参数类型
 * @param names 
 */
export function get(type: string, ...names: string[]): Promise<void>;

/**
 * 设置参数
 * @param type 参数类型
 * @param values 
 */
export function set(type: string, ...values: string[]): Promise<void>;

/**
 * 删除参数
 * @param type 参数类型
 * @param names 
 */
export function unset(type: string, ...names: string[]): Promise<void>;

/**
 * 加载默认参数值
 * @param type 
 * @param flags 
 */
export function load(type?: string, flags?: string): Promise<void>;

// ////////////////////////////////////////////////////////////////////////////
// 命令行接口

/**
 * 执行指定的子命令
 * @param subcommands 
 * @param type 
 * @param name 
 * @param args 
 */
export function execute(subcommands: ManageCommand, type: string, name: string, ...args: any): any;

/**
 * 查找元素
 * @param names 
 * @param name 
 */
export function find(names: { [key: string]: any }, name: string): { name: string, value: any } | undefined;

/**
 * 通过脚本名称解析出对应的 APP 的名称
 * @param script 
 */
export function parseAppName(script: string): string;

/**
 * 显示帮助信息
 * - 帮助信息由程序自动生成
 * @param commands 
 * @param details 是否显示详细的帮助信息
 */
export function help(commands: Commands, details?: boolean): void;

/**
 * 执行 CLI 命令
 * - CLI 主入口
 * @param commands 命令列表
 * @param execPath 执行文件路径
 * @param scriptPath 执行的脚本文件名称
 * @param name 命令名
 * @param args 命令参数
 */
export function run(commands: Commands, execPath?: string, scriptPath?: string, name?: string, ...args: string[]): any;

/**
 * 执行 CLI 命令
 * - CLI 主入口
 * @param commands 命令列表
 * @param argv 传入 process.argv
 */
export function run(commands: Commands, ...argv: string[]): void;

export as namespace cmdline;
