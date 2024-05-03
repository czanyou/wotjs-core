
declare module '@tjs/abort-controller' {
    export class AbortController {

    }

    export class AbortSignal {

    }
}

/**
 * 控制台模块
 */
declare module '@tjs/console' {
    export class Console {

    }

    /**
     * 颜色格式化工具
     */
    interface ColorFormatter {
        black(text: string): string;
        blue(text: string): string;
        cyan(text: string): string;
        green(text: string): string;
        magenta(text: string): string;
        red(text: string): string;
        white(text: string): string;
        yellow(text: string): string;
    }

    interface Colors extends ColorFormatter {
        COLORS: { [key: string]: string }
        BACKGROUND_COLORS: { [key: string]: string }

        background: ColorFormatter
        bright: ColorFormatter
    }

    /**
     * 打印信息到控制台，包含行尾换行
     * @param args 
     */
    export function alert(...args: any): void;

    /**
     * 格式化字符串
     * @param colorfully 
     * @param message 
     * @param args 
     */
    export function format(colorfully: boolean, ...args: any): string;

    /**
     * 颜色信息
     */
    export function getColors(): Colors;

    /**
     * 格式化字符串
     * @param colorfully 
     * @param message 
     * @param args 
     */
    export function inspect(colorfully: boolean, message: any, ...args: any): string;

    /**
     * 打印信息到控制台，包含行尾换行
     * @param args 
     */
    export function print(...args: any): void;

    /**
     * 打印日志信息
     * @param {string} level 日志级别: `d`,`l`,`i`,`w`,`e`,`a`
     * @param {string} lineNumber 源代码行号信息
     * @param {any[]} args 
     */
    export function printConsole(level: string, lineNumber: string, ...args: any): boolean;

    /**
     * 设置自定义打印函数
     * @param onPrintLog 
     */
    export function setPrintLog(onPrintLog: (level: string, line: string, ...args: any) => void): void;

    /**
     * 计算字节显示宽度
     * @param text 
     */
    export function width(text: string): number;

    /**
     * 打印信息到控制台，不包含行尾换行
     * @param args 
     */
    export function write(...args: any): void;

    global {

        /**
         * @module internal
         * wotjs 内部模块和接口
         */

        /**
         * 颜色格式化工具
         */
        interface ColorFormatter {
            black(text: string): string;
            blue(text: string): string;
            cyan(text: string): string;
            green(text: string): string;
            magenta(text: string): string;
            red(text: string): string;
            white(text: string): string;
            yellow(text: string): string;
        }

        interface Colors extends ColorFormatter {
            COLORS: { [key: string]: string }
            BACKGROUND_COLORS: { [key: string]: string }

            background: ColorFormatter
            bright: ColorFormatter
        }

        interface Console {
            /**
             * 格式化字符串
             * @param colorfully 
             * @param data 
             */
            inspect(colorfully: boolean, ...data: any): string;

            /**
             * 在控制台打印指定的信息，但是不会打印行号等调试信息
             * @param data
             */
            print(...data: any): void;

            /**
             * 在控制台输出指定的信息，但是不会打印行号等调试信息，也不会自动换行
             * @param data
             */
            write(...data: any): void;

            /**
             * 颜色信息
             */
            colors: Colors;
        }

        interface Error {
            code: number | string;
            error?: string;
        }
    }
}

/**
 * Web stream API
 */
declare module '@tjs/streams' {
    function createReadableStream<R>(underlyingSource?: UnderlyingSource<R>, queuingStrategy?: QueuingStrategy<R>): ReadableStream<R>;
    function createWritableStream<R>(): WritableStream<R>;
}

/** Crypto */
declare module '@tjs/crypto' {
    type Data = string | ArrayBuffer;
    type DigestAlgorithm = "MD5" | "SHA1" | "SHA256" | "SHA512";

    function digest(algorithm: DigestAlgorithm, data: Data): ArrayBuffer;
    function hmac(algorithm: DigestAlgorithm, data: Data, secret: Data): ArrayBuffer;
}

declare module '@tjs/performance' {
    export class Performance {

    }
}

/**
 * 模拟浏览器中的 Navigator 对象
 */
declare module '@tjs/navigator' {
    import * as serial from "@tjs/serial"

    export class Navigator {

    }

    global {
        type SerialPortOptions = serial.SerialPortOptions;
        type SerialPortSignals = serial.SerialPortSignals;
        type SerialPortHandle = serial.SerialPortHandle;
        type SerialPortInfo = serial.SerialPortInfo;
        type SerialPort = serial.SerialPort;

        interface Navigator {
            serial: {
                getPorts(): Promise<SerialPort[]>;
                requestPort(options?: { [key: string]: any }): Promise<SerialPort>;
            };

            root: string;
            board: string;
            native: any;
        }
    }
}

/**
 * DOM 事件框架
 */
declare module '@tjs/event-target' {
    export class Event {
        constructor(type: string, init?: any);
        type: string;
    }

    export class CustomEvent extends Event {

    }

    export class EventTarget {
        dispatchEvent(event: Event | { type: string }): void;
        addEventListener(eventName: string, listener: Function, options: boolean | { capture?: boolean, passive?: boolean, once?: boolean }): void;
        removeEventListener(eventName: string, listener: Function, options: any): void;
        getEventListeners(eventName?: string): Map<string, any>;
        removeAllEventListeners(eventName?: string): void;
    }

    export function defineEventAttribute(prototype: object, eventName: string): void;

    global {
        interface EventTarget {
            getEventListeners(eventName?: string): Map<string, any>;
            removeAllEventListeners(eventName?: string): void;
        }
    }
}

declare module '@tjs/form-data' {
    export function parse(data: Uint8Array): FormData;
}

/**
 * Web Storage API
 */
declare module '@tjs/storage' {
    export interface StorageManager {
        readonly storages: { [key: string]: Storage };

        /**
         * 保存数据到存储
         * @param type 存储类型
         */
        flushValues(type: string): Promise<void>;

        /**
         * 保存数据到存储
         */
        flush(): Promise<void>;

        /**
         * 加载存储的数据
         * @param type 存储类型
         */
        loadValues(type: string): Promise<void>;

        /**
         * 加载存储的数据
         * @param scope 
         */
        load(scope: string): Promise<void>;
    }

    /**
     * 保存所有存储
     */
    export function flushStorages(): Promise<void>;

    /**
     * 返回指定类型的存储
     * @param type 存储类型
     */
    export function getStorage(type: string): Storage;

    /**
     * 返回存储管理
     */
    export function getStorageManager(): StorageManager;

    /**
     * 加载所有存储
     * @param scope 
     */
    export function loadStorages(scope: string): Promise<void>;

}
