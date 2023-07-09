
declare namespace native {
    export interface FileHandle {
        path: string;
        fd: number;
        write(data: string | ArrayBuffer, encoding?: string): Promise<void>;
        read(): Promise<ArrayBuffer>;
        stat(): Promise<any>;
        sync(): Promise<void>;
        close(): Promise<void>;
    }

    export interface Dir {

    }

    /**
     * 表示一个子进程
     */
    export interface ChildProcess {
        readonly pid: number;
        readonly stderr: TTY;
        readonly stdin: TTY;
        readonly stdout: TTY;

        /**
         * 发送一个信号
         * @param signal 
         */
        kill(signal?: number): void;

        /** 等待进程结束 */
        wait(): Promise<any>;

        connected: boolean;
        disconnect(): void;
        send(message: object): Promise<boolean>;
        wait(): Promise<ProcessResult>;
        ondisconnect(message: Event): void;
        onmessage(message: MessageEvent): void;
    }

    export interface ProcessResult {
        stdout?: string;
        stderr?: string;
        code?: number;
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

    export interface Timer {

    }

    export function alert(...data: any[]): void;
    export function clearInterval(timer: Timer): void;
    export function clearTimeout(timer: Timer): void;
    export function confirm(message: string): boolean;
    export function cwd(): string;
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
    export function prompt(message: string): string;
    export function random(buffer: ArrayBuffer, byteOffset?: number, byteLength?: number): void;
    export function setenv(key: string, value: string): void;
    export function setInterfal(func: Function, interval: number): Timer;
    export function setInterval(handler: Function, timeout: number, ...arguments: any[]): Timer;
    export function setTimeout(handler: Function, timeout: number, ...arguments: any[]): Timer;
    export function signal(signal?: number, handler?: (signal: number) => any): void;
    export function spawn(command: string | string[], options?: SpawnOptions): ChildProcess;
    export function strerror(errno: number): string;
    export function syslog(level: number, data: any): void;
    export function tmpdir(): string;
    export function uname(): void;
    export function unsetenv(name: string): void;
    export function write(...data: any[]): void;

    export namespace signals {
        const SIGTERM: number;
        const SIGKILL: number;
        const SIGUSR1: number;
    }

    export namespace errors {
        const UV_ENOENT: number;
    }

    export namespace fs {
        function access(path: string): Promise<void>;
        function chmod(path: string, mode: number): Promise<void>;
        function chown(path: string, uid: number, gid: number): Promise<void>;
        function copyFile(path: string, newPath: string): Promise<void>;
        function md5sum(path: string): Promise<ArrayBuffer>;
        function sha1sum(path: string): Promise<ArrayBuffer>;
        function lstat(path: string): Promise<void>;
        function mkdir(path: string): Promise<void>;
        function mkdtemp(): Promise<string>;
        function mkstemp(): Promise<FileHandle>;
        function open(path: string, flag: string, mode: number): Promise<FileHandle>;
        function opendir(path: string, options: any): Promise<Dir[]>;
        function readFile(path: string, encoding?: string): Promise<ArrayBuffer>;
        function readlink(path: string): Promise<string>;
        function realpath(path: string): Promise<string>;
        function rename(path: string, newPath: string): Promise<void>;
        function rm(path: string): Promise<void>;
        function rmdir(path: string): Promise<void>;
        function stat(path: string): Promise<void>;
        function statfs(path: string): Promise<void>;
        function symlink(target: string, newPath: string): Promise<void>;
        function truncate(path: string, lenght?: number): Promise<void>;
        function unlink(path: string): Promise<void>;
        function utimes(path: string): Promise<void>;
        function watch(path: string): Promise<void>;
    }

    export namespace os {
        const platform: string;

        function freemem(): number;
        function cpuinfo(): any[];
        function hostname(): string;
        function kill(pid: number, signal?: number): Promise<void>;
        function loadavg(): number[];
        function interfaces(): any[];
        function printHandles(): void;
        function printMemoryUsage(): void;
        function dumpObjects(): void;
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

        interface MQTTMessage {
            type: number;
        }

        function encodePing(): ArrayBuffer;
        function encodeDisconnect(): ArrayBuffer;
        function encodeUnsubscribe(topic: string): ArrayBuffer;
        function encodeConnect(options: any): ArrayBuffer;

        function encodeSubscribe(topic: string, dup, pid): ArrayBuffer;
        function encodePublish(topic: string, payload, dup, qos, retained, pid): ArrayBuffer;

        class Parser {
            onMessage(message: MQTTMessage): void;
            execute(message: ArrayBuffer): void;
            offset(): number;
            compact(): void;
            capacity(): number;
            reset(): void;
        }
    }

    export namespace uart {
        class UART {
            constructor(fd: number);

            close(): Promise<void>;
            read(): void;
            write(data: any): void;

            onmessage(data): void;
            onclose(): void;
            ondisconnect(): void;
        }

        const PARITY_NONE: number;
        const PARITY_ODD: number;
        const PARITY_EVEN: number;

        function open(device, baudRate, parityType, dataBits, stopBits): number;
        function setDTR(): void;
        function setRTS(): void;
    }

    export class Error {
        constructor(errno: number);

        errno: number;
        code: string;
        message: string;
    }

    export class Stream {
        close(): void;
        onclose(): void;
        onerror(err: any): void;
        onmessage(message: ArrayBuffer): void;
        write(data: string | ArrayBuffer | ArrayBufferView): Promise<void>
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
        onopen(connection: TLS): void;
        onconnect(connection: TLS): void;
    }

    export class TCP extends Stream {
        _id: number;
        address(): any;
        remoteAddress(): any;
        accept(): TCP;
        bind(address: any): void;
        connect(address: any): Promise<void>
        listen(backlog?: number): void;
        setNoDelay(noDelay: boolean): void;
        setKeepAlive(keepAlive: boolean, timeout: number): void;
        shutdown(): Promise<void>;

        onconnection(connection: TCP): void;
        onopen(connection: TLS): void;
        onconnect(connection: TLS): void;
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

    export interface UDPMessage {
        data?: ArrayBuffer;
        address?: SocketAddress;
    }

    export class UDP {
        close(): void;

        recv(): Promise<UDPMessage>;
        send(data: string | ArrayBuffer | ArrayBufferView, socket: SocketAddress): Promise<void>;

        fileno(): number;
        address(): SocketAddress;
        remoteAddress(): SocketAddress;
        connect(address: SocketAddress): void;
        disconnect(): void;
        bind(address: SocketAddress, flags?: number): void;

        onmessage(data: UDPMessage): void;
        onerror(error?: Error): void;
        onclose(): void;
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
            read(): Promise<ArrayBuffer>;
            write(data: ArrayBuffer): Promise<void>;

            onclose(): void;
            onmessage(message: string): void;
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

