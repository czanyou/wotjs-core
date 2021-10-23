// @ts-check
// 2nd bootstrap. Here all modules that need to pollute the global namespace are
// already loaded.
//

import { AbortController, AbortSignal } from '@tjs/abort-controller';
import { Console } from '@tjs/console';
import { Worker as NativeWorker } from '@tjs/native';
import { defineEventAttribute, EventTarget, Event, CustomEvent } from '@tjs/event-target';
import { Performance } from '@tjs/performance';
import { Navigator } from '@tjs/navigator';
import { createStorage } from '@tjs/storage';
import process from '@tjs/process';

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

const kErrorEventData = Symbol('kErrorEventData');

class CloseEvent extends Event {
    /**
     * @param {string} type
     * @param {any} [init]
     */
    constructor(type, init) {
        super(type);

        if (init) {
            this.code = init.code;
            this.reason = init.reason;
            this.wasClean = init.wasClean;
        }
    }

    get [Symbol.toStringTag]() {
        return 'CloseEvent';
    }
}

class ErrorEvent extends Event {
    /** @param {any} [error] */
    constructor(error) {
        super('error');

        this[kErrorEventData] = error;
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
        super(type);

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

Object.defineProperties(window, {
    CloseEvent: { enumerable: true, configurable: true, writable: true, value: CloseEvent },
    CustomEvent: { enumerable: true, configurable: true, writable: true, value: CustomEvent },
    ErrorEvent: { enumerable: true, configurable: true, writable: true, value: ErrorEvent },
    Event: { enumerable: true, configurable: true, writable: true, value: Event },
    EventTarget: { enumerable: true, configurable: true, writable: true, value: EventTarget },
    MessageEvent: { enumerable: true, configurable: true, writable: true, value: MessageEvent },
    PromiseRejectionEvent: { enumerable: true, configurable: true, writable: true, value: PromiseRejectionEvent }
});

Object.setPrototypeOf(window, EventTarget.prototype);
// @ts-ignore
EventTarget.prototype.__init.call(window);

const windowPrototype = Object.getPrototypeOf(window);
defineEventAttribute(windowPrototype, 'load');
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
    writable: true,
    value: createStorage('session')
});

Object.defineProperty(window, 'localStorage', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: createStorage('local')
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
            this.dispatchEvent(new ErrorEvent(error));
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

// Web things API
const WebThings = {
    async consume(td) {
        const wot = await import('@tjs/wot');
        return wot.consume(td);
    },
    async discover(...args) {
        const wot = await import('@tjs/wot');
        return wot.discover(...args);
    },
    async produce(td) {
        const wot = await import('@tjs/wot');
        return wot.produce(td);
    }
};

Object.defineProperty(window, 'WoT', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: WebThings
});
