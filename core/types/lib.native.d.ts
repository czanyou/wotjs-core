/**
 * @module native
 * WoT.js Native modules - 原生模块
 * - 因为原生模块接口可能经常变动，所以禁止应用程序直接调用原生模块接口
 */
declare module '@tjs/native' {
    /**
     * 文件句柄
     * 该接口定义了一个文件句柄对象，它提供了一些方法来操作文件，如读取、写入、关闭、获取状态等。
     */
    export interface FileHandle {
        /**
         * 文件路径
         */
        path: string;

        /**
         * 文件描述符
         */
        fd: number;

        /**
         * 读取文件内容
         * @param size 读取的字节数，可选
         * @returns 读取的文件内容
         */
        read(size?: number): Promise<ArrayBuffer>;

        /**
         * 写入文件内容
         * @param data 要写入的数据，可以是字符串或 ArrayBuffer
         * @param encoding 编码方式，可选
         * @returns 写入操作的结果
         */
        write(data: string | ArrayBuffer, encoding?: string): Promise<void>;

        /**
         * 关闭文件句柄
         * @returns 关闭操作的结果
         */
        close(): void;

        /**
         * 获取文件状态
         * @returns 文件状态信息
         */
        stat(): Promise<any>;

        /**
         * 同步文件内容到磁盘
         * @returns 同步操作的结果
         */
        sync(): Promise<void>;

        /**
         * 截断文件
         * @param length 截断后的文件长度，可选
         * @returns 截断操作的结果
         */
        truncate(length?: number): Promise<void>;
    }


    /** 目录 */
    export interface Dir {
        /** 文件名称 */
        name: string;

        /** 文件类型, 1 FILE 文件, 2 DIR 目录, 3 LINK 链接文件, 4 FIFO, 5 SOCKET, 6 CHAR, 7 BLOCK */
        type: number;
    }

    /** 
     * 子进程 
     * Instances of the ChildProcess represent spawned child processes.
     */
    export interface ChildProcess {
        /**
         * Returns the process identifier (PID) of the child process. 
         */
        readonly pid: number;

        // 标准错误输出的TTY对象
        readonly stderr: TTY;

        // 标准输入的TTY对象
        readonly stdin: TTY;

        // 标准输出的TTY对象
        readonly stdout: TTY;

        /**
         * 发送一个信号给子进程
         * @param signal 信号，可以是数字或信号名
         */
        kill(signal?: number): void;

        /**
         * Indicates whether it is still possible to send and receive messages 
         * from a child process. 
         * @returns {boolean} true if connected, false otherwise
         */
        connected: boolean;

        /**
         * Closes the IPC channel between parent and child, allowing the child 
         * to exit gracefully once there are no other connections keeping it alive. 
         */
        disconnect(): void;

        /**
         * When an IPC channel has been established between the parent and child, 
         * the subprocess.send() method can be used to send messages to the child process.
         * @param message 要发送的消息对象
         * @returns {Promise<boolean>} 发送成功返回true，否则返回false
         */
        send(message: object): Promise<boolean>;

        /** 等待进程结束 */
        wait(): Promise<ProcessResult>;

        // 当子进程的连接断开时触发的事件
        ondisconnect?(message: Event): void;

        // 当子进程接收到消息时触发的事件
        onmessage?(message: MessageEvent): void;
    }


    /**
     * 子进程返回结果
     * 该接口定义了一个子进程执行完毕后返回的结果对象，包含了子进程的标准输出、标准错误输出、退出代码、信号值以及可能的错误信息。
     */
    export interface ProcessResult {
        /** 输出 */
        stdout?: string;

        /** 错误输出 */
        stderr?: string;

        /** 退出代码 */
        code?: number;

        /** 信号值 */
        signal?: number;

        /** 错误 */
        error?: Error;
    }


    /**
     * 地址族：IPv4
     */
    export const AF_INET: number;

    /**
     * 地址族：IPv6
     */
    export const AF_INET6: number;

    /**
     * 地址族：未指定
     */
    export const AF_UNSPEC: number;

    /**
     * 标准输入文件描述符
     */
    export const STDIN_FILENO: number;

    /**
     * 标准输出文件描述符
     */
    export const STDOUT_FILENO: number;

    /**
     * 标准错误输出文件描述符
     */
    export const STDERR_FILENO: number;

    /**
     * 命令行字符串，通常是用于启动当前进程的命令。
     */
    export const command: string;

    /**
     * 系统的 CPU 架构，例如 "x86"、"x64"、"arm" 等。
     */
    export const arch: string;

    /**
     * 命令行参数数组中的第一个参数，通常是执行文件的路径。
     */
    export const arg0: number;

    /**
     * 命令行参数数组，包含启动当前进程时传递的所有参数。
     */
    export const args: string[];

    /**
     * 系统的主板型号或标识符。
     */
    export const board: string;

    /**
     * 系统的平台名称，例如 "Windows"、"Linux"、"Mac OS" 等。
     */
    export const platform: string;

    /**
     * 软件根目录路径。
     */
    export const root: string;

    /**
     * 软件版本号，例如 "10.0.19041"、"20.04" 等。
     */
    export const version: string;

    /**
     * 内置模块版本号
     */
    export const versions: any;

    /**
     * SpawnOptions 接口定义了创建子进程时的可选配置参数。
     */
    export interface SpawnOptions {
        /**
         * 环境变量，可以是一个键值对对象，其中键是环境变量的名称，值是环境变量的值。
         */
        env?: { [key: string]: any };

        /**
         * 是否分离进程，即是否让子进程在后台运行，不受父进程控制。
         */
        detached?: boolean;

        /**
         * 子进程的工作目录。
         */
        cwd?: string;

        /**
         * 子进程的用户 ID。
         */
        uid?: number;

        /**
         * 子进程的组 ID。
         */
        gid?: number;

        /**
         * 标准输入的处理方式，可以是 'inherit'（继承父进程的标准输入），'pipe'（通过管道连接到子进程的标准输入），或 'ignore'（忽略标准输入）。
         */
        stdin?: string;

        /**
         * 标准错误输出的处理方式，可以是 'inherit'（继承父进程的标准错误输出），'pipe'（通过管道连接到子进程的标准错误输出），或 'ignore'（忽略标准错误输出）。
         */
        stderr?: string;

        /**
         * 标准输出的处理方式，可以是 'inherit'（继承父进程的标准输出），'pipe'（通过管道连接到子进程的标准输出），或 'ignore'（忽略标准输出）。
         */
        stdout?: string;
    }


    /**
     * 定时器
     * 该接口定义了一个定时器对象，它提供了一些方法来管理定时器的引用计数。
     */
    export interface Timer {
        /**
         * 增加定时器的引用计数。
         * 当调用此方法时，定时器将不会被垃圾回收，直到其引用计数降为 0。
         */
        ref(): void;

        /**
         * 减少定时器的引用计数。
         * 当调用此方法时，如果定时器的引用计数已经为 0，则不会有任何效果。
         */
        unref(): void;

        /**
         * 检查定时器是否有引用。
         * @returns 如果定时器有引用，则返回 true，否则返回 false。
         */
        hasRef(): boolean;
    }

    /**
     * 显示一个警告对话框，通常用于向用户显示重要信息
     * @param data 要显示的数据，可以是多个参数
     */
    export function alert(...data: any[]): void;

    /**
     * 清除指定的定时器，停止定时器的执行
     * @param timer 要清除的定时器对象，如果未指定，则清除所有定时器
     */
    export function clearInterval(timer?: Timer): void;

