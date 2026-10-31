/* helper for inline tables: QT('col:TYPE,col2:TYPE', rows) */
window.QT = function (spec, rows) {
  const cols = spec.split(',').map(s => s.trim().split(':'));
  return { columns: cols.map(c => c[0]), types: cols.map(c => c[1] || 'TEXT'), rows };
};
window.QUESTIONS = window.QUESTIONS || [];
