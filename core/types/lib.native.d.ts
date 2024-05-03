/**
 * @module native
 * WoT.js Native modules - 原生模块
 * - 因为原生模块接口可能经常变动，所以禁止应用程序直接调用原生模块接口
 */
declare module '@tjs/native' {
    /** 文件 */
    export interface FileHandle {
        path: string;
        fd: number;

        read(size?: number): Promise<ArrayBuffer>;
        write(data: string | ArrayBuffer, encoding?: string): Promise<void>;

        close(): Promise<void>;
        stat(): Promise<any>;
        sync(): Promise<void>;
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

        readonly stderr: TTY;
        readonly stdin: TTY;
        readonly stdout: TTY;

        /**
         * 发送一个信号给子进程
         * @param signal 
         */
        kill(signal?: number): void;

        /**
         * Indicates whether it is still possible to send and receive messages 
         * from a child process. 
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
         * @param message 
         */
        send(message: object): Promise<boolean>;

        /** 等待进程结束 */
        wait(): Promise<ProcessResult>;

        ondisconnect?(message: Event): void;
        onmessage?(message: MessageEvent): void;
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

        /** 信号值 */
        signal?: number;

        /** 错误 */
        error?: Error;
    }

    export const AF_INET: number;
    export const AF_INET6: number;
    export const AF_UNSPEC: number;

    export const STDIN_FILENO: number;
    export const STDOUT_FILENO: number;
    export const STDERR_FILENO: number;

    export const command: string;
    export const arch: string;
    export const arg0: number;
    export const args: string[];
    export const board: string;
    export const platform: string;
    export const root: string;
    export const version: string;
    export const versions: any;

    export interface SpawnOptions {
        env?: { [key: string]: any };
        detached?: boolean;
        cwd?: string;
        uid?: number;
        gid?: number;
        stdin?: string; // inherit, pipe, ignore
        stderr?: string; // inherit, pipe, ignore
        stdout?: string; // inherit, pipe, ignore
    }

    /** 定时器 */
    export interface Timer {
        ref(): void;
        unref(): void;
        hasRef(): number;
    }

    export function alert(...data: any[]): void;
    export function clearInterval(timer?: Timer): void;
    export function clearTimeout(timer?: Timer): void;
    export function confirm(message?: string): boolean;
    export function cwd(): string;
    export function scriptPath(): string;
    export function environ(): void;
    export function exepath(): string;
    export function exit(code: number): void;
    export function exitCode(code?: number): number;
    export function getenv(name: string): string;
    export function gettimeofday(): number;
    export function homedir(): string;
    export function hrtime(): number;
    export function isatty(object: any): boolean;
    export function openlog(name: string): void;
    export function print(...data: any[]): void;
    export function prompt(message?: string, _default?: string): string | null;
    export function random(buffer: ArrayBuffer, byteOffset?: number, byteLength?: number): void;
    export function setenv(key: string, value: string): void;
    export function setInterval(handler: TimerHandler, timeout?: number, ...arguments: any[]): Timer;
    export function setTimeout(handler: TimerHandler, timeout?: number, ...arguments: any[]): Timer;
    export function signal(signal?: number, handler?: (signal: number) => any): void;

    /**
     * Spawns a new process using the given command, with command-line arguments in args. 
     * If omitted, args defaults to an empty array.
     * @param command The command to run.
     * @param options 
     */
    export function spawn(command: string | string[], options?: SpawnOptions): ChildProcess;

    export function strerror(errno: number): string;
    export function syslog(level: number, data: any): void;
    export function tmpdir(): string;
    export function uname(): { sysname: string, release: string, version: string, machine: string };
    export function unsetenv(name: string): void;
    export function write(...data: any[]): void;

    export namespace runtime {
        export function evalScript(fileanme: string): any;
        export function loadScript(fileanme: string, flags?: boolean): any;
        export function readObject(data: ArrayBuffer, pos: number, len: number, flags?: boolean): any;
        export function writeObject(object: any, flags?: boolean): ArrayBuffer;
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

