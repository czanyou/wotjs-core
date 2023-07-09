
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

    /**
     * 加载测试套件
     * @param meta 
     */
    export function loadAll(meta: string | object): Promise<void>;

    /** 运行所有加载的测试套件和测试用例 */
    export function runAll(): Promise<void>;

    /** 添加一个测试用例 */
    export function test(description: string, testFunction: Function): void;

    /** 
     * 休眠并等待一段时间
     * @param timeout
     */
    export function sleep(timeout: number): Promise<void>;

    /** 
     * 设置一个超时定时器 
     * @param timeout 超时时间
     * @param callback 超时回调函数
     */
    export function startTimeout(timeout: number, callback: Function): void;

    /** 停止超时定时器 */
    export function stopTimeout(): void;

    /** 等待超时定时器结束或被中止 */
    export function waitTimeout(): Promise<void>;

    export namespace assert {

        /**
         * Expects the function fn does not throw an error.
         * @param fn 
         * @param expected 
         * @param message will be appended to the message provided by the AssertionError
         */
        function doesNotThrow(func: Function, expected: any, description?: string): void;

        /**
         * Tests strict equality between the actual and expected parameters
         * @param actual 
         * @param expected 
         * @param message will be appended to the message provided by the AssertionError
         */
        function equal(actual: any, expected: any, description?: string): void;

        /**
         * Throws an AssertionError with the provided error message or a default error message. 
         * If the message parameter is an instance of an Error then it will be thrown instead of the AssertionError.
         * @param message Default: 'Failed'
         */
        function fail(description?: string): void;
        function is(actual: any, expected: any, description?: string): void;

        /**
         * Tests strict inequality between the actual and expected parameters
         * @param actual 
         * @param expected 
         * @param message will be appended to the message provided by the AssertionError
         */
        function notEqual(actual: any, expected: any, description?: string): void;

        /**
         * Tests if value is truthy. It is equivalent to assert.equal(!!value, true, message).
         * @param actual 
         * @param message will be appended to the message provided by the AssertionError
         */
        function ok(actual: boolean | any, description?: string): void;

        /**
         * Expects the function fn to throw an error.
         * @param fn 
         * @param expected 
         * @param message will be appended to the message provided by the AssertionError
         */
        function throws(func: Function, expected: any, description?: string): void;
    }

    export default assert;
}

declare module '@tjs/bluetooth' {
    export class BluetoothDevice {

    }

    /**
     * 返回所有设备
     * @returns 设备列表
     */
    export function getDevices(): Promise<BluetoothDevice[]>;

    /**
     * 请求指定的设备
     * @param options 设备名称或索引
     */
    export function requestDevice(options: string | number): Promise<BluetoothDevice>;
}

declare module '@tjs/config' {
    /**
     * Config File
     */
    export class Config {
        readonly data: Map<String, String> | any;

        readonly filename: string;

        readonly lastModified: number;

        constructor(name: string, basepath?: string);

        /**
         * Get the config value(s) to stdout.
         * @param name 
         */
        get(name: string | string[], type?: Boolean | String | Number | null | any): string | any;

        /**
         * Save to file.
         */
        flush(): Promise<any>;

        /**
         * Show all the config settings.
         */
        list(): Map<string, string>;

        /**
         * Load from file.
         */
        load(cache?: boolean): Promise<any>;

        /**
         * Save to file.
         */
        save(): Promise<any>;

        /**
         * Set a value in the configuration
         * @param name 
         * @param value 
         */
        set(name: string | object, value?: string | number | boolean): Promise<any>;

        /**
         * Deletes the specified keys from configuration file.
         * @param name 
         */
        unset(name: string): Promise<any>;
    }

    export function load(name: string, basepath?: string): Promise<Config>;
}

declare module '@tjs/devices' {

    export namespace adc {
        function read(id?: number): number;
        function close(id?: number): void;
    }

    /** 代表一个硬件看门狗设备 */
    export interface Watchdog {
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

        /** 设置新的超时时间，一般建议为 60s，单位为秒. */
        setTimeout(timeout: number): void
    }

    /**
     * 返回所有设备
     * @returns 设备列表
     */
    export function getDevices(): Promise<Watchdog[]>

    /**
     * 请求指定的设备
     * @param options 设备名称或索引
     */
    export function requestDevice(options: string | number): Promise<Watchdog>
}

declare module '@tjs/getopts' {
    export interface Options {
        /**
         * An object of option aliases. An alias can be a string or an array of strings. 
         * Aliases let you declare substitute names for an option, e.g., 
         * the short (abbreviated) and long (canonical) variations.
         */
        alias?: { [key: string]: string | string[] };

        /**
         * An array of flags to parse as strings. In the example below, t is parsed as a string, 
         * causing all adjacent characters to be treated as a single value and not as individual options.
         */
        string?: string[];

        /**
         * An array of options to parse as boolean. In the example below, t is parsed as a boolean, 
         * causing the following argument to be treated as an operand.
         */
        boolean?: string[];

        /**
         * An object of default values for options not present in the arguments array.
         */
        default?: { [key: string]: any };

        /**
         * We call this function for each unknown option. Return false to discard the option. 
         * Unknown options are those that appear in the arguments array, 
         * but are not in opts.string, opts.boolean, opts.default, or opts.alias.
         */
        unknown?: (option: string) => any;