    /**
     * 清除指定的超时定时器，停止超时定时器的执行
     * @param timer 要清除的超时定时器对象，如果未指定，则清除所有超时定时器
     */
    export function clearTimeout(timer?: Timer): void;

    /**
     * 显示一个确认对话框，通常用于询问用户是否执行某个操作
     * @param message 要显示的确认消息，如果未指定，则显示默认消息
     * @returns 用户的选择，true 表示确认，false 表示取消
     */
    export function confirm(message?: string): boolean;

    /**
     * 获取当前工作目录的路径
     * @returns 当前工作目录的路径
     */
    export function cwd(): string;

    /**
     * 获取当前脚本的路径
     * @returns 当前脚本的路径
     */
    export function scriptPath(): string;

    /**
     * 获取当前环境变量的列表
     * @returns 包含当前环境变量的对象
     */
    export function environ(): { [key: string]: string };

    /**
     * 获取当前执行的可执行文件的路径
     * @returns 当前执行的可执行文件的路径
     */
    export function exepath(): string;

    /**
     * 退出当前进程，结束程序的执行
     * @param code 退出代码，默认为 0
     */
    export function exit(code: number): void;

    /**
     * 获取或设置当前进程的退出代码
     * @param code 要设置的退出代码，如果未指定，则返回当前退出代码
     * @returns 当前进程的退出代码
     */
    export function exitCode(code?: number): number;

    /**
     * 获取指定环境变量的值
     * @param name 要获取的环境变量的名称
     * @returns 指定环境变量的值，如果未找到，则返回 undefined
     */
    export function getenv(name: string): string | undefined;

    /**
     * 获取当前时间，以秒和微秒为单位
     * @returns 当前时间，以秒和微秒为单位
     */
    export function gettimeofday(): number;

    /**
     * 获取当前用户的主目录路径
     * @returns 当前用户的主目录路径
     */
    export function homedir(): string;

    /**
     * 获取当前时间的高精度时间戳，以纳秒为单位
     * @returns 当前时间的高精度时间戳，以纳秒为单位
     */
    export function hrtime(): number;

    /**
     * 检查指定的对象是否是一个 TTY（终端设备）
     * @param object 要检查的对象
     * @returns 如果对象是一个 TTY，则返回 true，否则返回 false
     */
    export function isatty(object: any): boolean;

    /**
     * 打开一个日志记录器，用于记录日志信息
     * @param name 日志记录器的名称
     */
    export function openlog(name: string): void;

    /**
     * 打印数据到标准输出设备，通常是控制台
     * @param data 要打印的数据，可以是多个参数
     */
    export function print(...data: any[]): void;


    /**
     * 显示一个提示对话框，通常用于获取用户的输入
     * @param message 要显示的提示消息，如果未指定，则显示默认消息
     * @param _default 默认值，如果用户未输入，则返回默认值
     * @returns 用户输入的内容，如果用户未输入，则返回默认值或 null
     */
    export function prompt(message?: string, _default?: string): string | null;


    /**
     * 生成随机数并填充到指定的缓冲区中
     * @param buffer 要填充的缓冲区
     * @param byteOffset 缓冲区的起始偏移量，默认为 0
     * @param byteLength 要填充的字节长度，默认为缓冲区的长度
     */
    export function random(buffer: ArrayBuffer, byteOffset?: number, byteLength?: number): void;

    /**
     * 设置指定的环境变量的值
     * @param key 要设置的环境变量的名称
     * @param value 要设置的环境变量的值
     */
    export function setenv(key: string, value: string): void;


    /**
     * 重复执行指定的函数，每隔一段时间执行一次
     * @param handler 要执行的函数
     * @param timeout 执行间隔时间，以毫秒为单位，默认为 0
     * @param arguments 传递给函数的参数
     * @returns 返回一个定时器对象，可以用于清除定时器
     */
    export function setInterval(handler: TimerHandler, timeout?: number, ...arguments: any[]): Timer;

    /**
     * 在指定的时间后执行一次函数
     * @param handler 要执行的函数
     * @param timeout 延迟执行的时间，以毫秒为单位，默认为 0
     * @param arguments 传递给函数的参数
     * @returns 返回一个定时器对象，可以用于清除定时器
     */
    export function setTimeout(handler: TimerHandler, timeout?: number, ...arguments: any[]): Timer;


    /**
     * 注册一个信号处理函数，当接收到指定信号时调用
     * @param signal 要处理的信号，如果未指定，则处理所有信号
     * @param handler 信号处理函数，当接收到信号时调用
     */
    export function signal(signal?: number, handler?: (signal: number) => any): void;

    /**
     * Spawns a new process using the given command, with command-line arguments in args. 
     * If omitted, args defaults to an empty array.
     * @param command The command to run.
     * @param options 
     */
    export function spawn(command: string | string[], options?: SpawnOptions): ChildProcess;

    /**
     * 将错误码转换为字符串描述
     * @param errno 错误码
     * @returns 错误码对应的字符串描述
     */
    export function strerror(errno: number): string;

    /**
     * 将数据写入系统日志
     * @param level 日志级别
     * @param data 要写入的数据
     */
    export function syslog(level: number, data: any): void;

    /**
     * 获取系统的临时目录路径
     * @returns 临时目录路径
     */
    export function tmpdir(): string;

    /**
     * 获取系统信息
     * @returns 包含系统名称、版本、发行版本和机器类型的对象
     */
    export function uname(): { sysname: string, release: string, version: string, machine: string };

    /**
     * 从环境中删除指定的环境变量
     * @param name 要删除的环境变量名
     */
    export function unsetenv(name: string): void;

    /**
     * 将数据写入标准输出
     * @param data 要写入的数据
     */
    export function write(...data: any[]): void;

    /**
     * JavaScript 运行时
     */
    export namespace runtime {

        /**
         * 编译成字节码
         * @param data 要编译的源代码
         * @param module 模块名称
         * @returns 编译后的字节码
         */
        export function compile(data: ArrayBuffer, module: string): ArrayBuffer;

        /**
         * 执行指定的字节码
         * @param data 数据缓存区
         * @param offset 数据开始位置
         * @param length 数据长度
         */
        export function evalByteCode(data: ArrayBuffer, offset: number, length: number): any;

        /**
         * 执行脚本字符串
         * @param script 要执行的脚本字符串
         * @returns 脚本执行的结果
         */
        export function evalScript(script: string): any;

        /**
         * 执行脚本文件
         * @param fileanme 要加载的脚本文件名
         * @param flags `true` 表示为模块，`false` 表示为非模块
         * @returns 脚本执行的结果
         */
        export function loadScript(fileanme: string, flags?: boolean): any;

        /**
         * 字节码数据反序列化为对象
         * @param data 数据缓存区
         * @param pos 开始位置
         * @param len 数据长度
         * @param flags 标志位
         * @returns 反序列化后的对象
         */
        export function readObject(data: ArrayBuffer, pos: number, len: number, flags?: number): any;

        // export const JS_WRITE_OBJ_BYTECODE = 1;
        // export const JS_WRITE_OBJ_BSWAP = 2;
        // export const JS_WRITE_OBJ_SAB = 4;
        // export const JS_WRITE_OBJ_REFERENCE = 8;

        /**
         * 对象序列化为二进制数据
         * @param object JavaScript 对象
         * @param flags 标志位
         * @returns 字节码二进制数据
         */
        export function writeObject(object: any, flags?: number): ArrayBuffer;

        /**
         * 执行垃圾回收
         */
        export function gc(): void;
    }

    /** 操作系统信号定义表 */
    export namespace signals {
        const SIGTERM: number;
        const SIGKILL: number;
        const SIGUSR1: number;
    }

