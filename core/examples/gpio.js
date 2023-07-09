import * as config from '@tjs/config';
import * as gpio from '../js/tjs/gpio.js';

async function test() {
    const deviceConfig = await config.load('device');

    const data = deviceConfig.data || {};
    gpio.setPortInfos(data);

    console.log(await gpio.getPorts());

    const led1 = await gpio.requestPort('led.green');
    const led2 = await gpio.requestPort('led.blue');
    const led3 = await gpio.requestPort('led.yellow');
    
    const reset = await gpio.requestPort('reset');

    console.log(led1);
    console.log(led2);
    console.log(led3);

    if (!led1) {
        return;
    }

    let count = 0;
    setInterval(async () => {
        const value = (count % 10);
        if (value == 0) {
            await led1.setOn();

        } else if (value == 1) {
            await led1.setOff();
            await led2.setOn();

        } else if (value == 2) {
            await led2.setOff();
            await led3.setOn();

        } else if (value == 3) {
            await led3.setOff();
        }

        count++;
    }, 50);
}

async function test1() {
    const deviceConfig = await config.load('device');

    const data = deviceConfig.data || {};
    gpio.setPortInfos(data);

    const led1 = await gpio.requestPort('ledwifi1');
    const led2 = await gpio.requestPort('ledblue');
    const led3 = await gpio.requestPort('ledorange');

    setInterval(async () => {
        led3.toggle();
        led2.toggle();
        led1.toggle();
    }, 50);
}

async function test2() {
    const deviceConfig = await config.load('device');

    const data = deviceConfig.data || {};
    gpio.setPortInfos(data);

    const reset = await gpio.requestPort('ledblue');
    console.log(reset);

    let lastState = false;
    setInterval(async () => {
        const state = await reset.isOn();
        if (lastState != state) {
            lastState = state;
            console.log(state);
        }
    }, 50);
}

// test2();
test();
