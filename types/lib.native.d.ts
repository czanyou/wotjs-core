
declare namespace native {
    export interface FileHandle {
        write(data: string | ArrayBuffer, encoding?: string): Promise<void>;
        close(): Promise<void>;
    }

    export interface Dir {

    }

    /**
     * 表示一个子进程
     */
    export interface ChildProcess {
        /** 等待进程结束 */
        wait(): Promise<any>;

        /**
         * 断开连接
         */
        disconnect(): void;

        /**
         * 发送一个信号
         * @param signal 
         */
        kill(signal?: number): void;

        /**
         * 发送一个消息
         * @param message 
         */
        send(message: object): Promise<boolean>;

        /**
         * 当收到消息
         * @param message 
         */
        onmessage(message: MessageEvent): void;

        /**
         * 当断开连接
         */
        ondisconnect(message: Event): void;

        /** 是否忆连接 */
        connected: boolean;
        stdout: TTY;
        stdin: TTY;
        stderr: TTY;
        util: any;
    }

    export interface ProcessOptions {
        stdout: any;
        stderr: any;
        stdin: any;
    }

    export interface ProcessResult {

    }

    export const AF_INET: number;
    export const AF_INET6: number;
    export const AF_UNSPEC: number;

    export const STDIN_FILENO: number;
    export const STDOUT_FILENO: number;
    export const STDERR_FILENO: number;

    export const applet: string;
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

    export function alert(...data: any[]): void;
    export function cwd(): string;
    export function environ(): void;
    export function exepath(): string;
    export function exit(code: number): void;
    export function exitCode(code?: number): number;
    export function getenv(name: string): string;
    export function homedir(): string;
    export function hrtime(): number;
    export function isatty(object: any): boolean;
    export function openlog(name: string): void;
    export function print(...data: any[]): void;
    export function random(buffer: ArrayBuffer, byteOffset?: number, byteLength?: number): void;
    export function setenv(key: string, value: string): void;
    export function signal(signal?: number, handler?: (signal: number) => any): void;
    export function spawn(command: string | string[], options: SpawnOptions): ChildProcess;
    export function syslog(level: number, data: any): void;
    export function tmpdir(): string;
    export function uname(): void;
    export function unsetenv(name: string): void;
    export function write(...data: any[]): void;

    export namespace signal {
        const SIGTERM: number;
        const SIGKILL: number;
        const SIGUSR1: number;
    }

    export namespace fs {
        function access(filename: string): Promise<void>;
        function chmod(): Promise<void>;
        function chown(): Promise<void>;
        function copyFile(): Promise<void>;
        function hashFile(): Promise<void>;
        function lstat(): Promise<void>;
        function mkdir(): Promise<void>;
        function mkdtemp(): Promise<void>;
        function mkstemp(): Promise<void>;
        function open(filename: string, flag: string, mode: number): Promise<FileHandle>;
        function opendir(filename: string, options: any): Promise<Dir[]>;
        function readFile(filename: string, encoding?: string): Promise<ArrayBuffer>;
        function readlink(): Promise<void>;
        function realpath(): Promise<void>;
        function rename(): Promise<void>;
        function rm(): Promise<void>;
        function rmdir(): Promise<void>;
        function stat(): Promise<void>;
        function statfs(): Promise<void>;
        function symlink(): Promise<void>;
        function truncate(): Promise<void>;
        function unlink(): Promise<void>;
        function utimes(): Promise<void>;
        function watch(): Promise<void>;
    }

    export namespace os {
        const platform: string;

        function freemem(): number;
        function cpuinfo(): any[];
        function hostname(): string;
        function kill(pid: number, signal?: number): Promise<void>;
        function loadavg(): number[];
        function interfaces(): any[];
        function printActiveHandles(): void;
        function printAllHandles(): void;
        function printMemoryUsage(): void;
        function processTitle(title?: string): string;
        function reboot(): void;
        function rssmem(): number;
        function totalmem(): number;
        function uptime(): number;
        function sleep(delay: number): void;
        function pid(): number;
        function ppid(): number;
        function chdir(pathname: string): Promise<void>;
    }

    export namespace util {
        const CODE_HEX: number;
        const CODE_BASE64: number;
        const HASH_MD5: number;
        const HASH_SHA1: number;

        function encode(data: BufferSource, format?: number): string;
        function decode(data: string, format?: number): Uint8Array;
        function hash(data: BufferSource, format?: number): Uint8Array;
        function textDecode(data: BufferSource): string;
        function textEncode(data: string): Uint8Array;
    }

    export namespace dns {
        const AI_ADDRCONFIG: number;
        const AI_V4MAPPED: number;

        function getaddrinfo(hostname: string, params: any): Promise<any[]>;
    }

    export namespace hal {

        function ppid(): Promise<void>;

        class GPIO {
            constructor(name: string)

            onpoll(): void;
            close(): Promise<void>;
            read(): Promise<number>;
            write(value?: string): Promise<void>;
        }
    }

    /**
     * 硬件看门狗
     */
    export namespace watchdog {
        function close(fileno: number): void;
        function enable(fileno: number, enable?: boolean): boolean;
        function keepalive(fileno: number): void;
        function open(filename: string): number;
        function reset(fileno: number): void;
        function timeout(fileno: number, timeout?: number): number;
    }