    /** libuv 错误码定义表 */
    export namespace errors {
        const UV_ENOENT: number;
        const UV_EACCES: number;
    }

    /**
     * 文件或目录的统计信息
     * 该接口定义了文件或目录的统计信息，包括访问时间、创建时间、块大小、块数、修改时间、设备号、标志、生成号、组ID、索引节点号、模式、大小、链接数、设备类型、类型和用户ID。
     */
    export interface Stats {
        /**
         * 文件的最后访问时间
         */
        atime: number;

        /**
         * 文件的创建时间
         */
        birthtime: number;

        /**
         * 文件系统的块大小
         */
        blksize: number;

        /**
         * 文件占用的块数
         */
        blocks: number;

        /**
         * 文件的最后修改时间
         */
        ctime: number;

        /**
         * 文件所在设备的设备号
         */
        dev: number;

        /**
         * 文件的标志
         */
        flags: number;

        /**
         * 文件的生成号
         */
        gen: number;

        /**
         * 文件的组ID
         */
        gid: number;

        /**
         * 文件的索引节点号
         */
        ino: number;

        /**
         * 文件的模式
         */
        mode: number;

        /**
         * 文件的最后修改时间
         */
        mtime: number;

        /**
         * 文件的硬链接数
         */
        nlink: number;

        /**
         * 文件所在设备的设备类型
         */
        rdev: number;

        /**
         * 文件的大小，以字节为单位
         */
        size: number;

        /**
         * 文件类型: `file`, `directory`, `link`, `fifo`, `socket`, `char`, `block`
         */
        type: string;

        /**
         * 文件的用户ID
         */
        uid: number;
    }


    /**
     * 文件系统操作接口
     * 该接口提供了一系列文件系统操作的方法，包括访问权限检查、修改权限、修改所有者、复制文件、创建目录、创建临时文件、打开文件、读取目录、读取文件、读取链接、获取真实路径、重命名、删除目录、获取文件状态、获取文件系统状态、创建符号链接、删除文件、修改文件时间以及监视文件变化。
     */
    export namespace fs {
        /**
         * 检查文件或目录的访问权限
         * @param path 文件或目录的路径
         * @returns 一个 Promise，当文件或目录存在且具有指定的访问权限时解析
         */
        function access(path: string): Promise<void>;

        /**
         * 修改文件或目录的权限
         * @param path 文件或目录的路径
         * @param mode 新的权限模式
         * @returns 一个 Promise，当权限修改成功时解析
         */
        function chmod(path: string, mode: number): Promise<void>;

        /**
         * 修改文件或目录的所有者
         * @param path 文件或目录的路径
         * @param uid 用户 ID
         * @param gid 组 ID
         * @returns 一个 Promise，当所有者修改成功时解析
         */
        function chown(path: string, uid: number, gid: number): Promise<void>;

        /**
         * 复制文件
         * @param path 源文件的路径
         * @param newPath 目标文件的路径
         * @returns 一个 Promise，当文件复制成功时解析
         */
        function copyFile(path: string, newPath: string): Promise<void>;

        /**
         * 获取文件或目录的状态（不跟踪符号链接）
         * @param path 文件或目录的路径
         * @returns 一个 Promise，当状态获取成功时解析，返回 Stats 对象
         */
        function lstat(path: string): Promise<void>;

        /**
         * 创建目录
         * @param path 目录的路径
         * @returns 一个 Promise，当目录创建成功时解析
         */
        function mkdir(path: string): Promise<void>;

        /**
         * 创建一个临时目录
         * @returns 一个 Promise，当目录创建成功时解析，返回目录的路径
         */
        function mkdtemp(): Promise<string>;

        /**
         * 创建一个临时文件
         * @returns 一个 Promise，当文件创建成功时解析，返回 FileHandle 对象
         */
        function mkstemp(): Promise<FileHandle>;

        /**
         * 打开文件
         * @param path 文件的路径
         * @param flag 打开文件的标志
         * @param mode 文件的权限模式（可选）
         * @returns 一个 Promise，当文件打开成功时解析，返回 FileHandle 对象
         */
        function open(path: string, flag: string, mode?: number): Promise<FileHandle>;

        /**
         * 读取目录
         * @param path 目录的路径
         * @returns 一个 Promise，当目录读取成功时解析，返回 Dir 对象数组
         */
        function opendir(path: string): Promise<Dir[]>;

        /**
         * 读取文件内容
         * @param path 文件的路径
         * @param encoding 文件的编码（可选）
         * @returns 一个 Promise，当文件读取成功时解析，返回文件内容的 ArrayBuffer
         */
        function readFile(path: string, encoding?: string): Promise<ArrayBuffer>;
        function readFile(path: string, encoding: 'utf-8'): Promise<string>;

        /**
         * 读取符号链接的目标路径
         * @param path 符号链接的路径
         * @returns 一个 Promise，当链接读取成功时解析，返回目标路径
         */
        function readlink(path: string): Promise<string>;

        /**
         * 获取文件的真实路径
         * @param path 文件的路径
         * @returns 一个 Promise，当真实路径获取成功时解析，返回真实路径
         */
        function realpath(path: string): Promise<string>;

        /**
         * 重命名文件或目录
         * @param path 文件或目录的当前路径
         * @param newPath 文件或目录的新路径
         * @returns 一个 Promise，当重命名成功时解析
         */
        function rename(path: string, newPath: string): Promise<void>;

        /**
         * 删除目录
         * @param path 目录的路径
         * @returns 一个 Promise，当目录删除成功时解析
         */
        function rmdir(path: string): Promise<void>;

        /**
         * 获取文件或目录的状态
         * @param path 文件或目录的路径
         * @returns 一个 Promise，当状态获取成功时解析，返回 Stats 对象
         */
        function stat(path: string): Promise<Stats>;

        /**
         * 获取文件系统的状态
         * @param path 文件系统的路径
         * @returns 一个 Promise，当状态获取成功时解析
         */
        function statfs(path: string): Promise<void>;

        /**
         * 创建符号链接
         * @param target 符号链接指向的目标路径
         * @param newPath 符号链接的路径
         * @returns 一个 Promise，当符号链接创建成功时解析
         */
        function symlink(target: string, newPath: string): Promise<void>;

        /**
         * 删除文件
         * @param path 文件的路径
         * @returns 一个 Promise，当文件删除成功时解析
         */
        function unlink(path: string): Promise<void>;

        /**
         * 修改文件的访问时间和修改时间
         * @param path 文件的路径
         * @returns 一个 Promise，当时间修改成功时解析
         */
        function utimes(path: string): Promise<void>;

        /**
         * 监视文件或目录的变化
         * @param path 文件或目录的路径
         * @returns 一个 Promise，当监视开始时解析
         */
        function watch(path: string): Promise<void>;
    }

    /** 操作系统 */
    export namespace os {
        /**
         * 获取当前操作系统的平台信息
         * @returns {string} 平台信息，如 "linux", "darwin", "win32" 等
         */
        const platform: string;

        /**
         * 改变当前工作目录
         * @param {string} path - 要切换到的目录路径
         * @returns {void} - 无返回值
         */
        function chdir(path: string): void;

        /**
         * 获取 CPU 信息
         * @returns {any[]} - CPU 信息数组
         */
        function cpuinfo(): any[];

        /**
         * 获取空闲内存大小
         * @returns {number} - 空闲内存大小，单位为字节
         */
        function freemem(): number;

        /**
         * 获取当前进程的有效组 ID
         * @returns {number} - 有效组 ID
         */
        function getegid(): number;

