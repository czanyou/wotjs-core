// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as os from '@tjs/os';
// eslint-disable-next-line no-unused-vars
import * as serial from '@tjs/serial';

/**
 * @typedef {(type:string, data?:string) => any} ATCallback
 */

const textDecoder = new TextDecoder();

/**
 * AT 指令解析器
 */
class ATParser {
    /**
     * @param {ATCallback} callback 
     */
    constructor(callback) {
        /** @type ATCallback */
        this.callback = callback;

        /** @type string */
        this.buffer = '';

        /** @type number */
        this.BUFFER_LIMIT = 64 * 1024;
    }

    get [Symbol.toStringTag]() {
        return 'ATParser';
    }

    /**
     * 执行解析
     * @param {ArrayBuffer=} data 
     */
    execute(data) {
        if (!data) {
            return;
        }

        const text = textDecoder.decode(data);
        this.buffer = this.buffer + text;
        if (this.buffer.length >= this.BUFFER_LIMIT) {
            this.buffer = '';
        }
        // console.log(this.buffer);

        const func = this.callback;

        while (true) {
            const line = this.readLine();
            if (line == null) {
                break;
            }

            // console.log('uart: data:', line);

            if (line == 'OK') {
                func('ok');

            } else if (line.startsWith('ERROR')) {
                const position = line.indexOf(')', 6);
                const code = line.substring(6, position);

                func('error', code);

            } else if (line.startsWith('+')) {
                func('message', line);

            } else if (line == '') {
                func('endline');

            } else {
                func('data', line);
            }
        }
    }

    /**
     * 从缓存中读取一行
     * @returns {string|undefined}
     */
    readLine() {
        const buffer = this.buffer;
        const pos = buffer.indexOf('\n');
        if (pos < 0) {
            return;
        }

        /** @type string */
        const line = buffer.substring(0, pos + 1);
        this.buffer = buffer.substring(pos + 1);

        return line.trim();
    }
}

/**
 * @typedef {{result?:string, command?:string, readonly?:boolean, readwrite?:boolean, writeonly?: boolean}} ATCommand
 * @typedef {{name:string, param1:any, param2:any, timeout?:number, callback?:function, created?:number, command?:ATCommand, cmdline?:string, result?:string, updated?:number}} ATRequest
 * @typedef {{request?:ATRequest, ok?:boolean, data?:any, type?:string, error?:number}} ATResult
 */

/**
 * @class ATClient
 * AT 指令客户端
 */
export class ATClient extends EventTarget {
    /** @param {Object<string,any>=} options */
    constructor(options) {
        super();

        /** @type serial.SerialPortOptions */
        this.options = Object.assign({
            baudRate: 115200,
            stopBits: 1,
            dataBits: 8,
            parity: 'none'
        }, options);

        /** @type boolean 是否在收到应答消息后，自动关闭串口。 */
        this.isAutoClose = options?.autoClose || false;

        /** @type {SerialPort|null} */
        this.device = null;

        /** @type number 每条命令发送间隔/延时时间，单位为毫秒 */
        this.delay = 20;

        /** @type number */
        this.limit = 10;

        /** @type number 打开串口重试次数 */
        this.retryCount = 0;

        /** @type any */
        this.statusTimer = null;

        /** @type any */
        this.timeoutTimer = null;

        /** @type any */
        this.flushTimer = null;

        /** @type {ATResult|null} */
        this.result = null;

        /** @type boolean */
        this.isInvoking = false;

        /** @type {ATRequest[]} */
        this.requests = [];

        /** @type any */
        this.commands = {};

        /** @type ATParser|undefined */
        this.parser = undefined;

        /** 日志信息 */
        this.logs = [];
    }

    get [Symbol.toStringTag]() {
        return 'ATClient';
    }

    /**
     * 关闭串口连接
     */
    async close() {
        const serialPort = this.device;
        if (serialPort) {
            this.device = null;

            serialPort.onmessage = undefined;
            serialPort.close();
        }

        const statusTimer = this.statusTimer;
        if (statusTimer) {
            this.statusTimer = undefined;
            clearInterval(statusTimer);
        }

        this.removeAllEventListeners();

        const parser = this.parser;
        if (parser) {
            this.parser = undefined;
        }
    }

