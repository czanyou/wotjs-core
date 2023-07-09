
declare module '@tjs/abort-controller' {
    export class AbortController {

    }

    export class AbortSignal {

    }
}

declare module '@tjs/console' {
    export class Console {

    }

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

    export class ReadableStream<R> {
        readonly locked: boolean;
        constructor(underlyingSource?: UnderlyingSource<R>, strategy?: QueuingStrategy<R>);

        getReader(): ReadableStreamDefaultReader<R>;
        cancel(reason?: any): Promise<void>;

        pipeThrough<T>(transform: ReadableWritablePair<T, R>, options?: StreamPipeOptions): ReadableStream<T>;
        pipeTo(destination: WritableStream<R>, options?: StreamPipeOptions): Promise<void>;
        tee(): [ReadableStream<R>, ReadableStream<R>];
    }
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
