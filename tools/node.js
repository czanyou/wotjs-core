import * as fs from 'node:fs';

console.log(fs.readdir);

try {
    const ret = fs.readdirSync({});
    console.log(ret);

} catch (e) {
    console.log(e);
}
