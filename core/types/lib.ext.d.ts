/**
 * 断言测试
 */
declare module '@tjs/assert' {

    /**
     * A subclass of Error that indicates the failure of an assertion.
     */
    export class AssertionError extends Error {
        /** Set to the actual argument for methods such as assert.equal(). */
        actual: any;

        /** Set to the expected value for methods such as assert.equal(). */
        expected: any;

        /** Set to the passed in operator value. */
        operator: string;

        /** Value is always ERR_ASSERTION to show that the error is an assertion error. */
        code: string;
    }

    /**
     * Tests if value is truthy. It is equivalent to assert.equal(!!value, true, message).
     * @param actual 
     * @param message will be appended to the message provided by the AssertionError
     */
    export function assert(actual: any, message?: string): void;

    /**
     * Expects the function fn does not throw an error.
     * @param fn 
     * @param expected 
     * @param message will be appended to the message provided by the AssertionError
     */
    export function doesNotThrow(fn: Function, expected: any, message?: string): void;

    /**
     * Tests strict equality between the actual and expected parameters
     * @param actual 
     * @param expected 
     * @param message will be appended to the message provided by the AssertionError
     */
    export function equal(actual: any, expected: any, message?: string): void;

    /**
     * Throws an AssertionError with the provided error message or a default error message. 
     * If the message parameter is an instance of an Error then it will be thrown instead of the AssertionError.
     * @param message Default: 'Failed'
     */
    export function fail(message?: string | Error): void;


    export function is(actual: any, expected: any, message?: string): void;

    /**
     * Expects the string input to match the regular expression.
     * @param string 
     * @param regexp 
     * @param message will be appended to the message provided by the AssertionError
     */
    export function match(string: string, regexp: RegExp, message?: string | Error): void;

    /**
     * Tests strict inequality between the actual and expected parameters
     * @param actual 
     * @param expected 
     * @param message will be appended to the message provided by the AssertionError
     */
    export function notEqual(actual: any, expected: any, message?: string): void;

    /**
     * Tests if value is truthy. It is equivalent to assert.equal(!!value, true, message).
     * @param actual 
     * @param message will be appended to the message provided by the AssertionError
     */
    export function ok(actual: any, message?: string): void;

    /**
     * Expects the function fn to throw an error.
     * @param fn 
     * @param expected 
     * @param message will be appended to the message provided by the AssertionError
     */
    export function throws(fn: Function, expected: any, message?: string): void;
}

/**
 * 配置参数读取和保存
 */
declare module '@tjs/config' {
    /**
     * Config File
     */
    export class Config {
        /** 所有数据 */
        readonly data: { [key: string]: string };

        /** 文件名 */
        readonly filename: string;

        /** 最后修改时间 */
        readonly lastModified: number;

        /** 名称 */
        readonly name: string;

        /** 
         * Returns the number of key/value pairs.
         * 返回一个整数，表示存储在 Config 对象里的数据项（data items）数量。 
         */
        readonly length: number;

        /** 分组 */
        sections: string[];

        /**
         * 
         * @param name 
         * @param basepath 
         */
        constructor(name: string, basepath?: string);

        /**
         * Removes all key/value pairs, if there are any.
         */
        clear(): undefined;

        /**
         * Get the array config value(s).
         * @param name 
         */
        getArray(name: string, options?: { flat?: boolean }): any[] | undefined;

        /**
         * Get the boolean config value(s).
         * - true (1)
         * - false (0)
         * @param name 
         */
        getBoolean(name: string): boolean | undefined;

        /**
         * Returns the current value associated with the given key, or null if the given key does not exist.
         * @param name 
         */
        getItem(name: string): string | undefined;

        /**
         * Get the number config value(s).
         * - 10 进制整数和浮点数：124.56
         * - 16 进制整数：0x1234
         * @param name 
         */
        getNumber(name: string): number | undefined;

        /**
         * Get the object config value(s).
         * @param name 
         */
        getObject(name?: string, options?: { flat?: boolean }): { [key: string]: any } | undefined;

        /**
         * Get the string config value(s).
         * - 默认都为字符串
         * - 带双引号的字符串
         * @param name 
         */
        getString(name: string): string | undefined;

        /**
         * Save to file.
         */
        flush(): Promise<boolean>;

        /**
         * Load from file.
         */
        load(strings?: string): Promise<boolean>;

