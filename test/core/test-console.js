// @ts-check
import { assert, test } from '@tjs/assert';

test('console', async () => {
    assert.ok(console.clear);
    assert.ok(console.log);
    assert.ok(console.info);
    assert.ok(console.error);
    assert.ok(console.warn);
    assert.ok(console.debug);

    assert.ok(console.count);
    assert.ok(console.countReset);
    assert.ok(console.time);
    assert.ok(console.timeEnd);

    assert.ok(console.colors);
});
