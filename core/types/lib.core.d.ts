/**
 * The fs module enables interacting with the file system in a way modeled on standard POSIX functions.
 */
declare module '@tjs/fs' {
    export interface IReadFileOptions {
        encoding?: string, // Default: 'utf8'
        flag?: string // Default: 'r'.
    }

    export interface IWriteFileOptions {
        encoding?: string, // Default: 'utf8'
        mode?: number, // Default: 0o666
        flag?: string // Default: 'w'.
    }

    export interface Stats {
        atime: number,
        birthtime: number,
        blksize: number,
        blocks: number,
        ctime: number,
        dev: number,
        flags: number,
        gen: number,
        gid: number,
        ino: number,
        mode: number,
        mtime: number,
        nlink: number,
        rdev: number,
        size: number,

        /** 文件类型: `file`, `directory`, `link`, `fifo`, `socket`, `char`, `block` */
        type: string,
        uid: number;
    }

    export interface FsStats {
        bavail: number,
        bfree: number,
        blocks: number,
        bsize: number,
        ffree: number,
        files: number,
        type: number
    }

    export interface Dirent {
        /** 文件或目录名称 */
        name: string;

        /** 文件类型, 1 FILE 文件, 2 DIR 目录, 3 LINK 链接文件, 4 FIFO, 5 SOCKET, 6 CHAR, 7 BLOCK */
        type: number;
    }

    export interface Dir extends IterableIterator<Dirent> {
        path: string,
        close(): void
        next(...args: []): IteratorResult<Dirent>
    }

    /**
     * A <FileHandle> object is an object wrapper for a numeric file descriptor.
     * Instances of the <FileHandle> object are created by the fs.open() method.
     */
    export interface FileHandle {
        path: string,
        fd: number,

        /**
         * Closes the file handle after waiting for any pending operation on the handle to complete.
         */
        close(): Promise<void>;

        /**
         * 锁定或释放文件，可以在多个进程间创建互斥锁
         * @param lock 
         * @retuns 
         */
        flock(lock?: boolean): number;

        /**
         * Reads data from the file and stores that in the given buffer.
         * @param size 
         * @param position 
         */
        read(size?: number, position?: number): Promise<ArrayBuffer>;

        stat(): Promise<Stats>;

        /**
         * Request that all data for the open file descriptor is flushed to the storage device. 
         */
        sync(): Promise<void>;

        /**
         * Truncates the file.
         * @param length 
         */
        truncate(length?: number): Promise<void>;

        /**
         * Write string to the file.
         * 
         * @param data 
         * @param offset 
         * @param length 
         * @param position 
         */
        write(data: string, position?: number): Promise<void>;

        /**
         * Write buffer to the file.
         * @param data 
         * @param offset 
         * @param length 
         * @param position 
         */
        write(data: ArrayBuffer, offset?: number, length?: number, position?: number): Promise<void>;

        fileno(): number;
    }

    export const constants: {
        /** 文件是否存在 */
        F_OK: 0,

        /** 读权限 */
        R_OK: 4,

        /** 写权限 */
        W_OK: 2,

        /** 执行权限 */
        X_OK: 1,

        /** 只读 */
        O_RDONLY: 0,

        /** 只写 */
        O_WRONLY: 1,

        /** 读写 */
        O_RDWR: 2
    };

    /** 
     * 检查文件是否存在或者具有指定的访问权限 
     * @param path 要检查的文件
     * @param mode 要检查的权限
     * @retrun 0 表示文件存在或者具有指定的访问权限, 否则返回 -1
     */
    export function access(path: string, mode?: number): Promise<number>;

    /** 写入数据到文件尾 */
    export function appendFile(path: string, data: ArrayBuffer | string, options?: IWriteFileOptions): Promise<void>;

    /** chmod */
    export function chmod(path: string, mode: number): Promise<void>;

    /** chown */
    export function chown(path: string, uid: number, gid: number): Promise<void>;

    /** 复制文件 */
    export function copyFile(src: string, dest: string, mode?: number): Promise<void>;

    /** 复制目录和文件 */
    export function cp(src: string, dest: string, options?: { force?: boolean, recursive?: boolean }): Promise<void>;