        /**
         * Load from string.
         */
        parse(strings?: string, options?: any): boolean;

        /**
         * Removes the key/value pair with the given key, if a key/value pair with the given key exists.
         * @param name 
         */
        removeItem(name: string): boolean;

        /**
         * Rename the given section to a new name.
         * @param oldName 
         * @param newName 
         */
        renameSection(oldName: string, newName: string): boolean;

        /**
         * Remove the given section from the configuration file.
         * @param name 
         */
        removeSection(name: string): boolean;

        /**
         * Save to file.
         * @param filename 
         */
        save(filename?: string): Promise<boolean>;

        /**
         * Set a value in the configuration
         * @param name 
         * @param value 
         */
        set(name: string | object, value?: string | number | boolean): boolean;

        /**
         * Set a value in the configuration
         * @param name 
         * @param value 
         */
        setItem(name: string, value?: string | number | boolean): boolean;

        /**
         * Encode as string
         */
        stringify(): string;

        /**
         * Encode as JavaScript object.
         */
        toObject(): { [key: string]: any };

        /**
         * Encode as JSON string
         */
        toJSON(): string;
    }

    /**
     * 加载指定的名称的配置文件
     * @param name 配置文件名称，不包含扩展名在内
     * @param basepath 配置文件所在的路径，如果没有指定，默认为 `/usr/local/tjs/conf`。
     */
    export function load(name: string, basepath?: string): Promise<Config>;

    /**
     * 
     * @param filename 
     */
    export function open(filename: string): Promise<Config>;
}

/**
 * 提供 Watchdog 等设备访问接口
 */
declare module '@tjs/devices' {

    export namespace adc {
        function read(id?: number): number;
        function close(id?: number): void;
    }

    /** 代表一个硬件看门狗设备 */
    export interface Watchdog {
        fileno?: number

        device?: string

        /** 关闭这个设备 */
        close(): void

        /** 
         * 打开这个设备
         * - 注意打开设备后会自动启用看门狗功能
         * - 应用程序必须在超时时间内不停地喂狗，否则系统会自动重启
         */
        open(): boolean

        /** 禁用看门狗功能 */
        disable(): void

        /** 启用看门狗功能 */
        enable(): void

        /** 喂狗，系统保活 */
        keepalive(): void

        /** 返回当前设置的超时时间，单位为秒. */
        getTimeout(): number

        /** 指出是否开启了看门狗 */
        isEnabled(): boolean

        reset(): any;

        /** 设置新的超时时间，一般建议为 60s，单位为秒. */
        setTimeout(timeout: number): void
    }

    /**
     * 返回所有设备
     * @returns 设备列表
     */
    export function getWatchdogs(): Promise<Watchdog[]>

    /**
     * 请求指定的设备
     * @param options 设备名称或索引
     */
    export function requestWatchdog(options: { name?: string }): Promise<Watchdog>
}

/**
 * 提供 GPIO 口设备访问接口
 */
declare module '@tjs/gpio' {
    export interface GpioOptions {
        /** The direction of the interface, could either be "in" or "out". */
        direction: string;

        /** The edge of the interface that controls interrupt events, could be one of "none", "rising", "falling" or "both". */
        edge: string;

        /** The initial electrical level of the interface, could be either "low" or "high" */
        level: string;
    }

    /**
     * 代表一个 IO 口
     */
    export interface GpioHandle {
        /** 端口号 */
        port: number;

        /** 名称 */
        name: string;

        /** 初始输入输出级别 */
        level: string;

        /** 输入输出方向 */
        direction: string;

        /** 边缘触发方式 */
        edge: string;

        /** 当前值 */
        value: number;

        /** 设备 */
        device: string;

        /** 关闭这个端口 */
        close(): Promise<void>

        /** 输入输出方向 */
        getDirection(): Promise<string>;

        /** 边缘触发方式 */
        getEgde(): Promise<string>;

        /** 打开这个端口 */
        open(): Promise<void>;

        /**
         * Read from the interface, the value would be either Level.low (0) or Level.high (1).
         */
        read(): Promise<number>;

        /** 输入输出方向 */
        setDirection(direction: string): Promise<void>;

        /** 边缘触发方式 */
        setEdge(edge: string): Promise<void>;