    /** 文件系统 */
    export namespace fs {
        function access(path: string): Promise<void>;
        function chmod(path: string, mode: number): Promise<void>;
        function chown(path: string, uid: number, gid: number): Promise<void>;
        function copyFile(path: string, newPath: string): Promise<void>;
        function lstat(path: string): Promise<void>;
        function mkdir(path: string): Promise<void>;
        function mkdtemp(): Promise<string>;
        function mkstemp(): Promise<FileHandle>;
        function open(path: string, flag: string, mode?: number): Promise<FileHandle>;
        function opendir(path: string): Promise<Dir[]>;
        function readFile(path: string, encoding?: string): Promise<ArrayBuffer>;
        function readlink(path: string): Promise<string>;
        function realpath(path: string): Promise<string>;
        function rename(path: string, newPath: string): Promise<void>;
        function rmdir(path: string): Promise<void>;
        function stat(path: string): Promise<Stats>;
        function statfs(path: string): Promise<void>;
        function symlink(target: string, newPath: string): Promise<void>;
        function unlink(path: string): Promise<void>;
        function utimes(path: string): Promise<void>;
        function watch(path: string): Promise<void>;
    }

    /** 操作系统 */
    export namespace os {
        const platform: string;

        function chdir(path: string): void;
        function cpuinfo(): any[];
        function freemem(): number;
        function getegid(): number;
        function geteuid(): number;
        function getgid(): number;
        function getuid(): number;
        function hostname(): string;
        function interfaces(): any[];
        function kill(pid: number, signal?: number): Promise<void>;
        function loadavg(): number[];
        function pid(): number;
        function ppid(): number;
        function printHandles(): void;
        function printMemoryUsage(): void;
        function processTitle(title?: string): string;
        function reboot(): void;
        function rssmem(): number;
        function setegid(gid: number): number;
        function seteuid(uid: number): number;
        function setgid(gid: number): number;
        function setuid(uid: number): number;
        function sleep(delay: number): void;
        function totalmem(): number;
        function uptime(): number;
    }

    /** 工具方法 */
    export namespace util {
        const CODE_HEX: number;
        const CODE_BASE64: number;
        const HASH_MD5: number;
        const HASH_SHA1: number;

        function applications(): string[];
        function modules(): string[];
        function asset(filename: string): ArrayBuffer;
        function encode(data: BufferSource, format?: number): string;
        function decode(data: string, format?: number): Uint8Array;
        function hash(data: BufferSource, format?: number): Uint8Array;
    }

    export namespace utf8 {
        function decode(data: BufferSource): string;
        function encode(data: string): Uint8Array;
    }

    /** 域名解析 */
    export namespace dns {
        const AI_ADDRCONFIG: number;
        const AI_V4MAPPED: number;

        interface GetaddrinfoOptions {
            /** PF_INET:2, PF_INET6: 10 */
            family?: number;

            flags?: number;

            /** IPPROTO_TCP:6, IPPROTO_UDP:17 */
            protocol?: number;

            service?: string;

            /** SOCK_STREAM:1, SOCK_DGRAM:2, SOCK_RAW:3 */
            socktype?: number;
        }

        interface AddressInfo {
            address: {
                family?: number;
                ip?: number;
                address?: number;
                port?: number;
            }
        }

        /**
         * 
         * @param node 
         * @param params 
         */
        function getaddrinfo(node: string, options: GetaddrinfoOptions): Promise<AddressInfo[]>;
    }

    /** 硬件抽象层 */
    export namespace hal {

        function ppid(): Promise<void>;

        class GPIO {
            constructor(name: string)

            onpoll?(): void;
            close(): Promise<void>;
            read(): Promise<number>;
            write(value?: string): Promise<void>;
        }
    }

    /** 硬件看门狗 */
    export namespace watchdog {
        function close(fileno: number): void;
        function enable(fileno: number, enable?: boolean): boolean;
        function keepalive(fileno: number): void;
        function open(filename: string): number;
        function reset(fileno: number): void;
        function timeout(fileno: number, timeout?: number): number;
    }