        /**
         * 获取当前进程的有效用户 ID
         * @returns {number} - 有效用户 ID
         */
        function geteuid(): number;

        /**
         * 获取当前进程的实际组 ID
         * @returns {number} - 实际组 ID
         */
        function getgid(): number;

        /**
         * 获取当前进程的实际用户 ID
         * @returns {number} - 实际用户 ID
         */
        function getuid(): number;

        /**
         * 获取主机名
         * @returns {string} - 主机名
         */
        function hostname(): string;

        /**
         * 获取网络接口信息
         * @returns {any[]} - 网络接口信息数组
         */
        function interfaces(): any[];

        /**
         * 向指定进程发送信号
         * @param {number} pid - 进程 ID
         * @param {number} signal - 信号编号，可选
         * @returns {Promise<void>} - 当信号发送成功时解析
         */
        function kill(pid: number, signal?: number): Promise<void>;

        /**
         * 获取平均负载
         * @returns {number[]} - 平均负载数组
         */
        function loadavg(): number[];

        /**
         * 获取当前进程 ID
         * @returns {number} - 当前进程 ID
         */
        function pid(): number;

        /**
         * 获取父进程 ID
         * @returns {number} - 父进程 ID
         */
        function ppid(): number;

        /**
         * 打印当前进程的句柄信息
         * @returns {void} - 无返回值
         */
        function printHandles(): void;

        /**
         * 打印当前进程的内存使用情况
         * @returns {void} - 无返回值
         */
        function printMemoryUsage(): void;

        /**
         * 设置或获取进程标题
         * @param {string} title - 要设置的进程标题，可选
         * @returns {string} - 当前进程标题
         */
        function processTitle(title?: string): string;

        /**
         * 重启系统
         * @returns {void} - 无返回值
         */
        function reboot(): void;

        /**
         * 获取当前进程的 RSS 内存使用量
         * @returns {number} - RSS 内存使用量，单位为字节
         */
        function rssmem(): number;

        /**
         * 设置当前进程的有效组 ID
         * @param {number} gid - 要设置的有效组 ID
         * @returns {number} - 新的有效组 ID
         */
        function setegid(gid: number): number;

        /**
         * 设置当前进程的有效用户 ID
         * @param {number} uid - 要设置的有效用户 ID
         * @returns {number} - 新的有效用户 ID
         */
        function seteuid(uid: number): number;

        /**
         * 设置当前进程的实际组 ID
         * @param {number} gid - 要设置的实际组 ID
         * @returns {number} - 新的实际组 ID
         */
        function setgid(gid: number): number;

        /**
         * 设置当前进程的实际用户 ID
         * @param {number} uid - 要设置的实际用户 ID
         * @returns {number} - 新的实际用户 ID
         */
        function setuid(uid: number): number;

        /**
         * 使当前进程睡眠指定的毫秒数
         * @param {number} delay - 要睡眠的毫秒数
         * @returns {void} - 无返回值
         */
        function sleep(delay: number): void;

        /**
         * 获取总内存大小
         * @returns {number} - 总内存大小，单位为字节
         */
        function totalmem(): number;

        /**
         * 获取系统运行时间
         * @returns {number} - 系统运行时间，单位为秒
         */
        function uptime(): number;
    }

    /**
     * 实用工具函数集合
     * 该命名空间提供了一些常用的工具函数，如应用程序管理、模块管理、资源获取、编码转换和哈希计算等
     */
    export namespace util {
        /**
         * 十六进制编码格式
         */
        const CODE_HEX: number;

        /**
         * Base64 编码格式
         */
        const CODE_BASE64: number;

        /**
         * MD5 哈希算法
         */
        const HASH_MD5: number;

        /**
         * SHA1 哈希算法
         */
        const HASH_SHA1: number;

        /**
         * 获取所有内置模块的名称列表
         * @returns {string[]} 模块名称列表
         */
        function modules(): string[];

        /**
         * 获取指定文件名的资源内容
         * @param {string} filename - 资源文件名
         * @returns {ArrayBuffer} 资源内容的 ArrayBuffer
         */
        function asset(filename: string): ArrayBuffer;

        /**
         * 对数据进行编码
         * @param {BufferSource} data - 要编码的数据
         * @param {number} format - 编码格式，可选
         * @returns {string} 编码后的数据字符串
         */
        function encode(data: BufferSource, format?: number): string;

        /**
         * 对数据进行解码
         * @param {string} data - 要解码的数据字符串
         * @param {number} format - 解码格式，可选
         * @returns {Uint8Array} 解码后的数据 Uint8Array
         */
        function decode(data: string, format?: number): Uint8Array;

        /**
         * 计算数据的哈希值
         * @param {BufferSource} data - 要计算哈希值的数据
         * @param {number} format - 哈希算法格式，可选
         * @returns {Uint8Array} 计算得到的哈希值 Uint8Array
         */
        function hash(data: BufferSource, format?: number): Uint8Array;
    }


    /**
     * UTF-8 编码转换工具
     * 该命名空间提供了 UTF-8 编码和其他编码之间相互转换的方法
     */
    export namespace utf8 {
        /**
         * 将 BufferSource 转换为 UTF-8 编码的字符串
         * @param data - 要转换的数据，可以是 ArrayBuffer、TypedArray 或 DataView
         * @returns 转换后的 UTF-8 字符串
         */
        function decode(data: BufferSource): string;

        /**
         * 将 UTF-8 编码的字符串转换为 Uint8Array
         * @param data - 要转换的 UTF-8 字符串
         * @returns 转换后的 Uint8Array
         */
        function encode(data: string): Uint8Array;
    }

    /**
     * 域名解析
     * 该命名空间提供了域名解析的相关方法和选项
     */
    export namespace dns {
        /**
         * AI_ADDRCONFIG 常量
         * 用于指定地址配置信息
         */
        const AI_ADDRCONFIG: number;

        /**
         * AI_V4MAPPED 常量
         * 用于指定 IPv4 映射的 IPv6 地址
         */
        const AI_V4MAPPED: number;

        /**
         * GetaddrinfoOptions 接口
         * 定义了 getaddrinfo 函数的选项参数
         */
        interface GetaddrinfoOptions {
            /**
             * 地址族，可选值：PF_INET:2, PF_INET6: 10
             */
            family?: number;

            /**
             * 标志位，可选
             */
            flags?: number;

            /**
             * 协议类型，可选值：IPPROTO_TCP:6, IPPROTO_UDP:17
             */
            protocol?: number;

            /**
             * 服务类型，可选
             */
            service?: string;

            /**
             * 套接字类型，可选值：SOCK_STREAM:1, SOCK_DGRAM:2, SOCK_RAW:3
             */
            socktype?: number;
        }

        /**
         * AddressInfo 接口
         * 定义了地址信息的结构
         */
        interface AddressInfo {
            /**
             * 地址对象
             */
            address: {
                /**
                 * 地址族，可选
                 */
                family?: number;

                /**
                 * IP 地址，可选
                 */
                ip?: number;

                /**
                 * 地址，可选
                 */
                address?: number;

                /**
                 * 端口号，可选
                 */
                port?: number;
            }
        }

        /**
         * getaddrinfo 函数
         * 异步地将一个域名解析为一组地址信息
         * @param node - 要解析的域名或 IP 地址
         * @param options - 解析选项
         * @returns 解析后的地址信息数组
         */
        function getaddrinfo(node: string, options: GetaddrinfoOptions): Promise<AddressInfo[]>;
    }

