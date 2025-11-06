// https://www.w3.org/TR/user-timing/
// Derived from: https://github.com/blackswanny/performance-polyfill
import * as native from '@tjs/native';

class Performance {
    #startTime = hrtimeMs();
    #entries = [];
    #marksIndex = Object.create(null);

    constructor() {

    }

    get timeOrigin() {
        return this.#startTime;
    }

    now() {
        return hrtimeMs() - this.#startTime;
    }

    mark(name) {
        const mark = {
            name,
            entryType: 'mark',
            startTime: this.now(),
            duration: 0
        };
        this.#entries.push(mark);
        this.#marksIndex[name] = mark;
    }

    measure(name, startMark, endMark) {
        let startTime;
        let endTime;
  
        if (endMark !== undefined && this.#marksIndex[endMark] === undefined) {
          throw new SyntaxError("Failed to execute 'measure' on 'Performance': The mark '" + endMark + "' does not exist.");
        }
  
        if (startMark !== undefined && this.#marksIndex[startMark] === undefined) {
          throw new SyntaxError("Failed to execute 'measure' on 'Performance': The mark '" + startMark + "' does not exist.");
        }
  
        if (this.#marksIndex[startMark]) {
          startTime = this.#marksIndex[startMark].startTime;
        } else {
          startTime = 0;
        }
  
        if (this.#marksIndex[endMark]) {
          endTime = this.#marksIndex[endMark].startTime;
        } else {
          endTime = this.now();
        }
  
        const mark = {
            name,
            entryType: 'measure',
            startTime,
            duration: endTime - startTime
        };
        this.#entries.push(mark);
    }

    getEntriesByType(type) {
        return this.#entries.filter(entry => entry.entryType === type);
    }

    getEntriesByName(name) {
        return this.#entries.filter(entry => entry.name === name);
    }

    clearMarks(name) {
        if (typeof name === 'undefined') {
            this._entries = this.#entries.filter(entry => entry.entryType !== 'mark');
        } else {
            const entry = this.#entries.find(e => e.entryType === 'mark' && e.name === name);
            this.#entries.splice(this.#entries.indexOf(entry), 1);
            delete this.#marksIndex[name];
        }
    }

    clearMeasures(name) {
        if (typeof name === 'undefined') {
            this._entries = this.#entries.filter(entry => entry.entryType !== 'measure');
        } else {
            const entry = this.#entries.find(e => e.entryType === 'measure' && e.name === name);
            this.#entries.splice(this.#entries.indexOf(entry), 1);
        }
    }
}

function hrtimeMs() {
    return Number(BigInt(native.hrtime()) / 1000000n);
}

export { Performance };