    /** ADC */
    export namespace adc {
        function open(filename: string): number;
        function close(fileno: number): void;
        function read(fileno: number): number;
    }

    export namespace gpio {
        function value(name: string): number;
        function input(name: string): number;
        function output(name: string, value: number): number;
    }

    /** HTTP 协议 */
    export namespace http {
        const methods: string[];
        const RESPONSE: number;
        const REQUEST: number;

        function ppid(): Promise<void>;

        interface Message {
            method?: number,
            status?: number,
            statusText?: string,
            url?: string,
            httpMajor: number,
            httpMinor: number,
            headers: [string, string][];
        }

        /**
         * HTTP 消息解析器
         */
        class Parser {
            constructor(type?: number);

            /**
             * 初始化
             * @param type 
             */
            init(type: number): void;

            /**
             * 执行解析
             * @param data
             */
            execute(data: string | ArrayBuffer | Uint8Array): void;

            onbody?(data: ArrayBuffer): void;
            onheaderscomplete?(info: Message): void;
            onmessagecomplete?(): void;

            onmessagebegin?(): void;
            onstatus?(): void;
            onurl?(url: string): void;
            onheaderfield?(name: string): void;
            onheadervalue?(value: string): void;
        }
    }

    /** Crypto */
    export namespace crypto {
        const MD_MD5: number;
        const MD_SHA1: number;
        const MD_SHA256: number;
        const MD_SHA512: number;

        type Data = string | ArrayBuffer;
        type DigestAlgorithm = number | "MD5" | "SHA1" | "SHA256" | "SHA512";

        function digest(algorithm: DigestAlgorithm, data: Data): ArrayBuffer;
        function hashfile(algorithm: DigestAlgorithm, filename: string): ArrayBuffer;
        function hmac(algorithm: DigestAlgorithm, data: Data, secret: Data): ArrayBuffer;
    }

    /** MQTT 协议 */
    export namespace mqtt {
        const CONNACK: number;
        const CONNECT: number;
        const DISCONNECT: number;
        const PINGREQ: number;
        const PINGRESP: number;
        const PUBACK: number;
        const PUBCOMP: number;
        const PUBLISH: number;
        const PUBREC: number;
        const PUBREL: number;
        const SUBACK: number;
        const SUBSCRIBE: number;
        const UNSUBACK: number;
        const UNSUBSCRIBE: number;

        interface MQTTMessage {
            type: number;
            length: number;
        }

        interface ConnectOptions {
            username?: string;
            password?: string;
            clientId?: string;
            keepalive?: number;
            clean?: boolean;
        }

        function encodeConnect(options: ConnectOptions): ArrayBuffer;
        function encodeDisconnect(): ArrayBuffer;
        function encodePing(): ArrayBuffer;
        function encodePublish(topic: string, payload: any, dup: number, qos: number, retained: number, pid: number): ArrayBuffer;
        function encodeSubscribe(topic: string, dup: number, pid: number): ArrayBuffer;
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
        class UART {
            constructor(fd: number);

            close(): void;
            read(): ArrayBuffer;
            write(data: any): void;

            onclose?(): void;
            ondisconnect?(): void;
            onmessage?(data: ArrayBuffer): void;

            fd?: number;
        }

        const PARITY_NONE: number;
        const PARITY_ODD: number;
        const PARITY_EVEN: number;

        function open(device: string, baudRate: number, parityType?: number, dataBits?: number, stopBits?: number): number;

        /** Sets control signals on the port and returns a Promise that resolves when they are set. */
        export function setSignals(fd: number, mask: number, signals?: number): void

        /** Returns a Promise that resolves with an object containing the current state of the port's control signals. */
        export function getSignals(fd: number): number
    }

    export class Error {
        constructor(errno: number);

        code: string;
        errno: number;
        message: string;
        name: string;
    }

    /** 流 */
    export class Stream {
        close(): void;
        fileno(): number;
        hasRef(): number;
        ref(): void;
        unref(): void;
        write(data: string | ArrayBuffer | ArrayBufferView): Promise<void>

