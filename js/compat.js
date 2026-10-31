/* MySQL compatibility layer for sql.js (SQLite in the browser).
 * 1) rewriteMySQL(sql): rewrites MySQL-only syntax into SQLite syntax (outside string literals).
 * 2) registerMySQLFunctions(db): adds MySQL functions (DATE_FORMAT, DATEDIFF, TIMESTAMPDIFF, DATE_ADD, ...).
 * Works in the browser (window.MySQLCompat) and in Node (module.exports).
 */
(function (root) {
  'use strict';
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function parseD(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') { // julian day or yyyymmdd
      if (v > 10000000 && v < 99991231) { const s = String(Math.floor(v)); return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))); }
      if (v > 1000000) return new Date((v - 2440587.5) * 86400000);
      return null;
    }
    const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?)?/.exec(String(v));
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
  }
  const hasTime = v => typeof v === 'string' && /\d{1,2}:\d{2}/.test(v);
  const fDate = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const fDT = d => `${fDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const dayNum = d => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);

  function addInterval(v, n, unit) {
    const d = parseD(v); if (!d || n === null || n === undefined) return null;
    n = Number(n); unit = String(unit).toUpperCase();
    const out = new Date(d.getTime());
    const addMonths = k => {
      const day = out.getUTCDate();
      out.setUTCDate(1); out.setUTCMonth(out.getUTCMonth() + k);
      const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
      out.setUTCDate(Math.min(day, last));
    };
    switch (unit) {
      case 'SECOND': out.setTime(out.getTime() + n * 1000); break;
      case 'MINUTE': out.setTime(out.getTime() + n * 60000); break;
      case 'HOUR': out.setTime(out.getTime() + n * 3600000); break;
      case 'DAY': out.setTime(out.getTime() + n * 86400000); break;
      case 'WEEK': out.setTime(out.getTime() + n * 7 * 86400000); break;
      case 'MONTH': addMonths(n); break;
      case 'QUARTER': addMonths(3 * n); break;
      case 'YEAR': addMonths(12 * n); break;
      default: return null;
    }
    return (hasTime(v) || ['SECOND', 'MINUTE', 'HOUR'].includes(unit)) ? fDT(out) : fDate(out);
  }
  function monthDiff(a, b) { // MySQL TIMESTAMPDIFF(MONTH,a,b)
    let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    const ra = a.getUTCDate() * 86400 + a.getUTCHours() * 3600 + a.getUTCMinutes() * 60 + a.getUTCSeconds();
    const rb = b.getUTCDate() * 86400 + b.getUTCHours() * 3600 + b.getUTCMinutes() * 60 + b.getUTCSeconds();
    if (m > 0 && rb < ra) m--; else if (m < 0 && rb > ra) m++;
    return m;
  }
  function week0(d) { // MySQL WEEK(d) mode 0: Sunday start, 0..53
    const y = d.getUTCFullYear();
    const jan1 = new Date(Date.UTC(y, 0, 1));
    const firstSun = new Date(Date.UTC(y, 0, 1 + ((7 - jan1.getUTCDay()) % 7)));
    if (d < firstSun) return 0;
    return Math.floor((dayNum(d) - dayNum(firstSun)) / 7) + 1;
  }
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3);
    const fy = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return { week: 1 + Math.round(((t - fy) / 86400000 - 3 + ((fy.getUTCDay() + 6) % 7)) / 7), year: t.getUTCFullYear() };
  }
  function dateFormat(v, f) {
    const d = parseD(v); if (!d || f === null) return null;
    const h = d.getUTCHours();
    const map = {
      Y: d.getUTCFullYear(), y: pad(d.getUTCFullYear() % 100), m: pad(d.getUTCMonth() + 1), c: d.getUTCMonth() + 1,
      d: pad(d.getUTCDate()), e: d.getUTCDate(), H: pad(h), k: h, h: pad(h % 12 || 12), I: pad(h % 12 || 12), l: h % 12 || 12,
      i: pad(d.getUTCMinutes()), s: pad(d.getUTCSeconds()), S: pad(d.getUTCSeconds()), p: h < 12 ? 'AM' : 'PM',
      M: MONTHS[d.getUTCMonth()], b: MONTHS[d.getUTCMonth()].slice(0, 3), W: DAYS[d.getUTCDay()], a: DAYS[d.getUTCDay()].slice(0, 3),
      w: d.getUTCDay(), j: pad(dayNum(d) - dayNum(new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) + 1, 3),
      U: pad(week0(d)), u: pad(isoWeek(d).week), v: pad(isoWeek(d).week), x: isoWeek(d).year, T: `${pad(h)}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`, '%': '%'
    };
    return String(f).replace(/%(.)/g, (all, c) => (c in map ? String(map[c]) : c));
  }
  function strToDate(s, f) {
    if (s === null || f === null) return null;
    const re = String(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%([YmdHisbMeckIp])/g, (a, c) => ({ Y: '(\\d{4})', m: '(\\d{1,2})', c: '(\\d{1,2})', d: '(\\d{1,2})', e: '(\\d{1,2})', H: '(\\d{1,2})', k: '(\\d{1,2})', I: '(\\d{1,2})', i: '(\\d{1,2})', s: '(\\d{1,2})', b: '([A-Za-z]{3})', M: '([A-Za-z]+)', p: '(AM|PM)' }[c]));
    const order = (String(f).match(/%[YmdHisbMeckIp]/g) || []).map(x => x[1]);
    const m = new RegExp('^' + re).exec(String(s).trim()); if (!m) return null;
    let Y = 1970, Mo = 1, Dd = 1, H = 0, Mi = 0, S = 0, pm = null, timeUsed = false;
    order.forEach((c, i) => { const v = m[i + 1]; if (c === 'Y') Y = +v; else if (c === 'm' || c === 'c') Mo = +v; else if (c === 'd' || c === 'e') Dd = +v; else if (c === 'H' || c === 'k' || c === 'I') { H = +v; timeUsed = true; } else if (c === 'i') { Mi = +v; timeUsed = true; } else if (c === 's') { S = +v; timeUsed = true; } else if (c === 'b' || c === 'M') Mo = MONTHS.findIndex(x => x.toLowerCase().startsWith(v.toLowerCase().slice(0, 3))) + 1; else if (c === 'p') pm = v; });
    if (pm === 'PM' && H < 12) H += 12; if (pm === 'AM' && H === 12) H = 0;
    const d = new Date(Date.UTC(Y, Mo - 1, Dd, H, Mi, S));
    return timeUsed ? fDT(d) : fDate(d);
  }

  // --- function registry ---------------------------------------------------
  function reg(db, nm, fn, arities) {
    const list = arities || [fn.length];
    for (const n of list) {
      const w = function () { return fn.apply(null, arguments); };
      Object.defineProperty(w, 'length', { value: n });
      try { db.create_function(nm, w); } catch (e) { /* ignore */ }
    }
  }
  const num = x => (x === null || x === undefined ? null : Number(x));
  function registerMySQLFunctions(db) {
    const D1 = f => v => { const d = parseD(v); return d ? f(d) : null; };
    reg(db, 'DATE_FORMAT', dateFormat);
    reg(db, 'TIME_FORMAT', dateFormat);
    reg(db, 'DATEDIFF', (a, b) => { const x = parseD(a), y = parseD(b); return x && y ? dayNum(x) - dayNum(y) : null; });
    reg(db, 'TIMESTAMPDIFF', (u, a, b) => {
      const x = parseD(a), y = parseD(b); if (!x || !y) return null; u = String(u).toUpperCase();
      const ms = y - x;
      switch (u) {
        case 'SECOND': return Math.trunc(ms / 1000); case 'MINUTE': return Math.trunc(ms / 60000); case 'HOUR': return Math.trunc(ms / 3600000);
        case 'DAY': return Math.trunc(ms / 86400000); case 'WEEK': return Math.trunc(ms / 604800000);
        case 'MONTH': return monthDiff(x, y); case 'QUARTER': return Math.trunc(monthDiff(x, y) / 3); case 'YEAR': return Math.trunc(monthDiff(x, y) / 12);
      } return null;
    });
    reg(db, 'DATE_ADD', (d, n, u) => addInterval(d, n, u));
    reg(db, 'DATE_SUB', (d, n, u) => addInterval(d, -n, u));
    reg(db, 'ADDDATE', (d, n, u) => addInterval(d, n, u || 'DAY'), [2, 3]);
    reg(db, 'SUBDATE', (d, n, u) => addInterval(d, -n, u || 'DAY'), [2, 3]);
    reg(db, 'YEAR', D1(d => d.getUTCFullYear()));
    reg(db, 'MONTH', D1(d => d.getUTCMonth() + 1));
    reg(db, 'DAY', D1(d => d.getUTCDate()));
    reg(db, 'DAYOFMONTH', D1(d => d.getUTCDate()));
    reg(db, 'HOUR', D1(d => d.getUTCHours()));
    reg(db, 'MINUTE', D1(d => d.getUTCMinutes()));
    reg(db, 'SECOND', D1(d => d.getUTCSeconds()));
    reg(db, 'QUARTER', D1(d => Math.floor(d.getUTCMonth() / 3) + 1));
    reg(db, 'DAYOFWEEK', D1(d => d.getUTCDay() + 1));
    reg(db, 'WEEKDAY', D1(d => (d.getUTCDay() + 6) % 7));
    reg(db, 'DAYOFYEAR', D1(d => dayNum(d) - dayNum(new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) + 1));
    reg(db, 'DAYNAME', D1(d => DAYS[d.getUTCDay()]));
    reg(db, 'MONTHNAME', D1(d => MONTHS[d.getUTCMonth()]));
    reg(db, 'WEEK', (v, mode) => { const d = parseD(v); if (!d) return null; return (mode === 3 || mode === 1) ? isoWeek(d).week : week0(d); }, [1, 2]);
    reg(db, 'WEEKOFYEAR', D1(d => isoWeek(d).week));
    reg(db, 'YEARWEEK', (v, mode) => { const d = parseD(v); if (!d) return null; if (mode === 3 || mode === 1) { const w = isoWeek(d); return w.year * 100 + w.week; } let w = week0(d), y = d.getUTCFullYear(); if (w === 0) { y--; w = week0(new Date(Date.UTC(y, 11, 31))); } return y * 100 + w; }, [1, 2]);
    reg(db, 'LAST_DAY', D1(d => fDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))));
    reg(db, 'TO_DAYS', D1(d => dayNum(d) + 719528));
    reg(db, 'FROM_DAYS', n => fDate(new Date((n - 719528) * 86400000)));
    reg(db, 'MAKEDATE', (y, n) => fDate(new Date(Date.UTC(y, 0, n))));
    reg(db, 'UNIX_TIMESTAMP', v => { const d = parseD(v); return d ? Math.floor(d.getTime() / 1000) : null; }, [1]);
    reg(db, 'FROM_UNIXTIME', s => fDT(new Date(s * 1000)));
    reg(db, 'STR_TO_DATE', strToDate);
    reg(db, 'EXTRACT_', (u, v) => { const d = parseD(v); if (!d) return null; switch (String(u).toUpperCase()) { case 'YEAR': return d.getUTCFullYear(); case 'MONTH': return d.getUTCMonth() + 1; case 'DAY': return d.getUTCDate(); case 'HOUR': return d.getUTCHours(); case 'MINUTE': return d.getUTCMinutes(); case 'SECOND': return d.getUTCSeconds(); case 'QUARTER': return Math.floor(d.getUTCMonth() / 3) + 1; case 'WEEK': return week0(d); case 'YEAR_MONTH': return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; case 'DOW': return d.getUTCDay(); } return null; });
    const today = () => fDate(new Date()); const now = () => fDT(new Date());
    reg(db, 'CURDATE', today, [0]); reg(db, 'NOW', now, [0]); reg(db, 'SYSDATE', now, [0]); reg(db, 'UTC_DATE', today, [0]);
    // math
    reg(db, 'MOD', (a, b) => (a === null || b === null || +b === 0 ? null : a % b));
    reg(db, 'FLOOR', x => (x === null ? null : Math.floor(x)));
    reg(db, 'CEIL', x => (x === null ? null : Math.ceil(x)));
    reg(db, 'CEILING', x => (x === null ? null : Math.ceil(x)));
    reg(db, 'POWER', (a, b) => (a === null || b === null ? null : Math.pow(a, b)));
    reg(db, 'POW', (a, b) => (a === null || b === null ? null : Math.pow(a, b)));
    reg(db, 'SQRT', x => (x === null || x < 0 ? null : Math.sqrt(x)));
    reg(db, 'EXP', x => (x === null ? null : Math.exp(x)));
    reg(db, 'LN', x => (x === null || x <= 0 ? null : Math.log(x)));
    reg(db, 'LOG', (a, b) => (b === undefined ? (a > 0 ? Math.log(a) : null) : (a > 0 && b > 0 ? Math.log(b) / Math.log(a) : null)), [1, 2]);
    reg(db, 'LOG10', x => (x > 0 ? Math.log10(x) : null));
    reg(db, 'LOG2', x => (x > 0 ? Math.log2(x) : null));
    reg(db, 'SIGN', x => (x === null ? null : Math.sign(x)));
    reg(db, 'PI', () => Math.PI, [0]);
    reg(db, 'RAND', () => Math.random(), [0, 1]);
    reg(db, 'TRUNCATE', (x, d) => { if (x === null) return null; const p = Math.pow(10, d || 0); return Math.trunc(x * p) / p; });
    // strings
    reg(db, 'MY_LEFT', (s, n) => (s === null ? null : String(s).slice(0, Math.max(0, n))));
    reg(db, 'MY_RIGHT', (s, n) => (s === null ? null : (n <= 0 ? '' : String(s).slice(-n))));
    reg(db, 'SUBSTRING_INDEX', (s, delim, count) => {
      if (s === null) return null; const parts = String(s).split(delim);
      return count > 0 ? parts.slice(0, count).join(delim) : parts.slice(count).join(delim);
    });
    reg(db, 'LOCATE', (sub, s, pos) => { if (s === null || sub === null) return null; return String(s).toLowerCase().indexOf(String(sub).toLowerCase(), (pos || 1) - 1) + 1; }, [2, 3]);
    reg(db, 'POSITION_', (sub, s) => (s === null ? null : String(s).toLowerCase().indexOf(String(sub).toLowerCase()) + 1));
    reg(db, 'LPAD', (s, n, p) => { if (s === null) return null; s = String(s); if (s.length >= n) return s.slice(0, n); return (String(p).repeat(n) + s).slice(-n); });
    reg(db, 'RPAD', (s, n, p) => { if (s === null) return null; s = String(s); if (s.length >= n) return s.slice(0, n); return (s + String(p).repeat(n)).slice(0, n); });
    reg(db, 'REPEAT', (s, n) => (s === null ? null : String(s).repeat(Math.max(0, n))));
    reg(db, 'REVERSE', s => (s === null ? null : String(s).split('').reverse().join('')));
    reg(db, 'CHAR_LENGTH', s => (s === null ? null : String(s).length));
    reg(db, 'CHARACTER_LENGTH', s => (s === null ? null : String(s).length));
    reg(db, 'UCASE', s => (s === null ? null : String(s).toUpperCase()));
    reg(db, 'LCASE', s => (s === null ? null : String(s).toLowerCase()));
    reg(db, 'SPACE', n => ' '.repeat(Math.max(0, n)));
    reg(db, 'STRCMP', (a, b) => (a === null || b === null ? null : a < b ? -1 : a > b ? 1 : 0));
    reg(db, 'REGEXP', (re, s) => (s === null || re === null ? null : (new RegExp(re, 'i').test(String(s)) ? 1 : 0)));
    reg(db, 'REGEXP_LIKE', (s, re) => (s === null || re === null ? null : (new RegExp(re, 'i').test(String(s)) ? 1 : 0)));
    reg(db, 'REGEXP_REPLACE', (s, re, rep) => (s === null ? null : String(s).replace(new RegExp(re, 'g'), rep)));
    reg(db, 'REGEXP_SUBSTR', (s, re) => { if (s === null) return null; const m = new RegExp(re).exec(String(s)); return m ? m[0] : null; });
    reg(db, 'FIELD', function () { const a = [].slice.call(arguments); const i = a.slice(1).findIndex(x => x == a[0]); return i + 1; }, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    reg(db, 'ELT', function () { const a = [].slice.call(arguments); return a[a[0]] === undefined ? null : a[a[0]]; }, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
    reg(db, 'FIND_IN_SET', (s, list) => (list === null || s === null ? null : String(list).split(',').indexOf(String(s)) + 1));
    // aggregates
    const statAgg = (finalize) => ({ init: () => ({ n: 0, s: 0, ss: 0 }), step: (st, x) => { if (x !== null && x !== undefined) { st.n++; st.s += +x; st.ss += x * x; } return st; }, finalize });
    const varPop = st => (st.n ? st.ss / st.n - Math.pow(st.s / st.n, 2) : null);
    const varSamp = st => (st.n > 1 ? (st.ss - st.s * st.s / st.n) / (st.n - 1) : null);
    try {
      db.create_aggregate('STDDEV', statAgg(st => (st.n ? Math.sqrt(Math.max(0, varPop(st))) : null)));
      db.create_aggregate('STD', statAgg(st => (st.n ? Math.sqrt(Math.max(0, varPop(st))) : null)));
      db.create_aggregate('STDDEV_POP', statAgg(st => (st.n ? Math.sqrt(Math.max(0, varPop(st))) : null)));
      db.create_aggregate('STDDEV_SAMP', statAgg(st => (st.n > 1 ? Math.sqrt(Math.max(0, varSamp(st))) : null)));
      db.create_aggregate('VARIANCE', statAgg(varPop));
      db.create_aggregate('VAR_POP', statAgg(varPop));
      db.create_aggregate('VAR_SAMP', statAgg(varSamp));
      db.create_aggregate('BIT_OR', { init: () => 0, step: (s, x) => s | x, finalize: s => s });
    } catch (e) { /* older sql.js */ }
  }

  // --- SQL rewriter ----------------------------------------------------------
  function protect(sql) {
    const lits = [];
    let out = '', i = 0;
    while (i < sql.length) {
      const c = sql[i], c2 = sql.substr(i, 2);
      if (c2 === '--' || (c === '#' && !/[\w]/.test(sql[i - 1] || ''))) { const j = sql.indexOf('\n', i); i = j < 0 ? sql.length : j; continue; }
      if (c2 === '/*') { const j = sql.indexOf('*/', i + 2); i = j < 0 ? sql.length : j + 2; out += ' '; continue; }
      if (c === "'" || c === '"' || c === '`') {
        let j = i + 1, s = c;
        while (j < sql.length) { if (sql[j] === '\\' && c !== '`') { s += sql[j + 1] === "'" ? "''" : sql[j + 1]; j += 2; continue; } if (sql[j] === c) { if (sql[j + 1] === c) { s += c + c; j += 2; continue; } break; } s += sql[j]; j++; }
        s += c; i = j + 1;
        if (c === '`') { out += '"' + s.slice(1, -1).replace(/"/g, '""') + '"'; continue; }
        lits.push(c === '"' ? "'" + s.slice(1, -1).replace(/'/g, "''") + "'" : s);
        out += `__L${lits.length - 1}__`; continue;
      }
      out += c; i++;
    }
    return { code: out, lits };
  }
  // find matching paren from index of '('
  function matchParen(s, open) { let d = 0; for (let i = open; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')') { d--; if (d === 0) return i; } } return -1; }
  function splitTopLevel(s, re) { let d = 0; for (let i = 0; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')') d--; else if (d === 0) { re.lastIndex = i; const m = re.exec(s); if (m && m.index === i) return [s.slice(0, i), s.slice(i + m[0].length)]; } } return null; }

  function rewriteGroupConcat(code) {
    const re = /\bGROUP_CONCAT\s*\(/ig; let m, out = '', last = 0;
    while ((m = re.exec(code))) {
      const open = m.index + m[0].length - 1, close = matchParen(code, open); if (close < 0) break;
      let inner = code.slice(open + 1, close);
      inner = rewriteGroupConcat(inner);
      let sep = null, order = null;
      const sp = splitTopLevel(inner, /\s+SEPARATOR\s+/iy); if (sp) { inner = sp[0]; sep = sp[1].trim(); }
      const op = splitTopLevel(inner, /\s+ORDER\s+BY\s+/iy); if (op) { inner = op[0]; order = op[1].trim(); }
      let distinct = /^\s*DISTINCT\s+/i.test(inner);
      let body = inner;
      if (distinct && (sep || order)) { // SQLite: DISTINCT aggregates take one argument
        body = inner; sep = null; // fall back to default ',' separator
        if (order) { order = null; }
      }
      const rep = `GROUP_CONCAT(${body}${sep ? ', ' + sep : (order ? ", ','" : '')}${order ? ' ORDER BY ' + order : ''})`;
      out += code.slice(last, m.index) + rep; last = close + 1; re.lastIndex = close + 1;
    }
    return out + code.slice(last);
  }

  function rewriteMySQL(sql) {
    const { code: c0, lits } = protect(sql);
    let c = c0;
    const U = '(MICROSECOND|SECOND|MINUTE|HOUR|DAY|WEEK|MONTH|QUARTER|YEAR)';
    // window RANGE with INTERVAL on a date ordering column
    c = c.replace(new RegExp(`ORDER\\s+BY\\s+([\\w."]+)(\\s+ASC)?\\s+RANGE\\s+BETWEEN\\s+INTERVAL\\s+(\\d+)\\s+DAY\\s+PRECEDING`, 'ig'), 'ORDER BY julianday($1) RANGE BETWEEN $3 PRECEDING');
    c = c.replace(new RegExp(`AND\\s+INTERVAL\\s+(\\d+)\\s+DAY\\s+FOLLOWING`, 'ig'), 'AND $1 FOLLOWING');
    // TIMESTAMPDIFF(UNIT, ...) and EXTRACT(UNIT FROM x)
    c = c.replace(new RegExp(`\\bTIMESTAMPDIFF\\s*\\(\\s*${U}\\s*,`, 'ig'), "TIMESTAMPDIFF('$1',");
    c = c.replace(new RegExp(`\\bEXTRACT\\s*\\(\\s*(YEAR_MONTH|${U.slice(1, -1)})\\s+FROM\\s+`, 'ig'), "EXTRACT_('$1', ");
    c = c.replace(/\bPOSITION\s*\(\s*([^()]+?)\s+IN\s+/ig, 'POSITION_($1, ');
    // expr +/- INTERVAL n UNIT  (simple left operand)
    c = c.replace(new RegExp(`([\\w.]+(?:\\([^()]*\\))?|__L\\d+__)\\s*([+-])\\s*INTERVAL\\s+(-?[\\w.]+|\\([^()]*\\))\\s+${U}\\b`, 'ig'), (a, l, op, n, u) => `DATE_ADD(${l}, ${op === '-' ? '-' : ''}(${n}), '${u.toUpperCase()}')`);
    // DATE_ADD(x, INTERVAL n UNIT)
    c = c.replace(new RegExp(`,\\s*INTERVAL\\s+(.+?)\\s+${U}\\s*\\)`, 'ig'), (a, n, u) => `, (${n}), '${u.toUpperCase()}')`);
    // functions that clash with SQLite keywords / syntax
    c = c.replace(/\bLEFT\s*\(/ig, 'MY_LEFT(').replace(/\bRIGHT\s*\(/ig, 'MY_RIGHT(');
    c = c.replace(/\bIF\s*\(/ig, 'IIF(');
    c = c.replace(/\bGREATEST\s*\(/ig, 'MAX(').replace(/\bLEAST\s*\(/ig, 'MIN(');
    c = c.replace(/\bANY_VALUE\s*\(/ig, 'MAX(');
    c = c.replace(/\b(CURRENT_DATE|CURRENT_TIMESTAMP|LOCALTIMESTAMP|LOCALTIME)\s*\(\s*\)/ig, (a, f) => (f.toUpperCase() === 'CURRENT_DATE' ? 'CURDATE()' : 'NOW()'));
    c = c.replace(/\bSUBSTRING\s*\(\s*([^(),]+?)\s+FROM\s+(\d+)\s+FOR\s+(\d+)\s*\)/ig, 'SUBSTR($1, $2, $3)');
    c = c.replace(/\bSUBSTRING\s*\(/ig, 'SUBSTR(').replace(/\bMID\s*\(/ig, 'SUBSTR(');
    c = c.replace(/\bCHAR_LENGTH\s*\(/ig, 'CHAR_LENGTH(');
    c = c.replace(/\bCAST\s*\(([^()]*(?:\([^()]*\)[^()]*)*?)\s+AS\s+DATE\s*\)/ig, 'DATE($1)');
    c = c.replace(/\bCAST\s*\(([^()]*(?:\([^()]*\)[^()]*)*?)\s+AS\s+DATETIME\s*\)/ig, 'DATETIME($1)');
    c = c.replace(/\bAS\s+(SIGNED|UNSIGNED)(\s+INTEGER|\s+INT)?\s*\)/ig, 'AS INTEGER)');
    c = c.replace(/\bAS\s+CHAR(\s*\(\s*\d+\s*\))?\s*\)/ig, 'AS TEXT)');
    c = c.replace(/<=>/g, ' IS ');
    c = c.replace(/\bFROM\s+DUAL\b/ig, '');
    c = c.replace(/\bNOT\s+REGEXP\b/ig, 'NOT REGEXP').replace(/\bRLIKE\b/ig, 'REGEXP');
    c = c.replace(/\bSEPARATOR\b/ig, 'SEPARATOR');
    c = rewriteGroupConcat(c);
    // MySQL "/" is always decimal division. SQLite truncates int/int -> force real division.
    c = c.replace(/\/(?!\*)/g, '* 1.0 /');
    c = c.replace(/\bDIV\b/ig, '/');
    return c.replace(/__L(\d+)__/g, (a, i) => lits[+i]);
  }

  const api = { rewriteMySQL, registerMySQLFunctions, parseD, dateFormat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MySQLCompat = api;
})(typeof window !== 'undefined' ? window : this);
