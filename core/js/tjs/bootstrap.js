// @ts-check
/// <reference path ="../../types/index.d.ts" />
// 2nd bootstrap. Here all modules that need to pollute the global namespace are
// already loaded.
//

import { AbortController, AbortSignal } from '@tjs/abort-controller';
import { Console } from '@tjs/console';
import { Worker as NativeWorker } from '@tjs/native';
import { defineEventAttribute, EventTarget, Event, CustomEvent } from '@tjs/event-target';
import { Performance } from '@tjs/performance';
import { Navigator } from '@tjs/navigator';
import { getStorage } from '@tjs/storage';

import * as process from '@tjs/process';
import * as path from '@tjs/path';
import * as native from '@tjs/native';
import * as os from '@tjs/os';

// Console
//

Object.defineProperty(window, 'console', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Console()
});

// EventTarget
//

const kCloseEventCode = Symbol('kCloseEventCode');
const kCloseEventReason = Symbol('kCloseEventReason');
const kCloseEventWasClean = Symbol('kCloseEventWasClean');

class CloseEvent extends Event {
    /**
     * @param {string} type
     * @param {any} [init]
     */
    constructor(type, init) {
        super(type, init);

        this[kCloseEventCode] = init?.code;
        this[kCloseEventReason] = init?.reason;
        this[kCloseEventWasClean] = init?.wasClean;
    }

    get [Symbol.toStringTag]() {
        return 'CloseEvent';
    }

    get code() {
        return this[kCloseEventCode];
    }

    get reason() {
        return this[kCloseEventReason];
    }

    get wasClean() {
        return this[kCloseEventWasClean];
    }
}

const kErrorEventData = Symbol('kErrorEventData');
const kErrorEventMessage = Symbol('kErrorEventMessage');

class ErrorEvent extends Event {
    /** 
     * @param {string} type
     * @param {ErrorEventInit} [init]
     */
    constructor(type, init) {
        super(type, init);

        if (init) {
            this[kErrorEventData] = init.error;
            this[kErrorEventMessage] = init.message || String(init.error);
        }
    }

    get [Symbol.toStringTag]() {
        return 'ErrorEvent';
    }

    get message() {
        return String(this[kErrorEventData]);
    }

    get filename() {
        return undefined;
    }

    get lineno() {
        return undefined;
    }

    get colno() {
        return undefined;
    }

    get error() {
        return this[kErrorEventData];
    }
}

const kMessageEventData = Symbol('kMessageEventData');

class MessageEvent extends Event {
    /**
     * @param {string} type
     * @param {{data?: any}} [init]
     */
    constructor(type, init) {
        super(type, init);

        if (init) {
            this[kMessageEventData] = init.data;
        }
    }

    get [Symbol.toStringTag]() {
        return 'MessageEvent';
    }

    get data() {
        return this[kMessageEventData];
    }
}

const kPromiseRejectionReason = Symbol('kPromiseRejectionReason');

class PromiseRejectionEvent extends Event {
    /**
     * @param {string} type
     * @param {string} [reason]
     */
    constructor(type, reason) {
        super(type, { cancelable: true });

        this[kPromiseRejectionReason] = reason;
    }

    get [Symbol.toStringTag]() {
        return 'PromiseRejectionEvent';
    }

    get reason() {
        return this[kPromiseRejectionReason];
    }
}

// DOMException

export class DOMException extends Error {
    /**
     * 
     * @param {string} message 
     * @param {string} name 
     */
    constructor(message, name) {
        super();

        this._message = message;
        this._name = name;
    }

    get message() {
        return this._message;
    }

    get name() {
        return this._name;
    }
}

Object.defineProperties(window, {
    CloseEvent: { enumerable: true, configurable: true, writable: true, value: CloseEvent },
    CustomEvent: { enumerable: true, configurable: true, writable: true, value: CustomEvent },
    ErrorEvent: { enumerable: true, configurable: true, writable: true, value: ErrorEvent },
    Event: { enumerable: true, configurable: true, writable: true, value: Event },
    EventTarget: { enumerable: true, configurable: true, writable: true, value: EventTarget },
    MessageEvent: { enumerable: true, configurable: true, writable: true, value: MessageEvent },
    PromiseRejectionEvent: { enumerable: true, configurable: true, writable: true, value: PromiseRejectionEvent },
    DOMException: { enumerable: true, configurable: true, writable: true, value: DOMException }
});

Object.setPrototypeOf(window, EventTarget.prototype);
// @ts-ignore
EventTarget.prototype.__init.call(window);

const windowPrototype = Object.getPrototypeOf(window);
defineEventAttribute(windowPrototype, 'load');
defineEventAttribute(windowPrototype, 'unload');
defineEventAttribute(windowPrototype, 'unhandledrejection');

Object.defineProperty(window, Symbol.toStringTag, {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'Global'
});

// Storage
//

Object.defineProperty(window, 'sessionStorage', {
    enumerable: true,
    configurable: true,
    get() {
        return getStorage('session');
    }
});

Object.defineProperty(window, 'localStorage', {
    enumerable: true,
    configurable: true,
    get() {
        return getStorage('local');
    }
});

// Performance
//

Object.defineProperty(window, 'performance', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Performance()
});

// AbortController
//

Object.defineProperty(window, 'AbortController', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: AbortController
});

Object.defineProperty(window, 'AbortSignal', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: AbortSignal
});

// Web workers API
//

const kWorker = Symbol('kWorker');

class Worker extends EventTarget {
    /** @param {string} filename */
    constructor(filename) {
        super();

        const worker = new NativeWorker(filename);
        worker.onmessage = message => {
            this.dispatchEvent(new MessageEvent('message', { data: message }));
        };

        worker.onmessageerror = messageError => {
            this.dispatchEvent(new MessageEvent('messageerror', { data: messageError }));
        };

        worker.onerror = error => {
            this.dispatchEvent(new ErrorEvent('error', { error }));
        };

        this[kWorker] = worker;
    }

    get [Symbol.toStringTag]() {
        return 'Worker';
    }

    /** @param {any[]} args */
    postMessage(...args) {
        this[kWorker].postMessage(args);
    }

    terminate() {
        this[kWorker].terminate();
        
        this.removeAllEventListeners();
    }
}

const workerPrototype = Worker.prototype;
defineEventAttribute(workerPrototype, 'message');
defineEventAttribute(workerPrototype, 'messageerror');
defineEventAttribute(workerPrototype, 'error');

Object.defineProperty(window, 'Worker', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: Worker
});

// Navigator
Object.defineProperty(window, 'navigator', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Navigator()
});

// Process API

Object.defineProperty(window, 'process', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: process
});

class Location {
    constructor() {
        let pathname = native.scriptPath();
        if (pathname && !path.isAbsolute(pathname)) {
            pathname = path.join(os.cwd(), pathname);
        }

        let filename = native.exepath();
        if (filename && !path.isAbsolute(filename)) {
            filename = path.join(os.cwd(), filename);
        }

        this.hash = '';
        this.host = '';
        this.hostname = '';
        this.href = 'file://' + pathname;
        this.origin = 'file://' + filename;
        this.password = '';
        this.pathname = pathname;
        this.port = '';
        this.protocol = 'file:';
        this.search = process.argv.slice(2);
        this.username = '';
    }

    /**
     * 
     * @param {string} url 
     */
    assign(url) {

    }

    reload() {

    }

    /**
     * 
     * @param {string} url 
     */
    replace(url) {

    }
}

let location;

Object.defineProperty(window, 'location', {
    enumerable: true,
    configurable: true,
    get() {
        if (!location) {
            location = new Location();
        }

        return location;
    }
});
