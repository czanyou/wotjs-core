import * as sqlite3 from '@tjs/sqlite3';

console.log('sqlite3:', sqlite3);

const db = new sqlite3.Database('build/test.db');
console.log('sqlite3:', db);

// create
if (!db.exec('create table t (a, b, c);')) {
    console.log(db.errmsg());
}

// insert
let st = db.prepare('insert into t (a, b, c) values (1, 2, 3);');
console.log('bind parameter count = ' + st.parameterCount());

let s;
s = st.step();
console.log('step result = ' + s); // "row" "done" "busy" null
st.reset();
st.clearBindings();
st.finalize();
console.log('last insert rowid = ' + db.lastInsertId());

// insert
st = db.prepare('insert into t (a, b, c) values (?1, ?2, ?3);');
console.log('bind parameter count = ' + st.parameterCount());
/* distinctly 1 based */
console.log(st.parameterName(1));
console.log(st.parameterIndex('?2'));
console.log(st.columnCount());
st.bind(1, null);
st.bind(2, null);
st.bind(3, null);
st.finalize();

// select
console.log('select');
st = db.prepare('select * from t;');
st.step();
console.log(st.columnCount());
let i;
console.log('begin column names...');
/* zero based - and see above bind parameter indices */
for (i = 0; i < st.columnCount(); ++i) {
    console.log(st.name(i));
}

console.log('... end column names');
st.reset();
while ((s = st.step()) == 'row') {
    console.log('row', st.value(0), st.value(1), st.value(2));
}

console.log(s);
st.finalize();

db.close();
