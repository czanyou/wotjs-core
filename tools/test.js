#!/bin/env tjs

import * as util from '@tjs/util'
// import * as log from '@app/log.js'

class Test {

    #test = 1;

    name = 'good';

    constructor() {
        this.#test = 0;
    }

    test() {
        return this.#test;
    }
}

async function test2() {
    console.log('test');

    const value = new Test();
    console.log(value, value.test());
    console.log(value.name ?? 'test');
    console.log(value.test() ?? 'test');
}

async function test() {
    console.log('test');

    await util.sleep(1000);

    console.log('end');
}

test();