    /**
     * 硬件抽象层
     * 该命名空间提供了对硬件设备的抽象和操作接口
     */
    export namespace hal {
        /**
         * 获取父进程 ID
         * @returns {Promise<void>} 当获取成功时解析
         */
        function ppid(): Promise<void>;

        /**
         * GPIO 类
         * 该类提供了对 GPIO 引脚的操作接口
         */
        class GPIO {
            /**
             * 构造函数
             * @param name - GPIO 引脚的名称
             */
            constructor(name: string)

            /**
             * 轮询事件处理函数
             * 当 GPIO 引脚状态发生变化时调用
             */
            onpoll?(): void;

            /**
             * 关闭 GPIO 引脚
             * @returns {Promise<void>} 当关闭成功时解析
             */
            close(): Promise<void>;

            /**
             * 读取 GPIO 引脚的当前值
             * @returns {Promise<number>} 读取成功时返回引脚值
             */
            read(): Promise<number>;

            /**
             * 向 GPIO 引脚写入值
             * @param value - 要写入的值，可选
             * @returns {Promise<void>} 当写入成功时解析
             */
            write(value?: string): Promise<void>;
        }
    }

    /**
     * 硬件看门狗
     * 该命名空间提供了对硬件看门狗的操作接口，包括打开、关闭、使能、喂狗、重置和设置超时时间等功能
     */
    export namespace watchdog {
        /**
         * 关闭看门狗
         * @param fileno - 看门狗文件描述符
         * @returns {void} 无返回值
         */
        function close(fileno: number): void;

        /**
         * 使能或禁用看门狗
         * @param fileno - 看门狗文件描述符
         * @param enable - 是否使能看门狗，可选，默认为 true
         * @returns {boolean} 返回操作结果，true 表示操作成功，false 表示操作失败
         */
        function enable(fileno: number, enable?: boolean): boolean;

        /**
         * 喂狗操作
         * @param fileno - 看门狗文件描述符
         * @returns {void} 无返回值
         */
        function keepalive(fileno: number): void;

        /**
         * 打开看门狗设备
         * @param filename - 看门狗设备文件名
         * @returns {number} 返回文件描述符
         */
        function open(filename: string): number;

        /**
         * 重置看门狗
         * @param fileno - 看门狗文件描述符
         * @returns {void} 无返回值
         */
        function reset(fileno: number): void;

        /**
         * 设置或获取看门狗超时时间
         * @param fileno - 看门狗文件描述符
         * @param timeout - 超时时间，可选，单位为毫秒
         * @returns {number} 返回设置或获取的超时时间
         */
        function timeout(fileno: number, timeout?: number): number;
    }

    /**
     * ADC
     * 该命名空间提供了对模数转换器的操作接口，包括打开、关闭和读取值等功能
     */
    export namespace adc {
        /**
         * 打开 ADC 设备
         * @param filename - ADC 设备文件名
         * @returns {number} 返回文件描述符
         */
        function open(filename: string): number;

        /**
         * 关闭 ADC 设备
         * @param fileno - ADC 设备文件描述符
         * @returns {void} 无返回值
         */
        function close(fileno: number): void;

        /**
         * 读取 ADC 值
         * @param fileno - ADC 设备文件描述符
         * @returns {number} 返回读取的 ADC 值
         */
        function read(fileno: number): number;
    }

    /**
     * GPIO
     * 该命名空间提供了对 GPIO 引脚的操作接口，包括获取值、设置输入模式和设置输出模式及值等功能
     */
    export namespace gpio {
        /**
         * 获取 GPIO 引脚的值
         * @param name - GPIO 引脚名称
         * @returns {number} 返回 GPIO 引脚的值
         */
        function value(name: string): number;

        /**
         * 将 GPIO 引脚设置为输入模式
         * @param name - GPIO 引脚名称
         * @returns {number} 返回操作结果，0 表示成功，-1 表示失败
         */
        function input(name: string): number;

        /**
         * 将 GPIO 引脚设置为输出模式并设置值
         * @param name - GPIO 引脚名称
         * @param value - 要设置的值，0 或 1
         * @returns {number} 返回操作结果，0 表示成功，-1 表示失败
         */
        function output(name: string, value: number): number;
    }

    /** HTTP 协议 */
    export namespace http {
        /**
         * 支持的 HTTP 方法列表
         */
        const methods: string[];

        /**
         * 响应类型常量
         */
        const RESPONSE: number;

        /**
         * 请求类型常量
         */
        const REQUEST: number;

        /**
         * 获取父进程 ID
         * @returns {Promise<void>} 当获取成功时解析
         */
        function ppid(): Promise<void>;

        /**
         * HTTP 消息接口
         */
        interface Message {
            /**
             * HTTP 方法，可选
             */
            method?: number;

            /**
             * HTTP 状态码，可选
             */
            status?: number;

            /**
             * HTTP 状态文本，可选
             */
            statusText?: string;

            /**
             * 请求 URL，可选
             */
            url?: string;

            /**
             * HTTP 主版本号
             */
            httpMajor: number;

            /**
             * HTTP 次版本号
             */
            httpMinor: number;

            /**
             * HTTP 头部字段列表
             */
            headers: [string, string][];
        }

        /**
         * HTTP 消息解析器
         */
        class Parser {
            /**
             * 构造函数
             * @param type - 消息类型，可选
             */
            constructor(type?: number);

            /**
             * 初始化解析器
             * @param type - 消息类型
             */
            init(type: number): void;

            /**
             * 执行解析
             * @param data - 要解析的数据，可以是字符串、ArrayBuffer 或 Uint8Array
             */
            execute(data: string | ArrayBuffer | Uint8Array): void;

            /**
             * 当接收到消息体时调用
             * @param data - 消息体数据
             */
            onbody?(data: ArrayBuffer): void;

            /**
             * 当接收到完整的头部信息时调用
             * @param info - 头部信息
             */
            onheaderscomplete?(info: Message): void;

            /**
             * 当接收到完整的消息时调用
             */
            onmessagecomplete?(): void;

            /**
             * 当消息开始时调用
             */
            onmessagebegin?(): void;

            /**
             * 当接收到状态行时调用
             */
            onstatus?(): void;

            /**
             * 当接收到 URL 时调用
             * @param url - URL 字符串
             */
            onurl?(url: string): void;

            /**
             * 当接收到头部字段名时调用
             * @param name - 头部字段名
             */
            onheaderfield?(name: string): void;

            /**
             * 当接收到头部字段值时调用
             * @param value - 头部字段值
             */
            onheadervalue?(value: string): void;
        }
    }


    /**
     * 加密
     * 该命名空间提供了加密相关的操作接口，包括摘要算法、文件哈希和 HMAC 算法等
     */
    export namespace crypto {
        /**
         * MD5 摘要算法常量
         */
        const MD_MD5: number;

        /**
         * SHA1 摘要算法常量
         */
        const MD_SHA1: number;

        /**
         * SHA256 摘要算法常量
         */
        const MD_SHA256: number;

        /**
         * SHA512 摘要算法常量
         */
        const MD_SHA512: number;

        /**
         * 数据类型，可以是字符串或 ArrayBuffer
         */
        type Data = string | ArrayBuffer;

        /**
         * 摘要算法类型，可以是数字或字符串表示的算法名
         */
        type DigestAlgorithm = number | "MD5" | "SHA1" | "SHA256" | "SHA512";

        /**
         * 计算数据的摘要值
         * @param algorithm - 摘要算法类型
         * @param data - 要计算摘要的数据
         * @returns {ArrayBuffer} 返回计算得到的摘要值
         */
        function digest(algorithm: DigestAlgorithm, data: Data): ArrayBuffer;