    /** 检查指定的文件或目录是否存在 */
    export function exists(path: string): Promise<boolean>;

    /** 计算文件 Hash 值 */
    export function md5sum(path: string): Promise<string>;

    /** 计算文件 Hash 值 */
    export function sha1sum(path: string): Promise<string>;

    /** 计算文件 Hash 值 */
    export function filesum(path: string, hash: string): Promise<string>;

    /** lstat */
    export function lstat(path: string): Promise<void>;

    /** 创建一个目录 */
    export function mkdir(path: string, options?: { recursive?: boolean, mode?: string | number }): Promise<void>;

    /** 创建一个临时目录 */
    export function mkdtemp(prefix: string): Promise<string>;

    /** 创建一个临时文件 */
    export function mkstemp(path?: string): Promise<FileHandle>;

    /** 
     * 打开一个文件 
     * Refer to the POSIX open(2) documentation for more detail.
     * @param path
     * @param flags Default: 'r', a(append),r(read),w(write); x(fails if exists), a+(a/r),r+(r/w), w+(r/w)
     * @param mode Default: 0o666
     */
    export function open(path: string, flags: string | number, mode?: number): Promise<FileHandle>;

    /** 打开一个目录 */
    export function opendir(path: string): Promise<Dir>;

    /** 读取目录内容 */
    export function readdir(path: string): Promise<Dirent[]>;

    /**
     * Asynchronously reads the entire contents of a file.
     * @param filename 文件名
     * @param encoding 编码格式, 只支持 `utf-8`
     */
    export function readFile(filename: string, encoding?: IReadFileOptions | string): Promise<string | ArrayBuffer>;

    /**
     * Asynchronously reads the entire contents of a file.
     * @param filename 文件名
     * @param encoding 编码格式, 只支持 `utf-8`
     */
    export function readTextFile(filename: string, encoding?: IReadFileOptions | string): Promise<string>;

    /** 返回链接的路径 */
    export function readlink(path: string): Promise<string>;

    /** 返回真实路径 */
    export function realpath(path: string): Promise<string>;

    /** 重命名 */
    export function rename(oldPath: string, newPath: string): Promise<void>;

    /** 删除文件 */
    export function rm(path: string, options?: { force?: boolean, recursive?: boolean }): Promise<void>;

    /** 删除目录 */
    export function rmdir(path: string): Promise<void>;

    /** stat */
    export function stat(path: string): Promise<Stats>;

    /** statfs */
    export function statfs(path: string): Promise<FsStats>;

    /** 创建符号链接 */
    export function symlink(target: string, path: string): Promise<void>;

    /** 截断文件 */
    export function truncate(path: string, len: number): Promise<void>;

    /** 删除一个文件或者符号链接 */
    export function unlink(path: string): Promise<void>;

    /** 修改文件时间 */
    export function utimes(path: string, atime: number | Date, mtime: number | Date): Promise<void>;

    /** 监控指定名称的文件或目录 */
    export function watch(filename: string, options: any, listener: Function): Promise<void>;

    /**
     * Asynchronously writes data to a file, replacing the file if it already exists. 
     * @param filename 文件名
     * @param data 要写入的数据
     * @param options 
     */
    export function writeFile(filename: string, data: string | ArrayBuffer | ArrayBufferView, options?: IWriteFileOptions | string): Promise<void>;

    /**
     * 创建文件流
     * @param filename 文件名
     * @param options 选项
     */
    export function readableStream(filename: string, options?: { chunkSize?: number, onprogress?: (event: {loaded: number, total: number}) => void}): Promise<ReadableStream>;
}

/**
 * The os module provides operating system-related utility methods and properties.
 */
declare module '@tjs/os' {
    import * as native from '@tjs/native';

    export class ProcessOptions {
        /** Current working directory of the child process. Default: os.cwd(). */
        cwd?: string;

        detached?: boolean;

        /** Environment key-value pairs. Default: process.env. */
        env?: object;

        /** Default: 'utf8' */
        encoding?: string;

        /** Sets the group identity of the process (see setgid(2)). */
        gid?: number;

