
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
     * ??????????????????
     * @param meta 
     */
    export function loadAll(meta: string | object): Promise<void>;

    /** ???????????????????????????????????????????????? */
    export function runAll(): Promise<void>;

    /** ???????????????????????? */
    export function test(description: string, testFunction: Function): void;

    /** 
     * ???????????????????????????
     * @param timeout
     */
    export function sleep(timeout: number): Promise<void>;

    /** 
     * ??????????????????????????? 
     * @param timeout ????????????
     * @param callback ??????????????????
     */
    export function startTimeout(timeout: number, callback: Function): void;

    /** ????????????????????? */
    export function stopTimeout(): void;

    /** ??????????????????????????????????????? */
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
     * ??????????????????
     * @returns ????????????
     */
    export function getDevices(): Promise<BluetoothDevice[]>;

    /**
     * ?????????????????????
     * @param options ?????????????????????
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

    /** ????????????????????????????????? */
    export interface Watchdog {
        /** ?????????????????? */
        close(): void

        /** 
         * ??????????????????
         * - ???????????????????????????????????????????????????
         * - ?????????????????????????????????????????????????????????????????????????????????
         */
        open(): boolean

        /** ????????????????????? */
        disable(): void

        /** ????????????????????? */
        enable(): void

        /** ????????????????????? */
        keepalive(): void

        /** ????????????????????????????????????????????????. */
        getTimeout(): number

        /** ?????????????????????????????? */
        isEnabled(): boolean

        /** ?????????????????????????????????????????? 60s???????????????. */
        setTimeout(timeout: number): void
    }

    /**
     * ??????????????????
     * @returns ????????????
     */
    export function getDevices(): Promise<Watchdog[]>

    /**
     * ?????????????????????
     * @param options ?????????????????????
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
     * ???????????? IO ???
     */
    export interface GPIO {
        /** ????????? */
        port: number;

        /** ?????? */
        name: string;

        /** ???????????????????????? */
        level: string;

        /** ?????????????????? */
        direction: string;

        /** ?????????????????? */
        edge: string;

        /** ?????????????????? */
        close(): Promise<void>

        /** ?????????????????? */
        getDirection(): Promise<string>;

        /** ?????????????????? */
        getEgde(): Promise<string>;

        /** ?????????????????? */
        open(): Promise<void>;

        /**
         * Read from the interface, the value would be either Level.low (0) or Level.high (1).
         */
        read(): Promise<number>;

        /** ?????????????????? */
        setDirection(direction: string): Promise<void>;

        /** ?????????????????? */
        setEdge(edge: string): Promise<void>;

        /**
         * Write to the interface.
         * @param value Could be one of the values under Level (0 or 1).
         */
        write(value: number): Promise<void>;
    }

    /** ???????????? */
    export interface Input {
        handle: GPIO

        /** ?????????????????? */
        close(): Promise<void>

        /** ??????????????? on */
        isOn(): Promise<boolean>

        /** ??????????????? off */
        isOff(): Promise<boolean>

        /** ???????????????????????????????????????????????? */
        onstatechange(isOn: boolean): void

        /** ????????????????????? on */
        setOn(): Promise<void>

        /** ????????????????????? off */
        setOff(): Promise<void>

        /** ?????????????????? */
        toggle(): Promise<void>
    }

    /** ???????????? */
    export interface Output extends Input {
        /** ????????????????????? on */
        setOn(): Promise<void>

        /** ????????????????????? off */
        setOff(): Promise<void>

        /** ?????????????????? */
        toggle(): Promise<void>
    }

    export function init(config: any, init?: boolean): Promise<void>;


    export function open(device: string, options: number | GPIOOptions): GPIO;

    /** ?????????????????? */
    export function exports(port: number): Promise<void>;

    /** ????????????????????? */
    export function unexport(port: number): Promise<void>;

    /**
     * ??????????????????????????????
     * @returns ????????????
     */
    export function getDevices(): Promise<Input[] | Output[]>

    /**
     * ?????????????????????????????????
     * @param options ?????????????????????????????????
     */
    export function requestDevice(options: string | number): Promise<Input | Output>
}

declare module '@tjs/logs' {
    /** ???????????? */
    namespace Log {
        export function init(config: any): void;

        /** ?????????????????? */
        export function config(config: any): string

        /** ?????? debug ?????????????????? */
        export function d(tag: string, ...args: any[]): void

        /** ?????? info ?????????????????? */
        export function i(tag: string, ...args: any[]): void

        /** ?????? warn ?????????????????? */
        export function w(tag: string, ...args: any[]): void

        /** ?????? error ?????????????????? */
        export function e(tag: string, ...args: any[]): void

        /** ?????? import.meta ???????????? tag */
        export function tag(meta: any): string
    }

    export default Log;
}

declare module '@tjs/location' {
    export class LocationDevice {

    }

    /**
     * ??????????????????
     * @returns ????????????
     */
    export function getDevices(success, error, options): Promise<LocationDevice[]>

    /**
     * ?????????????????????
     * @param options ?????????????????????
     */
    export function requestDevice(success, error, options): Promise<LocationDevice>

    export function clearWatch(id): void;
}

declare module '@tjs/media' {
    export class MediaDevice {

    }

    /**
     * ??????????????????
     * @returns ????????????
     */
    export function getDevices(): Promise<MediaDevice[]>

    /**
     * ?????????????????????
     * @param options ?????????????????????
     */
    export function requestDevice(options: string | number): Promise<MediaDevice>

    export function decodingInfo(mediaConfig): any;

    export function encodingInfo(mediaConfig): any;
}

declare module '@tjs/serial' {
    /**
     * UART options
     * ??????????????????
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

    /** ?????????????????? */
    export interface SerialPortInfo {
        /** ????????????????????? */
        device: string,

        /** ?????????????????? */
        index: number,

        /** ???????????? */
        name: string
    }

    /**
     * ????????????
     */
    export class SerialPort extends EventTarget {
        /** ???????????????????????? */
        close(): Promise<void>

        /** ?????????????????????????????? */
        getInfo(): any

        /**
         * ??????????????????
         * @param options 
         */
        open(options: SerialPortOptions): Promise<void>

        /**
         * ????????????????????????
         * @returns ??????????????????
         */
        read(): Promise<ArrayBuffer>

        /**
         * ????????????
         * @param data ??????????????????
         */
        write(data: ArrayBuffer | Uint8Array | string): Promise<void>

        onconnect(): void
        
        ondisconnect(): void

        onend(): void

        /**
         * ??????????????????
         * @param data ??????
         */
        onmessage(data: ArrayBuffer): void
    }

    export function open(device: string, options: number | SerialPortOptions): SerialPortHandle;

    export function setRTS(fd: number, flags?: number): Promise<void>
    export function setDTR(fd: number, flags?: number): Promise<void>

    /**
     * ????????????????????????
     * @returns ????????????
     */
    export function getDevices(): Promise<SerialPort[]>

    /**
     * ???????????????????????????
     * @param options ?????????????????????
     */
    export function requestDevice(options: string | number): Promise<SerialPort>;
}