        /** 
         * A boolean property. If true, the operands array _ will be populated with all 
         * the arguments after the first operand.
         */
        stopEarly?: boolean;
    }

    /**
     * Parse command-line arguments. Returns an object mapping argument names to their values.
     * @param argv An array of arguments, usually process.argv.
     * @param options 
     */
    export function getopts(argv: string[], options?: Options): { [key: string]: boolean | number | string | string[] };
}

declare module '@tjs/gpio' {
    export interface GPIOOptions {
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
    export interface GPIO {
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

    /** 输入端口 */
    export interface Input {
        handle: GPIO

        /** 关闭这个端口 */
        close(): Promise<void>

        /** 检查是否为 on */
        isOn(): Promise<boolean>

        /** 检查是否为 off */
        isOff(): Promise<boolean>

        /** 当输入状态发生改变时调用这个方法 */
        onstatechange(isOn: boolean): void

        /** 设置输出状态为 on */
        setOn(): Promise<void>

        /** 设置输出状态为 off */
        setOff(): Promise<void>

        /** 切换输出状态 */
        toggle(): Promise<void>
    }

    /** 输出端口 */
    export interface Output extends Input {
        /** 设置输出状态为 on */
        setOn(): Promise<void>

        /** 设置输出状态为 off */
        setOff(): Promise<void>

        /** 切换输出状态 */
        toggle(): Promise<void>
    }

    export function init(config: any, init?: boolean): Promise<void>;


    export function open(device: string, options: number | GPIOOptions): GPIO;

    /** 导出一个端口 */
    export function exports(port: number): Promise<void>;

    /** 反导出一个端口 */
    export function unexport(port: number): Promise<void>;

    /**
     * 返回所有输入输出设备
     * @returns 设备列表
     */
    export function getDevices(): Promise<Input[] | Output[]>

    /**
     * 请求指定的输入输出设备
     * @param options 输入输出设备名称或索引
     */
    export function requestDevice(options: string | number): Promise<Input | Output>
}

declare module '@tjs/logs' {
    /** 日志输出 */
    namespace Log {
        export function init(config: any): void;

        /** 配置日志输出 */
        export function config(config: any): string

        /** 输出 debug 级别日志信息 */
        export function d(tag: string, ...args: any[]): void

        /** 输出 info 级别日志信息 */
        export function i(tag: string, ...args: any[]): void

        /** 输出 warn 级别日志信息 */
        export function w(tag: string, ...args: any[]): void

        /** 输出 error 级别日志信息 */
        export function e(tag: string, ...args: any[]): void

        /** 根据 import.meta 生成日志 tag */
        export function tag(meta: any): string
    }

    export default Log;
}

declare module '@tjs/location' {
    export class LocationDevice {

    }

    /**
     * 返回所有设备
     * @returns 设备列表
     */
    export function getDevices(success, error, options): Promise<LocationDevice[]>

    /**
     * 请求指定的设备
     * @param options 设备名称或索引
     */
    export function requestDevice(success, error, options): Promise<LocationDevice>

    export function clearWatch(id): void;
}

declare module '@tjs/media' {
    export class MediaDevice {

    }

    /**
     * 返回所有设备
     * @returns 设备列表
     */
    export function getDevices(): Promise<MediaDevice[]>

    /**
     * 请求指定的设备
     * @param options 设备名称或索引
     */
    export function requestDevice(options: string | number): Promise<MediaDevice>

    export function decodingInfo(mediaConfig): any;

    export function encodingInfo(mediaConfig): any;
}

declare module '@tjs/serial' {
    /**
     * UART options
     * 串口设备选项
     */
    export interface SerialPortOptions {
        /** Baud rate, defaults to 9600 */
        baudRate: number;

        /** Data bits, defaults to 8. */
        dataBits: number;

        /** Stop bits, defaults to 1 */
        stopBits: number;

        /** Parity, defaults to "none", could be either of "none", "odd" or "even". */
        parity: string,

        /** Flow control, defaults to "none", could be either of "none", "hardware" or "software". */
        flowControl: string;
    }

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
        device: string,

        /** 串口设备索引 */
        index: number,

        /** 串口名称 */
        name: string
    }

    /**
     * 串口设备
     */
    export class SerialPort extends EventTarget {
        /** 关闭这个串口设备 */
        close(): Promise<void>

        /** 返回当前串口设备信息 */
        getInfo(): any

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
        write(data: ArrayBuffer | Uint8Array | string): Promise<void>

        onconnect(): void
        
        ondisconnect(): void

        onend(): void

        /**
         * 当收到新数据
         * @param data 数据
         */
        onmessage(data: ArrayBuffer): void
    }

    export function open(device: string, options: number | SerialPortOptions): SerialPortHandle;

    export function setRTS(fd: number, flags?: number): Promise<void>
    export function setDTR(fd: number, flags?: number): Promise<void>

    /**
     * 返回所有串口设备
     * @returns 设备列表
     */
    export function getDevices(): Promise<SerialPort[]>

    /**
     * 请求指定的串口设备
     * @param options 串口名称或索引
     */
    export function requestDevice(options: string | number): Promise<SerialPort>;
}
