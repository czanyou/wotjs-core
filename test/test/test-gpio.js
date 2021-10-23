
import * as gpio from '@tjs/gpio';
import * as config from '@tjs/config';

console.log(gpio);

async function test() {
    const deviceConfig = await config.load('device');

    const data = deviceConfig.data || {};
    await gpio.init(data);

    // console.log(await gpio.getDevices());
    const led1 = await gpio.requestDevice('led.green');
    const led2 = await gpio.requestDevice('led.blue');
    const led3 = await gpio.requestDevice('led.yellow');
    
    const reset = await gpio.requestDevice('reset');

    console.log(led1);
    console.log(led2);
    console.log(led3);

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
    await gpio.init(data);

    const led1 = await gpio.requestDevice('ledwifi1');
    const led2 = await gpio.requestDevice('ledblue');
    const led3 = await gpio.requestDevice('ledorange');

    setInterval(async () => {
        led3.toggle();
        led2.toggle();
        led1.toggle();
    }, 50);
}

async function test2() {
    const deviceConfig = await config.load('device');

    const data = deviceConfig.data || {};
    await gpio.init(data);

    const reset = await gpio.requestDevice('ledblue');
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
test1();
