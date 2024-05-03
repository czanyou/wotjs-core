// @ts-check
/// <reference path ="../../types/index.d.ts" />

/**
 * @template R
 */
export class ReadableStreamDefaultController {
    /**
     * 
     * @param {ReadableStream<R>} stream 
     */
    constructor(stream) {
        /** @type ReadableStream<R> | undefined owner */
        this._ownerStream = stream;

        /** @type number */
        this.desiredSize = 0;
    }

    get [Symbol.toStringTag]() {
        return 'ReadableStreamDefaultController';
    }

    /** 
     * 用于关闭关联的流。
     * closes the associated stream. 
     * - reader 将仍然可以从流中读取任何先前入队的数据块，但是一旦读取这些数据块，流将被关闭。
     * - 如果你想完全的丢弃这个流并且丢弃任何入队的数据块，你可以使用 ReadableStream.cancel() 
     *  或者 ReadableStreamDefaultReader.cancel()。
     */
    close() {
        const ownerStream = this._ownerStream;
        if (ownerStream) {
            ownerStream.close();
        }
    }

    /**
     * 将给定数据块送入到关联的流中。
     * @param {R} chunk 要送入的数据块。
     */
    enqueue(chunk) {
        const ownerStream = this._ownerStream;
        if (ownerStream) {
            ownerStream.enqueue(chunk);
        }
    }

    /**
     * causes any future interactions with the associated stream to error.
     * @param {Error} err The error you want future interactions to fail with.
     */
    error(err) {
        const ownerStream = this._ownerStream;
        if (ownerStream) {
            ownerStream.error(err);
        }
    }
}

/**
 * @template R
 * implements ReadableStreamGenericReader<R>
 */
export class ReadableStreamDefaultReader {
    /**
     * 
     * @param {ReadableStream<R>} stream 
     */
    constructor(stream) {
        /** @type ReadableStream<R>|undefined owner */
        this._ownerStream = stream;

        /** @type boolean */
        this._isLockReleased = false;

        /** @type Promise | null */
        this._closedPromise = null;
    }

    get [Symbol.toStringTag]() {
        return 'ReadableStreamDefaultReader';
    }

    get closed() {
        const ownerStream = this._ownerStream;
        if (!ownerStream) {
            return Promise.reject(new Error('owner stream is null'));
        }

        return this._closedPromise;
    }

    /**
     * 这个 promise 在流被取消时兑现。消费者在流中调用该方法发出取消流的信号。
     * - cancel 用于在不再需要来自一个流的任何数据的情况下完全结束这个流，即使仍有排队等待的数据块。
     * - 调用 cancel 后该数据丢失，并且流不再可读。
     * - 为了仍然可以读这些数据块而不完全结束这个流，你应该使用 ReadableStreamDefaultController.close()。
     * @param {any=} reason 人类可读的取消原因。这个值可能会被使用。
     * @returns {Promise<any>} 会在结束时使用给定的 reason 参数兑现
     * @throws TypeError 源对象不是 ReadableStreamDefaultReader，或者流没有所有者。
     */
    async cancel(reason) {
        const ownerStream = this._ownerStream;
        if (ownerStream) {
            ownerStream._reader = null;
            await ownerStream.cancel(reason);
        }
    }

    /**
     * 返回一个 Promise，这个 promise 提供流的内部队列中下一个分块（以供访问）。
     * @returns 返回一个 Promise，这个 promise 提供流的内部队列中下一个分块（以供访问）。
     * - 如果有分块可用，则 promise 将使用 { value: theChunk, done: false } 形式的对象来兑现。
     * - 如果流已经关闭，则 promise 将使用 { value: undefined, done: true } 形式的对象来兑现。
     * - 如果流发生错误，promise 将因相关错误被拒绝。
     * @throws TypeError 源对象不是 ReadableStreamDefaultReader，或者流没有所有者。
     */
    async read() {
        if (this._isLockReleased) {
            throw new TypeError('releaseLock is called');
        }

        // 1. If this.[[stream]] is undefined, return a promise rejected with a TypeError exception.
        const ownerStream = this._ownerStream;
        if (!ownerStream) {
            throw new TypeError('onwer stream is null');
        }

        const result = await ownerStream.read();
        if (result.done) {
            ownerStream._resolveClosedPromise();
            this.releaseLock();
        }

        return result;
    }

    /** 
     * 用于释放 reader 对流的锁定。
     * - releases the reader's lock on the stream. 
     * - reader 的锁在仍有待处理的读取请求时无法释放
     * @throws 如果源对象不是一个 ReadableStreamDefaultReader，或者仍有读取请求处于等待状态。
     */
    releaseLock() {
        this._isLockReleased = true;

        const ownerStream = this._ownerStream;
        if (!ownerStream) {
            return;
        }

        // 4. If stream.[[state]] is "readable", reject reader.[[closedPromise]] with a TypeError exception.

        // 6. Set reader.[[closedPromise]].[[PromiseIsHandled]] to true.

        // 8. Set stream.[[reader]] to undefined.
        ownerStream._reader = null;
        ownerStream._rejectReadPromises(new TypeError('lock is released'));

        // 9. Set reader.[[stream]] to undefined.
        this._ownerStream = undefined;
    }
}