        onerror?(err: Error): void;
        onmessage?(message: ArrayBuffer): void;
    }

    export class Socket extends Stream {
        address(): SocketAddress;
        bufferedAmount(): number;
        remoteAddress(): SocketAddress;

        bind(address: SocketAddress, flags?: number): void;
        connect(address: SocketAddress): Promise<void>
        listen(backlog?: number): void;
        pause(): number;
        resume(): number;
        shutdown(): Promise<void>;
        setKeepAlive(keepAlive: boolean, timeout: number): void;
        setNoDelay(noDelay: boolean): void;

        onclose?(): void;
        onconnect?(status?: number): void;
        onopen?(status?: { result?: number, error?: string }): void;
    }

    export class TLS extends Socket {
        constructor(options?: any);

        accept(): TCP;
        onconnection?(connection: TLS): void;
    }

    export class TCP extends Socket {
        id(): number;

        accept(): TCP;
        setDebug(debug: boolean): void;

        onconnection?(connection: TCP): void;
    }

    export class Pipe extends Stream {
        address(): string;
        bufferedAmount(): number;
        id(): number;
        remoteAddress(): string;

        accept(): Pipe;
        bind(address: string): void;
        connect(address: string): Promise<void>
        listen(backlog?: number): void;
        open(fd: number): void;
        shutdown(): Promise<void>;

        setDebug(debug: boolean): void;

        onclose?(): void;
        onconnect?(): void;
        onconnection?(connection: Pipe): void;
        onerror?(err: Error): void;
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

    const IPV6ONLY: number;
    const PARTIAL: number;
    const REUSEADDR: number;

    export interface SocketAddress {
        address?: string;
        port?: number;
    }

    export interface UDPMessage {
        data?: ArrayBuffer;
        address?: SocketAddress;
    }

    export class UDP {
        address(): SocketAddress;
        bind(address: SocketAddress, flags?: number): void;
        close(): void;
        connect(address: SocketAddress): void;
        disconnect(): void;
        fileno(): number;
        hasRef(): number;
        recv(): Promise<UDPMessage>;
        ref(): void;
        remoteAddress(): SocketAddress;
        setBroadcast(broadcast: boolean): void;
        setTTL(ttl:number): number;
        send(data: string | ArrayBuffer | ArrayBufferView, socket: SocketAddress): Promise<void>;
        unref(): void;

        onmessage?(data: UDPMessage): void;
        onerror?(error?: Error): void;
        onclose?(): void;
    }

    /**
     * 工作线程
     */
    export class Worker {
        constructor(filename: string);

        postMessage(args: any[]): void;
        terminate(): void;

        onmessage(message: any): void;
        onmessageerror(): void;
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

    /** 文件压缩和解压缩 */
    export namespace zlib {
        class Reader {
            /** 打开指定的 zip 文件 */
            open(filename: string): number;

            /** 关闭这个 reader */
            close(): void;

            /** 包含的文件数 */
            count(): number;

            /** 返回指定的文件的统计信息 */
            stat(index: number): any;

            /** 解压指定的文件 */
            extract(index: number, outfile?: string): ArrayBuffer;

            /** 解压指定的文件 */
            extract(filename: string, outfile?: string): ArrayBuffer;
        }

        /**
         * 添加指定的文件到 zip 文件中
         * @param zipname 
         * @param filename 
         * @param data 
         */
        function add(zipname: string, filename: string, data: BufferSource): ArrayBuffer;

        /**
         * 解压指定的文件
         */
        function extract(zipname: string, filename: string): ArrayBuffer;

        /** 数据压缩 */
        function compress(data: BufferSource): ArrayBuffer;

        /** 数据解压 */
        function uncompress(data: BufferSource, uncompressedSize: number): ArrayBuffer;

        /** 对 gzip 压缩的数据进行解压 */
        function ungzip(data: BufferSource, uncompressedSize: number): ArrayBuffer;
    }
}
