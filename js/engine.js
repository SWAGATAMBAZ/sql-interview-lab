/* Execution engines: SQL (sql.js + MySQL compat) and Python (Pyodide + pandas). */
(function () {
  'use strict';
  const DATASET_META = {
    retail: { title: 'ShopKart — E-commerce', domain: 'E-commerce' },
    payments: { title: 'PayFlow — Payments', domain: 'Fintech: Payments' },
    lending: { title: 'NaviLoans — Lending', domain: 'Fintech: Lending' },
    delivery: { title: 'QuickBite — Food delivery', domain: 'Food delivery' },
    events: { title: 'ShopApp — Event logs', domain: 'Product analytics' },
    subscriptions: { title: 'StreamBox — Subscriptions', domain: 'Subscriptions / SaaS' },
    hr: { title: 'Acme Corp — HR', domain: 'HR / Classic' },
    rides: { title: 'RideNow — Ride hailing', domain: 'Mobility' }
  };
  const PYODIDE_VERSIONS = ['0.28.3', '0.27.7', '0.26.4'];

  let SQL = null, sqlPromise = null;
  const dbBytes = {};
  const dsPromises = {};

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }
  function loadDataset(key) {
    if (window.DATASETS && window.DATASETS[key]) return Promise.resolve(window.DATASETS[key]);
    if (!dsPromises[key]) dsPromises[key] = loadScript('datasets/' + key + '.js').then(() => window.DATASETS[key]);
    return dsPromises[key];
  }
  async function tablesFor(q) {
    if (q.dataset) return (await loadDataset(q.dataset)).tables;
    return q.tables;
  }
  function initSQL() {
    if (SQL) return Promise.resolve(SQL);
    if (!sqlPromise) sqlPromise = initSqlJs({ locateFile: f => 'vendor/' + f }).then(s => (SQL = s));
    return sqlPromise;
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
  async function bytesFor(key, tables) {
    if (!dbBytes[key]) {
      await initSQL();
      const db = new SQL.Database();
      populate(db, tables);
      dbBytes[key] = db.export();
      db.close();
    }
    return dbBytes[key];
  }
  const keyFor = q => (q.dataset ? 'ds:' + q.dataset : 'q:' + q.id);

  async function runSQL(q, sql) {
    const tables = await tablesFor(q);
    const bytes = await bytesFor(keyFor(q), tables);
    const db = new SQL.Database(bytes);
    MySQLCompat.registerMySQLFunctions(db);
    const translated = MySQLCompat.rewriteMySQL(sql);
    const t0 = performance.now();
    try {
      const res = db.exec(translated);
      const ms = performance.now() - t0;
      const last = res[res.length - 1];
      return { columns: last ? last.columns : [], rows: last ? last.values : [], ms, statements: res.length, translated, changes: db.getRowsModified() };
    } finally { db.close(); }
  }
  const expectedCache = {};
  async function expected(q) {
    if (!expectedCache[q.id]) expectedCache[q.id] = await runSQL(q, q.sql);
    return expectedCache[q.id];
  }

  // ---------- Python ----------
  let py = null, pyPromise = null; const pyLoaded = {};
  function initPy(onStatus) {
    if (py) return Promise.resolve(py);
    if (!pyPromise) pyPromise = (async () => {
      let lastErr;
      for (const v of PYODIDE_VERSIONS) {
        try {
          onStatus && onStatus(`Downloading Python runtime (Pyodide ${v})…`);
          const base = `https://cdn.jsdelivr.net/pyodide/v${v}/full/`;
          await loadScript(base + 'pyodide.js');
          const p = await loadPyodide({ indexURL: base });
          onStatus && onStatus('Installing pandas + numpy (first time ~10–20s, then cached)…');
          await p.loadPackage(['pandas', 'numpy']);
          await p.runPythonAsync(PY_BOOT);
          py = p; return p;
        } catch (e) { lastErr = e; }
      }
      pyPromise = null;
      throw lastErr || new Error('Could not load Pyodide');
    })();
    return pyPromise;
  }
  const PY_BOOT = `
import json, math, io, sys
import pandas as pd
import numpy as np
_DS = {}
def _load(key, tables_json):
    tables = json.loads(tables_json)
    env = {}
    for name, t in tables.items():
        df = pd.DataFrame(t['rows'], columns=t['columns'])
        for c, ty in zip(t['columns'], t['types']):
            if ty in ('DATE', 'DATETIME'):
                df[c] = pd.to_datetime(df[c])
            elif ty == 'INT' and df[c].isna().any():
                df[c] = df[c].astype('Int64')
        env[name] = df
    _DS[key] = env
def _cell(v):
    if isinstance(v, pd.Timestamp):
        if pd.isna(v): return None
        return v.strftime('%Y-%m-%d') if (v.hour == 0 and v.minute == 0 and v.second == 0) else v.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(v, pd.Timedelta): return str(v)
    if isinstance(v, (np.bool_, bool)): return int(v)
    if isinstance(v, np.integer): return int(v)
    if isinstance(v, np.floating): v = float(v)
    if v is pd.NA or v is pd.NaT: return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)): return None
    if isinstance(v, (int, float, str)) or v is None: return v
    return str(v)
def _run(key, code):
    ns = {'pd': pd, 'np': np}
    for k, v in _DS[key].items(): ns[k] = v.copy()
    buf = io.StringIO(); old = sys.stdout; sys.stdout = buf
    try:
        exec(code, ns)
    finally:
        sys.stdout = old
    out = {'stdout': buf.getvalue()[-20000:]}
    if 'result' not in ns:
        out['error'] = "No variable named 'result'. Assign your final DataFrame to result."
        return json.dumps(out)
    r = ns['result']
    if isinstance(r, pd.Series): r = r.to_frame()
    if not isinstance(r, pd.DataFrame):
        r = pd.DataFrame({'result': [r]})
    if not isinstance(r.index, pd.RangeIndex): r = r.reset_index()
    out['columns'] = [str(c) for c in r.columns]
    out['rows'] = [[_cell(v) for v in row] for row in r.itertuples(index=False)]
    out['shape'] = list(r.shape)
    return json.dumps(out)
`;
  async function runPy(q, code, onStatus) {
    const p = await initPy(onStatus);
    const key = keyFor(q);
    if (!pyLoaded[key]) {
      onStatus && onStatus('Loading tables into pandas…');
      const tables = await tablesFor(q);
      p.globals.set('__tj', JSON.stringify(tables));
      await p.runPythonAsync(`_load(${JSON.stringify(key)}, __tj)`);
      pyLoaded[key] = true;
    }
    p.globals.set('__code', code);
    const t0 = performance.now();
    const outJson = await p.runPythonAsync(`_run(${JSON.stringify(key)}, __code)`);
    const out = JSON.parse(outJson);
    out.ms = performance.now() - t0;
    return out;
  }

  // ---------- Result comparison (same rules as the offline verifier) ----------
  function norm(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Math.round(v * 100) / 100;
    if (typeof v === 'boolean') return v ? 1 : 0;
    let s = String(v);
    if (/^\d{4}-\d{2}-\d{2} 00:00:00$/.test(s)) s = s.slice(0, 10);
    if (/^-?\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 100) / 100;
    return s;
  }
  function same(a, b) {
    if (a === null || b === null) return a === b;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 0.011;
    return a === b;
  }
  function compare(exp, got, ordered) {
    let E = exp.rows.map(r => r.map(norm)), G = got.rows.map(r => r.map(norm));
    if (E.length !== G.length) return { ok: false, reason: `Your result has ${G.length} row(s); expected ${E.length}.` };
    if (E.length && E[0].length !== G[0].length) return { ok: false, reason: `Your result has ${G[0].length} column(s); expected ${E[0].length} (${exp.columns.join(', ')}).` };
    if (!ordered) {
      const key = r => JSON.stringify(r.map(x => (typeof x === 'number' ? Math.round(x * 10) / 10 : x)));
      E = E.slice().sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
      G = G.slice().sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    }
    for (let i = 0; i < E.length; i++) {
      for (let j = 0; j < E[i].length; j++) {
        if (!same(E[i][j], G[i][j])) {
          const sameSet = ordered && compare(exp, got, false).ok;
          return { ok: false, row: i, col: j, reason: sameSet ? 'Right rows, wrong ORDER. Check the required sort order (and tie-breakers).' : `First difference at row ${i + 1}, column ${j + 1} (${exp.columns[j]}): got ${JSON.stringify(G[i][j])}, expected ${JSON.stringify(E[i][j])}.` };
        }
      }
    }
    return { ok: true };
  }

  window.Engine = { DATASET_META, loadDataset, tablesFor, runSQL, runPy, expected, compare, initSQL, initPy, isPyReady: () => !!py };
})();