/**
 * @typedef UnderlyingSource
 * @property {(controller:ReadableStreamDefaultController) => void =} start A user-defined function that is invoked immediately when the ReadableStream is created.
 * @property {(controller:ReadableStreamDefaultController) => Promise<void> =} pull A user-defined function that is called repeatedly when the ReadableStream internal queue is not full. 
 * @property {(reason?: string) => Promise<void> =} cancel A user-defined function that is called when the ReadableStream is canceled.
 * @property {string=} type Must be 'bytes' or undefined.
 * @property {number=} autoAllocateChunkSize Used only when type is equal to 'bytes'.
 * 
 * @typedef {{}} QueuingStrategy
 * @property {number=} highWaterMark 
 * @property {number=} size 
 */

/**
 * ReadableStream
 * @template R
 */
export class ReadableStream {
    /**
     * 
     * @param {UnderlyingSource} underlyingSource 
     * @param {QueuingStrategy} queuingStrategy 
     */
    constructor(underlyingSource, queuingStrategy) {

        /** @type {((err?: any, result?: any) => void) | undefined} */
        this._closedPromiseCallback = undefined;

        /** @type Promise<undefined> | undefined */
        this._closedPromise = undefined;

        /** @type ReadableStreamDefaultController | undefined */
        this._controller = new ReadableStreamDefaultController(this);

        /** @type QueuingStrategy */
        this._queuingStrategy = queuingStrategy;

        /** @type ReadableStreamDefaultReader | null */
        this._reader = null;

        /** @type R[] */
        this._readBuffer = [];

        /** @type any[] */
        this._readRequests = [];

        /** @type string `closed` | `errored` | `readable` */
        this._state = 'readable';

        /** @type Error | undefined */
        this._storedError = undefined;

        /** @type UnderlyingSource | undefined */
        this._underlyingSource = underlyingSource;

        // start
        const start = underlyingSource?.start;
        if (start) {
            start(this._controller);
        }
    }

    get [Symbol.toStringTag]() {
        return 'ReadableStream';
    }

    /**
     * The readableStream.locked property is false by default, and is switched 
     * to true while there is an active reader consuming the stream's data.
     * @returns boolean
     */
    get locked() {
        return this._reader != null;
    }

    get state() {
        return this._state;
    }

    /**
     * 取消这个流
     * - 还未读取的数据将被丢失
     * @param {any=} reason 
     * @returns {Promise<any>}
     */
    async cancel(reason) {
        if (this.locked) {
            return Promise.reject(new TypeError('Cannot cancel a stream that already has a reader'));

        } else if (this._state == 'closed') {
            return Promise.resolve();

        } else if (this._state == 'errored') {
            return Promise.reject(this._storedError);

        } else if (this.state == 'readable') {
            // 清除缓存区中还未读取的数据
            const readBuffer = this._readBuffer;
            while (readBuffer.length) {
                readBuffer.pop();
            }

            this._onCancelStream(reason);
            this._onDestoryStream();
        }
    }

    /**
     * 关闭这个流
     * - 还未读取的数据还可以继续读取
     */
    close() {
        if (this.state == 'readable') {
            this._onDestoryStream();
        }
    }

    /**
     * Appends a new chunk of data to the <ReadableStream>'s queue.
     * @param {R|null} chunk 
     */
    enqueue(chunk) {
        if (chunk == null) {
            this._onDestoryStream();
            return;
        }

        if (this.state != 'readable') {
            return;
        }

        this._readBuffer.push(chunk);
        this._resolveReadPromisesWithChunk();
    }

    /**
     * Signals an error that causes the <ReadableStream> to error and close.
     * @param {Error} err 
     */
    error(err) {
        if (this.state != 'readable') {
            return;
        }

        this._storedError = err;
        this._setState('errored');

        this._resolveClosedPromise();
        this._rejectReadPromises(err);
    }

    /**
     * 返回一个 reader
     * - 将锁定这个 stream
     * @returns ReadableStreamDefaultReader
     */
    getReader() {
        // 1. If IsReadableStreamLocked(stream) is true, throw a TypeError exception.
        if (this.locked) {
            throw new TypeError('The stream is locked');
        }

        const reader = new ReadableStreamDefaultReader(this);

        if (this.state == 'closed') {
            reader._closedPromise = Promise.resolve(undefined);

        } else if (this.state == 'errored') {
            reader._closedPromise = Promise.reject(this._storedError);

        } else {
            this._closedPromise = new Promise((resolve, reject) => {
                function callback(err, result) {
                    if (err != null) {
                        reject(err);

                    } else {
                        resolve(result);
                    }
                }

                this._closedPromiseCallback = callback;
            });

            reader._closedPromise = this._closedPromise;
        }

        this._reader = reader;
        return reader;
    }

