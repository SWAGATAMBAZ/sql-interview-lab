"""Runs every pandas solution and compares with the SQL solution output (same normalisation as the site)."""
import json, math, re, sys, os, traceback
import pandas as pd
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '..')
qs = json.load(open(os.path.join(HERE, 'questions.json')))
expected = json.load(open(os.path.join(HERE, 'expected.json')))
_ds = {}

def load_ds(key):
    if key not in _ds:
        src = open(os.path.join(SITE, 'datasets', key + '.js')).read()
        js = src[src.index(']=') + 2:].rstrip().rstrip(';')
        _ds[key] = json.loads(js)
    return _ds[key]['tables']

def frames(tables):
    env = {}
    for name, t in tables.items():
        df = pd.DataFrame(t['rows'], columns=t['columns'])
        for c, ty in zip(t['columns'], t['types']):
            if ty in ('DATE', 'DATETIME'):
                df[c] = pd.to_datetime(df[c])
            elif ty == 'INT' and df[c].isna().any():
                df[c] = df[c].astype('Int64')
        env[name] = df
    return env

def to_rows(result):
    if isinstance(result, pd.Series):
        result = result.to_frame()
    if not isinstance(result.index, pd.RangeIndex):
        result = result.reset_index()
    rows = []
    for r in result.itertuples(index=False):
        row = []
        for v in r:
            if isinstance(v, pd.Timestamp):
                v = v.strftime('%Y-%m-%d') if (v.hour == 0 and v.minute == 0 and v.second == 0) else v.strftime('%Y-%m-%d %H:%M:%S')
            elif isinstance(v, (np.integer,)):
                v = int(v)
            elif isinstance(v, (np.floating,)):
                v = float(v)
            elif isinstance(v, (np.bool_, bool)):
                v = int(v)
            if v is pd.NA or v is pd.NaT or (isinstance(v, float) and math.isnan(v)):
                v = None
            row.append(v)
        rows.append(row)
    return list(map(str, result.columns)), rows

def norm(v):
    if v is None: return None
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    s = str(v)
    if re.match(r'^\d{4}-\d{2}-\d{2} 00:00:00$', s): s = s[:10]
    try:
        if re.match(r'^-?\d+(\.\d+)?$', s): return round(float(s), 2)
    except Exception: pass
    return s

def same(a, b):
    if a is None or b is None: return a is None and b is None
    if isinstance(a, float) and isinstance(b, float): return abs(a - b) <= 0.011
    return a == b

def compare(exp_rows, got_rows, ordered):
    E = [[norm(v) for v in r] for r in exp_rows]
    G = [[norm(v) for v in r] for r in got_rows]
    if len(E) != len(G): return f'row count {len(G)} vs expected {len(E)}'
    if E and len(E[0]) != len(G[0]): return f'col count {len(G[0])} vs expected {len(E[0])}'
    if not ordered:
        key = lambda r: json.dumps([(x if not isinstance(x, float) else round(x, 1)) for x in r], default=str)
        E = sorted(E, key=key); G = sorted(G, key=key)
    for i, (e, g) in enumerate(zip(E, G)):
        if not all(same(x, y) for x, y in zip(e, g)):
            return f'row {i}: got {g} expected {e}'
    return None

ok = bad = 0
for q in qs:
    tables = load_ds(q['dataset']) if q['dataset'] else q['tables']
    env = frames(tables)
    env.update({'pd': pd, 'np': np})
    try:
        exec(q['py'], env)
        cols, rows = to_rows(env['result'])
        err = compare(expected[str(q['id'])]['rows'], rows, q['ordered'])
    except Exception as e:
        err = 'EXCEPTION ' + traceback.format_exc().strip().splitlines()[-1]
    if err:
        bad += 1; print(f"Q{q['id']}: FAIL {err}")
    else:
        ok += 1
print(f'pandas verified: {ok} ok, {bad} failed')
