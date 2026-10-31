# SQL Interview Lab

92 interview-grade SQL problems for **Data Analyst / Business Analyst / Data Scientist (2–3+ yrs)** roles — solve each one in **MySQL** or **Python (pandas)** right in the browser, check your answer instantly, and keep notes.

- **Realistic multi-table datasets** (generated, ~60K rows total): e-commerce sales & returns, a payment gateway (retries, outages, refunds, T+2 settlements, fraud), a lending book (EMIs, partial/late payments, DPD), food delivery, raw app event logs, subscriptions, HR, ride hailing.
- **Every pattern that shows up in interviews:** top-N per group, running totals, moving averages, LAG/LEAD, gaps & islands, sessionization, cohorts/retention, ordered funnels, pivots, recursive CTEs, date spines, anti-joins, relational division, fan-out traps, reconciliation, data cleaning, and the classic LeetCode / Namaste-SQL puzzles (rewritten with original data).
- **Filters:** difficulty, interview level (L1 ₹10–25 LPA → L3 ₹45–80 LPA), domain, topic/pattern, company, status, bookmarks.
- **Hidden optimal solutions** in MySQL *and* pandas, each with a plain-English explanation.
- **Notes** per question (autosaved), a global scratchpad, a "My Notes" page, Markdown export and JSON backup/restore.

Everything runs client-side. Progress, code and notes are stored in your browser's `localStorage`.

## Host it on GitHub Pages

1. Create a new repository (e.g. `sql-interview-lab`) and upload **the contents of this folder** (so `index.html` is at the repo root). Keep the empty `.nojekyll` file.
2. Repository → **Settings → Pages** → *Build and deployment* → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
3. After a minute your lab is live at `https://<your-username>.github.io/sql-interview-lab/`.

To run locally, serve the folder over HTTP (opening `index.html` as a file won't load the WebAssembly engine):

```bash
cd sql-interview-lab
python3 -m http.server 8000
# open http://localhost:8000
```

## How it works

| Piece | What it uses |
|---|---|
| SQL engine | [sql.js](https://github.com/sql-js/sql.js) (SQLite → WebAssembly), bundled in `vendor/`, plus `js/compat.js` — a MySQL compatibility layer that rewrites MySQL-only syntax (`INTERVAL`, `IF()`, `LEFT()`, `GROUP_CONCAT … SEPARATOR`, `TIMESTAMPDIFF(UNIT,…)`, `EXTRACT`, decimal `/` division, …) and registers MySQL functions (`DATE_FORMAT`, `DATEDIFF`, `DATE_ADD`, `WEEKDAY`, `LAST_DAY`, `STR_TO_DATE`, `SUBSTRING_INDEX`, `STDDEV`, …). |
| Python engine | [Pyodide](https://pyodide.org) with pandas + numpy, loaded on demand from the jsDelivr CDN (~15 MB once, then browser-cached). |
| Editor | CodeMirror 5 (bundled) with MySQL/Python highlighting and table/column autocomplete (Ctrl+Space). |
| Answer check | Your result is compared with the official solution's output: values (column names ignored), numbers to 2 decimals, row order only when the problem asks for a sort. |

## Project layout

```
index.html          app shell
css/style.css       styles
js/app.js           UI: problem list, workspace, notes, datasets playground, prep guide
js/engine.js        SQL + Python execution and answer comparison
js/compat.js        MySQL → SQLite compatibility layer
data/q_*.js         the 92 questions (prompt, hint, SQL + pandas solutions, explanations)
datasets/*.js       the generated datasets (loaded lazily per problem)
vendor/             sql.js + CodeMirror
```

## Adding your own question

Append an object to any `data/q_*.js` file:

```js
window.QUESTIONS.push({
  id: 93, title: 'My question', difficulty: 'Medium', tier: 2,
  dataset: 'retail',                     // or: tables: { t: QT('a:INT,b:TEXT', [[1,'x']]) }
  topics: ['Window ranking'], companies: ['Acme'], ordered: true,
  prompt: '<p>…</p>', hint: '…',
  sql: 'SELECT …', sql_explain: '<p>…</p>',
  py: 'result = …', py_explain: '<p>…</p>'
});
```

The expected output is computed from `sql`, so make the SQL solution deterministic (explicit `ORDER BY` with tie-breakers).

## Notes

"Seen at" company tags mark where a *pattern* has been reported in public interview write-ups — they are not leaked questions. Salary bands per level are rough Indian-market guides.

## Maintainer tools (optional)

`tools/` contains the dataset generator and the answer verifier used to build this lab. Every SQL solution is executed through the same in-browser engine, and every pandas solution is checked against it (pandas 2.2 and 3.0):

```bash
npm i sql.js@1.12.0          # once
node tools/gen_data.js       # regenerate datasets/*.js (deterministic)
node tools/verify.js         # run all SQL solutions
python3 tools/verify_py.py   # run all pandas solutions and compare
```
