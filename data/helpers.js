/* helper for inline tables: QT('col:TYPE,col2:TYPE', rows) */
window.QT = function (spec, rows) {
  const cols = spec.split(',').map(s => s.trim().split(':'));
  return { columns: cols.map(c => c[0]), types: cols.map(c => c[1] || 'TEXT'), rows };
};
window.QUESTIONS = window.QUESTIONS || [];
/* LeetCode-set helper: LC(number, {...}) — internal id = 10000 + LeetCode number */
window.LC = function (n, o) {
  const tier = o.difficulty === 'Easy' ? 1 : o.difficulty === 'Medium' ? 2 : 3;
  window.QUESTIONS.push(Object.assign({ id: 10000 + n, lc: n, set: 'lc', companies: [], ordered: false, tier }, o));
};