        /**
         * Write to the interface.
         * @param value Could be one of the values under Level (0 or 1).
         */
        write(value: number): Promise<void>;
    }

    /** 输入输出端口 */
    export interface GpioPort {
        handle: GpioHandle

        /** 关闭这个端口 */
        close(): Promise<void>

        /** 检查是否为 off */
        isOff(): Promise<boolean>

        /** 检查是否为 on */
        isOn(): Promise<boolean>

        /** 设置输出状态为 off */
        setOff(): Promise<void>

        /** 设置输出状态为 on */
        setOn(): Promise<void>

        /** 切换输出状态 */
        toggle(): Promise<void>

        /** 当输入状态发生改变时调用这个方法 */
        onstatechange?(isOn: boolean): void
    }

    export function closePorts(): Promise<void>;

    /**
     * 返回所有输入输出设备
     * @returns 设备列表
     */
    export function getPorts(): Promise<GpioPort[]>

    /**
     * 请求指定的输入输出设备
     * @param options 输入输出设备名称或索引
     */
    export function requestPort(options: {}): Promise<GpioPort>

    /**
     * 配置 GPIO 端口
     * @param options 
     * @param init 
     */
    export function setPortInfos(options: any): void;

    export class Gpio {
        /**
         * @param name I/O 口的名称
         */
        constructor(name: string);

        /**
         * 查询当前值
         */
        getValue(): number;

        /**
         * 设置为输入
         */
        setInput(): number;

        /**
         * 设置为输出
         * @param value 输出值
         */
        setOutput(value: number): number;
    }
}

/**
 * 日志管理
 */
declare module '@tjs/logs' {
    export interface LogConfig {
        /** 进程名 */
        name: string,

        /** 日志输出方式 `syslog`, `console` */
        type?: string,

        /** 日志输出级别 `log` | `info` | `warn` | `error` */
        level?: string
    }

    export namespace syslog {

        /**
         * 初始化 syslog 日志输出
         * @param name 进程名
         */
        export function open(name: string): void;

        /**
         * 输出 syslog 日志
         * @param level 日志级别
         * @param data 日志消息
         */
        export function log(level: number, data: string): void;
    }

    /**
     * 配置控制台日志输出
     * @param config 日志配置参数
     */
    export function config(config?: LogConfig): LogConfig;
}

declare module '@tjs/shell' {

    import * as fs from '@tjs/fs';
    import * as os from '@tjs/os';

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

    export interface Shell {

        readonly $0: number;

        /** CPU 架构类型 */
        readonly arch: string;

        /** 命令行参数 */
        readonly args: string[];

        /** 主板类型 */
        readonly board: string;

        /** 脚本目录 */
        readonly error?: Error;

        /** 执行文件目录 */
        readonly execPath: string;

        /** 进程 ID */
        readonly pid: number;

        /** 父进程 ID */
        readonly ppid: number;

        /** 操作系统类型 */
        readonly platform: string;

        /** 根目录 */
        readonly rootPath: string;

        /** 脚本目录 */
        readonly scriptPath: string;

        /** 检查文件访问权限 */
        access(path: string, mode?: number): Promise<number>;

        /** 写入数据到文件尾 */
        append(path: string, data: ArrayBuffer | string): Promise<void>;

        /**
         * 返回文件名部分
         * @param path 路径
         */
        basename(path: string, extName?: string): string;

        /** 
         * 改变当前进程的工作目录
         */
        cd(directory: string): void;

        /** 修改文件访问权限 */
        chmod(path: string, mode: number): Promise<void>;

        /** 修改文件用户和用户组 */
        chown(path: string, uid: number, gid: number): Promise<void>;

        /** 复制文件或目录 */
        cp(src: string, dest: string, options?: { force?: boolean, recursive?: boolean }): Promise<void>;

        /**
         * 返回路径所属的目录名
         * @param path 
         */
        dirname(path: string): string;

        /** 打印到控制台 */
        echo(...args: any[]): void;

        /** 执行 shell 命令 */
        exec(...args: string[]): Promise<os.ProcessResult>;

        /** 检查指定的文件或目录是否存在 */
        exists(path: string): Promise<boolean>;

        /**
         * Exit the process with optional exit code.
         * 以 `code` 的退出状态同步终止进程。 
         * @param code 退出码，默认为 `0`
         */
        exit(code?: number): void