        /**  
         * Shell to execute the command with. See Shell requirements and Default Windows shell. 
         * Default: '/bin/sh' on Unix, process.env.ComSpec on Windows. 
         */
        shell?: string;

        /** 标准输入类型: inherit, pipe, ignore */
        stderr?: string;

        /** 标准输入类型: inherit, pipe, ignore */
        stdin?: string;

        /** 标准输入类型: inherit, pipe, ignore */
        stdout?: string;

        /** Default: 0 */
        timeout?: number;

        /** Sets the user identity of the process (see setuid(2)). */
        uid?: number;
    }

    /**
     * 子进程返回结果
     */
    export interface ProcessResult {
        /** 输出 */
        stdout?: string;

        /** 错误输出 */
        stderr?: string;

        /** 退出代码 */
        code?: number;

        /** 错误 */
        error?: Error;
    }

    /**
     * 子进程
     */
    export class ChildProcess {
        /** 标准输入类型: inherit, pipe, ignore */
        stdin?: native.Pipe;

        /** 标准输出类型: inherit, pipe, ignore */
        stdout?: native.Pipe;

        /** 标准错误类型: inherit, pipe, ignore */
        stderr?: native.Pipe;

        /** pid */
        pid: number;

        /** 是否已连接 */
        connected: boolean;

        /** 断开连接 */
        disconnect(): void;

        /** 向子进程发送信号 */
        kill(signal: number): Promise<void>;

        /**
         * 发送一个消息
         * @param message 
         */
        send(message: object): Promise<boolean>;

        /** 等待子进程结束 */
        wait(): Promise<ProcessResult>;

        /** 当断开连接 */
        ondisconnect?(message: Event): void;

        /** 当收到消息 */
        onmessage?(message: MessageEvent): void;
    }

    /**
     * 网络接口信息
     */
    export class NetworkInterface {
        /** IP 地址 */
        ip?: string;

        /** 硬件地址 */
        mac?: string;

        /** 子网掩码 */
        netmask?: string;

        /** IPv4 或 IPv6  */
        family?: string;

        /** 网络接口名称 */
        interface?: string;

        /** 网络接口名称 */
        name?: string;

        /**
         * - IFF_UP: 0x01
         * - IFF_BROADCAST: 0x2
         * - IFF_LOOPBACK: 0x8
         * - IFF_RUNNING: 0x40
         * - IFF_MULTICAST: 0x1000
         */
        flags?: number;
    }

    export interface SignalHandler {
        readonly signum: number;
        close(): void;
    }

    /**
     * 启动一个子进程
     * @param command 
     * @param args 
     * @param options 
     */
    export function spawn(command: string, args?: string[], options?: ProcessOptions): ChildProcess;

    /**
     * 
     * @param file 
     * @param args 
     * @param options 
     */
    export function execFile(file: string, args?: string[], options?: ProcessOptions): Promise<ChildProcess>;

    /**
     * 
     * @param file 
     * @param options 
     */
    export function execFile(file: string, options?: ProcessOptions): Promise<ChildProcess>;

    /**
     * 安全地启动一个子进程，并返回输出结果
     * @param command 要执行的命令行
     * @param options 选项
     */
    export function exec(command: string[] | string, options?: ProcessOptions): Promise<ProcessResult>;

    /**
     * 执行 Shell 命令
     * @param args 
     */
    export function shell(...args: string[]): Promise<ProcessResult>;

    export function daemon(command: string[] | string, options?: ProcessOptions): Promise<ProcessResult>;

    /** CPU 架构类型 */
    export const arch: string;

    /** 主板类型 */
    export const board: string;

    /** 操作系统类型 */
    export const platform: string;

    /**
     * Registers the given function as a listener of the given signal event. 
     * 信号 
     */
    export function signal(signal: number, handler: (signal: number) => any): SignalHandler;

    /** CPU 信息 */
    export function cpus(): string[];

    /** 
     * Change the current working directory to the specified path.
     * 改变当前进程的工作目录，如果失败则抛出异常。 
     */
    export function chdir(path: string): void