        /**
         * 计算文件的哈希值
         * @param algorithm - 摘要算法类型
         * @param filename - 要计算哈希值的文件名
         * @returns {ArrayBuffer} 返回计算得到的哈希值
         */
        function hashfile(algorithm: DigestAlgorithm, filename: string): ArrayBuffer;

        /**
         * 计算 HMAC 值
         * @param algorithm - 摘要算法类型
         * @param data - 要计算 HMAC 的数据
         * @param secret - HMAC 密钥
         * @returns {ArrayBuffer} 返回计算得到的 HMAC 值
         */
        function hmac(algorithm: DigestAlgorithm, data: Data, secret: Data): ArrayBuffer;
    }

    /** MQTT 协议 */
    export namespace mqtt {
        /** CONNACK 消息类型 */
        const CONNACK: number;
        /** CONNECT 消息类型 */
        const CONNECT: number;
        /** DISCONNECT 消息类型 */
        const DISCONNECT: number;
        /** PINGREQ 消息类型 */
        const PINGREQ: number;
        /** PINGRESP 消息类型 */
        const PINGRESP: number;
        /** PUBACK 消息类型 */
        const PUBACK: number;
        /** PUBCOMP 消息类型 */
        const PUBCOMP: number;
        /** PUBLISH 消息类型 */
        const PUBLISH: number;
        /** PUBREC 消息类型 */
        const PUBREC: number;
        /** PUBREL 消息类型 */
        const PUBREL: number;
        /** SUBACK 消息类型 */
        const SUBACK: number;
        /** SUBSCRIBE 消息类型 */
        const SUBSCRIBE: number;
        /** UNSUBACK 消息类型 */
        const UNSUBACK: number;
        /** UNSUBSCRIBE 消息类型 */
        const UNSUBSCRIBE: number;

        /**
         * MQTT 消息接口
         */
        interface MQTTMessage {
            /** 消息类型 */
            type: number;
            /** 消息长度 */
            length: number;
        }

        /**
         * 连接选项接口
         */
        interface ConnectOptions {
            /** 用户名，可选 */
            username?: string;
            /** 密码，可选 */
            password?: string;
            /** 客户端 ID，可选 */
            clientId?: string;
            /** 保活时间，可选 */
            keepalive?: number;
            /** 是否清除会话，可选 */
            clean?: boolean;
        }

        /**
         * 编码连接消息
         * @param options - 连接选项
         * @returns {ArrayBuffer} 返回编码后的连接消息
         */
        function encodeConnect(options: ConnectOptions): ArrayBuffer;

        /**
         * 编码断开连接消息
         * @returns {ArrayBuffer} 返回编码后的断开连接消息
         */
        function encodeDisconnect(): ArrayBuffer;

        /**
         * 编码 Ping 请求消息
         * @returns {ArrayBuffer} 返回编码后的 Ping 请求消息
         */
        function encodePing(): ArrayBuffer;

        /**
         * 编码发布消息
         * @param topic - 主题
         * @param payload - 负载
         * @param dup - 重复标志
         * @param qos - 服务质量
         * @param retained - 保留标志
         * @param pid - 消息 ID
         * @returns {ArrayBuffer} 返回编码后的发布消息
         */
        function encodePublish(topic: string, payload: any, dup: number, qos: number, retained: number, pid: number): ArrayBuffer;

        /**
         * 编码订阅消息
         * @param topic - 主题
         * @param dup - 重复标志
         * @param pid - 消息 ID
         * @returns {ArrayBuffer} 返回编码后的订阅消息
         */
        function encodeSubscribe(topic: string, dup: number, pid: number): ArrayBuffer;

        /**
         * 编码取消订阅消息
         * @param topic - 主题
         * @param dup - 重复标志
         * @param pid - 消息 ID
         * @returns {ArrayBuffer} 返回编码后的取消订阅消息
         */
        function encodeUnsubscribe(topic: string, dup: number, pid: number): ArrayBuffer;

        /**
         * MQTT 协议数据格式解析器
         * 
         * 对原始数据流进行解析，解析后得到相应的 MQTT 消息对象
         */
        class Parser {
            /**
             * 内部缓存区容量
             */
            capacity(): number;

            /**
             * 对缓存区的数据进行压缩
             */
            compact(): void;

            /** 
             * 执行数据解析 
             * @param message 从网络层收到的数据
             */
            execute(message: ArrayBuffer): void;

            /**
             * 返回数据偏移位置
             */
            offset(): number;

            /**
             * 重置内部缓存区
             */
            reset(): void;

            /**
             * 处理解析后的消息
             * @param message MQTT 消息
             */
            onmessage?(message: MQTTMessage): void;
        }
    }

    /** 串口 */
    export namespace uart {
        /**
         * UART 类，用于串口通信
         */
        class UART {
            /**
             * 构造函数
             * @param fd - 文件描述符
             */
            constructor(fd: number);

            /**
             * 关闭串口
             */
            close(): void;

            /**
             * 从串口读取数据
             * @returns {ArrayBuffer} 返回读取的数据
             */
            read(): ArrayBuffer;

            /**
             * 向串口写入数据
             * @param data - 要写入的数据
             */
            write(data: any): void;

            /**
             * 当串口关闭时调用的回调函数
             */
            onclose?(): void;

            /**
             * 当串口断开连接时调用的回调函数
             */
            ondisconnect?(): void;

            /**
             * 当接收到串口数据时调用的回调函数
             * @param data - 接收到的数据
             */
            onmessage?(data: ArrayBuffer): void;

            /**
             * 文件描述符，可选
             */
            fd?: number;
        }

        /**
         * 无校验位常量
         */
        const PARITY_NONE: number;

        /**
         * 奇校验位常量
         */
        const PARITY_ODD: number;

        /**
         * 偶校验位常量
         */
        const PARITY_EVEN: number;

        /**
         * 打开串口设备
         * @param device - 串口设备文件名
         * @param baudRate - 波特率
         * @param parityType - 校验类型，可选
         * @param dataBits - 数据位数，可选
         * @param stopBits - 停止位数，可选
         * @returns {number} 返回文件描述符
         */
        function open(device: string, baudRate: number, parityType?: number, dataBits?: number, stopBits?: number): number;

        /**
         * 设置串口控制信号
         * @param fd - 文件描述符
         * @param mask - 信号掩码
         * @param signals - 要设置的信号，可选
         */
        export function setSignals(fd: number, mask: number, signals?: number): void

        /**
         * 获取串口控制信号状态
         * @param fd - 文件描述符
         * @returns {Promise<number>} 返回信号状态
         */
        export function getSignals(fd: number): number
    }


    /**
     * 定义一个错误类，用于处理错误信息
     */
    export class Error {
        /**
         * 构造函数，用于创建一个错误对象
         * @param errno 错误号
         */
        constructor(errno: number);

        /**
         * 错误代码，通常是一个字符串，用于标识错误类型
         */
        code: string;

        /**
         * 错误号，通常是一个数字，用于标识错误类型
         */
        errno: number;

        /**
         * 错误消息，通常是一个字符串，用于描述错误的具体信息
         */
        message: string;

        /**
         * 错误名称，通常是一个字符串，用于标识错误的类型
         */
        name: string;
    }

    /**
     * 流
     * 这个类提供了对流数据的基本操作，如关闭流、获取文件描述符、引用计数管理以及数据写入。
     * 它还支持错误处理和消息接收的回调函数。
     */
    export class Stream {
        /**
         * 关闭流
         * 这个方法用于关闭当前的流，释放相关资源。
         */
        close(): void;

