/* Section 8 — Fintech: lending & collections (Navi / Bajaj / KreditBee style) */
window.QUESTIONS.push(
{
  id: 62, title: 'EMI status per loan with partial payments', difficulty: 'Medium', tier: 2, dataset: 'lending',
  topics: ['Join fan-out', 'CTE', 'Conditional aggregation'], companies: ['Navi', 'Bajaj Finserv', 'KreditBee', 'Paytm'], ordered: true,
  prompt: `<p>As of 2024-12-31, classify every EMI that has fallen due on <b>Two-Wheeler</b> loans: <b>fully paid</b> (Σ amount_paid ≥ emi_amount), <b>partially paid</b> (0 &lt; Σ &lt; emi_amount), <b>unpaid</b> (no payment).</p>
<p>Return <code>loan_id</code>, <code>emis_due</code>, <code>fully_paid</code>, <code>partially_paid</code>, <code>unpaid</code>. Sort by loan_id.</p>`,
  hint: 'Sum repayments per (loan, emi) first. Then LEFT JOIN the schedule to those sums.',
  sql: `WITH paid AS (
  SELECT loan_id, emi_no, SUM(amount_paid) AS paid
  FROM repayments
  GROUP BY loan_id, emi_no
)
SELECT s.loan_id,
       COUNT(*) AS emis_due,
       SUM(CASE WHEN p.paid >= s.emi_amount THEN 1 ELSE 0 END)               AS fully_paid,
       SUM(CASE WHEN p.paid > 0 AND p.paid < s.emi_amount THEN 1 ELSE 0 END) AS partially_paid,
       SUM(CASE WHEN p.paid IS NULL THEN 1 ELSE 0 END)                       AS unpaid
FROM emi_schedule s
JOIN loans l     ON l.loan_id = s.loan_id AND l.product = 'Two-Wheeler'
LEFT JOIN paid p ON p.loan_id = s.loan_id AND p.emi_no = s.emi_no
GROUP BY s.loan_id
ORDER BY s.loan_id;`,
  sql_explain: `<p>Ledger tables can have <b>several rows per EMI</b> (part payments). Joining the raw ledger to the schedule and counting would double count EMIs. Collapse the ledger to the EMI grain first, then classify with CASE.</p>`,
  py: `paid = repayments.groupby(['loan_id', 'emi_no']).amount_paid.sum().rename('paid').reset_index()
s = emi_schedule.merge(loans[loans['product'] == 'Two-Wheeler'][['loan_id']], on='loan_id').merge(paid, on=['loan_id', 'emi_no'], how='left')
s['full'] = (s.paid >= s.emi_amount).astype(int)
s['part'] = ((s.paid > 0) & (s.paid < s.emi_amount)).astype(int)
s['none'] = s.paid.isna().astype(int)
result = s.groupby('loan_id').agg(emis_due=('emi_no', 'count'), fully_paid=('full', 'sum'), partially_paid=('part', 'sum'), unpaid=('none', 'sum')).reset_index()`,
  py_explain: `<p>Aggregate ledger → left-merge on schedule → boolean flags → sum per loan.</p>`
},
{
  id: 63, title: 'Days Past Due (DPD) buckets as of 2024-12-31', difficulty: 'Hard', tier: 3, dataset: 'lending',
  topics: ['Business case', 'CTE', 'CASE', 'Date functions'], companies: ['Navi', 'Bajaj Finserv', 'HDFC Bank', 'KreditBee', 'Slice'], ordered: true,
  prompt: `<p>For each <b>Active</b> loan, DPD = number of days between the due date of its <b>oldest EMI that is not fully paid</b> (Σ payments ≤ 2024-12-31 &lt; emi_amount) and 2024-12-31. DPD = 0 if every due EMI is fully paid.</p>
<p>Buckets: <code>'0'</code>, <code>'1-30'</code>, <code>'31-60'</code>, <code>'61-90'</code>, <code>'90+'</code>. Return <code>dpd_bucket</code>, <code>loans</code>, <code>pct_loans</code> (2 dp), in that bucket order.</p>`,
  hint: 'Per EMI paid flag → MIN(due_date) of unpaid EMIs per loan (LEFT JOIN so fully-paid loans stay) → DATEDIFF → CASE → sort with a numeric key.',
  sql: `WITH paid AS (
  SELECT loan_id, emi_no, SUM(amount_paid) AS paid
  FROM repayments
  WHERE paid_date <= '2024-12-31'
  GROUP BY loan_id, emi_no
), oldest_unpaid AS (
  SELECT s.loan_id, MIN(s.due_date) AS oldest_due
  FROM emi_schedule s
  LEFT JOIN paid p ON p.loan_id = s.loan_id AND p.emi_no = s.emi_no
  WHERE COALESCE(p.paid, 0) < s.emi_amount
  GROUP BY s.loan_id
), dpd AS (
  SELECT l.loan_id,
         COALESCE(DATEDIFF('2024-12-31', o.oldest_due), 0) AS dpd
  FROM loans l
  LEFT JOIN oldest_unpaid o ON o.loan_id = l.loan_id
  WHERE l.loan_status = 'Active'
), b AS (
  SELECT CASE WHEN dpd = 0 THEN '0' WHEN dpd <= 30 THEN '1-30' WHEN dpd <= 60 THEN '31-60'
              WHEN dpd <= 90 THEN '61-90' ELSE '90+' END AS dpd_bucket,
         CASE WHEN dpd = 0 THEN 0 WHEN dpd <= 30 THEN 1 WHEN dpd <= 60 THEN 2
              WHEN dpd <= 90 THEN 3 ELSE 4 END AS sort_key
  FROM dpd
)
SELECT dpd_bucket, COUNT(*) AS loans,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct_loans
FROM b
GROUP BY dpd_bucket, sort_key
ORDER BY sort_key;`,
  sql_explain: `<p>DPD is driven by the <b>oldest</b> unpaid instalment (not the latest). Steps: ledger → EMI paid amount → unpaid EMIs → earliest due per loan → days to as-of date.</p>
<p>Two gotchas: (1) LEFT JOIN from loans so fully-current loans get DPD 0 via COALESCE; (2) text buckets sort alphabetically ('1-30' &lt; '31-60' &lt; '61-90' &lt; '90+' happens to work, but don't rely on it — carry a numeric sort key).</p>`,
  py: `paid = repayments[repayments.paid_date <= '2024-12-31'].groupby(['loan_id', 'emi_no']).amount_paid.sum().rename('paid').reset_index()
s = emi_schedule.merge(paid, on=['loan_id', 'emi_no'], how='left').fillna({'paid': 0})
oldest = s[s.paid < s.emi_amount].groupby('loan_id').due_date.min().rename('oldest_due')
l = loans[loans.loan_status == 'Active'].join(oldest, on='loan_id')
l['dpd'] = (pd.Timestamp('2024-12-31') - l.oldest_due).dt.days.fillna(0)
l['dpd_bucket'] = pd.cut(l.dpd, bins=[-1, 0, 30, 60, 90, 10**6], labels=['0', '1-30', '31-60', '61-90', '90+'])
result = l.groupby('dpd_bucket', observed=False).size().reset_index(name='loans')
result = result[result.loans > 0].reset_index(drop=True)
result['dpd_bucket'] = result.dpd_bucket.astype(str)
result['pct_loans'] = (100 * result.loans / result.loans.sum()).round(2)`,
  py_explain: `<p><code>pd.cut</code> with explicit bin edges is a clean bucketing tool and keeps the categorical order.</p>`
},
{
  id: 64, title: 'PAR30 by product (portfolio at risk)', difficulty: 'Hard', tier: 3, dataset: 'lending',
  topics: ['Business case', 'Risk metrics', 'Conditional aggregation'], companies: ['Navi', 'Bajaj Finserv', 'Aditya Birla Capital', 'Paytm', 'IDFC First'], ordered: true,
  prompt: `<p>Using the same DPD definition as the previous question (as of 2024-12-31, Active loans only): <b>PAR30</b> = principal of loans with DPD &gt; 30 ÷ principal of all active loans × 100.</p>
<p>Return <code>product</code>, <code>active_loans</code>, <code>par30_loans</code>, <code>par30_pct</code> (principal-weighted, 2 dp). Sort by par30_pct desc.</p>`,
  hint: 'Reuse the DPD CTE, then SUM(CASE WHEN dpd > 30 THEN principal END) / SUM(principal).',
  sql: `WITH paid AS (
  SELECT loan_id, emi_no, SUM(amount_paid) AS paid
  FROM repayments WHERE paid_date <= '2024-12-31'
  GROUP BY loan_id, emi_no
), oldest_unpaid AS (
  SELECT s.loan_id, MIN(s.due_date) AS oldest_due
  FROM emi_schedule s
  LEFT JOIN paid p ON p.loan_id = s.loan_id AND p.emi_no = s.emi_no
  WHERE COALESCE(p.paid, 0) < s.emi_amount
  GROUP BY s.loan_id
), dpd AS (
  SELECT l.loan_id, l.product, l.principal,
         COALESCE(DATEDIFF('2024-12-31', o.oldest_due), 0) AS dpd
  FROM loans l
  LEFT JOIN oldest_unpaid o ON o.loan_id = l.loan_id
  WHERE l.loan_status = 'Active'
)
SELECT product,
       COUNT(*) AS active_loans,
       SUM(CASE WHEN dpd > 30 THEN 1 ELSE 0 END) AS par30_loans,
       ROUND(100.0 * SUM(CASE WHEN dpd > 30 THEN principal ELSE 0 END) / SUM(principal), 2) AS par30_pct
FROM dpd
GROUP BY product
ORDER BY par30_pct DESC;`,
  sql_explain: `<p>Risk teams weight by money, not by count: one ₹40L home loan going bad matters more than ten ₹30K personal loans. (Strictly PAR uses <i>outstanding</i> principal; using sanctioned principal is a stated simplification — say so in the interview.)</p>`,
  py: `paid = repayments[repayments.paid_date <= '2024-12-31'].groupby(['loan_id', 'emi_no']).amount_paid.sum().rename('paid').reset_index()
s = emi_schedule.merge(paid, on=['loan_id', 'emi_no'], how='left').fillna({'paid': 0})
oldest = s[s.paid < s.emi_amount].groupby('loan_id').due_date.min().rename('oldest_due')
l = loans[loans.loan_status == 'Active'].join(oldest, on='loan_id')
l['dpd'] = (pd.Timestamp('2024-12-31') - l.oldest_due).dt.days.fillna(0)
l['bad'] = (l.dpd > 30).astype(int)
l['bad_principal'] = l.principal * l.bad
g = l.groupby('product').agg(active_loans=('loan_id', 'count'), par30_loans=('bad', 'sum'), bp=('bad_principal', 'sum'), p=('principal', 'sum')).reset_index()
g['par30_pct'] = (100 * g.bp / g.p).round(2)
result = g[['product', 'active_loans', 'par30_loans', 'par30_pct']].sort_values('par30_pct', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Multiply the principal by a 0/1 flag to get the "bad" principal, then ratio of sums.</p>`
},
{
  id: 65, title: 'First-payment default (FPD30) by disbursal vintage', difficulty: 'Hard', tier: 3, dataset: 'lending',
  topics: ['Vintage analysis', 'Cohort analysis', 'Business case'], companies: ['Navi', 'KreditBee', 'MoneyView', 'Slice', 'Bajaj Finserv'], ordered: true,
  prompt: `<p>A loan is an <b>FPD30</b> if its <b>first EMI</b> was not fully paid within 30 days of its due date (Σ payments with paid_date ≤ due_date + 30 days &lt; emi_amount).</p>
<p>Only loans whose first EMI due date is on or before 2024-11-30 (so 30 days have passed). Per disbursal month return <code>disbursal_month</code> (YYYY-MM), <code>loans</code>, <code>fpd_loans</code>, <code>fpd_rate_pct</code> (2 dp). Sort by disbursal_month.</p>`,
  hint: 'Filter the schedule to emi_no = 1, LEFT JOIN repayments with the date condition inside the ON clause.',
  sql: `WITH first_emi AS (
  SELECT s.loan_id, s.due_date, s.emi_amount,
         COALESCE(SUM(r.amount_paid), 0) AS paid_30
  FROM emi_schedule s
  LEFT JOIN repayments r
         ON r.loan_id = s.loan_id AND r.emi_no = s.emi_no
        AND r.paid_date <= DATE_ADD(s.due_date, INTERVAL 30 DAY)
  WHERE s.emi_no = 1 AND s.due_date <= '2024-11-30'
  GROUP BY s.loan_id, s.due_date, s.emi_amount
)
SELECT DATE_FORMAT(l.disbursal_date, '%Y-%m') AS disbursal_month,
       COUNT(*) AS loans,
       SUM(CASE WHEN f.paid_30 < f.emi_amount THEN 1 ELSE 0 END) AS fpd_loans,
       ROUND(100.0 * SUM(CASE WHEN f.paid_30 < f.emi_amount THEN 1 ELSE 0 END) / COUNT(*), 2) AS fpd_rate_pct
FROM first_emi f
JOIN loans l ON l.loan_id = f.loan_id
GROUP BY disbursal_month
ORDER BY disbursal_month;`,
  sql_explain: `<p><b>Vintage analysis</b> groups loans by when they were originated, so you can tell whether newer underwriting is better or worse. FPD is the earliest risk signal (often fraud or bad KYC).</p>
<p>Putting the date condition in the <b>ON</b> clause keeps EMIs with no qualifying payment (they become 0 → FPD). In the WHERE clause it would drop them — the classic LEFT JOIN mistake again.</p>`,
  py: `f = emi_schedule[(emi_schedule.emi_no == 1) & (emi_schedule.due_date <= '2024-11-30')]
r = repayments.merge(f[['loan_id', 'emi_no', 'due_date']], on=['loan_id', 'emi_no'])
r = r[r.paid_date <= r.due_date + pd.Timedelta(days=30)].groupby('loan_id').amount_paid.sum().rename('paid_30')
f = f.join(r, on='loan_id').fillna({'paid_30': 0}).merge(loans[['loan_id', 'disbursal_date']], on='loan_id')
f['fpd'] = (f.paid_30 < f.emi_amount).astype(int)
f['disbursal_month'] = f.disbursal_date.dt.strftime('%Y-%m')
result = f.groupby('disbursal_month').agg(loans=('loan_id', 'count'), fpd_loans=('fpd', 'sum')).reset_index()
result['fpd_rate_pct'] = (100 * result.fpd_loans / result.loans).round(2)`,
  py_explain: `<p>Filter payments to the 30-day window before summing; then fill 0 for loans with no qualifying payment.</p>`
},
{
  id: 66, title: 'Monthly collection efficiency (2024)', difficulty: 'Medium', tier: 2, dataset: 'lending',
  topics: ['Business case', 'Aggregation', 'Date functions'], companies: ['Navi', 'Bajaj Finserv', 'Muthoot', 'HDFC Bank'], ordered: true,
  prompt: `<p>Collection efficiency for a due month = amount collected against EMIs <b>due in that month</b>, received <b>by the last day of that month</b>, ÷ total amount due that month × 100.</p>
<p>For each month of 2024 return <code>due_month</code> (YYYY-MM), <code>amount_due</code>, <code>collected_in_month</code>, <code>efficiency_pct</code> (2 dp). Sort by due_month.</p>`,
  hint: 'Aggregate the qualifying collections per EMI first (LEFT JOIN with LAST_DAY(due_date) in the ON clause), then roll up by month — summing emi_amount after a 1-to-many join would double count.',
  sql: `WITH per_emi AS (
  SELECT s.loan_id, s.emi_no, s.due_date, s.emi_amount,
         COALESCE(SUM(r.amount_paid), 0) AS collected
  FROM emi_schedule s
  LEFT JOIN repayments r
         ON r.loan_id = s.loan_id AND r.emi_no = s.emi_no
        AND r.paid_date <= LAST_DAY(s.due_date)
  WHERE s.due_date >= '2024-01-01' AND s.due_date < '2025-01-01'
  GROUP BY s.loan_id, s.emi_no, s.due_date, s.emi_amount
)
SELECT DATE_FORMAT(due_date, '%Y-%m') AS due_month,
       ROUND(SUM(emi_amount), 2) AS amount_due,
       ROUND(SUM(collected), 2)  AS collected_in_month,
       ROUND(100.0 * SUM(collected) / SUM(emi_amount), 2) AS efficiency_pct
FROM per_emi
GROUP BY due_month
ORDER BY due_month;`,
  sql_explain: `<p>Two-level aggregation protects against fan-out: an EMI paid in two parts would add its <code>emi_amount</code> twice to "amount due" in a single-level GROUP BY. <code>LAST_DAY()</code> gives the month-end cut-off.</p>`,
  py: `s = emi_schedule[emi_schedule.due_date.dt.year == 2024].copy()
s['cutoff'] = s.due_date + pd.offsets.MonthEnd(0)
r = repayments.merge(s[['loan_id', 'emi_no', 'cutoff']], on=['loan_id', 'emi_no'])
r = r[r.paid_date <= r.cutoff].groupby(['loan_id', 'emi_no']).amount_paid.sum().rename('collected').reset_index()
s = s.merge(r, on=['loan_id', 'emi_no'], how='left').fillna({'collected': 0})
s['due_month'] = s.due_date.dt.strftime('%Y-%m')
result = s.groupby('due_month').agg(amount_due=('emi_amount', 'sum'), collected_in_month=('collected', 'sum')).reset_index()
result['efficiency_pct'] = 100 * result.collected_in_month / result.amount_due
result = result.round(2)`,
  py_explain: `<p><code>+ pd.offsets.MonthEnd(0)</code> rolls a date forward to its month-end (= LAST_DAY).</p>`
},
{
  id: 67, title: 'Ever-30+ delinquency by credit score band', difficulty: 'Hard', tier: 3, dataset: 'lending',
  topics: ['Risk metrics', 'CASE', 'EXISTS', 'Business case'], companies: ['Navi', 'CRED', 'Experian', 'TransUnion CIBIL', 'Slice'], ordered: true,
  prompt: `<p>A loan is <b>ever 30+</b> if any of its EMIs whose <code>due_date + 30 days ≤ 2024-12-31</code> was not fully paid within 30 days of its due date.</p>
<p>Band borrowers by <code>credit_score</code>: <code>'&lt;650'</code>, <code>'650-699'</code>, <code>'700-749'</code>, <code>'750+'</code>. Return <code>score_band</code>, <code>loans</code>, <code>ever30_loans</code>, <code>ever30_rate_pct</code> (2 dp), sorted from lowest band to highest.</p>`,
  hint: 'Per EMI sum of payments within 30 days → per loan MAX(flag) → join borrowers → band.',
  sql: `WITH emi30 AS (
  SELECT s.loan_id,
         CASE WHEN COALESCE(SUM(r.amount_paid), 0) < s.emi_amount THEN 1 ELSE 0 END AS miss30
  FROM emi_schedule s
  LEFT JOIN repayments r
         ON r.loan_id = s.loan_id AND r.emi_no = s.emi_no
        AND r.paid_date <= DATE_ADD(s.due_date, INTERVAL 30 DAY)
  WHERE DATE_ADD(s.due_date, INTERVAL 30 DAY) <= '2024-12-31'
  GROUP BY s.loan_id, s.emi_no, s.emi_amount
), loan_flag AS (
  SELECT loan_id, MAX(miss30) AS ever30 FROM emi30 GROUP BY loan_id
)
SELECT CASE WHEN b.credit_score < 650 THEN '<650'
            WHEN b.credit_score < 700 THEN '650-699'
            WHEN b.credit_score < 750 THEN '700-749'
            ELSE '750+' END AS score_band,
       COUNT(*) AS loans,
       SUM(f.ever30) AS ever30_loans,
       ROUND(100.0 * SUM(f.ever30) / COUNT(*), 2) AS ever30_rate_pct
FROM loan_flag f
JOIN loans l     ON l.loan_id = f.loan_id
JOIN borrowers b ON b.borrower_id = l.borrower_id
GROUP BY score_band
ORDER BY MIN(b.credit_score);`,
  sql_explain: `<p>"Ever" metrics = <code>MAX(flag)</code> over the loan's history. The result should show a clear monotonic decline in bad rate as the score improves — that's how you validate a scorecard's <i>rank ordering</i>. Ordering by <code>MIN(credit_score)</code> sorts bands numerically without a helper column.</p>`,
  py: `s = emi_schedule[emi_schedule.due_date + pd.Timedelta(days=30) <= '2024-12-31']
r = repayments.merge(s[['loan_id', 'emi_no', 'due_date']], on=['loan_id', 'emi_no'])
r = r[r.paid_date <= r.due_date + pd.Timedelta(days=30)].groupby(['loan_id', 'emi_no']).amount_paid.sum().rename('p').reset_index()
s = s.merge(r, on=['loan_id', 'emi_no'], how='left').fillna({'p': 0})
s['miss30'] = (s.p < s.emi_amount).astype(int)
f = s.groupby('loan_id').miss30.max().rename('ever30').reset_index().merge(loans[['loan_id', 'borrower_id']], on='loan_id').merge(borrowers, on='borrower_id')
f['score_band'] = pd.cut(f.credit_score, bins=[0, 649, 699, 749, 10000], labels=['<650', '650-699', '700-749', '750+'])
result = f.groupby('score_band', observed=True).agg(loans=('loan_id', 'count'), ever30_loans=('ever30', 'sum')).reset_index()
result['score_band'] = result.score_band.astype(str)
result['ever30_rate_pct'] = (100 * result.ever30_loans / result.loans).round(2)`,
  py_explain: `<p><code>groupby().max()</code> on a 0/1 flag = "ever". <code>pd.cut</code> keeps bands in order.</p>`
},
{
  id: 68, title: 'Multi-loan borrowers and their EMI burden (FOIR)', difficulty: 'Medium', tier: 1, dataset: 'lending',
  topics: ['Aggregation', 'HAVING', 'Business case'], companies: ['Navi', 'Bajaj Finserv', 'HDFC Bank', 'Axis Bank'], ordered: true,
  prompt: `<p>FOIR (Fixed Obligation to Income Ratio) = total monthly EMI of a borrower's <b>Active</b> loans ÷ monthly_income × 100.</p>
<p>Return borrowers with <b>2 or more Active</b> loans: <code>borrower_id</code>, <code>active_loans</code>, <code>total_emi</code>, <code>monthly_income</code>, <code>foir_pct</code> (2 dp). Sort by foir_pct desc.</p>`,
  hint: 'GROUP BY borrower, HAVING COUNT(*) >= 2.',
  sql: `SELECT b.borrower_id,
       COUNT(*)          AS active_loans,
       SUM(l.emi_amount) AS total_emi,
       b.monthly_income,
       ROUND(100.0 * SUM(l.emi_amount) / b.monthly_income, 2) AS foir_pct
FROM loans l
JOIN borrowers b ON b.borrower_id = l.borrower_id
WHERE l.loan_status = 'Active'
GROUP BY b.borrower_id, b.monthly_income
HAVING COUNT(*) >= 2
ORDER BY foir_pct DESC;`,
  sql_explain: `<p>Underwriters typically cap FOIR at 50–60%. Grouping by <code>monthly_income</code> too keeps the query valid under <code>ONLY_FULL_GROUP_BY</code> (MySQL's default) — selecting a non-aggregated column not in GROUP BY is an error in MySQL 8 unless it's functionally dependent on the key.</p>`,
  py: `l = loans[loans.loan_status == 'Active'].merge(borrowers[['borrower_id', 'monthly_income']], on='borrower_id')
g = l.groupby(['borrower_id', 'monthly_income']).agg(active_loans=('loan_id', 'count'), total_emi=('emi_amount', 'sum')).reset_index()
g = g[g.active_loans >= 2]
g['foir_pct'] = (100 * g.total_emi / g.monthly_income).round(2)
result = g[['borrower_id', 'active_loans', 'total_emi', 'monthly_income', 'foir_pct']].sort_values('foir_pct', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Plain groupby + threshold.</p>`
}
);