        /**
         * returns the extension of the path, from the last occurrence of the . (period) 
         * character to end of string in the last portion of the path. 
         * If there is no . in the last portion of the path, or if there are no . characters 
         * other than the first character of the basename of path (see path.basename()) , 
         * an empty string is returned.
         * @param path 
         */
        extname(path: string): string;

        /** 
         * Retrieve the value of an environment variable.
         * 查询环境变量 
         */
        getenv(name: string): string

        /** 返回当前进程用户 ID */
        getgid(): number;

        /** 返回当前进程用户组 ID */
        getuid(): number;

        /** 用户主目录 */
        homedir(): string;

        /** 主机名称 */
        hostname(): string;

        /**
         * 指出是否是绝对路径
         * @param path 
         */
        isAbsolute(path: string): boolean;

        /**
         * 连接路径名
         * @param args A sequence of path segments
         */
        join(...args: string[]): string;

        /** 发送信号 */
        kill(pid: number, siganl: number): void;

        /** 创建符号链接文件 */
        ln(target: string, path: string): Promise<void>;

        /** 计算文件 Hash 值 */
        md5sum(path: string): Promise<string>;

        /** 创建一个目录 */
        mkdir(path: string, options?: { recursive?: boolean, mode?: string | number }): Promise<void>;

        /** 创建一个临时目录 */
        mkdtemp(prefix: string): Promise<string>;

        /** 显示进度条 */
        progress(percent: number, name: string): void;

        /** 当前工作目录 */
        pwd(): string;

        /** 读取目录内容 */
        readdir(path: string): Promise<fs.Dirent[]>;

        /**
         * Asynchronously reads the entire contents of a file.
         * @param filename 文件名
         */
        read(filename: string): Promise<string>;

        /** 读取符号链接所指向的位置 */
        readlink(path: string): Promise<string>;

        /** 返回真实路径 */
        realpath(path: string): Promise<string>;

        /** 重启设备 */
        reboot(): number;

        /** 重命名或者移动文件 */
        mv(oldPath: string, newPath: string): Promise<void>;

        /** 删除文件 */
        rm(path: string, options?: { force?: boolean, recursive?: boolean }): Promise<void>;

        /** 删除目录 */
        rmdir(path: string): Promise<void>;

        /** 
         * Set the value of an environment variable.
         * 设置环境变量 
         */
        setenv(name: string, value: string): void

        /** 计算文件 Hash 值 */
        sha1sum(path: string): Promise<string>;

        /** 
         * 休眠 
         * @param time 单位为毫秒
         */
        sleep(time: number): Promise<void>;

        /** stat */
        stat(path: string): Promise<fs.Stats>;

        /** 临时文件目录 */
        tmpdir(): string;

        /** 截断文件 */
        truncate(path: string, len: number): Promise<void>;

        /** 操作系统信息 */
        uname(): { sysname: string, release: string, version: string, machine: string };

        /** 删除文件 */
        unlink(path: string): Promise<void>;

        /** 
         * Delete the value of an environment variable.
         * 删除环境变量 
         */
        unsetenv(name: string): void

        /** 系统启动时间, 单位为秒 */
        uptime(): number;

        /** 修改文件时间 */
        utimes(path: string, atime: number | Date, mtime: number | Date): Promise<void>;

        /** 查找可执行文件所在的目录 */
        which(command: string): Promise<string>;

        /**
         * Asynchronously writes data to a file, replacing the file if it already exists. 
         * @param filename 文件名
         * @param data 要写入的数据
         */
        write(filename: string, data: string | ArrayBuffer | ArrayBufferView): Promise<void>;
    }

    /**
     * 创建一个新的 Shell 实例
     */
    export function shell(): Shell;

    /**
     * 默认的 Shell 实例
     */
    const defaultShell: Shell;
    export default defaultShell;
}

/**
 * 提供串口设备访问接口
 */
declare module '@tjs/serial' {
    /**
     * UART options
     * 串口设备选项
     */
    export interface SerialPortOptions {
        /** Baud rate, defaults to 9600 */
        baudRate: number;

        /** 
         * An unsigned long integer indicating the size of the read and write buffers that are to be established. 
         * If not passed, defaults to 255. 
         */
        bufferSize?: number;

        /** Data bits, defaults to 8. */
        dataBits?: number;

