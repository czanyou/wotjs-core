import { redis } from '@tjs/redis';

// console.log('redis:', redis);

async function test() {
    let result = await redis.connect('172.24.160.1');
    console.log('connect', result);

    result = await redis.execute('PING');
    console.log('execute', result);

    result = await redis.execute('SET key 200');
    console.log('execute: SET key 200', result);

    result = await redis.execute('GET key');
    console.log('execute: GET key', result);

    result = await redis.execute('SET key 100');
    console.log('execute: SET key 100', result);

    result = await redis.execute('GET');
    console.log('execute: GET', result);

    await redis.disconnect();
}

test();