    /**
     * 执行命令
     * @param {string} name 
     * @param {string=} param1 
     * @param {string=} param2 
     * @returns {Promise<ATResult|undefined>}
     */
    async invoke(name, param1, param2) {
        if (this.device == null) {
            return;
        }

        const self = this;
        this.isInvoking = true;
        const promise = new Promise((resolve, reject) => {
            const timeout = 3000;
            /** @type any */
            let timeoutTimer = setTimeout(() => {
                timeoutTimer = null;

                reject(new Error('Timeout'));

                this.isInvoking = false;
                this._onFlush();
            }, timeout);

            /** @param {ATResult} result */
            function callback(result) {
                // console.log('callback', result);
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }

                resolve(result);
                self.isInvoking = false;
            }

            const command = this.commands[name];
            if (!command) {
                reject(new Error('Invalid command: ' + name));
                return;
            }

            const request = { command, name, param1, param2 };
            if (!this._onEnqueueRequest(request, 2000, callback)) {
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }

                reject(new Error('error'));
                self.isInvoking = false;
                return;
            }

            // console.log('invoke:', name, param1, param2);
            this._onFlush();
        });

        return promise;
    }

    /**
     * 
     * @param {string} type 
     * @param {*} data 
     */
    log(type, data) {
        const logs = this.logs;
        while (logs.length > 50) {
            logs.shift();
        }

        logs.push(type + ' ' + String(data));
    }

    /**
     * 打开串口设备
     * @returns 
     */
    async open() {
        if (this.device) {
            return;

        } else if (this.retryCount > 3) {
            return;
        }

        const options = this.options;
        const serialPort = await navigator.serial.requestPort(options);
        if (!serialPort) {
            console.print('uart:', 'Serial port is null');
            return;
        }

        try {
            await serialPort.open(options);
            this.device = serialPort;

            const info = await serialPort.getInfo();
            console.info('uart:', 'Open:', serialPort.handle, 'at:', info.device);
            // console.log('serial:', options);

        } catch (err) {
            console.log('uart:', 'Error:', err.message);
            return;
        }

        if (!this.device) {
            this.retryCount++;
            console.warn('uart:', 'Serial port open failed:', options.device, this.retryCount);
            return;
        }

        this.retryCount = 0;

        this._onOpenParser();

        // mode
        // serialPort.setSignals({ dataTerminalReady: false, requestToSend: false });

        // serial data
        serialPort.onmessage = async (event) => {
            const data = event.data;
            if (data == null) {
                await this.close();
                return;
            }

            // console.log('uart:', 'message', textDecoder.decode(data));

            this.log('<<<', textDecoder.decode(data));

            const parser = this.parser;
            parser?.execute(data);
        };
    }

    /**
     * 复位蓝牙模块
     */
    async reset() {
        const serialPort = this.device;
        if (serialPort) {
            // serialPort.setSignals({ requestToSend: true });
            os.sleep(10);
            // serialPort.setSignals({ requestToSend: false });
        }
    }

    async start() {
        await this.open();
        if (!this.device) {
            return;
        }

        const interval = 10 * 1000;

        if (!this.statusTimer) {
            this.statusTimer = setInterval(() => {
                this?._onCheckClientStatus();
            }, interval);
        }

        console.log('uart:', 'Started');
    }

    /** 检查运行状态信息 */
    async _onCheckClientStatus() {
        if (!this.device) {
            await this.open();
        }
    }

    /**
     * 将请求放入发送队列
     * @private
     * @param {ATRequest} request 命令类型
     * @param {number} timeout 参数1
     * @param {function(any):void} callback 参数2
     */
    _onEnqueueRequest(request, timeout, callback) {
        // console.log('tb03:', '_onEnqueueRequest');
        const limit = this.limit || 10;
        if (this.requests.length > limit) {
            return;
        }

        request.timeout = timeout;
        request.callback = callback;
        request.created = os.uptime();
        this.requests.push(request);

        return true;
    }

    /**
     * 在请求执行新的命令后或前一条命令执行完毕后调用，用于清空发送队列。
     * @private
     * @returns {Promise<void>}
     */
    async _onFlush() {
        if (this.flushTimer) {
            return;
        }

        // 下一条命令延时发送，避免从机处理不过来
        const delay = this.delay || 20;

        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;

            this._onSendNextRequest();
        }, delay);
    }

    /**
     * 创建 AT 协议解析器
     */
    _onOpenParser() {
        const self = this;

        /**
         * 处理解析器解析后的消息
         * @private
         * @param {string=} data
         */
        async function onProcessMessage(data) {
            if (!data) {
                return;
            }

            // console.log('uart:', 'message:', data);

            // console.log(data);
            const position = data.indexOf(':');
            if (position > 0) {
                const type = data.substring(0, position);
                const value = data.substring(position + 1);
                return await self._onProcessResponse(type, value);

            } else {
                return await self._onProcessResponse('', data);
            }
        }

        const parser = new ATParser((type, data) => {
            switch (type) {
                case 'message':
                    onProcessMessage(data);
                    break;

                case 'data':
                    onProcessMessage(data);
                    break;

                case 'ok':
                    onProcessMessage(data);
                    self._onResponseEnd(true);
                    break;

                case 'error':
                    onProcessMessage(data);
                    self._onResponseEnd(false, data);
                    break;

                default:
                    break;
            }
        });

        this.parser = parser;
    }

    /**
     * 处理从机应答消息
     * @private
     * @param {string} type 应答消息类型
     * @param {string=} data 应答消息内容
     */
    async _onProcessResponse(type, data) {
        const result = this.result;
        if (result) {
            const request = result?.request;
            if (type == '') {
                result.data = result.data ? result.data + ';' : '';
                result.data = result.data + data;
                return;

            } else if (request?.result == type) {
                result.data = data?.trim();
                return;
            }
        }

        // 如果这个没有相关的请求消息，则当做通知消息处理
        if (type) {
            const event = new MessageEvent('notification', { data: { type, data } });
            this.dispatchEvent(event);
        }
    }

    /**
     * 当收到完整的应答消息后调用，表示应答消息已经接收完毕
     * @private
     * @param {boolean} ok 是否收到 OK 应答
     * @param {any=} error 错误信息
     * @returns {Promise<void>}
     */
    async _onResponseEnd(ok, error) {
        if (this.isAutoClose) {
            this.close();
        }

        const timeoutTimer = this.timeoutTimer;
        if (timeoutTimer) {
            this.timeoutTimer = null;

            clearTimeout(timeoutTimer);
        }

        const result = this.result;
        if (!result) {
            return;
        }

        this.result = null;
        result.ok = ok;

        if (error != null) {
            result.error = Number(error);
        }

        const request = result.request;
        if (request == null) {
            return;
        }

        if (request.callback) {
            await request.callback(result);
        }

        setTimeout(() => {
            this._onFlush();
        }, 20);
    }

    /**
     * 发送数据到下一层传输层，比如串口
     * @private
     * @param {string} cmdline 
     * @returns {Promise<boolean>}
     */
    async _onSendData(cmdline) {
        try {
            this.log('>>>', cmdline);

            const serialPort = this.device;
            const ret = await serialPort?.write(cmdline);
            if (ret != cmdline.length) {
                console.warn('uart:', 'Send: write failed:', ret);
                return false;
            }

            return true;

        } catch (error) {
            console.log('uart:', 'Send: write error:', error.message);

            await this.close();
            return false;
        }
    }

    /**
     * 发送队列中的下一条命令
     * @private
     * @returns {Promise<ATResult|undefined>}
     */
    async _onSendNextRequest() {
        // console.log('tb03:', '_onSendNextRequest');
        if (this.timeoutTimer) {
            return;

        } else if (this.device == null) {
            return;
        }

        const request = this.requests.shift();
        if (request == null) {
            return;
        }

        // 发送请求
        const type = await this._onSendRequest(request);

        /** @type ATResult */
        const result = { ok: false, request, type };
        this.result = result;
        return result;
    }

    /**
     * 发送指定的命令
     * @private
     * @param {ATRequest} request 要发送的请求
     * @returns {Promise<string|undefined>}
     */
    async _onSendRequest(request) {
        const command = request.command;
        const type = request.name;
        let param1 = request.param1;
        let param2 = request.param2;

        let cmdline = command?.command;
        if (!command || !cmdline) {
            return;
        }

        if (command.readonly) {
            cmdline += '?';

        } else if (command.readwrite) {
            if (param1 != null) {
                cmdline += '=';
                cmdline += param1;

                if (param2 != null) {
                    cmdline += ',';
                    cmdline += param2;
                }

            } else {
                cmdline += '?';
            }

        } else if (command.writeonly) {

            cmdline += '=';
            if (param1 != null) {
                if (type == 'send') {
                    param2 = param1;
                    param1 = param1.length;
                }

                cmdline += param1;

                if (param2 != null) {
                    cmdline += ',';
                    cmdline += param2;
                }

            } else {
                cmdline += '0';
            }
        }

        // console.log('uart: send:', cmdline);
        cmdline += '\r\n';

        request.cmdline = cmdline;
        request.updated = os.uptime();

        const result = command.result;
        request.result = result;

        if (!await this._onSendData(cmdline)) {
            setTimeout(() => {
                this._onResponseEnd(false, '-1');
            }, 0);
        }

        return result;
    }
}