    /** 当前工作目录 */
    export function cwd(): string;

    /** 空闲内存数 */
    export function freemem(): number;

    /** 当前系统时间 */
    export function gettimeofday(): number;

    /** 用户主目录 */
    export function homedir(): string;

    /** 
     * Get the hostname of the machine the process is running on.
     * 返回当前进程运行的主机的名称 
     */
    export function hostname(): string;

    /** 高精度时钟时间，单位为纳秒。 */
    export function hrtime(): bigint

    export function isatty(fd: number): boolean;

    /** 发送信号 */
    export function kill(pid: number, siganl: number): void;

    /** CPU 负载状态 */
    export function loadavg(): number[];

    /** 网络接口列表 */
    export function networkInterfaces(): NetworkInterface[];

    /** 重启设备 */
    export function reboot(): number;

    /** 
     * 休眠 
     * @param time 单位为毫秒
     */
    export function sleep(time: number): void;

    /** 临时文件目录 */
    export function tmpdir(): string;

    /** 总内存数 */
    export function totalmem(): number;

    /** 操作系统信息 */
    export function uname(): { sysname: string, release: string, version: string, machine: string };

    /** 系统启动时间, 单位为秒 */
    export function uptime(): number;

    /** 打印所有的 libuv handler */
    export function printHandles(): void;

    /** 打印内存使用情况 */
    export function printMemoryUsage(): void;

    /**
     * Operating signals
     */
    export const signals: {
        SIGABRT: 6,
        SIGALRM: 14,
        SIGBUS: 7,
        SIGCHLD: 17,
        SIGCONT: 18,
        SIGFPE: 8,
        SIGHUP: 1,
        SIGILL: 4,
        SIGINT: 2,
        SIGIO: 29,
        SIGIOT: 6,
        SIGKILL: 9,
        SIGPIPE: 13,
        SIGPOLL: 29,
        SIGPROF: 27,
        SIGPWR: 30,
        SIGQUIT: 3,
        SIGSEGV: 11,
        SIGSTKFLT: 16,
        SIGSTOP: 19,
        SIGSYS: 31,
        SIGTERM: 15,
        SIGTRAP: 5,
        SIGTSTP: 20,
        SIGTTIN: 21,
        SIGTTOU: 22,
        SIGURG: 23,
        SIGUSR1: 10,
        SIGUSR2: 12,
        SIGVTALRM: 26,
        SIGWINCH: 28,
        SIGXCPU: 24,
        SIGXFSZ: 25
    }
}

/**
 * The path module provides utilities for working with file and directory paths.
 */
declare module '@tjs/path' {
    export interface PathObject {
        root?: string;
        dir?: string;
        base?: string;
        ext?: string;
        name?: string;
    }

    /**
     * Returns the last portion of a path, similar to the Unix basename command. 
     * Trailing directory separators are ignored.
     * @param path 路径
     */
    export function basename(path: string, extName?: string): string;

    /**
     * returns the extension of the path, from the last occurrence of the . (period) 
     * character to end of string in the last portion of the path. 
     * If there is no . in the last portion of the path, or if there are no . characters 
     * other than the first character of the basename of path (see path.basename()) , 
     * an empty string is returned.
     * @param path 
     */
    export function extname(path: string): string;

    /**
     * Returns the directory name of a path, similar to the Unix dirname command. 
     * Trailing directory separators are ignored, see path.sep.
     * @param path 
     */
    export function dirname(path: string): string;

    /**
     * Joins all given path segments together using the platform-specific separator as a delimiter, 
     * then normalizes the resulting path.
     * @param args A sequence of path segments
     */
    export function join(...args: string[]): string;

    /**
     * Determines if path is an absolute path.
     * If the given path is a zero-length string, false will be returned.
     * @param path 
     */
    export function isAbsolute(path: string): boolean;

    /**
     * Returns an object whose properties represent significant elements of the path. 
     * Trailing directory separators are ignored,
     * @param path 
     */
    export function parse(path: string): PathObject;

    /**
     * Returns a path string from an object. This is the opposite of path.parse().
     * @param path 
     */
    export function format(path: PathObject): string;
}

