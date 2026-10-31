/* Section 7 — Fintech: payments gateway (Razorpay / PhonePe / Paytm style) */
window.QUESTIONS.push(
{
  id: 52, title: 'Detect sudden drops in payment success rate', difficulty: 'Hard', tier: 3, dataset: 'payments',
  topics: ['Moving average', 'Window frame', 'Anomaly detection', 'Business case'], companies: ['Razorpay', 'PhonePe', 'Paytm', 'Juspay', 'Cashfree'], ordered: true,
  prompt: `<p>Ops wants an alert when a payment method's daily success rate suddenly drops. Success rate = success attempts / all attempts × 100 (pending counts as not successful).</p>
<p>For each <code>method</code> and day, compare the day's success rate with the <b>average of the previous 7 days' success rates</b> (excluding the day itself). Flag days where the rate is more than <b>15 percentage points</b> below that trailing average and the day has at least <b>15 attempts</b>.</p>
<p>Return <code>method</code>, <code>pay_date</code>, <code>attempts</code>, <code>success_rate_pct</code>, <code>trailing_7d_avg_pct</code>, <code>drop_pp</code> (all 2 dp). Sort by pay_date, method.</p>`,
  hint: 'Daily rate per method in a CTE. AVG(rate) OVER (PARTITION BY method ORDER BY day ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING).',
  sql: `WITH daily AS (
  SELECT method, DATE(created_at) AS pay_date,
         COUNT(*) AS attempts,
         100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*) AS sr
  FROM payments
  GROUP BY method, DATE(created_at)
), trailing AS (
  SELECT *,
         AVG(sr) OVER (PARTITION BY method ORDER BY pay_date
                       ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS trailing_avg
  FROM daily
)
SELECT method, pay_date, attempts,
       ROUND(sr, 2)                AS success_rate_pct,
       ROUND(trailing_avg, 2)      AS trailing_7d_avg_pct,
       ROUND(trailing_avg - sr, 2) AS drop_pp
FROM trailing
WHERE trailing_avg - sr > 15
  AND attempts >= 15
ORDER BY pay_date, method;`,
  sql_explain: `<p>This is the SQL behind "How would you identify a sudden decline in transaction success rates?" (asked in Razorpay BA rounds).</p>
<ul><li>A frame of <code>7 PRECEDING AND 1 PRECEDING</code> excludes today so the anomaly doesn't dilute its own baseline.</li>
<li>The minimum-volume rule avoids alerting on tiny samples — mention statistical noise (a 2-σ band using <code>STDDEV</code> over the same frame is the next step).</li>
<li>The first days of the series have fewer than 7 prior days; AVG over a partial frame still works.</li></ul>`,
  py: `p = payments.assign(pay_date=payments.created_at.dt.normalize(), ok=(payments.status == 'success').astype(int))
d = p.groupby(['method', 'pay_date']).agg(attempts=('ok', 'size'), s=('ok', 'sum')).reset_index().sort_values(['method', 'pay_date'])
d['sr'] = 100 * d.s / d.attempts
d['trailing_avg'] = d.groupby('method').sr.transform(lambda x: x.shift(1).rolling(7, min_periods=1).mean())
d['drop_pp'] = d.trailing_avg - d.sr
f = d[(d.drop_pp > 15) & (d.attempts >= 15)]
result = pd.DataFrame({'method': f.method, 'pay_date': f.pay_date, 'attempts': f.attempts, 'success_rate_pct': f.sr.round(2),
                       'trailing_7d_avg_pct': f.trailing_avg.round(2), 'drop_pp': f.drop_pp.round(2)}).sort_values(['pay_date', 'method']).reset_index(drop=True)`,
  py_explain: `<p><code>shift(1).rolling(7)</code> = window of the 7 rows before the current one (excluding it).</p>`
},
{
  id: 53, title: 'Root-cause the 12-Dec UPI incident by bank', difficulty: 'Medium', tier: 2, dataset: 'payments',
  topics: ['Conditional aggregation', 'RCA', 'Business case'], companies: ['Razorpay', 'PhonePe', 'Google Pay', 'Juspay'], ordered: true,
  prompt: `<p>UPI success rate crashed on <b>2024-12-12</b>. For UPI attempts only, compare each bank's success rate on that day with its pooled success rate over the previous 7 days (Dec 5 – Dec 11).</p>
<p>Return <code>bank</code>, <code>attempts_today</code>, <code>sr_today</code>, <code>sr_prev_7d</code>, <code>delta_pp</code> (today − previous, 2 dp). Sort by <code>delta_pp</code> ascending (worst first).</p>`,
  hint: 'One scan over Dec 5–12 with conditional sums for "today" and "baseline".',
  sql: `SELECT bank,
       SUM(CASE WHEN DATE(created_at) = '2024-12-12' THEN 1 ELSE 0 END) AS attempts_today,
       ROUND(100.0 * SUM(CASE WHEN DATE(created_at) = '2024-12-12' AND status = 'success' THEN 1 ELSE 0 END)
                   / SUM(CASE WHEN DATE(created_at) = '2024-12-12' THEN 1 ELSE 0 END), 2) AS sr_today,
       ROUND(100.0 * SUM(CASE WHEN DATE(created_at) < '2024-12-12' AND status = 'success' THEN 1 ELSE 0 END)
                   / SUM(CASE WHEN DATE(created_at) < '2024-12-12' THEN 1 ELSE 0 END), 2) AS sr_prev_7d,
       ROUND(100.0 * SUM(CASE WHEN DATE(created_at) = '2024-12-12' AND status = 'success' THEN 1 ELSE 0 END)
                   / SUM(CASE WHEN DATE(created_at) = '2024-12-12' THEN 1 ELSE 0 END)
           - 100.0 * SUM(CASE WHEN DATE(created_at) < '2024-12-12' AND status = 'success' THEN 1 ELSE 0 END)
                   / SUM(CASE WHEN DATE(created_at) < '2024-12-12' THEN 1 ELSE 0 END), 2) AS delta_pp
FROM payments
WHERE method = 'UPI'
  AND created_at >= '2024-12-05' AND created_at < '2024-12-13'
GROUP BY bank
ORDER BY delta_pp;`,
  sql_explain: `<p>RCA pattern: slice the metric by every dimension (bank, merchant category, failure_reason, hour) and compare against a baseline window. Pooled baseline (total successes / total attempts) is more stable than averaging daily rates. You should find two issuer banks with a huge drop and <code>bank_timeout</code> as the failure reason — an issuer-side outage, not a gateway bug.</p>`,
  py: `u = payments[(payments.method == 'UPI') & (payments.created_at >= '2024-12-05') & (payments.created_at < '2024-12-13')].copy()
u['today'] = u.created_at.dt.normalize() == pd.Timestamp('2024-12-12')
u['ok'] = (u.status == 'success').astype(int)
t = u[u.today].groupby('bank').agg(attempts_today=('ok', 'size'), sr_today=('ok', 'mean'))
b = u[~u.today].groupby('bank').agg(sr_prev_7d=('ok', 'mean'))
r = t.join(b).reset_index()
r['sr_today'] = 100 * r.sr_today
r['sr_prev_7d'] = 100 * r.sr_prev_7d
r['delta_pp'] = r.sr_today - r.sr_prev_7d
result = r.round(2).sort_values('delta_pp').reset_index(drop=True)`,
  py_explain: `<p>Mean of a 0/1 column = success rate. Split today vs baseline, aggregate each, join on bank.</p>`
},
{
  id: 54, title: 'Retry recovery: failed payments saved by a retry', difficulty: 'Hard', tier: 3, dataset: 'payments',
  topics: ['Self join', 'Range join', 'EXISTS', 'Business case'], companies: ['Razorpay', 'Juspay', 'Stripe', 'PhonePe'], ordered: true,
  prompt: `<p>A failed attempt is <b>recovered</b> if the same customer pays the same merchant the same amount <b>successfully</b> within <b>15 minutes after</b> the failure (any method).</p>
<p>Per method of the <i>failed</i> attempt return <code>method</code>, <code>failed_attempts</code>, <code>recovered</code>, <code>recovery_rate_pct</code> (2 dp). Sort by failed_attempts desc.</p>`,
  hint: 'EXISTS with a time window: p2.created_at > p.created_at AND p2.created_at <= p.created_at + INTERVAL 15 MINUTE.',
  sql: `SELECT p.method,
       COUNT(*) AS failed_attempts,
       SUM(CASE WHEN EXISTS (
             SELECT 1 FROM payments p2
             WHERE p2.customer_id = p.customer_id
               AND p2.merchant_id = p.merchant_id
               AND p2.amount      = p.amount
               AND p2.status      = 'success'
               AND p2.created_at  > p.created_at
               AND p2.created_at <= DATE_ADD(p.created_at, INTERVAL 15 MINUTE)
           ) THEN 1 ELSE 0 END) AS recovered,
       ROUND(100.0 * SUM(CASE WHEN EXISTS (
             SELECT 1 FROM payments p2
             WHERE p2.customer_id = p.customer_id AND p2.merchant_id = p.merchant_id
               AND p2.amount = p.amount AND p2.status = 'success'
               AND p2.created_at > p.created_at
               AND p2.created_at <= DATE_ADD(p.created_at, INTERVAL 15 MINUTE)
           ) THEN 1 ELSE 0 END) / COUNT(*), 2) AS recovery_rate_pct
FROM payments p
WHERE p.status = 'failed'
GROUP BY p.method
ORDER BY failed_attempts DESC;`,
  sql_explain: `<p>A <b>time-bounded self join</b>. Using <code>EXISTS</code> (instead of a JOIN) guarantees a failure is counted once even if two successful retries follow it. In an interview you'd put the EXISTS flag in a CTE once and aggregate it — written inline twice here to keep it one statement.</p>
<p>Business angle: high recovery for a method means the failure was transient (timeouts); low recovery means real drop-off — that's where to invest (e.g., smart retries / routing).</p>`,
  py: `f = payments[payments.status == 'failed'][['payment_id', 'customer_id', 'merchant_id', 'amount', 'method', 'created_at']]
s = payments[payments.status == 'success'][['customer_id', 'merchant_id', 'amount', 'created_at']].rename(columns={'created_at': 't2'})
m = f.merge(s, on=['customer_id', 'merchant_id', 'amount'])
m = m[(m.t2 > m.created_at) & (m.t2 <= m.created_at + pd.Timedelta(minutes=15))]
f = f.assign(rec=f.payment_id.isin(m.payment_id).astype(int))
result = f.groupby('method').agg(failed_attempts=('rec', 'size'), recovered=('rec', 'sum')).reset_index()
result['recovery_rate_pct'] = (100 * result.recovered / result.failed_attempts).round(2)
result = result.sort_values('failed_attempts', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Equi-merge on the keys, then filter the time window (pandas has no non-equi join; for huge data use <code>pd.merge_asof</code> with <code>tolerance</code>). <code>isin</code> on the failed ids = EXISTS.</p>`
},
{
  id: 55, title: 'Merchant refund rate (avoid join fan-out)', difficulty: 'Medium', tier: 2, dataset: 'payments',
  topics: ['Join fan-out', 'CTE', 'Aggregation'], companies: ['Razorpay', 'Paytm', 'Cashfree', 'PayU'], ordered: true,
  prompt: `<p>Per merchant: <code>captured</code> = Σ amount of successful payments; <code>refunded</code> = Σ refund_amount of <b>processed</b> refunds; <code>refund_rate_pct</code> = refunded / captured × 100.</p>
<p>Return merchants with refund_rate_pct &gt; 8: <code>merchant_id</code>, <code>merchant_name</code>, <code>category</code>, <code>captured</code>, <code>refunded</code>, <code>refund_rate_pct</code> (2 dp). Sort by refund_rate_pct desc.</p>`,
  hint: 'Aggregate payments and refunds in SEPARATE CTEs, then join on merchant_id. Joining payments→refunds first and summing amount double counts.',
  sql: `WITH cap AS (
  SELECT merchant_id, SUM(amount) AS captured
  FROM payments
  WHERE status = 'success'
  GROUP BY merchant_id
), ref AS (
  SELECT p.merchant_id, SUM(r.refund_amount) AS refunded
  FROM refunds r
  JOIN payments p ON p.payment_id = r.payment_id
  WHERE r.refund_status = 'processed'
  GROUP BY p.merchant_id
)
SELECT m.merchant_id, m.merchant_name, m.category,
       ROUND(c.captured, 2) AS captured,
       ROUND(COALESCE(r.refunded, 0), 2) AS refunded,
       ROUND(100.0 * COALESCE(r.refunded, 0) / c.captured, 2) AS refund_rate_pct
FROM merchants m
JOIN cap c      ON c.merchant_id = m.merchant_id
LEFT JOIN ref r ON r.merchant_id = m.merchant_id
WHERE 100.0 * COALESCE(r.refunded, 0) / c.captured > 8
ORDER BY refund_rate_pct DESC;`,
  sql_explain: `<p><b>Fan-out trap:</b> <code>payments LEFT JOIN refunds</code> then <code>SUM(p.amount)</code> counts a payment twice if it has two refunds. Rule: aggregate each fact table to the target grain <i>before</i> joining them.</p>`,
  py: `cap = payments[payments.status == 'success'].groupby('merchant_id').amount.sum().rename('captured')
r = refunds[refunds.refund_status == 'processed'].merge(payments[['payment_id', 'merchant_id']], on='payment_id')
ref = r.groupby('merchant_id').refund_amount.sum().rename('refunded')
m = merchants.join(cap, on='merchant_id', how='inner').join(ref, on='merchant_id')
m['refunded'] = m.refunded.fillna(0)
m['refund_rate_pct'] = 100 * m.refunded / m.captured
m = m[m.refund_rate_pct > 8]
result = (m[['merchant_id', 'merchant_name', 'category', 'captured', 'refunded', 'refund_rate_pct']]
          .round(2).sort_values('refund_rate_pct', ascending=False).reset_index(drop=True))`,
  py_explain: `<p>Two independent aggregations joined on the merchant key — no fan-out possible.</p>`
},
{
  id: 56, title: 'Settlement reconciliation (T+2)', difficulty: 'Hard', tier: 3, dataset: 'payments',
  topics: ['Reconciliation', 'LEFT JOIN', 'Business case', 'Data quality'], companies: ['Razorpay', 'Cashfree', 'PayU', 'Paytm', 'Stripe'], ordered: true,
  prompt: `<p>Finance must reconcile December payouts. Expected gross per (merchant, payment_date) = Σ amount of that day's successful payments. Settlements are in <code>settlements</code> keyed by <code>(merchant_id, payment_date)</code>.</p>
<p>List every expected (merchant, day) from <b>December 2024</b> that is either <b>missing</b> in settlements or whose <code>gross_amount</code> differs by more than ₹0.01.</p>
<p>Return <code>merchant_id</code>, <code>payment_date</code>, <code>expected_gross</code>, <code>settled_gross</code> (NULL if missing), <code>difference</code> (expected − settled, NULL if missing), <code>issue</code> ('MISSING_SETTLEMENT' or 'AMOUNT_MISMATCH'). All money 2 dp. Sort by payment_date, merchant_id.</p>`,
  hint: 'Expected CTE → LEFT JOIN settlements → CASE for the issue type. Compare with ABS(diff) > 0.01, never exact float equality.',
  sql: `WITH expected AS (
  SELECT merchant_id, DATE(created_at) AS payment_date, ROUND(SUM(amount), 2) AS expected_gross
  FROM payments
  WHERE status = 'success'
    AND created_at >= '2024-12-01' AND created_at < '2025-01-01'
  GROUP BY merchant_id, DATE(created_at)
)
SELECT e.merchant_id, e.payment_date, e.expected_gross,
       s.gross_amount AS settled_gross,
       ROUND(e.expected_gross - s.gross_amount, 2) AS difference,
       CASE WHEN s.settlement_id IS NULL THEN 'MISSING_SETTLEMENT' ELSE 'AMOUNT_MISMATCH' END AS issue
FROM expected e
LEFT JOIN settlements s ON s.merchant_id = e.merchant_id AND s.payment_date = e.payment_date
WHERE s.settlement_id IS NULL
   OR ABS(e.expected_gross - s.gross_amount) > 0.01
ORDER BY e.payment_date, e.merchant_id;`,
  sql_explain: `<p>Reconciliation = <b>outer join + classify</b>. The LEFT JOIN keeps unmatched expected rows (missing settlements); the ABS tolerance catches amount breaks without being fooled by floating-point noise. A full recon also checks the reverse direction (settlements with no payments) — that'd be a FULL OUTER JOIN (emulated in MySQL with LEFT JOIN UNION RIGHT JOIN).</p>`,
  py: `p = payments[(payments.status == 'success') & (payments.created_at >= '2024-12-01') & (payments.created_at < '2025-01-01')].copy()
p['payment_date'] = p.created_at.dt.normalize()
e = p.groupby(['merchant_id', 'payment_date']).amount.sum().round(2).rename('expected_gross').reset_index()
m = e.merge(settlements[['merchant_id', 'payment_date', 'gross_amount', 'settlement_id']], on=['merchant_id', 'payment_date'], how='left')
m['difference'] = (m.expected_gross - m.gross_amount).round(2)
m = m[m.settlement_id.isna() | (m.difference.abs() > 0.01)]
m['issue'] = np.where(m.settlement_id.isna(), 'MISSING_SETTLEMENT', 'AMOUNT_MISMATCH')
result = (m.rename(columns={'gross_amount': 'settled_gross'})
          [['merchant_id', 'payment_date', 'expected_gross', 'settled_gross', 'difference', 'issue']]
          .sort_values(['payment_date', 'merchant_id']).reset_index(drop=True))`,
  py_explain: `<p><code>merge(how='left')</code> + NaN check = LEFT JOIN … IS NULL. Use <code>indicator=True</code> for both-direction recons.</p>`
},
{
  id: 57, title: 'Merchants that went dormant in December', difficulty: 'Medium', tier: 1, dataset: 'payments',
  topics: ['Anti join', 'HAVING', 'Churn'], companies: ['Razorpay', 'Paytm', 'PhonePe', 'Instamojo'], ordered: true,
  prompt: `<p>Account managers need merchants that had successful payments in October–November 2024 but <b>none in December</b>.</p>
<p>Return <code>merchant_id</code>, <code>merchant_name</code>, <code>last_success_at</code>, <code>oct_nov_gmv</code> (2 dp). Sort by oct_nov_gmv desc.</p>`,
  hint: 'GROUP BY merchant with HAVING MAX(created_at) < Dec 1 — or conditional sums.',
  sql: `SELECT m.merchant_id, m.merchant_name,
       MAX(p.created_at)     AS last_success_at,
       ROUND(SUM(p.amount), 2) AS oct_nov_gmv
FROM payments p
JOIN merchants m ON m.merchant_id = p.merchant_id
WHERE p.status = 'success'
GROUP BY m.merchant_id, m.merchant_name
HAVING MAX(p.created_at) < '2024-12-01'
ORDER BY oct_nov_gmv DESC;`,
  sql_explain: `<p>Since the data starts in October, "active Oct–Nov, silent in Dec" = "last success before Dec 1". HAVING on <code>MAX</code> expresses it without a second scan. With a longer history you'd add <code>SUM(CASE WHEN created_at &gt;= '2024-10-01' …) &gt; 0</code>.</p>`,
  py: `s = payments[payments.status == 'success']
g = s.groupby('merchant_id').agg(last_success_at=('created_at', 'max'), oct_nov_gmv=('amount', 'sum')).reset_index()
g = g[g.last_success_at < '2024-12-01'].merge(merchants[['merchant_id', 'merchant_name']], on='merchant_id')
g['oct_nov_gmv'] = g.oct_nov_gmv.round(2)
result = g[['merchant_id', 'merchant_name', 'last_success_at', 'oct_nov_gmv']].sort_values('oct_nov_gmv', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Aggregate then filter on the max timestamp.</p>`
},
{
  id: 58, title: 'Top failure reason per payment method', difficulty: 'Medium', tier: 1, dataset: 'payments',
  topics: ['Window ranking', 'Window aggregate'], companies: ['Razorpay', 'PhonePe', 'Juspay', 'Pine Labs'], ordered: true,
  prompt: `<p>For failed payments only: per method, return its single most common <code>failure_reason</code> and that reason's share of the method's failures.</p>
<p>Return <code>method</code>, <code>failure_reason</code>, <code>failures</code>, <code>share_pct</code> (2 dp). Sort by method.</p>`,
  hint: 'Group by method, reason → ROW_NUMBER over method by count desc; share uses SUM(COUNT(*)) OVER (PARTITION BY method).',
  sql: `WITH r AS (
  SELECT method, failure_reason, COUNT(*) AS failures,
         100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY method) AS share,
         ROW_NUMBER() OVER (PARTITION BY method ORDER BY COUNT(*) DESC, failure_reason) AS rn
  FROM payments
  WHERE status = 'failed'
  GROUP BY method, failure_reason
)
SELECT method, failure_reason, failures, ROUND(share, 2) AS share_pct
FROM r
WHERE rn = 1
ORDER BY method;`,
  sql_explain: `<p>Windows over aggregates: after GROUP BY each row is (method, reason, count); <code>SUM(COUNT(*)) OVER (PARTITION BY method)</code> totals the counts per method, and ROW_NUMBER picks the mode.</p>`,
  py: `f = payments[payments.status == 'failed'].groupby(['method', 'failure_reason']).size().reset_index(name='failures')
f['share_pct'] = (100 * f.failures / f.groupby('method').failures.transform('sum')).round(2)
result = (f.sort_values(['method', 'failures', 'failure_reason'], ascending=[True, False, True])
          .drop_duplicates('method').reset_index(drop=True))`,
  py_explain: `<p>Count, share via <code>transform('sum')</code>, then argmax per method with sort + drop_duplicates.</p>`
},
{
  id: 59, title: 'Fraud signal: one card, many merchants, one day', difficulty: 'Medium', tier: 2, dataset: 'payments',
  topics: ['HAVING', 'COUNT DISTINCT', 'Fraud', 'Date functions'], companies: ['Razorpay', 'Paytm', 'American Express', 'Mastercard', 'Visa'], ordered: true,
  prompt: `<p>Risk wants customers who made <b>successful</b> payments at <b>3 or more distinct merchants on the same calendar day</b>.</p>
<p>Return <code>customer_id</code>, <code>pay_date</code>, <code>merchants</code>, <code>payments</code>, <code>total_amount</code> (2 dp), <code>minutes_span</code> (minutes between the first and last successful payment that day). Sort by pay_date, customer_id.</p>`,
  hint: 'GROUP BY customer, DATE(created_at) HAVING COUNT(DISTINCT merchant_id) >= 3; TIMESTAMPDIFF(MINUTE, MIN, MAX).',
  sql: `SELECT customer_id,
       DATE(created_at)                 AS pay_date,
       COUNT(DISTINCT merchant_id)      AS merchants,
       COUNT(*)                         AS payments,
       ROUND(SUM(amount), 2)            AS total_amount,
       TIMESTAMPDIFF(MINUTE, MIN(created_at), MAX(created_at)) AS minutes_span
FROM payments
WHERE status = 'success'
GROUP BY customer_id, DATE(created_at)
HAVING COUNT(DISTINCT merchant_id) >= 3
ORDER BY pay_date, customer_id;`,
  sql_explain: `<p>Velocity checks are bread-and-butter fraud SQL. Look at the output: some customers hit 4–5 merchants within ~30 minutes at 2–4 AM with high-value card payments — classic card-testing. A sliding 60-minute window version needs a self join / RANGE window instead of calendar-day grouping (good follow-up to discuss).</p>`,
  py: `s = payments[payments.status == 'success'].assign(pay_date=lambda d: d.created_at.dt.normalize())
g = s.groupby(['customer_id', 'pay_date']).agg(merchants=('merchant_id', 'nunique'), payments=('payment_id', 'count'),
                                              total_amount=('amount', 'sum'), t0=('created_at', 'min'), t1=('created_at', 'max')).reset_index()
g = g[g.merchants >= 3]
g['minutes_span'] = ((g.t1 - g.t0).dt.total_seconds() // 60).astype(int)
g['total_amount'] = g.total_amount.round(2)
result = g[['customer_id', 'pay_date', 'merchants', 'payments', 'total_amount', 'minutes_span']].sort_values(['pay_date', 'customer_id']).reset_index(drop=True)`,
  py_explain: `<p>Group by customer + normalised date; <code>nunique</code> for distinct merchants.</p>`
},
{
  id: 60, title: 'Hour-of-day × method GMV pivot (December)', difficulty: 'Medium', tier: 1, dataset: 'payments',
  topics: ['Pivot', 'Conditional aggregation', 'Date functions'], companies: ['PhonePe', 'Paytm', 'Razorpay', 'BharatPe'], ordered: true,
  prompt: `<p>Build a heatmap table of successful payment GMV in December 2024 by hour of day (0–23) and method.</p>
<p>Return <code>hour</code>, <code>upi</code>, <code>card</code>, <code>netbanking</code>, <code>wallet</code>, <code>total</code> (2 dp, 0 when none). Only hours that have at least one successful payment. Sort by hour.</p>`,
  hint: 'HOUR(created_at) and SUM(CASE WHEN method = … THEN amount ELSE 0 END).',
  sql: `SELECT HOUR(created_at) AS hour,
       ROUND(SUM(CASE WHEN method = 'UPI'        THEN amount ELSE 0 END), 2) AS upi,
       ROUND(SUM(CASE WHEN method = 'Card'       THEN amount ELSE 0 END), 2) AS card,
       ROUND(SUM(CASE WHEN method = 'Netbanking' THEN amount ELSE 0 END), 2) AS netbanking,
       ROUND(SUM(CASE WHEN method = 'Wallet'     THEN amount ELSE 0 END), 2) AS wallet,
       ROUND(SUM(amount), 2) AS total
FROM payments
WHERE status = 'success'
  AND created_at >= '2024-12-01' AND created_at < '2025-01-01'
GROUP BY HOUR(created_at)
ORDER BY hour;`,
  sql_explain: `<p>Static pivot via CASE. For unknown/many categories MySQL needs dynamic SQL (build the column list with GROUP_CONCAT, then PREPARE/EXECUTE) — worth mentioning.</p>`,
  py: `s = payments[(payments.status == 'success') & (payments.created_at >= '2024-12-01') & (payments.created_at < '2025-01-01')]
p = s.pivot_table(index=s.created_at.dt.hour, columns='method', values='amount', aggfunc='sum', fill_value=0)
p = p.reindex(columns=['UPI', 'Card', 'Netbanking', 'Wallet'], fill_value=0)
p.columns = ['upi', 'card', 'netbanking', 'wallet']
p['total'] = p.sum(axis=1)
p.index.name = 'hour'
result = p.round(2).reset_index()`,
  py_explain: `<p><code>pivot_table</code> with an index Series (<code>dt.hour</code>) and <code>fill_value=0</code>; <code>reindex(columns=…)</code> fixes column order.</p>`
},
{
  id: 61, title: 'Merchants climbing the GMV ranking (Nov → Dec)', difficulty: 'Hard', tier: 2, dataset: 'payments',
  topics: ['Window ranking', 'Self join', 'Pivot'], companies: ['Razorpay', 'Amazon', 'Paytm', 'Swiggy'], ordered: true,
  prompt: `<p>Rank merchants <b>within their category</b> by successful GMV for November and for December 2024 (DENSE_RANK, 1 = highest).</p>
<p>Return merchants whose rank <b>improved by 2 or more places</b>: <code>category</code>, <code>merchant_id</code>, <code>merchant_name</code>, <code>nov_rank</code>, <code>dec_rank</code>, <code>rank_change</code> (= nov_rank − dec_rank). Sort by rank_change desc, then merchant_id.</p>`,
  hint: 'Monthly GMV → DENSE_RANK per (category, month) → pivot the two months with MAX(CASE …) or self join.',
  sql: `WITH gmv AS (
  SELECT m.category, m.merchant_id, m.merchant_name,
         DATE_FORMAT(p.created_at, '%Y-%m') AS month,
         SUM(p.amount) AS gmv
  FROM payments p
  JOIN merchants m ON m.merchant_id = p.merchant_id
  WHERE p.status = 'success' AND p.created_at >= '2024-11-01'
  GROUP BY m.category, m.merchant_id, m.merchant_name, month
), ranked AS (
  SELECT *, DENSE_RANK() OVER (PARTITION BY category, month ORDER BY gmv DESC) AS rnk
  FROM gmv
), pivoted AS (
  SELECT category, merchant_id, merchant_name,
         MAX(CASE WHEN month = '2024-11' THEN rnk END) AS nov_rank,
         MAX(CASE WHEN month = '2024-12' THEN rnk END) AS dec_rank
  FROM ranked
  GROUP BY category, merchant_id, merchant_name
)
SELECT category, merchant_id, merchant_name, nov_rank, dec_rank, nov_rank - dec_rank AS rank_change
FROM pivoted
WHERE nov_rank - dec_rank >= 2
ORDER BY rank_change DESC, merchant_id;`,
  sql_explain: `<p>Rank inside each (category, month) partition, then reshape months into columns with <code>MAX(CASE …)</code> so the comparison is a simple subtraction. Merchants missing in one month get NULL and drop out of the WHERE automatically.</p>`,
  py: `s = payments[(payments.status == 'success') & (payments.created_at >= '2024-11-01')].merge(merchants, on='merchant_id')
s['month'] = s.created_at.dt.strftime('%Y-%m')
g = s.groupby(['category', 'merchant_id', 'merchant_name', 'month']).amount.sum().reset_index()
g['rnk'] = g.groupby(['category', 'month']).amount.rank(method='dense', ascending=False)
p = g.pivot_table(index=['category', 'merchant_id', 'merchant_name'], columns='month', values='rnk').reset_index()
p = p.rename(columns={'2024-11': 'nov_rank', '2024-12': 'dec_rank'}).dropna(subset=['nov_rank', 'dec_rank'])
p['rank_change'] = p.nov_rank - p.dec_rank
p = p[p.rank_change >= 2]
result = p[['category', 'merchant_id', 'merchant_name', 'nov_rank', 'dec_rank', 'rank_change']].astype({'nov_rank': int, 'dec_rank': int, 'rank_change': int})
result = result.sort_values(['rank_change', 'merchant_id'], ascending=[False, True]).reset_index(drop=True)
result.columns.name = None`,
  py_explain: `<p>Dense rank per (category, month), pivot months into columns, subtract.</p>`
}
);
