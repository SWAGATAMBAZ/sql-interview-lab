/* SQL Interview Lab — single page app */
(function () {
  'use strict';
  const ALL = window.QUESTIONS.slice().sort((a, b) => a.id - b.id);
  const QBYID = Object.fromEntries(ALL.map(q => [q.id, q]));
  const QS = ALL.filter(q => q.set !== 'lc');            // main interview set (Q001…)
  const LCQ = ALL.filter(q => q.set === 'lc');            // LeetCode set (LC175…), internal id = 10000 + number
  const setOf = q => (q.set === 'lc' ? 'lc' : 'main');
  const listFor = set => (set === 'lc' ? LCQ : QS);
  const META = Engine.DATASET_META;
  const TIERS = { 1: 'L1 · Core (₹10–25 LPA)', 2: 'L2 · Strong (₹25–45 LPA)', 3: 'L3 · Advanced (₹45–80 LPA)' };
  const TIER_SHORT = { 1: 'L1', 2: 'L2', 3: 'L3' };
  const DIFFS = ['Easy', 'Medium', 'Hard'];
  const qcode = id => (+id >= 10000 ? 'LC' + (id - 10000) : 'Q' + String(id).padStart(3, '0'));   // permanent ID: Q031 / LC1251
  const qhash = id => (+id >= 10000 ? '#lc-' + (id - 10000) : '#q-' + id);
  const lcUrl = q => 'https://leetcode.com/problems/' + q.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '/';
  const domainOf = q => (q.set === 'lc' ? 'LeetCode' : q.dataset ? META[q.dataset].domain : 'Puzzles & transformations');
  const app = document.getElementById('app');

  // ---------------- storage ----------------
  const P = 'sqlab.';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(P + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { toast('Could not save (storage full or blocked)'); } },
    del(k) { try { localStorage.removeItem(P + k); } catch (e) { /* ignore */ } }
  };
  const progress = () => LS.get('progress', {});
  function setProgress(id, lang, val) {
    const p = progress(); p[id] = p[id] || {};
    if (p[id][lang] === 'solved' && val === 'attempted') return;
    p[id][lang] = val; LS.set('progress', p); renderTopProgress();
  }
  const isSolved = id => { const s = progress()[id] || {}; return s.sql === 'solved' || s.py === 'solved'; };
  const isAttempted = id => { const s = progress()[id] || {}; return !!(s.sql || s.py); };
  const bookmarks = () => new Set(LS.get('bookmarks', []));
  function toggleBookmark(id) { const b = bookmarks(); b.has(id) ? b.delete(id) : b.add(id); LS.set('bookmarks', [...b]); return b.has(id); }
  const notes = () => LS.get('notes', {});
  function saveNote(id, patch) {
    const n = notes(); n[id] = Object.assign({ text: '', important: false }, n[id] || {}, patch, { updated: Date.now() });
    if (!n[id].text.trim() && !n[id].important) delete n[id];
    LS.set('notes', n);
  }

  // ---------------- helpers ----------------
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  let toastTimer;
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }
  function ask(msg, okLabel) {
    return new Promise(res => {
      const m = h(`<div class="modal-bg"><div class="modal"><p>${esc(msg)}</p><div class="row"><button class="btn ghost" data-a="0">Cancel</button><button class="btn primary" data-a="1">${esc(okLabel || 'OK')}</button></div></div></div>`);
      const done = v => { m.remove(); document.removeEventListener('keydown', key); res(v); };
      const key = e => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); };
      m.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === '1'); else if (e.target === m) done(false); });
      document.addEventListener('keydown', key);
      document.body.appendChild(m); m.querySelector('.btn.primary').focus();
    });
  }
  async function copyText(t, what) { try { await navigator.clipboard.writeText(t); toast((what || 'Text') + ' copied to clipboard'); } catch (e) { toast('Copy blocked by the browser'); } }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function fmtCell(v) {
    if (v === null || v === undefined) return '<td class="null">NULL</td>';
    if (typeof v === 'number') return `<td class="num">${Number.isInteger(v) ? v : +v.toFixed(6)}</td>`;
    return `<td title="${esc(v)}">${esc(v)}</td>`;
  }
  function tableHTML(res, limit = 500, diffRow = -1) {
    if (!res.columns.length) return '<div class="placeholder">Statement executed — no result set returned.</div>';
    const rows = res.rows.slice(0, limit);
    return `<div class="rtable-wrap"><table class="rtable"><thead><tr>${res.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${i === diffRow ? 'diff' : ''}">${r.map(fmtCell).join('')}</tr>`).join('')}</tbody></table></div>${res.rows.length > limit ? `<div class="faint" style="margin-top:6px">Showing first ${limit} of ${res.rows.length} rows.</div>` : ''}`;
  }
  function highlight(code, mode) {
    const out = document.createElement('div');
    if (CodeMirror.runMode) CodeMirror.runMode(code, mode, out); else out.textContent = code;
    return out.innerHTML;
  }
  function renderTopProgress() {
    const solved = ALL.filter(q => isSolved(q.id)).length;
    document.getElementById('topProgress').innerHTML = `<span><b style="color:var(--text)">${solved}</b> / ${ALL.length} solved</span><span class="bar"><i style="width:${(100 * solved / ALL.length).toFixed(1)}%"></i></span>`;
  }
  function setNav(name) { document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === name)); }
  function makeEditor(el, lang, value, extraKeys) {
    return CodeMirror(el, {
      value, mode: lang === 'sql' ? 'text/x-mysql' : 'python', theme: 'lab', lineNumbers: true, indentUnit: 4, tabSize: 4,
      matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true, lineWrapping: false,
      extraKeys: Object.assign({ 'Ctrl-Space': 'autocomplete', 'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment', Tab: cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(' '.repeat(cm.getOption('indentUnit'))) }, extraKeys || {})
    });
  }
  function attachAutoHint(cm) {
    cm.on('inputRead', (ed, ch) => {
      if (ed.getMode().name !== 'sql') return;
      if (/^[A-Za-z_.]$/.test(ch.text[0]) && !ed.state.completionActive) {
        const tok = ed.getTokenAt(ed.getCursor());
        if (tok.string.length >= 2 || ch.text[0] === '.') ed.showHint({ completeSingle: false });
      }
    });
  }

  // ---------------- router ----------------
  let cleanup = null;
  function route() {
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    let hash = location.hash.replace(/^#\/?/, '');
    hash = hash.replace(/^q\//, 'q-').replace(/^datasets\/(\w+)/, 'data-$1').replace(/^guide\//, 'guide-');  // old-style links
    window.scrollTo(0, 0);
    let m;
    if ((m = /^q-(\d+)$/.exec(hash)) && QBYID[+m[1]] && +m[1] < 10000) return viewQuestion(QBYID[+m[1]]);
    if ((m = /^lc-(\d+)$/.exec(hash)) && QBYID[10000 + +m[1]]) return viewQuestion(QBYID[10000 + +m[1]]);
    if (hash === 'leetcode') return viewProblems('lc');
    if (hash === 'notes') return viewNotes();
    if ((m = /^data-(\w+)$/.exec(hash)) && META[m[1]]) return viewPlayground(m[1]);
    if (hash === 'datasets') return viewDatasets();
    if ((m = /^guide(?:-(\w+))?$/.exec(hash))) return viewGuide(m[1]);
    return viewProblems();
  }
  window.addEventListener('hashchange', route);

  // ================= PROBLEMS =================
  const FILTERS = {};
  ['main', 'lc'].forEach(k => { let saved = {}; try { saved = JSON.parse(sessionStorage.getItem('sqlab.filters.' + k) || '{}'); } catch (e) { /* ignore */ } FILTERS[k] = Object.assign({ q: '', diff: [], tier: [], domain: [], topic: [], company: [], status: 'all', sort: 'id' }, saved); });
  function viewProblems(set = 'main') {
    const isLC = set === 'lc';
    const QS = listFor(set), F = FILTERS[set];
    setNav(isLC ? 'leetcode' : 'problems');
    const counts = (fn) => { const m = {}; QS.forEach(q => [].concat(fn(q)).forEach(k => (m[k] = (m[k] || 0) + 1))); return m; };
    const topicCounts = counts(q => q.topics), companyCounts = counts(q => q.companies), domainCounts = counts(domainOf);
    const topics = Object.keys(topicCounts).sort((a, b) => topicCounts[b] - topicCounts[a] || a.localeCompare(b));
    const companies = Object.keys(companyCounts).sort((a, b) => companyCounts[b] - companyCounts[a] || a.localeCompare(b));
    const domains = Object.keys(domainCounts).sort((a, b) => domainCounts[b] - domainCounts[a]);
    const solvedBy = d => QS.filter(q => q.difficulty === d && isSolved(q.id)).length;
    const totalBy = d => QS.filter(q => q.difficulty === d).length;
    const colors = { Easy: 'var(--easy)', Medium: 'var(--medium)', Hard: 'var(--hard)' };
    app.innerHTML = `<div class="page">
      <section class="hero">
        <div class="hero-card">
          ${isLC ? `<h1>LeetCode SQL — ${QS.length} Database problems</h1>
          <p>The LeetCode Database problems <b>175 → 1336</b>, each with its LeetCode number and title (ID <code>LC175</code>…), a short problem statement, its own sample tables, and optimised <b>MySQL + pandas</b> solutions with explanations. Same editor, answer checker and notes as the main set. Statements here are rewritten and the sample data is original — use the <b>LeetCode ↗</b> link on each problem for the official version.</p>
          <div class="cta"><button class="btn primary" id="randomBtn">🎲 Random unsolved LeetCode problem</button><a class="btn" href="#problems">← Interview problems (Q001–Q092)</a></div>` : `<h1>Crack the SQL round — from ₹10 LPA to ₹80 LPA roles</h1>
          <p>${QS.length} interview-grade problems on realistic multi-table datasets — e-commerce, payments (Razorpay-style), lending (Navi-style), food delivery, product event logs, subscriptions and rides — plus the classic LeetCode / Namaste-SQL patterns. Write <b>MySQL</b> or <b>pandas</b>, run it in your browser, and check your answer instantly.</p>
          <div class="cta"><button class="btn primary" id="randomBtn">🎲 Random unsolved problem</button><a class="btn" href="#guide">📘 How to use this + patterns cheat-sheet</a><a class="btn" href="#datasets">🗄️ Explore the datasets</a><a class="btn" href="#leetcode">🧩 LeetCode SQL (${LCQ.length})</a></div>`}
        </div>
        <div class="stats">
          ${DIFFS.map(d => `<div class="stat"><div class="n" style="color:${colors[d]}">${solvedBy(d)}<span class="faint" style="font-size:14px">/${totalBy(d)}</span></div><div class="l">${d}</div><div class="track"><i style="width:${100 * solvedBy(d) / totalBy(d)}%;background:${colors[d]}"></i></div></div>`).join('')}
          ${isLC ? '' : [1, 2, 3].map(t => { const tot = QS.filter(q => q.tier === t).length, s = QS.filter(q => q.tier === t && isSolved(q.id)).length; return `<div class="stat"><div class="n" style="color:var(--violet)">${s}<span class="faint" style="font-size:14px">/${tot}</span></div><div class="l">${TIERS[t]}</div><div class="track"><i style="width:${100 * s / tot}%;background:var(--violet)"></i></div></div>`; }).join('')}
        </div>
      </section>
      <div class="layout">
        <aside class="filters">
          <h4>Search</h4><input type="search" id="fq" placeholder="${isLC ? 'LC1251, 1251, title, table…' : 'Q031, 31, title, table, keyword…'}" value="${esc(F.q)}">
          <h4>Status</h4>
          ${[['all', 'All'], ['unsolved', 'Unsolved'], ['attempted', 'Attempted, not solved'], ['solved', 'Solved'], ['bookmarked', '★ Bookmarked'], ['noted', '📝 Has notes']].map(([v, l]) => `<label class="opt"><input type="radio" name="fstatus" value="${v}" ${F.status === v ? 'checked' : ''}> ${l}</label>`).join('')}
          <h4>Difficulty</h4>
          ${DIFFS.map(d => `<label class="opt"><input type="checkbox" data-f="diff" value="${d}" ${F.diff.includes(d) ? 'checked' : ''}> <span class="pill ${d}">${d}</span><span class="cnt">${totalBy(d)}</span></label>`).join('')}
          ${isLC ? '' : `<h4>Interview level</h4>
          ${[1, 2, 3].map(t => `<label class="opt"><input type="checkbox" data-f="tier" value="${t}" ${F.tier.includes(String(t)) ? 'checked' : ''}> ${TIERS[t]}<span class="cnt">${QS.filter(q => q.tier === t).length}</span></label>`).join('')}
          <h4>Domain / dataset</h4>
          ${domains.map(d => `<label class="opt"><input type="checkbox" data-f="domain" value="${esc(d)}" ${F.domain.includes(d) ? 'checked' : ''}> ${esc(d)}<span class="cnt">${domainCounts[d]}</span></label>`).join('')}`}
          <h4>Topic / pattern</h4>
          <div class="chips-select" id="topicChips">${topics.map(t => `<button data-v="${esc(t)}" class="${F.topic.includes(t) ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>
          ${isLC ? '' : `<h4>Company (pattern reported at)</h4>
          <input type="search" id="fcomp" placeholder="filter companies…" style="width:100%">
          <div class="company-list" id="companyList">${companies.map(c => `<label class="opt" data-name="${esc(c.toLowerCase())}"><input type="checkbox" data-f="company" value="${esc(c)}" ${F.company.includes(c) ? 'checked' : ''}> ${esc(c)}<span class="cnt">${companyCounts[c]}</span></label>`).join('')}</div>`}
          <div style="margin-top:14px"><button class="btn small ghost" id="clearF">Clear all filters</button></div>
        </aside>
        <section>
          <div class="list-head"><span class="count" id="countLbl"></span><form id="gotoF" class="goto"><input type="text" id="gotoIn" placeholder="${isLC ? 'Go to LC…' : 'Go to Q…'}" size="9"><button class="btn small">Open</button></form>
            <select id="fsort"><option value="id">Sort: ${isLC ? 'LeetCode number' : 'default order'}</option><option value="diff">Sort: difficulty</option>${isLC ? '' : '<option value="tier">Sort: interview level</option><option value="domain">Sort: domain</option>'}</select></div>
          <table class="qtable"><thead><tr><th>#</th><th>Problem</th>${isLC ? '' : '<th class="hide-sm">Domain</th>'}<th>Level</th>${isLC ? '' : '<th class="hide-sm">Seen at</th>'}<th>Status</th><th></th></tr></thead><tbody id="qbody"></tbody></table>
        </section>
      </div></div>`;
    const save = () => { try { sessionStorage.setItem('sqlab.filters.' + set, JSON.stringify(F)); } catch (e) { /* ignore */ } };
    const tbody = document.getElementById('qbody');
    function apply() {
      if (!document.body.contains(tbody)) return;   // page was left before a delayed refresh fired
      const bm = bookmarks(), nt = notes();
      const q = F.q.trim().toLowerCase();
      let list = QS.filter(x => {
        if (F.diff.length && !F.diff.includes(x.difficulty)) return false;
        if (F.tier.length && !F.tier.includes(String(x.tier))) return false;
        if (F.domain.length && !F.domain.includes(domainOf(x))) return false;
        if (F.topic.length && !F.topic.some(t => x.topics.includes(t))) return false;
        if (F.company.length && !F.company.some(c => x.companies.includes(c))) return false;
        if (F.status === 'solved' && !isSolved(x.id)) return false;
        if (F.status === 'unsolved' && isSolved(x.id)) return false;
        if (F.status === 'attempted' && (!isAttempted(x.id) || isSolved(x.id))) return false;
        if (F.status === 'bookmarked' && !bm.has(x.id)) return false;
        if (F.status === 'noted' && !nt[x.id]) return false;
        const num = (isLC ? /^#?(?:lc)?0*(\d+)$/i : /^#?q?0*(\d+)$/i).exec(q);
        if (num) return (isLC ? x.lc : x.id) === +num[1];
        if (q) {
          const tables = x.tables ? Object.keys(x.tables).join(' ') : x.dataset;
          const hay = (x.title + ' ' + x.topics.join(' ') + ' ' + x.companies.join(' ') + ' ' + tables + ' ' + domainOf(x) + ' ' + x.prompt.replace(/<[^>]+>/g, ' ')).toLowerCase();
          if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
        }
        return true;
      });
      const so = { id: (a, b) => a.id - b.id, diff: (a, b) => DIFFS.indexOf(a.difficulty) - DIFFS.indexOf(b.difficulty) || a.id - b.id, tier: (a, b) => a.tier - b.tier || a.id - b.id, domain: (a, b) => domainOf(a).localeCompare(domainOf(b)) || a.id - b.id }[F.sort];
      list.sort(so);
      document.getElementById('countLbl').textContent = `${list.length} problem${list.length === 1 ? '' : 's'}`;
      const pr = progress();
      tbody.innerHTML = list.length ? list.map(x => {
        const s = pr[x.id] || {};
        const ic = l => `<span class="${s[l] === 'solved' ? 'done' : s[l] ? 'try' : ''}" title="${l === 'sql' ? 'MySQL' : 'pandas'}: ${s[l] || 'not started'}">${l === 'sql' ? 'SQL' : 'PY'}${s[l] === 'solved' ? ' ✓' : ''}</span>`;
        return `<tr data-id="${x.id}"><td class="qid">${qcode(x.id)}</td>
          <td><div class="qtitle">${esc(x.title)} ${nt[x.id] ? '<span title="has notes">📝</span>' : ''}</div><div>${x.topics.slice(0, 4).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div></td>
          ${isLC ? '' : `<td class="hide-sm muted" style="white-space:nowrap">${esc(domainOf(x))}</td>`}
          <td style="white-space:nowrap"><span class="pill ${x.difficulty}">${x.difficulty}</span>${isLC ? '' : ` <span class="tier">${TIER_SHORT[x.tier]}</span>`}</td>
          ${isLC ? '' : `<td class="companies-cell hide-sm">${esc(x.companies.slice(0, 3).join(', '))}${x.companies.length > 3 ? ` <span class="faint">+${x.companies.length - 3}</span>` : ''}</td>`}
          <td><span class="status-ic">${ic('sql')}${ic('py')}</span></td>
          <td><span class="star ${bm.has(x.id) ? 'on' : ''}" data-star="${x.id}" title="Bookmark">${bm.has(x.id) ? '★' : '☆'}</span></td></tr>`;
      }).join('') : `<tr><td colspan="${isLC ? 5 : 7}" class="empty">No problems match these filters.</td></tr>`;
      save();
    }
    tbody.addEventListener('click', e => {
      const st = e.target.closest('[data-star]');
      if (st) { const on = toggleBookmark(+st.dataset.star); st.classList.toggle('on', on); st.textContent = on ? '★' : '☆'; e.stopPropagation(); return; }
      const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = qhash(+tr.dataset.id);
    });
    document.getElementById('gotoF').addEventListener('submit', e => {
      e.preventDefault(); const m = /(\d+)/.exec(document.getElementById('gotoIn').value);
      const id = m ? (isLC ? 10000 + +m[1] : +m[1]) : NaN;
      if (QBYID[id] && setOf(QBYID[id]) === set) location.hash = qhash(id);
      else toast(isLC ? 'No LeetCode problem with that number in this set (LC175–LC1336)' : 'No question with that number (Q001–' + qcode(QS[QS.length - 1].id) + ')');
    });
    document.getElementById('fq').addEventListener('input', debounce(e => { F.q = e.target.value; apply(); }, 150));
    document.querySelectorAll('input[name=fstatus]').forEach(r => r.addEventListener('change', e => { F.status = e.target.value; apply(); }));
    document.querySelectorAll('input[data-f]').forEach(cb => cb.addEventListener('change', e => {
      const k = e.target.dataset.f, v = e.target.value; F[k] = e.target.checked ? [...new Set([...F[k], v])] : F[k].filter(x => x !== v); apply();
    }));
    document.getElementById('topicChips').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const v = b.dataset.v;
      F.topic = F.topic.includes(v) ? F.topic.filter(x => x !== v) : [...F.topic, v]; b.classList.toggle('on'); apply();
    });
    if (!isLC) document.getElementById('fcomp').addEventListener('input', e => { const v = e.target.value.toLowerCase(); document.querySelectorAll('#companyList .opt').forEach(o => (o.style.display = o.dataset.name.includes(v) ? '' : 'none')); });
    const sortSel = document.getElementById('fsort'); sortSel.value = F.sort; sortSel.addEventListener('change', e => { F.sort = e.target.value; apply(); });
    document.getElementById('clearF').addEventListener('click', () => { Object.assign(F, { q: '', diff: [], tier: [], domain: [], topic: [], company: [], status: 'all' }); save(); viewProblems(set); });
    document.getElementById('randomBtn').addEventListener('click', () => {
      const pool = QS.filter(x => !isSolved(x.id)); const pick = (pool.length ? pool : QS)[Math.floor(Math.random() * (pool.length || QS.length))];
      location.hash = qhash(pick.id);
    });
    apply();
  }

  // ================= QUESTION WORKSPACE =================
  function starter(q, lang, tableNames) {
    const first = tableNames[0];
    if (lang === 'sql') return `-- ${qcode(q.id)}. ${q.title}\n-- Tables: ${tableNames.join(', ')}\n-- MySQL 8 syntax.  Run: Ctrl/Cmd+Enter   Check answer: Ctrl/Cmd+Shift+Enter\n\nSELECT *\nFROM ${first}\nLIMIT 10;\n`;
    return `# ${qcode(q.id)}. ${q.title}\n# DataFrames: ${tableNames.join(', ')}   (pd and np are already imported)\n# DATE/DATETIME columns are already parsed as datetime64.\n# Put your final answer in a DataFrame called \`result\`.\n\nresult = ${first}.head(10)\n`;
  }
  function viewQuestion(q) {
    const isLC = q.set === 'lc';
    const QS = listFor(setOf(q));
    setNav(isLC ? 'leetcode' : 'problems');
    const tableNames = q.tables ? Object.keys(q.tables) : [];
    let lang = LS.get('lang', 'sql');
    const idx = QS.findIndex(x => x.id === q.id);
    const prev = QS[idx - 1], next = QS[idx + 1];
    const bm = bookmarks();
    app.innerHTML = `<div class="ws" id="ws">
      <section class="pane">
        <div class="ws-head">
          <a class="btn small ghost" href="${isLC ? '#leetcode' : '#problems'}">← ${isLC ? 'LeetCode' : 'Problems'}</a>
          <span class="qcode" id="qCode" title="Click to copy this question ID">${qcode(q.id)}</span><h2>${esc(q.title)}</h2>
          <span class="star ${bm.has(q.id) ? 'on' : ''}" id="qStar" title="Bookmark">${bm.has(q.id) ? '★' : '☆'}</span>
          <div class="nav-q">${prev ? `<a class="btn small" href="${qhash(prev.id)}" title="Previous">‹</a>` : ''}${next ? `<a class="btn small" href="${qhash(next.id)}" title="Next">›</a>` : ''}</div>
        </div>
        <div class="tabs" id="ltabs"><button data-t="desc" class="on">Description</button><button data-t="schema">Schema &amp; data</button><button data-t="hint">Hint</button><button data-t="sol">Solution</button></div>
        <div class="tab-body" id="lbody"></div>
      </section>
      <div class="gutter" id="vg"></div>
      <section class="pane right" id="right">
        <div class="ed-bar">
          <div class="lang" id="langSw"><button data-l="sql">MySQL</button><button data-l="py">Python · pandas</button></div>
          <button class="btn primary" id="runBtn" title="Ctrl/Cmd + Enter">▶ Run</button>
          <button class="btn ok" id="chkBtn" title="Ctrl/Cmd + Shift + Enter">✓ Check answer</button>
          <button class="btn small ghost" id="resetBtn" title="Restore starter code">Reset</button>
          <span class="spacer"></span><span class="engine-status" id="engStatus"></span>
        </div>
        <div class="editor-wrap" id="edWrap"></div>
        <div class="hgutter" id="hg"></div>
        <div class="bottom">
          <div class="tabs" id="btabs"><button data-t="out" class="on">Result</button><button data-t="notes">📝 My notes</button></div>
          <div class="out" id="bbody"></div>
        </div>
      </section></div>`;

    // ---- left pane ----
    const lbody = document.getElementById('lbody');
    let revealed = false, solLang = lang;
    const tablesPromise = Engine.tablesFor(q);
    async function renderLeft(t) {
      document.querySelectorAll('#ltabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      if (t === 'desc') {
        const dsLine = q.dataset ? `<div class="ds-banner">Dataset: <b>${esc(META[q.dataset].title)}</b> — multi-table, open the <a href="#" data-goto="schema">Schema &amp; data</a> tab for columns and sample rows.</div>` : `<div class="ds-banner">Tables for this problem: ${tableNames.map(t => `<code>${t}</code>`).join(' ')} — see <a href="#" data-goto="schema">Schema &amp; data</a>.</div>`;
        lbody.innerHTML = `<div class="idnote">Question ID <b>${qcode(q.id)}</b> — quote this ID when you ask for help with this problem. <button class="btn small ghost" id="copyId2">Copy ID</button></div><div class="meta-row"><span class="pill ${q.difficulty}">${q.difficulty}</span>${isLC ? `<span class="chip">LeetCode #${q.lc}</span><a class="btn small" href="${lcUrl(q)}" target="_blank" rel="noopener">Open on LeetCode ↗</a>` : `<span class="tier">${TIERS[q.tier]}</span><span class="chip">${esc(domainOf(q))}</span>`}</div>
          <div class="prose">${q.prompt}</div>${dsLine}
          <div class="section-label">Patterns</div><div>${q.topics.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
          ${q.companies.length ? `<div class="section-label">Pattern reported in interviews at</div><div class="muted">${esc(q.companies.join(' · '))}</div>` : ''}
          ${isLC ? '<div class="faint" style="font-size:12px;margin-top:10px">Statement rewritten in short form; sample tables are original. LeetCode runs your query on more hidden test cases — this checker tests the sample shown here.</div>' : ''}
          <div class="section-label">Expected output</div>
          <div id="expBox"><button class="btn small" id="expBtn">Show first 5 rows of the expected output</button> <span class="faint">(columns + format, small spoiler)</span></div>`;
        document.getElementById('copyId2').addEventListener('click', copyId);
        lbody.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); renderLeft(a.dataset.goto); }));
        document.getElementById('expBtn').addEventListener('click', async () => {
          const box = document.getElementById('expBox'); box.innerHTML = '<span class="faint">Computing…</span>';
          try { const r = await Engine.expected(q); box.innerHTML = `<div class="info"><span>${r.rows.length} row(s) total · ${r.columns.length} column(s)</span><span>${q.ordered ? 'Row order is checked' : 'Row order is not checked'}</span></div>` + tableHTML({ columns: r.columns, rows: r.rows.slice(0, 5) }); } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
        });
      } else if (t === 'schema') {
        lbody.innerHTML = '<div class="faint">Loading dataset…</div>';
        const tables = await tablesPromise;
        const ds = q.dataset ? await Engine.loadDataset(q.dataset) : null;
        lbody.innerHTML = (ds ? `<div class="ds-banner"><b>${esc(ds.title)}</b><br>${esc(ds.description)}</div>` : '') +
          Object.entries(tables).map(([name, t]) => `<div class="schema-table"><header><b>${name}</b><span class="rc">${t.rows.length.toLocaleString()} rows</span><button class="btn small" data-prev="${name}">Preview rows</button><button class="btn small ghost" data-ins="${name}" title="Insert table name into editor">Insert</button></header>
            ${t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}
            <div class="cols">${t.columns.map((c, i) => `<span>${c}<i>${t.types[i]}</i></span>`).join('')}</div><div class="prev" id="prev_${name}"></div></div>`).join('') +
          `<div class="faint" style="font-size:12px">Indexes exist on every <code>*_id</code> column (besides the first column). Tip: explore with <code>SELECT … LIMIT 20</code> before writing the real query — exactly what you should do in a live interview.</div>`;
        lbody.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click', async () => {
          const name = b.dataset.prev, box = document.getElementById('prev_' + name);
          if (box.innerHTML) { box.innerHTML = ''; return; }
          const r = await Engine.runSQL(q, `SELECT * FROM ${name} LIMIT 15`);
          box.innerHTML = `<div style="padding:0 10px 10px">${tableHTML(r)}</div>`;
        }));
        lbody.querySelectorAll('[data-ins]').forEach(b => b.addEventListener('click', () => { cm.replaceSelection(b.dataset.ins); cm.focus(); }));
      } else if (t === 'hint') {
        lbody.innerHTML = `<div class="hint-box prose"><b>💡 Hint</b><p style="margin-top:6px">${esc(q.hint || 'Break it into CTEs: fix the grain, compute the metric, then filter/rank.')}</p></div>
          <div class="section-label">General approach for any SQL interview question</div>
          <ol class="prose muted"><li>Restate the output: one row per <i>what</i>? (the <b>grain</b>)</li><li>Which tables hold each column you need? Watch 1-to-many joins (fan-out).</li><li>Filter early; aggregate; then rank/window; then filter on window results in an outer query.</li><li>Edge cases: NULLs, ties, duplicates, missing days, divide-by-zero, integer division.</li><li>Say the complexity/index story out loud for senior roles.</li></ol>`;
      } else if (t === 'sol') {
        if (!revealed) {
          lbody.innerHTML = `<div class="lock"><div class="big">🔒</div><p>Try for at least 15–20 minutes first. Struggling productively is how the pattern sticks.</p><button class="btn primary" id="revealBtn">Reveal optimal solution (SQL + pandas)</button></div>`;
          document.getElementById('revealBtn').addEventListener('click', () => { revealed = true; renderLeft('sol'); });
          return;
        }
        const isSql = solLang === 'sql';
        const code = isSql ? q.sql : q.py;
        lbody.innerHTML = `<div class="sol-switch"><button data-s="sql" class="${isSql ? 'on' : ''}">MySQL solution</button><button data-s="py" class="${!isSql ? 'on' : ''}">pandas solution</button></div>
          <div class="code-block cm-s-lab">${highlight(code, isSql ? 'text/x-mysql' : 'python')}</div>
          <div class="code-actions"><button class="btn small" id="copySol">Copy</button><button class="btn small" id="loadSol">Load into editor</button></div>
          <div class="section-label">Explanation</div><div class="prose">${isSql ? q.sql_explain : q.py_explain}</div>`;
        lbody.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { solLang = b.dataset.s; renderLeft('sol'); }));
        document.getElementById('copySol').addEventListener('click', () => copyText(code, 'Solution'));
        document.getElementById('loadSol').addEventListener('click', () => {
          if (solLang !== lang) switchLang(solLang);
          const go = () => { cm.setValue(code); toast('Solution loaded into the editor'); };
          if (!cm.getValue().trim()) return go();
          ask('Replace the code in the editor with the solution?', 'Replace').then(ok => ok && go());
        });
      }
    }
    function copyId() { copyText(`${qcode(q.id)} — ${q.title}`, 'Question ID'); }
    document.getElementById('qCode').addEventListener('click', copyId);
    document.getElementById('ltabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) renderLeft(b.dataset.t); });
    document.getElementById('qStar').addEventListener('click', e => { const on = toggleBookmark(q.id); e.target.classList.toggle('on', on); e.target.textContent = on ? '★' : '☆'; });
    renderLeft('desc');

    // ---- editor ----
    const codeKey = l => `code.${q.id}.${l}`;
    const run = () => execute(false), check = () => execute(true);
    const cm = makeEditor(document.getElementById('edWrap'), lang, '', { 'Ctrl-Enter': run, 'Cmd-Enter': run, 'Shift-Ctrl-Enter': check, 'Shift-Cmd-Enter': check });
    attachAutoHint(cm);
    const saveCode = debounce(() => LS.set(codeKey(lang), cm.getValue()), 400);
    cm.on('change', saveCode);
    tablesPromise.then(tables => {
      const names = Object.keys(tables);
      if (!tableNames.length) tableNames.push(...names);
      cm.setOption('hintOptions', { tables: Object.fromEntries(names.map(n => [n, tables[n].columns])) });
      if (!cm.getValue()) cm.setValue(LS.get(codeKey(lang), null) || starter(q, lang, names));
    });
    function switchLang(l) {
      LS.set(codeKey(lang), cm.getValue());
      lang = l; LS.set('lang', l);
      document.querySelectorAll('#langSw button').forEach(b => b.classList.toggle('on', b.dataset.l === l));
      cm.setOption('mode', l === 'sql' ? 'text/x-mysql' : 'python');
      tablesPromise.then(t => cm.setValue(LS.get(codeKey(l), null) || starter(q, l, Object.keys(t))));
      updateStatus();
      if (l === 'py' && !Engine.isPyReady()) Engine.initPy(s => setStatus(s)).then(updateStatus).catch(e => setStatus('⚠️ Python failed to load: ' + e.message));
    }
    document.querySelectorAll('#langSw button').forEach(b => { b.classList.toggle('on', b.dataset.l === lang); b.addEventListener('click', () => switchLang(b.dataset.l)); });
    document.getElementById('runBtn').addEventListener('click', run);
    document.getElementById('chkBtn').addEventListener('click', check);
    document.getElementById('resetBtn').addEventListener('click', async () => { if (!(await ask('Reset the editor to the starter code? Your saved code for this language will be replaced.', 'Reset'))) return; cm.setValue(starter(q, lang, Object.keys(await tablesPromise))); });
    const statusEl = document.getElementById('engStatus');
    const setStatus = s => (statusEl.textContent = s);
    function updateStatus() { setStatus(lang === 'sql' ? 'MySQL 8 dialect · in-browser engine' : (Engine.isPyReady() ? 'Python 3 · pandas ready' : 'Python loads on first run (~15 MB, cached afterwards)')); }
    updateStatus();
    if (lang === 'py') Engine.initPy(s => setStatus(s)).then(updateStatus).catch(e => setStatus('⚠️ Python failed to load: ' + e.message));

    // ---- bottom pane ----
    const bbody = document.getElementById('bbody');
    let lastOut = `<div class="placeholder"><b>Run</b> executes your query and shows the result. <b>Check answer</b> compares it with the expected output (values, row count${q.ordered ? ', and row order' : ''}; column names don't matter, numbers are compared to 2 decimals).</div>`;
    let bTab = 'out';
    function renderBottom(t) {
      bTab = t;
      document.querySelectorAll('#btabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      if (t === 'out') { bbody.innerHTML = lastOut; return; }
      const n = notes()[q.id] || { text: '', important: false };
      bbody.innerHTML = `<div class="notes-panel"><div class="row"><b>Notes for ${qcode(q.id)}</b><span class="faint">— saved in this browser, all notes appear on the <a href="#notes">My Notes</a> page</span><span class="saved" id="savedLbl">${n.updated ? 'saved' : ''}</span></div>
        <textarea id="noteTa" placeholder="Key insight, the pattern, mistakes you made, edge cases… Use \`\`\` fences for code.">${esc(n.text)}</textarea>
        <div class="row"><button class="btn small" id="impBtn">${n.important ? '⭐ Marked important' : '☆ Mark important'}</button><button class="btn small" id="insCode">Insert my current code</button><button class="btn small" id="insSol">Insert the pattern hint</button></div></div>`;
      const ta = document.getElementById('noteTa'), lbl = document.getElementById('savedLbl');
      const persist = debounce(() => { saveNote(q.id, { text: ta.value }); lbl.textContent = 'saved ✓'; }, 400);
      ta.addEventListener('input', () => { lbl.textContent = 'saving…'; persist(); });
      document.getElementById('impBtn').addEventListener('click', e => { const cur = (notes()[q.id] || {}).important; saveNote(q.id, { text: ta.value, important: !cur }); e.target.textContent = !cur ? '⭐ Marked important' : '☆ Mark important'; });
      const insert = txt => { ta.value = (ta.value ? ta.value.replace(/\s*$/, '') + '\n\n' : '') + txt; ta.dispatchEvent(new Event('input')); ta.focus(); ta.scrollTop = ta.scrollHeight; };
      document.getElementById('insCode').addEventListener('click', () => insert('```' + (lang === 'sql' ? 'sql' : 'python') + '\n' + cm.getValue().trim() + '\n```'));
      document.getElementById('insSol').addEventListener('click', () => insert('Pattern: ' + q.topics.join(', ') + '\nHint: ' + (q.hint || '')));
    }
    document.getElementById('btabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) renderBottom(b.dataset.t); });
    renderBottom('out');

    async function execute(doCheck) {
      const code = cm.getValue();
      LS.set(codeKey(lang), code);
      const show = html => { lastOut = html; if (bTab !== 'out') renderBottom('out'); else bbody.innerHTML = html; };
      show('<div class="placeholder">Running…</div>');
      let res;
      try {
        if (lang === 'sql') {
          const r = await Engine.runSQL(q, code);
          res = { columns: r.columns, rows: r.rows, ms: r.ms, extra: r.statements > 1 ? `${r.statements} statements · showing the last result set` : '' };
        } else {
          setStatus(Engine.isPyReady() ? 'Running…' : 'Loading Python…');
          const r = await Engine.runPy(q, code, s => setStatus(s));
          updateStatus();
          if (r.error) { show((r.stdout ? `<div class="stdout">${esc(r.stdout)}</div>` : '') + `<div class="err">${esc(r.error)}</div>`); setProgress(q.id, lang, 'attempted'); return; }
          res = { columns: r.columns, rows: r.rows, ms: r.ms, stdout: r.stdout, extra: `DataFrame shape ${r.shape[0]} × ${r.shape[1]}` };
        }
      } catch (e) {
        let msg = String(e.message || e);
        if (lang === 'py') { updateStatus(); msg = msg.replace(/^[\s\S]*?(File "<exec>"[\s\S]*)$/, '$1').replace(/^[\s\S]*?(Traceback)/, '$1'); }
        show(`<div class="err">${esc(msg)}</div>${lang === 'sql' ? '<div class="faint" style="margin-top:8px;font-size:12px">Engine note: queries run on SQLite with a MySQL compatibility layer. Almost all MySQL 8 analytics syntax works (window functions, CTEs, DATE_FORMAT, DATEDIFF, TIMESTAMPDIFF, INTERVAL, IF, GROUP_CONCAT…). If valid MySQL fails here, see <a href="#guide-engine">engine notes</a>.</div>' : ''}`);
        setProgress(q.id, lang, 'attempted');
        return;
      }
      setProgress(q.id, lang, 'attempted');
      let html = res.stdout ? `<div class="stdout">${esc(res.stdout)}</div>` : '';
      let verdict = '';
      if (doCheck) {
        const exp = await Engine.expected(q);
        const c = Engine.compare(exp, res, !!q.ordered);
        if (c.ok) {
          setProgress(q.id, lang, 'solved');
          verdict = `<div class="verdict ok">✅ Accepted <span class="sub">— ${res.rows.length} row(s) match the expected output. Now open the Solution tab and compare approaches.</span></div>`;
          html = verdict + html + `<div class="info"><span>${res.rows.length} row(s)</span><span>${res.ms.toFixed(1)} ms</span>${res.extra ? `<span>${res.extra}</span>` : ''}</div>` + tableHTML(res);
        } else {
          verdict = `<div class="verdict bad">❌ Wrong answer <span class="sub">— ${esc(c.reason)}</span></div>`;
          const lim = 15;
          const dr = c.row !== undefined && c.row < lim ? c.row : -1;
          html = verdict + html + `<div class="cmp-grid"><div><h5>Your output (${res.rows.length} rows)</h5>${tableHTML({ columns: res.columns, rows: res.rows.slice(0, lim) }, lim, q.ordered ? dr : -1)}</div><div><h5>Expected (${exp.rows.length} rows)</h5>${tableHTML({ columns: exp.columns, rows: exp.rows.slice(0, lim) }, lim, q.ordered ? dr : -1)}</div></div>` +
            (!q.ordered ? '<div class="faint" style="margin-top:6px;font-size:12px">Row order is not checked for this problem; the first difference was found after sorting both results.</div>' : '');
        }
      } else {
        html += `<div class="info"><span>${res.rows.length} row(s)</span><span>${res.ms.toFixed(1)} ms</span>${res.extra ? `<span>${res.extra}</span>` : ''}</div>` + tableHTML(res);
      }
      show(html);
    }

    // ---- resizers ----
    const ws = document.getElementById('ws'), right = document.getElementById('right');
    ws.style.setProperty('--left', LS.get('split.v', '44%'));
    right.style.setProperty('--edH', LS.get('split.h', '52%'));
    function dragger(el, onMove, onEnd) {
      el.addEventListener('mousedown', e => {
        e.preventDefault(); el.classList.add('drag');
        const mv = ev => onMove(ev), up = () => { el.classList.remove('drag'); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); onEnd(); cm.refresh(); };
        window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
      });
    }
    dragger(document.getElementById('vg'), ev => { const r = ws.getBoundingClientRect(); const p = Math.min(75, Math.max(22, 100 * (ev.clientX - r.left) / r.width)); ws.style.setProperty('--left', p + '%'); }, () => LS.set('split.v', ws.style.getPropertyValue('--left')));
    dragger(document.getElementById('hg'), ev => { const r = right.getBoundingClientRect(); const top = right.querySelector('.ed-bar').offsetHeight; const p = Math.min(85, Math.max(15, 100 * (ev.clientY - r.top - top) / (r.height - top))); right.style.setProperty('--edH', p + '%'); cm.refresh(); }, () => LS.set('split.h', right.style.getPropertyValue('--edH')));
    setTimeout(() => cm.refresh(), 30);
    cleanup = () => LS.set(codeKey(lang), cm.getValue());
  }

  // ================= NOTES =================
  function renderNoteBody(text) {
    const parts = String(text).split(/```(\w*)\n?([\s\S]*?)```/g);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) out += esc(parts[i]);
      else if (i % 3 === 2) out += `<pre class="cm-s-lab">${highlight(parts[i].replace(/\n$/, ''), /py/.test(parts[i - 1]) ? 'python' : 'text/x-mysql')}</pre>`;
    }
    return out;
  }
  function viewNotes() {
    setNav('notes');
    app.innerHTML = `<div class="page"><div class="notes-head"><h1>📝 My notes</h1>
      <input type="search" id="nq" placeholder="search notes…"><label class="opt"><input type="checkbox" id="nImp"> ⭐ Important only</label>
      <button class="btn small" id="dlMd">Download Markdown</button><button class="btn small" id="cpMd">Copy Markdown</button><button class="btn small" id="exp">Export backup (JSON)</button><button class="btn small" id="cpBk">Copy backup</button><label class="btn small" style="cursor:pointer">Import backup<input type="file" id="imp" accept="application/json" hidden></label></div>
      <div class="general-note"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b>Global scratchpad</b><span class="faint">— patterns, formulas, things to revise before the interview</span><span class="saved" id="gLbl"></span></div>
      <textarea id="gNote" placeholder="e.g. Islands trick: date - ROW_NUMBER() days … LEFT JOIN filter goes in ON, not WHERE …">${esc(LS.get('notes.general', ''))}</textarea></div>
      <div id="cards" class="note-cards"></div>
      <p class="faint" style="margin-top:20px;font-size:12px">Notes, progress and code live in this browser's local storage (nothing is uploaded). Use <b>Export backup</b> to move them to another device or before clearing browser data.</p></div>`;
    const g = document.getElementById('gNote'), gl = document.getElementById('gLbl');
    g.addEventListener('input', debounce(() => { LS.set('notes.general', g.value); gl.textContent = 'saved ✓'; }, 400));
    const cards = document.getElementById('cards');
    function draw() {
      const q = document.getElementById('nq').value.toLowerCase(), imp = document.getElementById('nImp').checked;
      const n = notes();
      const list = Object.entries(n).filter(([id, v]) => QBYID[id] && (!imp || v.important) && (!q || (v.text + ' ' + QBYID[id].title + ' ' + qcode(id)).toLowerCase().includes(q)))
        .sort((a, b) => (b[1].important - a[1].important) || (b[1].updated - a[1].updated));
      cards.innerHTML = list.length ? list.map(([id, v]) => { const x = QBYID[id]; return `<article class="note-card ${v.important ? 'important' : ''}"><header>${v.important ? '⭐' : ''}<a href="${qhash(id)}"><span class="qcode sm">${qcode(id)}</span> ${esc(x.title)}</a><span class="pill ${x.difficulty}">${x.difficulty}</span></header>
        <div>${x.topics.slice(0, 4).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        <div class="body">${renderNoteBody(v.text) || '<span class="faint">(no text)</span>'}</div>
        <footer>Updated ${new Date(v.updated).toLocaleString()}<button class="btn small ghost" data-del="${id}">Delete</button></footer></article>`; }).join('')
        : `<div class="empty" style="grid-column:1/-1">No question notes yet. Open any problem → <b>📝 My notes</b> tab (below the editor) and start writing — it autosaves here.</div>`;
    }
    cards.addEventListener('click', async e => { const d = e.target.closest('[data-del]'); if (d && await ask('Delete this note?', 'Delete')) { const n = notes(); delete n[d.dataset.del]; LS.set('notes', n); draw(); } });
    document.getElementById('nq').addEventListener('input', debounce(draw, 150));
    document.getElementById('nImp').addEventListener('change', draw);
    const backup = () => { const data = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P)) data[k] = localStorage.getItem(k); } return JSON.stringify(data, null, 1); };
    document.getElementById('exp').addEventListener('click', () => download('sql-interview-lab-backup.json', backup(), 'application/json'));
    document.getElementById('cpBk').addEventListener('click', () => copyText(backup(), 'Backup JSON'));
    document.getElementById('imp').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { const d = JSON.parse(t); Object.entries(d).forEach(([k, v]) => k.startsWith(P) && localStorage.setItem(k, v)); toast('Backup imported'); viewNotes(); renderTopProgress(); }).catch(() => toast('Invalid backup file'));
    });
    const toMd = () => {
      const n = notes();
      let md = `# SQL Interview Lab — my notes\n\n## Scratchpad\n\n${LS.get('notes.general', '')}\n\n`;
      Object.entries(n).sort((a, b) => a[0] - b[0]).forEach(([id, v]) => { const x = QBYID[id]; if (x) md += `## ${v.important ? '⭐ ' : ''}${qcode(id)}. ${x.title} (${x.difficulty})\n_Patterns: ${x.topics.join(', ')}_\n\n${v.text}\n\n`; });
      return md;
    };
    document.getElementById('dlMd').addEventListener('click', () => download('sql-notes.md', toMd(), 'text/markdown'));
    document.getElementById('cpMd').addEventListener('click', () => copyText(toMd(), 'Markdown'));
    draw();
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

  // ================= DATASETS =================
  function viewDatasets() {
    setNav('datasets');
    const DESC = {
      retail: 'customers · products · orders · order_items · returns — ~4.5K orders, ~8.4K lines, 2023–2024.',
      payments: 'merchants · payments · refunds · settlements — ~8.8K payment attempts (with retries, outages, fraud).',
      lending: 'borrowers · loans · emi_schedule · repayments — EMIs, late & partial payments, defaulters.',
      delivery: 'users · restaurants · delivery_partners · food_orders — ~5.7K orders across 5 cities.',
      events: 'app_users · events — ~22.5K raw clickstream events, no session ids.',
      subscriptions: 'plans · subscriptions — plan changes, cancellations, re-activations.',
      hr: 'departments · employees · salary_history — hierarchy, ties, empty department.',
      rides: 'riders · drivers · trips — banned users, surge, cancellations.'
    };
    app.innerHTML = `<div class="page"><h1 style="font-size:22px;margin-bottom:6px">🗄️ Datasets</h1><p class="muted" style="margin:0 0 18px">Open any dataset in a free-form playground to practise reading unfamiliar multi-table schemas — the skill that matters most when an interviewer drops 4–5 big tables on you.</p>
      <div class="ds-grid">${Object.entries(META).map(([k, m]) => `<div class="ds-card" data-k="${k}"><h3>${esc(m.title)}</h3><span class="chip">${esc(m.domain)}</span> <span class="chip">${QS.filter(q => q.dataset === k).length} problems</span><p>${esc(DESC[k])}</p><span class="btn small">Open playground →</span></div>`).join('')}</div></div>`;
    app.querySelectorAll('.ds-card').forEach(c => c.addEventListener('click', () => (location.hash = '#data-' + c.dataset.k)));
  }
  function viewPlayground(key) {
    setNav('datasets');
    const pq = { id: 'pg_' + key, dataset: key };
    let lang = 'sql';
    app.innerHTML = `<div class="page"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><a class="btn small ghost" href="#datasets">← Datasets</a><h1 style="font-size:20px">${esc(META[key].title)} — playground</h1></div>
      <div class="playground"><aside class="side" id="pgSide"><div class="faint">Loading…</div></aside>
      <section class="main"><div class="ed-bar"><div class="lang" id="pgLang"><button data-l="sql" class="on">MySQL</button><button data-l="py">Python · pandas</button></div><button class="btn primary" id="pgRun">▶ Run</button><span class="spacer"></span><span class="engine-status" id="pgStatus"></span></div>
      <div class="pg-editor" id="pgEd"></div><div class="out" id="pgOut"><div class="placeholder">Write any query against these tables and press Run (Ctrl/Cmd+Enter).</div></div></section></div></div>`;
    const run = async () => {
      const out = document.getElementById('pgOut'); out.innerHTML = '<div class="placeholder">Running…</div>';
      try {
        let r;
        if (lang === 'sql') r = await Engine.runSQL(pq, cm.getValue());
        else { r = await Engine.runPy(pq, cm.getValue(), s => (document.getElementById('pgStatus').textContent = s)); document.getElementById('pgStatus').textContent = 'pandas ready'; if (r.error) { out.innerHTML = (r.stdout ? `<div class="stdout">${esc(r.stdout)}</div>` : '') + `<div class="err">${esc(r.error)}</div>`; return; } }
        out.innerHTML = (r.stdout ? `<div class="stdout">${esc(r.stdout)}</div>` : '') + `<div class="info"><span>${r.rows.length} row(s)</span><span>${r.ms.toFixed(1)} ms</span></div>` + tableHTML(r);
      } catch (e) { out.innerHTML = `<div class="err">${esc(e.message || e)}</div>`; }
    };
    const cm = makeEditor(document.getElementById('pgEd'), 'sql', '', { 'Ctrl-Enter': run, 'Cmd-Enter': run });
    attachAutoHint(cm);
    document.getElementById('pgRun').addEventListener('click', run);
    Engine.loadDataset(key).then(ds => {
      const names = Object.keys(ds.tables);
      cm.setOption('hintOptions', { tables: Object.fromEntries(names.map(n => [n, ds.tables[n].columns])) });
      const sqlStart = `-- ${ds.title}\nSELECT *\nFROM ${names[0]}\nLIMIT 20;`, pyStart = `# DataFrames: ${names.join(', ')}\nresult = ${names[0]}.describe(include='all').T.reset_index()`;
      cm.setValue(sqlStart);
      document.querySelectorAll('#pgLang button').forEach(b => b.addEventListener('click', () => {
        lang = b.dataset.l; document.querySelectorAll('#pgLang button').forEach(x => x.classList.toggle('on', x === b));
        cm.setOption('mode', lang === 'sql' ? 'text/x-mysql' : 'python'); cm.setValue(lang === 'sql' ? sqlStart : pyStart);
        if (lang === 'py') Engine.initPy(s => (document.getElementById('pgStatus').textContent = s)).then(() => (document.getElementById('pgStatus').textContent = 'pandas ready')).catch(e => (document.getElementById('pgStatus').textContent = '⚠️ ' + e.message));
      }));
      document.getElementById('pgSide').innerHTML = `<div class="ds-banner" style="margin-top:0">${esc(ds.description)}</div>` + Object.entries(ds.tables).map(([n, t]) => `<div class="schema-table"><header><b>${n}</b><span class="rc">${t.rows.length.toLocaleString()} rows</span><button class="btn small" data-q="${n}">Query</button></header>${t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}<div class="cols">${t.columns.map((c, i) => `<span>${c}<i>${t.types[i]}</i></span>`).join('')}</div></div>`).join('') +
        `<div class="section-label">Problems on this dataset</div>` + QS.filter(q => q.dataset === key).map(q => `<div style="margin:4px 0"><a href="#q-${q.id}">${qcode(q.id)} · ${esc(q.title)}</a> <span class="pill ${q.difficulty}">${q.difficulty}</span></div>`).join('');
      document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { cm.setValue(lang === 'sql' ? `SELECT *\nFROM ${b.dataset.q}\nLIMIT 20;` : `result = ${b.dataset.q}.head(20)`); run(); }));
      setTimeout(() => cm.refresh(), 20);
    });
  }

  // ================= GUIDE =================
  function viewGuide(anchor) {
    setNav('guide');
    const link = id => `<a href="#q-${id}">${qcode(id)}</a>`;
    const byTopic = t => QS.filter(q => q.topics.includes(t)).map(q => link(q.id)).join(' ');
    const PAT = [
      ['Top-N per group / argmax', '"top 3 in each", "highest … per …", "latest record"', 'ROW_NUMBER / DENSE_RANK in a CTE, filter in outer query', 'Top-N per group'],
      ['Running totals & moving averages', '"cumulative", "month-to-date", "rolling 7-day"', 'SUM/AVG OVER (ORDER BY … ROWS BETWEEN …); date spine for gaps', 'Running total'],
      ['Period-over-period', '"MoM", "growth vs previous", "YoY"', 'LAG over aggregated series; compute before filtering', 'LAG/LEAD'],
      ['Gaps & islands / streaks', '"consecutive", "streak", "in a row", "periods"', 'date − ROW_NUMBER() anchor, or change-flag + running SUM', 'Gaps & islands'],
      ['Sessionization', '"session", "30 minutes of inactivity"', 'LAG gap > threshold → flag → SUM OVER = session id', 'Sessionization'],
      ['Cohorts & retention', '"retention", "cohort", "D1/D7", "churn"', 'first-activity date per user + month/day offset + COUNT DISTINCT CASE', 'Retention'],
      ['Funnels', '"conversion", "drop-off", "after viewing"', 'MAX(CASE) flags per user; ordered funnel = chained MIN(time) CTEs', 'Funnel'],
      ['Anti-join / "never"', '"never ordered", "no sales", "silent"', 'NOT EXISTS (NULL-safe) or LEFT JOIN … IS NULL; filters go in ON', 'Anti join'],
      ['Relational division / "all"', '"in every month", "bought all"', 'HAVING COUNT(DISTINCT x) = required count', 'Relational division'],
      ['Pivot / unpivot', '"one column per…", "wide to long"', 'SUM/COUNT(CASE WHEN) to pivot; UNION ALL to unpivot', 'Pivot'],
      ['Date spine / interval expansion', '"every day even with no data", "occupancy", "MRR"', 'WITH RECURSIVE calendar + LEFT JOIN range condition', 'Date spine'],
      ['Hierarchies', '"all reports under", "org chart", "chain"', 'WITH RECURSIVE anchor + UNION ALL join to CTE', 'Recursive CTE'],
      ['Fan-out & reconciliation', 'two fact tables, "net of refunds", "settled vs expected"', 'aggregate each fact table to the key BEFORE joining; LEFT JOIN + classify', 'Join fan-out'],
      ['Data cleaning', 'messy strings, mixed date formats, duplicates', 'TRIM/UPPER/REPLACE, STR_TO_DATE, CAST, ROW_NUMBER dedup', 'Data cleaning']
    ];
    app.innerHTML = `<div class="page guide">
      <h1>📘 Prep guide</h1><p class="muted">How this lab was built, what interviewers actually test for 2–3 year DA / BA / DS roles, and how to use it to get ready for anything from a ₹15 LPA analyst round to a ₹70 LPA data-scientist loop.</p>

      <h2>What the research says interviewers test</h2>
      <ul>
        <li><b>Product companies skip theory and hand you 2–5 tables</b> with a business question; service companies mix theory (DDL vs DML, keys, normalisation) with simple queries. The second-highest-salary question is still the most-asked single SQL question in India — know 2+ ways (${link(3)}).</li>
        <li><b>Razorpay</b> (DA / BA): medium SQL on joins and window functions, cumulative sums, self joins, SQL order of execution, monthly sales aggregation by category, and "how would you detect a sudden drop in transaction success rate?" — plus moving from SQL output to a business implication. See ${link(1)} ${link(14)} ${link(52)} ${link(53)} ${link(56)}.</li>
        <li><b>Flipkart / Meesho / Amazon</b> (DA / BA): self joins, LAG/LEAD, 3rd-highest salary, moving averages, joins + window functions in a 60-minute round of ~3 queries, root-cause analysis cases. See ${link(4)} ${link(5)} ${link(13)} ${link(15)}.</li>
        <li><b>Uber / Amazon / Meta</b> (DS): a live round with a case and ~4 tables; cohort retention, fraud detection and metric investigation that need several CTEs, self joins and window chains; pandas often asked in the same round. See ${link(31)} ${link(32)} ${link(39)} ${link(40)} ${link(54)} ${link(59)} ${link(76)}.</li>
        <li><b>Lending fintechs</b> (Navi-type roles): SQL is the strongest signal; lending analytics revolves around DPD buckets, roll rates, PAR, vintage / cohort analysis and collection efficiency. See ${link(27)} ${link(62)}–${link(68)}.</li>
        <li><b>Swiggy / Zomato</b>: SQL + visualisation round, then a stats/Python case — delivery SLAs, cohorts, discount dependency. See ${link(69)}–${link(75)}.</li>
        <li>Patterns from <b>LeetCode SQL 50 / Top SQL</b> and <b>Namaste SQL</b> (new vs repeat customers, points table, trips &amp; users cancellation rate, consecutive numbers, stadium, median, tournament winners) are re-implemented with original data in ${link(24)} ${link(26)} ${link(30)} ${link(76)} ${link(80)}–${link(90)}.</li>
      </ul>
      <div class="callout">"Seen at" tags mean the <i>pattern</i> has been reported in interviews at that company (from public interview reports and guides) — they are not leaked questions. Use them to prioritise, not as a guarantee.</div>

      <h2>Interview levels used here</h2>
      <table><tr><th>Level</th><th>Typical roles</th><th>What you must do comfortably</th></tr>
        <tr><td><span class="tier">L1</span> ₹10–25 LPA</td><td>Data Analyst, Business Analyst (0–3 yrs), service-company analytics</td><td>Joins (incl. anti-join), GROUP BY/HAVING, CASE, basic windows (ROW_NUMBER, LAG, running sum), NULL handling</td></tr>
        <tr><td><span class="tier">L2</span> ₹25–45 LPA</td><td>Senior DA/BA, Product Analyst, DS-I at product companies / fintech</td><td>Multi-CTE business questions, gaps &amp; islands, funnels, pivots, fan-out awareness, frames, data cleaning, explaining trade-offs</td></tr>
        <tr><td><span class="tier">L3</span> ₹45–80 LPA</td><td>DS-II, Senior Product Analyst, Analytics lead at top product/fintech</td><td>Cohorts/retention, sessionization, ordered funnels, recursive CTEs &amp; date spines, risk metrics (DPD, PAR, vintage), reconciliation, anomaly detection — fast and correct under pressure, in SQL <i>and</i> pandas</td></tr></table>
      <p class="faint">Salary bands are rough Indian-market guides for 2–3+ years of experience; real ranges vary widely by company and city.</p>

      <h2>Pattern cheat-sheet</h2>
      <table><tr><th>Pattern</th><th>Trigger words</th><th>Technique</th><th>Practice</th></tr>
        ${PAT.map(p => `<tr><td><b>${p[0]}</b></td><td class="muted">${p[1]}</td><td>${p[2]}</td><td>${byTopic(p[3]) || ''}</td></tr>`).join('')}</table>

      <h2>A 3-week plan</h2>
      <ol><li><b>Week 1 — L1 core:</b> filter Level = L1. Solve every problem in MySQL, then redo 1 in 3 in pandas. Write one note per problem: the pattern + the trap.</li>
        <li><b>Week 2 — L2 business cases:</b> filter E-commerce, Payments, Delivery. Before writing SQL, write the grain and the CTE plan as comments. Time-box 25 minutes.</li>
        <li><b>Week 3 — L3 + mocks:</b> Lending, Product analytics, Subscriptions, Hard puzzles. Use "Random unsolved" as a mock: 2 problems in 45 minutes, talking out loud. Revise from <a href="#notes">My Notes</a> the day before.</li></ol>

      <h2>How to attack a big multi-table question (when it feels overwhelming)</h2>
      <ol><li><b>Read the schema first</b> (Schema &amp; data tab): what is one row of each table? Which keys join them? Which joins are 1-to-many?</li>
        <li><b>Write the output grain</b> as a comment: "one row per merchant per day".</li>
        <li><b>Plan CTEs</b> in plain words: base filter → per-entity aggregate → metric → rank/compare → final select.</li>
        <li><b>Build and run each CTE</b> with <code>SELECT * FROM cte LIMIT 10</code> before stacking the next. That's why this lab lets you run anything instantly.</li>
        <li><b>Sanity-check numbers</b>: row counts before/after joins, totals that should reconcile, a percentage that must be ≤ 100.</li></ol>

      <h2 id="engine">Engine notes (MySQL in the browser)</h2>
      <p>The SQL editor runs on SQLite (WebAssembly) with a <b>MySQL compatibility layer</b>, so you write normal MySQL 8 and everything runs offline in your browser. Supported out of the box: window functions (incl. frames and named <code>WINDOW</code>), CTEs and <code>WITH RECURSIVE</code>, <code>DATE_FORMAT</code>, <code>DATEDIFF</code>, <code>TIMESTAMPDIFF</code>, <code>DATE_ADD/DATE_SUB</code> and <code>± INTERVAL n UNIT</code>, <code>YEAR/MONTH/DAY/HOUR/QUARTER/WEEKDAY/DAYOFWEEK/WEEK/YEARWEEK/LAST_DAY</code>, <code>STR_TO_DATE</code>, <code>EXTRACT</code>, <code>IF</code>, <code>IFNULL</code>, <code>GREATEST/LEAST</code>, <code>LEFT/RIGHT</code>, <code>SUBSTRING_INDEX</code>, <code>LOCATE</code>, <code>LPAD/RPAD</code>, <code>CONCAT/CONCAT_WS</code>, <code>GROUP_CONCAT(… ORDER BY … SEPARATOR …)</code>, <code>FLOOR/CEIL/MOD/POWER/SQRT/LN/TRUNCATE</code>, <code>STDDEV/VARIANCE</code>, <code>REGEXP</code>, <code>RANGE BETWEEN INTERVAL n DAY PRECEDING</code>, <code>CAST(x AS DATE/SIGNED/DECIMAL)</code>, and MySQL-style decimal division (<code>5/2 = 2.5</code>).</p>
      <p>Known differences: string <code>=</code> comparison is case-sensitive here (MySQL's default collation is case-insensitive); <code>ONLY_FULL_GROUP_BY</code> isn't enforced (MySQL 8 would reject non-aggregated columns missing from GROUP BY, so keep the habit of grouping by them); no stored procedures / <code>PREPARE</code>. Dates are stored as ISO text (<code>'2024-12-31'</code>, <code>'2024-12-31 18:20:00'</code>), so comparing with string literals works exactly as in MySQL.</p>
      <p>Python runs real CPython + pandas via Pyodide (WebAssembly), downloaded once from the jsDelivr CDN and cached by the browser. Assign your answer to <code>result</code>; prints are shown above the result.</p>
      <p><b>Answer checking:</b> your output is compared with the official solution's output by values (column names are ignored), numbers to 2 decimals, dates as <code>YYYY-MM-DD</code>; row order is checked only when the problem specifies a sort order.</p>
    </div>`;
    if (anchor) { const el = document.getElementById(anchor); if (el) el.scrollIntoView(); }
  }

  renderTopProgress();
  route();
})();