/**
 * The process module provides information about, and control over, the current WoT.js process.
 */
declare module '@tjs/process' {
    import * as native from '@tjs/native'

    /** CPU 架构类型，可能的值为：'arm'、'arm64'、'ia32'、'mips'、'x32' 和 'x64' */
    export const arch: string;

    /** 
     * Returns the script arguments to the program.
     * 命令行参数。
     * - 第一个元素是 process.execPath
     * - 第二个元素是指向被执行的 JavaScript 文件的路径。
     * - 其余元素则是其他命令行参数。 
     */
    export const args: string[];

    /** 
     * 命令行参数，args 的别名。
     * - 第一个元素是 process.execPath
     * - 第二个元素是指向被执行的 JavaScript 文件的路径。
     * - 其余元素则是其他命令行参数。 
     */
    export const argv: string[];

    /**
     * 返回当前应用的名称
     */
    export const command: string;

    /**
     * 当前进程退出码
     */
    export function exitCode(code?: number): number;

    /** 
     * The current process ID of this instance.
     * 当前进程的 ID 
     */
    export const pid: number;

    /** 操作系统平台类型, 目前可能的值是: `linux` */
    export const platform: string;

    /** 
     * The process ID of parent process of this instance.
     * 当前进程的父进程的 PID 
     */
    export const ppid: number;

    /** 根目录 */
    export const root: string;

    /** 当前进程标题（即返回 ps 的当前值）, 为 process.title 分配一个新值会修改 ps 的当前值 */
    export function title(title?: string): string;

    /** 软件版本 */
    export const version: string;

    /** 
     * Version information related to the current runtime environment.
     * 当前运行环境相关版本号 
     */
    export const versions: { [key: string]: string };

    /** 
     * Returns the path to the current executable.
     * 当前进程执行文件的绝对路径 
     */
    export function execPath(): string

    /** 
     * The URL of the entrypoint module entered from the command-line. 
     * 当前进程执行脚本的路径 
     */
    export function scriptPath(): string

    /**
     * Exit the process with optional exit code.
     * 以 `code` 的退出状态同步终止进程。 
     * @param code 退出码，默认为 `0`
     */
    export function exit(code?: number): void

    /** 
     * Retrieve the value of an environment variable.
     * 查询环境变量 
     */
    export function getenv(name: string): string

    /** 
     * Returns a snapshot of the environment variables at invocation as a simple object of keys and values.
     * 查询环境变量 
     */
    export function environ(): { [key: string]: string }

    /** 
     * Delete the value of an environment variable.
     * 删除环境变量 
     */
    export function unsetenv(name: string): void

    /** 
     * Set the value of an environment variable.
     * 设置环境变量 
     */
    export function setenv(name: string, value: string): void

    /** 
     * The number of bytes of the current process resident set size, 
     * which is the amount of memory occupied in main memory (RAM).
     * 当前进程占用的物理内存 
     */
    export function rss(): number;

    export function getegid(): number;
    export function geteuid(): number;
    export function getgid(): number;
    export function getuid(): number;
    export function setegid(gid: number): number;
    export function seteuid(gid: number): number;
    export function setgid(gid: number): number;
    export function setuid(gid: number): number;

    export function stdin(): native.TTY;
    export function stdout(): native.TTY;
    export function stderr(): native.TTY;

    export function addEventListener(eventName: string, listener: Function, options?: boolean | { capture?: boolean, passive?: boolean, once?: boolean }): void;
    export function removeEventListener(eventName: string, listener: Function, options:any): void;
}

/**
 * The util module supports the needs of WoT.js internal APIs. 
 * Many of the utilities are useful for application and module developers as well. 
 */
declare module '@tjs/util' {
    export class MessageParser extends EventTarget {
        execute(data: ArrayBuffer | string): void;

        /**
         * 当收到消息
         * @param message 
         */
        onmessage(message: MessageEvent): void;

        /**
         * 当断开连接
         */
        ondisconnect(message: Event): void;
    }

    /**
     * 解码
     * @param text 要解码的数据
     * @param format `hex`,`base64`
     */
    export function decode(text: string, format?: string): Uint8Array;

