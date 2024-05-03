// @ts-check
/// <reference path ="../types/index.d.ts" />

async function main() {
    const textDecoder = new TextDecoder();
    try {
        const callback = {};
        const promise = new Promise((resolve, reject) => {
            callback.resolve = resolve;
            callback.reject = reject;
        });

        // fetch
        const url = 'http://localhost:38088/get?foo=100&bar=test';
        const init = { debug: false, headers: {} };
        const response = await fetch(url, init);
        // console.log('headers:', response.headers);

        // read response body
        const body = response.body;
        const reader = body?.getReader();

        if (reader) {
            while (true) {
                const result = await reader.read();
                // console.log('result:', result);

                if (result?.done) {
                    console.log('eof');
                    callback.resolve({});
                    break;

                } else if (result?.value) {
                    console.write(textDecoder.decode(result.value));
                }
            }
        }

        await promise;

        console.log('close');

    } catch (e) {
        console.log('error:', e);
    }
}

main();