    /**
     * Requests the next chunk of data from the underlying <ReadableStream> and 
     * returns a promise that is fulfilled with the data once it is available.
     * @returns 
     */
    read() {
        // 2. Let promise be a new promise.
        const promise = new Promise((resolve, reject) => {
            // console.log('streams:', 'read: wait');

            // 3. Let readRequest be a new read request with the following items:
            const callback = (error, result) => {
                if (error) {
                    reject(error);

                } else {
                    resolve(result);
                }
            };

            this._readRequests.push(callback);
        });

        // 4. Perform ReadableStreamDefaultReaderRead(this, readRequest).
        this._resolveReadPromises();

        // 5. Return promise.
        return promise;
    }

    /**
     * 
     * @param {any=} reason 
     */
    _onCancelStream(reason) {
        const cancel = this._underlyingSource?.cancel;
        if (cancel) {
            cancel(reason);
        }
    }

    _onDestoryStream() {
        this._setState('closed');

        const reader = this._reader;
        if (reader) {
            this._reader = null;
        }

        this._resolveClosedPromise();
        this._resolveReadPromises();
    }

    _onPullStream() {
        const controller = this._controller;
        const pull = this._underlyingSource?.pull;
        if (pull && controller) {
            pull(controller).then(() => {

            });
        }
    }

    /**
     * 拒绝所有还未履行的读承诺
     * @param {Error} err 
     */
    _rejectReadPromises(err) {
        const requests = this._readRequests;
        while (requests.length) {
            const callback = requests.shift();
            callback(err);
        }
    }

    /**
     * 履行 closed 承诺
     */
    _resolveClosedPromise() {
        this._closedPromise = undefined;

        const callback = this._closedPromiseCallback;
        if (callback) {
            this._closedPromiseCallback = undefined;
            callback(this._storedError);
        }
    }

    /**
     * 履行 read 承诺
     */
    _resolveReadPromisesWithChunk() {
        // 1. 继续读取内存缓存区中的数据
        if (!this._readBuffer.length) {
            return;
        }

        const requests = this._readRequests;
        while (requests.length) {
            const result = this._nextChunk();
            if (!result) {
                break;
            }

            const callback = requests.shift();
            callback(null, result);
        }
    }

    /**
     * 履行 read 承诺
     */
    _resolveReadPromisesWithoutChunk() {
        const result = { done: true, value: undefined };

        const requests = this._readRequests;
        while (requests.length) {
            const callback = requests.shift();
            callback(null, result);
        }
    }

    /**
     * 履行 read 承诺
     */
    _resolveReadPromises() {
        const requests = this._readRequests;
        if (!requests.length) {
            return;
        }

        // 1. 继续读取内存缓存区中的数据
        this._resolveReadPromisesWithChunk();
        if (!requests.length) {
            return;
        }

        // 2. If stream.[[state]] is "closed", perform readRequest’s close steps.
        if (this._state == 'closed') {
            this._resolveReadPromisesWithoutChunk();
            return;
        }

        // 如果流发生错误，所有 promise 将因相关错误被拒绝。
        // 3. Otherwise, if stream.[[state]] is "errored", perform readRequest’s error steps given stream.[[_storedError]].
        const err = this._storedError;
        if (err) {
            this._rejectReadPromises(err);
            return;
        }

        // 4. Perform stream.[[controller]].[[PullSteps]](readRequest).
        this._onPullStream();
    }

    /**
     * 设置这个 stream 的状态
     * @param {string} state 
     */
    _setState(state) {
        if (this._state != state) {
            this._state = state;
            // console.log('strams:', 'state:', state);

            if (state == 'closed') {
                this._underlyingSource = undefined;

                const controller = this._controller;
                if (controller) {
                    this._controller = undefined;
                    controller._ownerStream = undefined;
                }
            }
        }
    }

    _nextChunk() {
        const readBuffer = this._readBuffer;
        if (!readBuffer.length) {
            return;
        }

        const value = readBuffer.shift();

        // 如果有分块可用，则 promise 将使用 { value: theChunk, done: false } 形式的对象来兑现。
        return { done: false, value };
    }
}

export class WritableStream {
    constructor() {
        this._locked = false;
    }

    get [Symbol.toStringTag]() {
        return 'WritableStream';
    }

    async abort() {

    }

    async close() {

    }

    async write() {

    }
}

Object.defineProperty(window, 'ReadableStream', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: ReadableStream
});

Object.defineProperty(window, 'WritableStream', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: WritableStream
});

/**
 * 
 * @param {*} underlyingSource 
 * @param {*} queuingStrategy 
 * @returns 
 */
export function createReadableStream(underlyingSource, queuingStrategy) {
    return new ReadableStream(underlyingSource, queuingStrategy);
}

export function createWritableStream() {
    return new WritableStream();
}