    export namespace adc {
        function open(filename: string): number;
        function close(fileno: number): void;
        function read(fileno: number): number;
    }

    export namespace http {
        const methods: any;
        const RESPONSE: number;
        const REQUEST: number;

        function ppid(): Promise<void>;

        class Parser {
            constructor(type?: number);
            init(type: number): void;
            execute(data: any): void;

            onbody(): void;
            onheaderscomplete(): void;
            onmessagecomplete(): void;

            onmessagebegin(): void;
            onstatus(): void;
            onurl(url: string): void;
            onheaderfield(name: string): void;
            onheadervalue(value: string): void;
        }
    }

    export namespace crypto {
        const MD_MD5: number;
        const MD_SHA1: number;
        const MD_SHA256: number;
        const MD_SHA512: number;

        type DigestAlgorithm = "MD5" | "SHA1" | "SHA256" | "SHA512";
        function digest(algorithm: number | DigestAlgorithm, data: string | ArrayBuffer): ArrayBuffer;
    }

    export namespace mqtt {
        const PUBACK: number;
        const PUBLISH: number;
        const SUBACK: number;
        const CONNACK: number;
        const PINGRESP: number;

        function encodePing(): ArrayBuffer;
        function encodeDisconnect(): ArrayBuffer;
        function encodeUnsubscribe(topic: string): ArrayBuffer;
        function encodeConnect(options: any): ArrayBuffer;

        function encodeSubscribe(topic: string, dup, pid): ArrayBuffer;
        function encodePublish(topic: string, payload, dup, qos, retained, pid): ArrayBuffer;

        class Parser {
            onMessage(message: ArrayBuffer): void;
            execute(message: ArrayBuffer): void;
            offset(): number;
            compact(): void;
            capacity(): number;
            reset(): void;
        }
    }

    export class Error {
        constructor(errno: number);

        errno: number;
        message: string;

        static strerror(errno: number): string;
    }

    export class Stream {
        close(): void;
        onclose(): void;
        onend(): void;
        onerror(err: any): void;
        onmessage(message: ArrayBuffer): void;
        write(data: string | ArrayBuffer | Uint8Array): Promise<void>
    }

    export class TLS extends Stream {
        constructor(options: any);
        address(): any;
        remoteAddress(): any;
        accept(): TLS;
        bind(address: any): void;
        connect(address: any): Promise<void>
        listen(backlog?: number): void;
        onconnection(connection: TLS): void;
    }

    export class TCP extends Stream {
        _id: number;
        address(): any;
        remoteAddress(): any;
        accept(): TCP;
        bind(address: any): void;
        connect(address: any): Promise<void>
        listen(backlog?: number): void;
        onconnection(connection: TCP): void;
    }

    export class Pipe extends Stream {
        address(): any;
        remoteAddress(): any;
        accept(): Pipe;
        bind(address: any): void;
        open(fd: number): void;
        connect(address: any): Promise<void>
        listen(backlog?: number): void;

        onconnection(connection: Pipe): void;
        onopen(): void;
    }

    export class TTY extends Stream {
        static MODE_NORMAL: number;
        static MODE_RAW: number;
        static MODE_IO: number;

        constructor(fd: number, input?: boolean);
        read(): Promise<ArrayBuffer>;
    }

    const IPV6ONLY: number;
    const PARTIAL: number;
    const REUSEADDR: number;

    export interface SocketAddress {
        address?: string;
        port?: number;
    }

    export class UDP {
        close(): void;
        recv(): Promise<ArrayBuffer>;
        send(data: ArrayBuffer, socket: SocketAddress): Promise<void>;
        fileno(): number;
        address(): SocketAddress;
        remoteAddress(): SocketAddress;
        connect(address: SocketAddress): void;
        bind(address: SocketAddress): void;
        onmessage(data: ArrayBuffer): void;
        onerror(): void;
    }

    export class Worker {
        constructor(filename: string);

        postMessage(args: any[]): void;
        terminate(): void;

        onmessage(message: any): void;
        onmessageerror(): void;
        onerror(error?: any): void;
    }

    export namespace serial {
        const PARITY_NONE: number;
        const PARITY_ODD: number;
        const PARITY_EVEN: number;

        function setDTR(): void;
        function setRTS(): void;

        function open(device: string, baudRate?: number, parity?: number, dataBits?: number, stopBits?: number): number;

        class UART {
            constructor(fd: number);

            close(): void;
            onend(): void;
            onmessage(message: string): void;
            read(): Promise<ArrayBuffer>;
            write(data: ArrayBuffer): Promise<void>;
        }
    }

    export namespace zlib {
        class Reader {
            open(filename: string): number;
            close(): void;
            count(): number;
            stat(index: number): any;
            extract(index: number, outfile?: string): ArrayBuffer;
            extract(filename: string, outfile?: string): ArrayBuffer;
        }

        function add(zipname: string, filename: string, data: BufferSource): ArrayBuffer;
        function extract(zipname: string, filename: string): ArrayBuffer;
        function compress(data: BufferSource): ArrayBuffer;
        function uncompress(data: BufferSource, uncompressedSize: number): ArrayBuffer;
    }
}

declare module '@tjs/native' {
    export = native;
}

