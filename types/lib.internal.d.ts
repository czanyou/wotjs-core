interface WatchdogDevice {
    device: string;
    fileno: number | null;
    enabled: boolean;

    close(): void;
    disable(): void;
    enable(): void;
    getTimeout(): number;
    keepalive(): void;
    open(): boolean;
    reset(): void;
    setTimeout(timeout: number): void;
}

interface Navigator {
    serial: any;
    bluetooth: any;
    devices: {
        requestDevice(name: string): Promise<WatchdogDevice>;
        getDevices(): Promise<any[]>;
    };

    root: string;
    board: string;
    native: any;
}

declare module 'WoT';

interface Colors {
    colors(): any;

    background: {
        black(text: string): string;
        red(text: string): string;
        green(text: string): string;
        yellow(text: string): string;
        blue(text: string): string;
        magenta(text: string): string;
        cyan(text: string): string;
        white(text: string): string;
    }

    bright: {
        black(text: string): string;
        red(text: string): string;
        green(text: string): string;
        yellow(text: string): string;
        blue(text: string): string;
        magenta(text: string): string;
        cyan(text: string): string;
        white(text: string): string;
    }

    black(text: string): string;
    red(text: string): string;
    green(text: string): string;
    yellow(text: string): string;
    blue(text: string): string;
    magenta(text: string): string;
    cyan(text: string): string;
    white(text: string): string;
}

interface Console {
    /**
     * 在控制台打印指定的信息，但是不会打印行号等调试信息
     * @param data
     */
    print(...data: any[]): void;
    /**
     * 在控制台输出指定的信息，但是不会打印行号等调试信息，也不会自动换行
     * @param data
     */
    write(...data: any[]): void;
    format(...data: any[]): string;
    width(text: string): number;
    colors: Colors;
}

interface Error {
    code: number | string;
    error: string;
}
