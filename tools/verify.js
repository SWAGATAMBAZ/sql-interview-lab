// Runs every SQL solution through sql.js + compat layer; writes expected outputs for the pandas verifier.
const fs = require('fs');
const path = require('path');
const h = require('./harness.js');
const SITE = path.join(__dirname, '..');
global.window = global.window || {};
new Function('window', fs.readFileSync(path.join(SITE, 'data', 'helpers.js'), 'utf8'))(window);
const files = fs.readdirSync(path.join(SITE, 'data')).filter(f => f.startsWith('q_')).sort();
for (const f of files) new Function('window', 'QT', 'LC', fs.readFileSync(path.join(SITE, 'data', f), 'utf8'))(window, window.QT, window.LC);
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
(async () => {
  const out = {}; let bad = 0;
  const ids = new Set();
  for (const q of window.QUESTIONS) {
    if (ids.has(q.id)) { console.log('DUPLICATE ID', q.id); bad++; }
    ids.add(q.id);
    if (only && !only.includes(q.id)) continue;
    for (const k of ['title', 'difficulty', 'tier', 'topics', 'companies', 'prompt', 'sql', 'py', 'sql_explain', 'py_explain']) if (!q[k]) { console.log(`Q${q.id} missing ${k}`); bad++; }
    const db = await h.dbFor(q);
    try {
      const t0 = Date.now();
      const r = h.runSQL(db, q.sql, q.after);
      out[q.id] = r;
      const ms = Date.now() - t0;
      const flag = r.rows.length === 0 ? '  <-- EMPTY' : '';
      if (flag) bad++;
      console.log(`${q.lc ? 'LC' + q.lc : 'Q' + q.id} [${q.dataset || 'inline'}] ${q.title}: ${r.rows.length} rows, ${r.columns.length} cols, ${ms}ms${flag}`);
      if (process.env.SHOW) console.log('   ', r.columns.join(' | '), '\n   ', r.rows.slice(0, +process.env.SHOW).map(x => JSON.stringify(x)).join('\n    '));
    } catch (e) { bad++; console.log(`Q${q.id} SQL ERROR: ${e.message}`); }
    db.close();
  }
  fs.writeFileSync(path.join(__dirname, 'expected.json'), JSON.stringify(out));
  // export question metadata for python verifier
  fs.writeFileSync(path.join(__dirname, 'questions.json'), JSON.stringify(window.QUESTIONS.filter(q => !only || only.includes(q.id)).map(q => ({ id: q.id, dataset: q.dataset || null, tables: q.tables || null, py: q.py, ordered: !!q.ordered }))));
  console.log(`\n${window.QUESTIONS.length} questions, problems: ${bad}`);
})();