    /**
     * 
     * @param message 
     */
    export function encodeMessage(message: boolean | number | string | object | Array<any> | ArrayBuffer): Uint8Array;

    /**
     * 编码
     * @param data 要编码的数据
     * @param format `hex`,`base64`
     */
    export function encode(data: string | Uint8Array | ArrayBuffer, format?: string): string;

    /**
     * 计算 hash 值
     * @param data 要计算的数据
     * @param type 算法类型，`md5`,`sha1`
     */
    export function hash(data: ArrayBuffer | Uint8Array | string, type?: string): string;

    /**
     * 睡眠
     * @param time 
     */
    export function sleep(time: number): Promise<void>;

    /**
     * 将字符串转换为二进制数据
     * @param text 字符串
     * @param format 编码格式 'utf-8', 'utf8', 'hex', 'base64'
     */
    export function toBuffer(text: string, format?: string): ArrayBuffer;

    /**
     * 将二进制数据转换为字符串
     * @param data 二进制数据
     * @param format 编码格式 'utf-8', 'utf8', 'hex', 'base64'
     */
    export function toString(data: Uint8Array | ArrayBuffer, format?: string): string;

    /**
     * 数据格式化
     */
    export namespace format {
        /**
         * 将指定的数据格式化显示
         * @param data 要格式化的数据
         * @param format 数据格式, `bytes`, `time`
         * @param fixed 
         */
        function stringify(data: any, format?: string, fixed?: number): string;

        /**
         * 解析指定格式的数值
         * @param data 要解析的数据
         * @param format 数据格式, `bytes`, `time`
         * @param defaultValue 
         */
        function parseNumber(data: string, format?: string, defaultValue?: number): number;

        /**
         * 解析指定格式的数据
         * @param data 要解析的数据
         * @param format 格式
         */
        function parse(data: string, format?: string): any;
    }

    /**
     * zip 文件读写
     */
    export namespace zlib {
        /**
         * Zip 文件解析器
         */
        class Reader {
            /** 打开指定的 zip 文件 */
            open(filename: string): number;

            /** 关闭这个 Reader */
            close(): void;

            /** 返回包含的文件数量 */
            count(): number;

            /** 返回文件信息 */
            stat(index: number): any;

            /** 文件解压 */
            extract(index: number, outfile?: string): ArrayBuffer;

            /** 文件解压 */
            extract(filename: string, outfile?: string): ArrayBuffer;
        }

        /**
         * 添加一个文件
         * @param zipname zip 文件名
         * @param filename 要添加的压缩文件名
         * @param data 文件内容
         */
        function add(zipname: string, filename: string, data: BufferSource): number;

        /**
         * 解压出指定名称的文件
         * @param zipname zip 文件名
         * @param filename 要解压的文件名
         */
        function extract(zipname: string, filename: string): ArrayBuffer;

        /**
         * 数据压缩
         * @param data 要压缩的数据
         */
        function compress(data: BufferSource): ArrayBuffer;

        /**
         * 数据解压
         * @param data 要解压的数据
         * @param uncompressedSize 解压后数据长度
         */
        function uncompress(data: BufferSource, uncompressedSize: number): ArrayBuffer;
    }

    export namespace types {
        function isArray(value: any): boolean;
        function isArrayBuffer(value: any): boolean;
        function isBoolean(value: any): boolean;
        function isDataView(value: any): boolean;
        function isDate(value: any): boolean;
        function isFinite(value: any): boolean;
        function isFunction(value: any): boolean;
        function isMap(value: any): boolean;
        function isNull(value: any): boolean;
        function isNullOrUndefined(value: any): boolean;
        function isNumber(value: any): boolean;
        function isObject(value: any): boolean;
        function isPromise(value: any): boolean;
        function isProxy(value: any): boolean;
        function isRegExp(value: any): boolean;
        function isSet(value: any): boolean;
        function isString(value: any): boolean;
        function isSymbol(value: any): boolean;
        function isTypedArray(value: any): boolean;
        function isUndefined(value: any): boolean;
        function isWeakSet(value: any): boolean;
    }
}

