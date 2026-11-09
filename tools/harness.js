// Node harness: load datasets / inline tables into sql.js with the MySQL compat layer.
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const compat = require('../js/compat.js');
const SITE = path.join(__dirname, '..');

global.window = global.window || {};
function loadDatasetDef(key) {
  if (!window.DATASETS || !window.DATASETS[key]) {
    const src = fs.readFileSync(path.join(SITE, 'datasets', key + '.js'), 'utf8');
    new Function('window', src)(window);
  }
  return window.DATASETS[key];
}
const sqlType = t => ({ INT: 'INTEGER', REAL: 'REAL', TEXT: 'TEXT', DATE: 'TEXT', DATETIME: 'TEXT' }[t] || 'TEXT');
function populate(db, tables) {
  db.run('BEGIN');
  for (const [name, t] of Object.entries(tables)) {
    db.run(`CREATE TABLE ${name} (${t.columns.map((c, i) => `${c} ${sqlType(t.types[i])}`).join(', ')})`);
    const st = db.prepare(`INSERT INTO ${name} VALUES (${t.columns.map(() => '?').join(',')})`);
    for (const r of t.rows) st.run(r.map(v => (v === undefined ? null : v)));
    st.free();
    t.columns.forEach((c, i) => { if (i > 0 && /_id$/.test(c)) db.run(`CREATE INDEX idx_${name}_${c} ON ${name}(${c})`); });
  }
  db.run('COMMIT');
}
let SQL;
async function getSQL() { if (!SQL) SQL = await initSqlJs(); return SQL; }
async function dbFor(q) {
  const S = await getSQL();
  const db = new S.Database();
  compat.registerMySQLFunctions(db);
  populate(db, tablesFor(q));
  return db;
}
function tablesFor(q) { return q.dataset ? loadDatasetDef(q.dataset).tables : q.tables; }
function runSQL(db, sql, after) {
  let res = db.exec(compat.rewriteMySQL(sql));
  if (after) res = res.concat(db.exec(compat.rewriteMySQL(after)));
  const last = res[res.length - 1];
  return last ? { columns: last.columns, rows: last.values } : { columns: [], rows: [] };
}
module.exports = { dbFor, runSQL, tablesFor, loadDatasetDef, getSQL, populate, compat };