        /** Stop bits, defaults to 1 */
        stopBits?: number;

        /** Parity, defaults to "none", could be either of "none", "odd" or "even". */
        parity?: string,

        /** Flow control, defaults to "none", could be either of "none", "hardware" or "software". */
        flowControl?: string;

        /** 串口的名称 */
        name?: string;

        /** 串口设备的名称，如 `/dev/ttyS0` */
        device?: string;
    }

    export interface SerialPortSignals {
        /** A boolean indicating to the other end of a serial connection that is is clear to send data. */
        clearToSend?: boolean,

        /** A boolean that toggles the control signal needed to communicate over a serial connection. */
        dataCarrierDetect?: boolean,

        /** A boolean indicating whether the device is ready to send and receive data. */
        dataSetReady?: boolean,

        /** A boolean indicating whether a ring signal should be sent down the serial connection. */
        ringIndicator?: boolean,

        dataTerminalReady?: boolean,

        requestToSend?: boolean,
    }

    /**
     * 串口设备句柄
     */
    export interface SerialPortHandle {
        close(): Promise<void>;
        flush(): void;
        fileno(): number;
        read(): Promise<ArrayBuffer>;
        wait(): void;
        write(data: ArrayBuffer | string): Promise<number>;

        onclose(): void;
        onmessage(data: ArrayBuffer): void;

        device: string;
        options: SerialPortOptions;
        port: number;
    }

    /** 串口设备信息 */
    export interface SerialPortInfo {
        /** 串口设备文件名 */
        device?: string,

        /** 串口设备索引 */
        index?: number,

        /** 串口名称 */
        name?: string
    }

    /**
     * 串口设备
     */
    export class SerialPort extends EventTarget {
        constructor(info: SerialPortInfo);

        readonly handle: any;

        /** 关闭这个串口设备 */
        close(): void

        /** 返回当前串口设备信息 */
        getInfo(): Promise<SerialPortInfo>

        /**
         * 打开当前串口
         * @param options 
         */
        open(options: SerialPortOptions): Promise<void>

        /**
         * 从缓存区读取数据
         * @returns 读取到的数据
         */
        read(): Promise<ArrayBuffer>

        /**
         * 发送数据
         * @param data 要发送的数据
         */
        write(data: ArrayBuffer | Uint8Array | string): Promise<number>

        /** 
         * Sets control signals on the port and returns a Promise that resolves when they are set. 
         */
        setSignals(signals?: SerialPortSignals): Promise<void>

        /** 
         * Returns a Promise that resolves with an object containing the current state of the port's control signals. 
         */
        getSignals(): Promise<SerialPortSignals>

        /**
         * An event handler called when the port has connected to the device.
         */
        onconnect?(event: Event): void

        /**
         * An event handler called when the port has disconnected from the device.
         */
        ondisconnect?(event: Event): void

        /**
         * 当收到新数据
         * @param event 数据数据
         */
        onmessage?(event: MessageEvent): void
    }

    /**
     * 关闭所有已经打开的串口设备
     */
    export function closePorts(): Promise<void>

    /**
     * 返回所有串口设备
     * @returns 设备列表
     */
    export function getPorts(): Promise<SerialPort[]>

    /** 
     * Returns a Promise that resolves when the port is opened. 
     * By default the port is opened with 8 data bits, 1 stop bit and no parity checking. 
     */
    export function open(device: string, options: number | SerialPortOptions): SerialPortHandle;

    /**
     * 请求指定的串口设备
     * @param options 串口名称或索引
     */
    export function requestPort(options?: { [key: string]: any }): Promise<SerialPort>;

    /**
     * 初始化设备列表
     * @param options 
     */
    export function setDeviceInfos(options?: { [key: string]: any }): void;
}

/**
 * 单元测试框架
 */
declare module '@tjs/test' {
    /**
     * 加载测试套件
     * @param meta 
     */
    export function loadAll(meta: string | object): Promise<void>;

    /** 运行所有加载的测试套件和测试用例 */
    export function runAll(): Promise<void>;

    /** 
     * Register a test which will be run when test is used on the command 
     * line and the containing module looks like a test module.
     * 添加一个测试用例 
     */
    export function test(description: string, fn: Function): void;

    /** 
     * 休眠并等待一段时间
     * @param timeout
     */
    export function sleep(timeout: number): Promise<void>;
}