        /**
         * 获取文件描述符
         * 这个方法返回当前流的文件描述符，用于底层的I/O操作。
         * @returns {number} 文件描述符
         */
        fileno(): number;

        /**
         * 检查是否有引用
         * 这个方法检查当前流是否有引用。
         * @returns {number} 如果有引用，返回1，否则返回0。
         */
        hasRef(): number;

        /**
         * 增加引用计数
         * 这个方法增加当前流的引用计数。
         */
        ref(): void;

        /**
         * 减少引用计数
         * 这个方法减少当前流的引用计数。
         */
        unref(): void;

        /**
         * 写入数据
         * 这个方法将数据写入到流中。
         * @param data 要写入的数据，可以是字符串、ArrayBuffer或ArrayBufferView。
         * @returns {Promise<void>} 当数据写入完成时解决的Promise。
         */
        write(data: string | ArrayBuffer | ArrayBufferView): Promise<void>;

        /**
         * 错误处理回调
         * 当流发生错误时调用的回调函数。
         * @param err 错误对象。
         */
        onerror?(err: Error): void;

        /**
         * 消息接收回调
         * 当流接收到消息时调用的回调函数。
         * @param message 接收到的消息，类型为ArrayBuffer。
         */
        onmessage?(message: any): void;
    }


    /**
     * Socket 类，继承自 Stream 类，用于处理网络套接字通信
     */
    export class Socket extends Stream {
        /**
         * 获取本地地址信息
         * @returns {SocketAddress} 返回本地地址信息
         */
        address(): SocketAddress;

        /**
         * 获取当前缓冲的数据量
         * @returns {number} 返回当前缓冲的数据量
         */
        bufferedAmount(): number;

        /**
         * 获取远程地址信息
         * @returns {SocketAddress} 返回远程地址信息
         */
        remoteAddress(): SocketAddress;

        /**
         * 绑定套接字到指定地址和端口
         * @param address - 要绑定的地址和端口
         * @param flags - 可选参数，绑定标志
         */
        bind(address: SocketAddress, flags?: number): void;

        /**
         * 连接到远程地址
         * @param address - 要连接的远程地址和端口
         * @returns {Promise<void>} 当连接完成时解决的 Promise
         */
        connect(address: SocketAddress): Promise<void>;

        /**
         * 监听套接字，准备接受连接
         * @param backlog - 可选参数，监听队列的最大长度
         */
        listen(backlog?: number): void;

        /**
         * 暂停套接字的读取操作
         * @returns {number} 返回暂停状态
         */
        pause(): number;

        /**
         * 恢复套接字的读取操作
         * @returns {number} 返回恢复状态
         */
        resume(): number;

        /**
         * 关闭套接字连接
         * @returns {Promise<void>} 当关闭完成时解决的 Promise
         */
        shutdown(): Promise<void>;

        /**
         * 设置套接字的 keep-alive 选项
         * @param keepAlive - 是否启用 keep-alive
         * @param timeout - keep-alive 超时时间
         */
        setKeepAlive(keepAlive: boolean, timeout: number): void;

        /**
         * 设置套接字的 Nagle 算法选项
         * @param noDelay - 是否禁用 Nagle 算法
         */
        setNoDelay(noDelay: boolean): void;

        /**
         * 当套接字关闭时调用的回调函数
         */
        onclose?(): void;

        /**
         * 当套接字连接建立时调用的回调函数
         * @param status - 连接状态
         */
        onconnect?(status?: number): void;

        /**
         * 当套接字打开时调用的回调函数
         * @param status - 打开状态
         */
        onopen?(status?: { result?: number, error?: string }): void;
    }

    /**
     * TLS 类，继承自 Socket 类，用于处理安全传输层协议通信
     */
    export class TLS extends Socket {
        /**
         * 构造函数，用于创建一个 TLS 套接字
         * @param options - 可选参数，用于配置 TLS 套接字
         */
        constructor(options?: any);

        /**
         * 接受一个传入的连接
         * @returns {TCP} 返回接受的 TCP 连接
         */
        accept(): TCP;

        /**
         * 当有新的连接建立时调用的回调函数
         * @param connection - 新建立的 TLS 连接
         */
        onconnection?(connection: TLS): void;
    }

    /**
     * TCP 类，继承自 Socket 类，用于处理传输控制协议通信
     */
    export class TCP extends Socket {
        /**
         * 获取 TCP 连接的唯一标识符
         * @returns {number} 返回连接的唯一标识符
         */
        id(): number;

        /**
         * 接受一个传入的连接
         * @returns {TCP} 返回接受的 TCP 连接
         */
        accept(): TCP;

        /**
         * 设置调试模式
         * @param debug - 是否启用调试模式
         */
        setDebug(debug: boolean): void;

        /**
         * 当有新的连接建立时调用的回调函数
         * @param connection - 新建立的 TCP 连接
         */
        onconnection?(connection: TCP): void;
    }

    /**
     * Pipe 类，继承自 Stream 类，用于处理管道通信
     */
    export class Pipe extends Stream {
        /**
         * 获取本地地址信息
         * @returns {string} 返回本地地址信息
         */
        address(): string;

        /**
         * 获取当前缓冲的数据量
         * @returns {number} 返回当前缓冲的数据量
         */
        bufferedAmount(): number;

        /**
         * 获取管道的唯一标识符
         * @returns {number} 返回管道的唯一标识符
         */
        id(): number;

        /**
         * 获取远程地址信息
         * @returns {string} 返回远程地址信息
         */
        remoteAddress(): string;

        /**
         * 接受一个传入的连接
         * @returns {Pipe} 返回接受的 Pipe 连接
         */
        accept(): Pipe;

        /**
         * 绑定管道到指定地址
         * @param address - 要绑定的地址
         */
        bind(address: string): void;

        /**
         * 连接到远程地址
         * @param address - 要连接的远程地址
         * @returns {Promise<void>} 当连接完成时解决的 Promise
         */
        connect(address: string): Promise<void>;

        /**
         * 监听管道，准备接受连接
         * @param backlog - 可选参数，监听队列的最大长度
         */
        listen(backlog?: number): void;

        /**
         * 打开一个文件描述符并将其关联到管道
         * @param fd - 要打开的文件描述符
         */
        open(fd: number): void;

        /**
         * 关闭管道连接
         * @returns {Promise<void>} 当关闭完成时解决的 Promise
         */
        shutdown(): Promise<void>;

        /**
         * 设置调试模式
         * @param debug - 是否启用调试模式
         */
        setDebug(debug: boolean): void;

        /**
         * 当管道关闭时调用的回调函数
         */
        onclose?(): void;

        /**
         * 当管道连接建立时调用的回调函数
         */
        onconnect?(): void;

        /**
         * 当有新的连接建立时调用的回调函数
         * @param connection - 新建立的 Pipe 连接
         */
        onconnection?(connection: Pipe): void;

        /**
         * 当发生错误时调用的回调函数
         * @param err - 错误对象
         */
        onerror?(err: Error): void;

        /**
         * 当接收到消息时调用的回调函数
         * @param message - 接收到的消息，类型为 ArrayBuffer
         */
        onmessage?(message: ArrayBuffer): void;
    }


    export class TTY extends Stream {
        /** Initial/normal terminal mode */
        static MODE_NORMAL: number;

        /** Raw input mode (On Windows, ENABLE_WINDOW_INPUT is also enabled) */
        static MODE_RAW: number;

        /** Binary-safe I/O mode for IPC (Unix-only) */
        static MODE_IO: number;

        /** 以给定的文件描述符初始化一个新的 TTY 流 */
        constructor(fd: number);

        /** 使用指定的终端模式设置 TTY */
        setMode(mode: number): void;

        /** 获取当前的窗口大小 */
        getWinSize(): { width: number, height: number };
    }
    /**
     * 定义了一些常量，用于配置 UDP 套接字的行为
     */
    const IPV6ONLY: number;
    const PARTIAL: number;
    const REUSEADDR: number;

    /**
     * 表示一个套接字地址，包含地址和端口信息
     */
    export interface SocketAddress {
        address?: string;
        port?: number;
    }

    /**
     * 表示一个 UDP 消息，包含数据和发送者的地址信息
     */
    export interface UDPMessage {
        data?: ArrayBuffer;
        address?: SocketAddress;
    }

    /**
     * UDP 类，继承自 Stream 类，用于处理用户数据报协议通信
     */
    export class UDP extends Stream {
        /**
         * 获取本地地址信息
         * @returns {SocketAddress} 返回本地地址信息
         */
        address(): SocketAddress;

        /**
         * 绑定套接字到指定地址和端口
         * @param address - 要绑定的地址和端口
         * @param flags - 可选参数，绑定标志
         */
        bind(address: SocketAddress, flags?: number): void;

        /**
         * 关闭套接字连接
         */
        close(): void;

        /**
         * 连接到远程地址
         * @param address - 要连接的远程地址和端口
         */
        connect(address: SocketAddress): void;

        /**
         * 断开与远程地址的连接
         */
        disconnect(): void;

        /**
         * 获取文件描述符
         * @returns {number} 返回文件描述符
         */
        fileno(): number;

        /**
         * 检查是否有引用
         * @returns {number} 如果有引用，返回1，否则返回0。
         */
        hasRef(): number;

        /**
         * 接收 UDP 消息
         * @returns {Promise<UDPMessage>} 当接收到消息时解决的 Promise
         */
        recv(): Promise<UDPMessage>;

        /**
         * 增加引用计数
         */
        ref(): void;

        /**
         * 获取远程地址信息
         * @returns {SocketAddress} 返回远程地址信息
         */
        remoteAddress(): SocketAddress;

        /**
         * 设置套接字的广播选项
         * @param broadcast - 是否启用广播
         */
        setBroadcast(broadcast: boolean): void;

        /**
         * 设置套接字的 TTL（Time To Live）值
         * @param ttl - TTL 值
         * @returns {number} 返回设置的 TTL 值
         */
        setTTL(ttl: number): number;

        /**
         * 发送数据到指定的套接字地址
         * @param data - 要发送的数据，可以是字符串、ArrayBuffer 或 ArrayBufferView
         * @param socket - 目标套接字地址
         * @returns {Promise<void>} 当数据发送完成时解决的 Promise
         */
        send(data: string | ArrayBuffer | ArrayBufferView, socket: SocketAddress): Promise<void>;

        /**
         * 减少引用计数
         */
        unref(): void;

        /**
         * 当接收到消息时调用的回调函数
         * @param data - 接收到的消息，类型为 UDPMessage
         */
        onmessage?(data: UDPMessage): void;

        /**
         * 当发生错误时调用的回调函数
         * @param error - 错误对象
         */
        onerror?(error?: Error): void;

        /**
         * 当套接字关闭时调用的回调函数
         */
        onclose?(): void;
    }


    /**
     * 工作线程
     */
    export class Worker {
        /**
         * 构造函数，用于创建一个新的 Worker 实例
         * @param filename - 工作线程的文件名
         */
        constructor(filename: string);

        /**
         * 向工作线程发送消息
         * @param args - 要发送的消息参数
         */
        postMessage(args: any[]): void;

        /**
         * 终止工作线程
         */
        terminate(): void;

        /**
         * 当工作线程接收到消息时调用的回调函数
         * @param message - 接收到的消息
         */
        onmessage(message: any): void;

        /**
         * 当工作线程接收到消息时发生错误调用的回调函数
         */
        onmessageerror(): void;

        /**
         * 当工作线程发生错误时调用的回调函数
         * @param error - 错误对象
         */
        onerror(error?: any): void;
    }


    /**
     * 串口设备
     */
    export namespace serial {
        const PARITY_NONE: number;
        const PARITY_ODD: number;
        const PARITY_EVEN: number;

        /**
         * 打开指定的串口设备
         * @param device 设备名称
         * @param baudRate 波特率
         * @param parity 校验方式
         * @param dataBits 数据位
         * @param stopBits 停止位
         */
        function open(device: string, baudRate?: number, parity?: number, dataBits?: number, stopBits?: number): number;

        class UART {
            constructor(fd: number);

            /** 关闭这个串口数据 */
            close(): void;

            /** 从串口设备读取数据 */
            read(): Promise<ArrayBuffer>;

            /** 写数据到串口设备 */
            write(data: ArrayBuffer): Promise<void>;

            /** 设备关闭时调用这个方法 */
            onclose?(): void;

            /** 收到串口数据时调用这个方法 */
            onmessage?(message: string): void;
        }
    }

    /**
     * 文件压缩和解压缩
     */
    export namespace zlib {
        /**
         * Reader 类，用于读取 zip 文件
         */
        class Reader {
            /**
             * 打开指定的 zip 文件
             * @param filename - zip 文件的路径
             * @returns {number} 返回文件描述符
             */
            open(filename: string): number;

            /**
             * 关闭这个 reader
             */
            close(): void;

            /**
             * 包含的文件数
             * @returns {number} 返回文件数量
             */
            count(): number;

            /**
             * 返回指定的文件的统计信息
             * @param index - 文件索引
             * @returns {any} 返回文件统计信息
             */
            stat(index: number): any;

            /**
             * 解压指定的文件
             * @param index - 文件索引
             * @param outfile - 可选参数，输出文件路径
             * @returns {ArrayBuffer} 返回解压后的数据
             */
            extract(index: number, outfile?: string): ArrayBuffer;

            /**
             * 解压指定的文件
             * @param filename - 文件名称
             * @param outfile - 可选参数，输出文件路径
             * @returns {ArrayBuffer} 返回解压后的数据
             */
            extract(filename: string, outfile?: string): ArrayBuffer;
        }

        /**
         * 添加指定的文件到 zip 文件中
         * @param zipname - zip 文件的路径
         * @param filename - 要添加的文件路径
         * @param data - 要添加的文件数据
         * @returns {ArrayBuffer} 返回添加后的 zip 文件数据
         */
        function add(zipname: string, filename: string, data: BufferSource): ArrayBuffer;

        /**
         * 解压指定的文件
         * @param zipname - zip 文件的路径
         * @param filename - 要解压的文件路径
         * @returns {ArrayBuffer} 返回解压后的数据
         */
        function extract(zipname: string, filename: string): ArrayBuffer;

        /**
         * 数据压缩
         * @param data - 要压缩的数据
         * @returns {ArrayBuffer} 返回压缩后的数据
         */
        function compress(data: BufferSource): ArrayBuffer;

        /**
         * 数据解压
         * @param data - 要解压的数据
         * @param uncompressedSize - 解压后的数据大小
         * @returns {ArrayBuffer} 返回解压后的数据
         */
        function uncompress(data: BufferSource, uncompressedSize: number): ArrayBuffer;

        /**
         * 对 gzip 压缩的数据进行解压
         * @param data - 要解压的数据
         * @param uncompressedSize - 解压后的数据大小
         * @returns {ArrayBuffer} 返回解压后的数据
         */
        function ungzip(data: BufferSource, uncompressedSize: number): ArrayBuffer;
    }

}
