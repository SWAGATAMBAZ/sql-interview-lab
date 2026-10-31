/* Section 4 — Dates, cohorts, retention, churn */
window.QUESTIONS.push(
{
  id: 30, title: 'New vs repeat customers every month', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['First touch', 'Window functions', 'Conditional aggregation'], companies: ['Amazon', 'Meesho', 'Flipkart', 'Nykaa', 'Zomato'], ordered: true,
  prompt: `<p>Consider non-cancelled orders. For each month of 2024, a purchasing customer is <b>new</b> if that month contains their first-ever non-cancelled order, otherwise <b>repeat</b>.</p>
<p>Return <code>month</code> (YYYY-MM), <code>new_customers</code>, <code>repeat_customers</code>, <code>repeat_share_pct</code> (repeat / all purchasing customers × 100, 2 dp). Sort by month.</p>`,
  hint: 'First-order month per customer from the FULL history (MIN over all years), then compare with each order month.',
  sql: `WITH first_month AS (
  SELECT customer_id, DATE_FORMAT(MIN(order_date), '%Y-%m') AS first_m
  FROM orders
  WHERE status <> 'Cancelled'
  GROUP BY customer_id
), active AS (
  SELECT DISTINCT customer_id, DATE_FORMAT(order_date, '%Y-%m') AS month
  FROM orders
  WHERE status <> 'Cancelled'
    AND order_date >= '2024-01-01' AND order_date < '2025-01-01'
)
SELECT a.month,
       SUM(CASE WHEN a.month = f.first_m THEN 1 ELSE 0 END)  AS new_customers,
       SUM(CASE WHEN a.month > f.first_m THEN 1 ELSE 0 END)  AS repeat_customers,
       ROUND(100.0 * SUM(CASE WHEN a.month > f.first_m THEN 1 ELSE 0 END) / COUNT(*), 2) AS repeat_share_pct
FROM active a
JOIN first_month f ON f.customer_id = a.customer_id
GROUP BY a.month
ORDER BY a.month;`,
  sql_explain: `<p>The classic Namaste-SQL / Amazon question. Key points:</p><ul><li>First-order date must come from the <b>whole history</b> — if you compute it only within 2024, a 2023 customer looks "new" in Jan 2024.</li>
<li><code>DISTINCT customer_id, month</code> so a customer with 3 orders in a month counts once.</li><li>Conditional SUM = pivot the two categories into columns in one pass.</li></ul>`,
  py: `o = orders[orders.status != 'Cancelled'].copy()
o['month'] = o.order_date.dt.strftime('%Y-%m')
first = o.groupby('customer_id').order_date.min().dt.strftime('%Y-%m').rename('first_m')
a = o[o.order_date.dt.year == 2024][['customer_id', 'month']].drop_duplicates().join(first, on='customer_id')
a['new'] = (a.month == a.first_m).astype(int)
a['rep'] = (a.month > a.first_m).astype(int)
result = a.groupby('month').agg(new_customers=('new', 'sum'), repeat_customers=('rep', 'sum'), n=('customer_id', 'count')).reset_index()
result['repeat_share_pct'] = (100 * result.repeat_customers / result.n).round(2)
result = result.drop(columns='n')`,
  py_explain: `<p><code>join(series, on=key)</code> maps the first month to every row (like a lookup). Boolean → int → sum = conditional count.</p>`
},
{
  id: 31, title: 'Monthly cohort retention table', difficulty: 'Hard', tier: 3, dataset: 'retail',
  topics: ['Cohort analysis', 'Retention', 'Conditional aggregation', 'Date functions'], companies: ['Amazon', 'Uber', 'Swiggy', 'CRED', 'Meta'], ordered: true,
  prompt: `<p>Cohort = month of a customer's first non-cancelled order. For cohorts <b>2024-01 through 2024-06</b>, compute the % of the cohort that placed a non-cancelled order in month +1, +2 and +3 after their cohort month.</p>
<p>Return <code>cohort_month</code>, <code>cohort_size</code>, <code>m1_pct</code>, <code>m2_pct</code>, <code>m3_pct</code> (2 dp). Sort by cohort_month.</p>`,
  hint: 'Month index = (year*12 + month) of the order − same for the cohort. COUNT(DISTINCT CASE WHEN month_index = 1 THEN customer_id END).',
  sql: `WITH o AS (
  SELECT customer_id, order_date FROM orders WHERE status <> 'Cancelled'
), cohort AS (
  SELECT customer_id, MIN(order_date) AS first_date FROM o GROUP BY customer_id
), activity AS (
  SELECT c.customer_id,
         DATE_FORMAT(c.first_date, '%Y-%m') AS cohort_month,
         (YEAR(o.order_date) * 12 + MONTH(o.order_date))
       - (YEAR(c.first_date) * 12 + MONTH(c.first_date)) AS month_index
  FROM cohort c
  JOIN o ON o.customer_id = c.customer_id
)
SELECT cohort_month,
       COUNT(DISTINCT customer_id) AS cohort_size,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN month_index = 1 THEN customer_id END) / COUNT(DISTINCT customer_id), 2) AS m1_pct,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN month_index = 2 THEN customer_id END) / COUNT(DISTINCT customer_id), 2) AS m2_pct,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN month_index = 3 THEN customer_id END) / COUNT(DISTINCT customer_id), 2) AS m3_pct
FROM activity
WHERE cohort_month BETWEEN '2024-01' AND '2024-06'
GROUP BY cohort_month
ORDER BY cohort_month;`,
  sql_explain: `<ol><li>Cohort date per customer = first order (full history).</li><li>For every order, <b>month_index</b> = months since cohort. <code>year*12+month</code> difference avoids day-of-month problems that <code>TIMESTAMPDIFF(MONTH, …)</code> has (Jan 31 → Feb 28 is 0 months for TIMESTAMPDIFF!).</li>
<li><code>COUNT(DISTINCT CASE WHEN month_index = k THEN customer_id END)</code> counts retained customers per offset; the ELSE NULL is ignored.</li></ol>
<p>Note: cohort_size includes everyone because month_index 0 rows exist for every customer.</p>`,
  py: `o = orders[orders.status != 'Cancelled'][['customer_id', 'order_date']]
first = o.groupby('customer_id').order_date.min().rename('first_date')
a = o.join(first, on='customer_id')
a['cohort_month'] = a.first_date.dt.strftime('%Y-%m')
a['idx'] = (a.order_date.dt.year * 12 + a.order_date.dt.month) - (a.first_date.dt.year * 12 + a.first_date.dt.month)
a = a[(a.cohort_month >= '2024-01') & (a.cohort_month <= '2024-06')]
size = a.groupby('cohort_month').customer_id.nunique().rename('cohort_size')
piv = a[a.idx.between(1, 3)].groupby(['cohort_month', 'idx']).customer_id.nunique().unstack(fill_value=0)
piv = piv.reindex(columns=[1, 2, 3], fill_value=0)
res = pd.concat([size, piv], axis=1).fillna(0)
for k in [1, 2, 3]:
    res['m%d_pct' % k] = (100 * res[k] / res.cohort_size).round(2)
result = res[['cohort_size', 'm1_pct', 'm2_pct', 'm3_pct']].reset_index().rename(columns={'index': 'cohort_month'})`,
  py_explain: `<p>Classic pandas cohort: compute an offset column, then <code>groupby([cohort, idx]).nunique().unstack()</code> to pivot offsets into columns and divide by cohort size.</p>`
},
{
  id: 32, title: 'D1 and D7 retention by signup week', difficulty: 'Hard', tier: 3, dataset: 'events',
  topics: ['Retention', 'Cohort analysis', 'Date functions'], companies: ['Amazon', 'Meta', 'Swiggy', 'Dream11', 'Uber'], ordered: true,
  prompt: `<p>A user is <b>D1-retained</b> if they logged any event exactly 1 day after their <code>signup_date</code>, and <b>D7-retained</b> if they logged any event exactly 7 days after.</p>
<p>Group users by signup week (week starting <b>Monday</b>). Return <code>week_start</code>, <code>signups</code>, <code>d1_pct</code>, <code>d7_pct</code> (2 dp). Only weeks starting on or after 2024-09-30 and on or before 2024-11-11. Sort by week_start.</p>`,
  hint: 'week_start = DATE_SUB(signup_date, INTERVAL WEEKDAY(signup_date) DAY). Build distinct (user, active_date) and use EXISTS-like LEFT JOINs or conditional MAX.',
  sql: `WITH active AS (
  SELECT DISTINCT user_id, DATE(event_time) AS d FROM events
), flags AS (
  SELECT u.user_id,
         DATE_SUB(u.signup_date, INTERVAL WEEKDAY(u.signup_date) DAY) AS week_start,
         MAX(CASE WHEN a.d = DATE_ADD(u.signup_date, INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS d1,
         MAX(CASE WHEN a.d = DATE_ADD(u.signup_date, INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS d7
  FROM app_users u
  LEFT JOIN active a ON a.user_id = u.user_id
  GROUP BY u.user_id, u.signup_date
)
SELECT week_start,
       COUNT(*)                        AS signups,
       ROUND(100.0 * SUM(d1) / COUNT(*), 2) AS d1_pct,
       ROUND(100.0 * SUM(d7) / COUNT(*), 2) AS d7_pct
FROM flags
WHERE week_start BETWEEN '2024-09-30' AND '2024-11-11'
GROUP BY week_start
ORDER BY week_start;`,
  sql_explain: `<p>Build a per-user row with 0/1 flags (<code>MAX(CASE…)</code> collapses many active days into a single flag), then average the flags per cohort. <code>WEEKDAY()</code> returns 0 for Monday, so subtracting it snaps any date to its Monday.</p>
<p>Definitions matter: "exactly day 7" vs "any day in days 1–7" (rolling retention) give very different numbers — always clarify in the interview.</p>`,
  py: `act = events.assign(d=events.event_time.dt.normalize())[['user_id', 'd']].drop_duplicates()
u = app_users.copy()
u['week_start'] = u.signup_date - pd.to_timedelta(u.signup_date.dt.weekday, unit='D')
def flag(k):
    t = act.merge(u[['user_id', 'signup_date']], on='user_id')
    hit = t[t.d == t.signup_date + pd.Timedelta(days=k)].user_id.unique()
    return u.user_id.isin(hit).astype(int)
u['d1'] = flag(1)
u['d7'] = flag(7)
u = u[(u.week_start >= '2024-09-30') & (u.week_start <= '2024-11-11')]
result = u.groupby('week_start').agg(signups=('user_id', 'count'), d1=('d1', 'mean'), d7=('d7', 'mean')).reset_index()
result['d1_pct'] = (100 * result.d1).round(2)
result['d7_pct'] = (100 * result.d7).round(2)
result = result[['week_start', 'signups', 'd1_pct', 'd7_pct']]`,
  py_explain: `<p><code>dt.weekday</code> is 0 for Monday — subtract it to get the week start. The mean of a 0/1 column is a rate.</p>`
},
{
  id: 33, title: 'DAU, MAU and stickiness (Nov 2024)', difficulty: 'Medium', tier: 1, dataset: 'events',
  topics: ['Aggregation', 'Product metrics', 'Subquery'], companies: ['Meta', 'Swiggy', 'Dream11', 'ShareChat', 'Google'], ordered: true,
  prompt: `<p>For November 2024 compute product health metrics in a single row:</p>
<ul><li><code>avg_dau</code> – average over the 30 days of daily distinct active users (2 dp)</li><li><code>mau</code> – distinct users active at least once in November</li><li><code>stickiness_pct</code> – avg_dau / mau × 100 (2 dp)</li><li><code>peak_dau_date</code> – date with the highest DAU (earliest if tied)</li></ul>`,
  hint: 'DAU per day in a CTE; then aggregate that CTE, and get the MAU with a scalar subquery.',
  sql: `WITH dau AS (
  SELECT DATE(event_time) AS d, COUNT(DISTINCT user_id) AS users
  FROM events
  WHERE event_time >= '2024-11-01' AND event_time < '2024-12-01'
  GROUP BY DATE(event_time)
), mau AS (
  SELECT COUNT(DISTINCT user_id) AS mau
  FROM events
  WHERE event_time >= '2024-11-01' AND event_time < '2024-12-01'
)
SELECT ROUND(AVG(dau.users), 2)                      AS avg_dau,
       mau.mau,
       ROUND(100.0 * AVG(dau.users) / mau.mau, 2)    AS stickiness_pct,
       (SELECT d FROM dau ORDER BY users DESC, d LIMIT 1) AS peak_dau_date
FROM dau CROSS JOIN mau
GROUP BY mau.mau;`,
  sql_explain: `<p>DAU/MAU ("stickiness") tells how many of the monthly users come back daily. You cannot get MAU by summing DAU (users repeat across days) — it needs its own <code>COUNT(DISTINCT)</code> over the month.</p>`,
  py: `e = events[(events.event_time >= '2024-11-01') & (events.event_time < '2024-12-01')]
dau = e.groupby(e.event_time.dt.normalize()).user_id.nunique()
mau = e.user_id.nunique()
peak = dau.sort_index().idxmax()
result = pd.DataFrame({'avg_dau': [round(dau.mean(), 2)], 'mau': [mau],
                       'stickiness_pct': [round(100 * dau.mean() / mau, 2)], 'peak_dau_date': [peak]})`,
  py_explain: `<p><code>idxmax()</code> on a sorted Series returns the first index holding the maximum (earliest date on ties).</p>`
},
{
  id: 34, title: 'Monthly Recurring Revenue (MRR) with a month spine', difficulty: 'Hard', tier: 3, dataset: 'subscriptions',
  topics: ['Recursive CTE', 'Date spine', 'SaaS metrics', 'Range join'], companies: ['Freshworks', 'Zoho', 'Netflix', 'Chargebee', 'Spotify'], ordered: true,
  prompt: `<p>MRR at the end of a month = sum of <code>monthly_price</code> of subscriptions active on the <b>last day</b> of that month. A row is active on day <i>d</i> when <code>start_date ≤ d</code> and (<code>end_date</code> is NULL or <code>end_date &gt; d</code>).</p>
<p>For every month of 2024 return <code>month</code> (YYYY-MM), <code>active_subscribers</code>, <code>mrr</code>. Months with no subscribers must still appear (with 0). Sort by month.</p>`,
  hint: 'Recursive CTE of month-end dates (LAST_DAY), then LEFT JOIN subscriptions with a range condition.',
  sql: `WITH RECURSIVE months AS (
  SELECT DATE('2024-01-31') AS month_end
  UNION ALL
  SELECT LAST_DAY(DATE_ADD(month_end, INTERVAL 1 MONTH)) FROM months WHERE month_end < '2024-12-31'
)
SELECT DATE_FORMAT(m.month_end, '%Y-%m')      AS month,
       COUNT(s.sub_id)                         AS active_subscribers,
       COALESCE(SUM(p.monthly_price), 0)       AS mrr
FROM months m
LEFT JOIN subscriptions s
       ON s.start_date <= m.month_end
      AND (s.end_date IS NULL OR s.end_date > m.month_end)
LEFT JOIN plans p ON p.plan_id = s.plan_id
GROUP BY m.month_end
ORDER BY month;`,
  sql_explain: `<p><b>Range (non-equi) join:</b> each month-end is matched with every subscription period covering it. The spine guarantees months with zero subscribers still show (LEFT JOIN + COUNT(col) + COALESCE).</p>
<p><code>LAST_DAY(DATE_ADD(d, INTERVAL 1 MONTH))</code> walks month-ends safely (Jan 31 + 1 month = Feb 29 in 2024).</p>
<p>Interview extension: split MRR movement into new / expansion / contraction / churned MRR.</p>`,
  py: `ends = pd.date_range('2024-02-01', '2025-01-01', freq='MS') - pd.Timedelta(days=1)   # month-ends
s = subscriptions.merge(plans, on='plan_id')
rows = []
for d in ends:
    act = s[(s.start_date <= d) & (s.end_date.isna() | (s.end_date > d))]
    rows.append({'month': d.strftime('%Y-%m'), 'active_subscribers': len(act), 'mrr': act.monthly_price.sum()})
result = pd.DataFrame(rows)`,
  py_explain: `<p>For small spines a loop over month-ends with a boolean range filter is clearest. For big data: cross-merge spine × subscriptions then filter (<code>how='cross'</code>), or an interval-tree approach. (Month-ends = month-starts minus one day, which works in every pandas version.)</p>`
},
{
  id: 35, title: 'Monthly subscriber churn rate', difficulty: 'Hard', tier: 3, dataset: 'subscriptions',
  topics: ['Churn', 'Range join', 'Recursive CTE', 'SaaS metrics'], companies: ['Netflix', 'Spotify', 'Zomato', 'Freshworks', 'Disney+ Hotstar'], ordered: true,
  prompt: `<p>A <b>user</b> (not a row — plan changes create new rows) is active on day <i>d</i> if any of their rows covers <i>d</i> (<code>start_date ≤ d &lt; end_date</code> or end_date NULL).</p>
<p>For each month from <b>2024-02 to 2024-11</b>: <code>start_users</code> = users active on the 1st of the month; <code>churned_users</code> = of those, users <b>not</b> active on the 1st of the next month. <code>churn_pct</code> = churned / start × 100 (2 dp).</p>
<p>Return <code>month</code>, <code>start_users</code>, <code>churned_users</code>, <code>churn_pct</code>. Sort by month.</p>`,
  hint: 'Month-start spine; set of (month, user) active on day 1; LEFT JOIN that set to itself on next month.',
  sql: `WITH RECURSIVE m AS (
  SELECT DATE('2024-02-01') AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 MONTH) FROM m WHERE d < '2024-12-01'
), active AS (
  SELECT DISTINCT m.d, s.user_id
  FROM m
  JOIN subscriptions s ON s.start_date <= m.d AND (s.end_date IS NULL OR s.end_date > m.d)
)
SELECT DATE_FORMAT(a.d, '%Y-%m') AS month,
       COUNT(*)                   AS start_users,
       SUM(CASE WHEN n.user_id IS NULL THEN 1 ELSE 0 END) AS churned_users,
       ROUND(100.0 * SUM(CASE WHEN n.user_id IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) AS churn_pct
FROM active a
LEFT JOIN active n ON n.user_id = a.user_id AND n.d = DATE_ADD(a.d, INTERVAL 1 MONTH)
WHERE a.d <= '2024-11-01'
GROUP BY a.d
ORDER BY month;`,
  sql_explain: `<p>Churn must be measured at the <b>user</b> grain: an upgrade ends one row and starts another on the same date — counting rows would treat every plan change as churn. <code>DISTINCT user_id</code> on the "active on day 1" set solves it.</p>
<p>The self LEFT JOIN asks "is this user still in next month's active set?"; NULL means churned. The spine runs one month past the last reported month so November can look at Dec 1.</p>`,
  py: `starts = pd.date_range('2024-02-01', '2024-12-01', freq='MS')
def active_on(d):
    s = subscriptions
    return set(s[(s.start_date <= d) & (s.end_date.isna() | (s.end_date > d))].user_id)
rows = []
for d, nxt in zip(starts[:-1], starts[1:]):
    a, b = active_on(d), active_on(nxt)
    churn = len(a - b)
    rows.append({'month': d.strftime('%Y-%m'), 'start_users': len(a), 'churned_users': churn,
                 'churn_pct': round(100 * churn / len(a), 2)})
result = pd.DataFrame(rows)`,
  py_explain: `<p>Python sets make the logic explicit: churned = active_at_start − active_next_month.</p>`
},
{
  id: 36, title: 'Customers who ordered in every month of Q4 2024', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['Relational division', 'HAVING', 'COUNT DISTINCT'], companies: ['Amazon', 'Flipkart', 'Walmart', 'Blinkit'], ordered: true,
  prompt: `<p>Find customers with at least one non-cancelled order in <b>each</b> of October, November and December 2024.</p>
<p>Return <code>customer_id</code>, <code>customer_name</code>, <code>q4_orders</code> (non-cancelled orders in Q4). Sort by <code>q4_orders</code> desc, then customer_id.</p>`,
  hint: 'HAVING COUNT(DISTINCT MONTH(order_date)) = 3.',
  sql: `SELECT c.customer_id, c.customer_name, COUNT(*) AS q4_orders
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status <> 'Cancelled'
  AND o.order_date >= '2024-10-01' AND o.order_date < '2025-01-01'
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(DISTINCT MONTH(o.order_date)) = 3
ORDER BY q4_orders DESC, c.customer_id;`,
  sql_explain: `<p>"Bought in ALL X" is <b>relational division</b>. The counting form is simplest: restrict to the window, then require the distinct number of months to equal the number required. Generalise with <code>= (SELECT COUNT(*) FROM required_set)</code>, e.g. "customers who bought every product in a category".</p>`,
  py: `o = orders[(orders.status != 'Cancelled') & (orders.order_date >= '2024-10-01')]
g = o.groupby('customer_id').agg(q4_orders=('order_id', 'count'), months=('order_date', lambda s: s.dt.month.nunique())).reset_index()
g = g[g.months == 3].merge(customers[['customer_id', 'customer_name']], on='customer_id')
result = g.sort_values(['q4_orders', 'customer_id'], ascending=[False, True])[['customer_id', 'customer_name', 'q4_orders']].reset_index(drop=True)`,
  py_explain: `<p>A lambda in <code>agg</code> computes distinct months per customer; filter on it like HAVING.</p>`
},
{
  id: 37, title: 'Lapsed customers: active in 2023, silent in 2024', difficulty: 'Easy', tier: 1, dataset: 'retail',
  topics: ['Anti join', 'Aggregation', 'Churn'], companies: ['Myntra', 'Nykaa', 'Amazon', 'Zomato'], ordered: true,
  prompt: `<p>Win-back campaign: find customers with <b>at least 3</b> non-cancelled orders in 2023 and <b>no orders at all</b> (any status) in 2024.</p>
<p>Return <code>customer_id</code>, <code>customer_name</code>, <code>orders_2023</code>, <code>last_order_date</code>. Sort by <code>last_order_date</code> desc, then customer_id.</p>`,
  hint: 'Aggregate 2023, then NOT EXISTS for 2024.',
  sql: `SELECT c.customer_id, c.customer_name,
       COUNT(*)           AS orders_2023,
       MAX(o.order_date)  AS last_order_date
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status <> 'Cancelled'
  AND o.order_date >= '2023-01-01' AND o.order_date < '2024-01-01'
  AND NOT EXISTS (SELECT 1 FROM orders o2
                  WHERE o2.customer_id = c.customer_id AND o2.order_date >= '2024-01-01')
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(*) >= 3
ORDER BY last_order_date DESC, c.customer_id;`,
  sql_explain: `<p>Combine a positive condition (aggregate on 2023) with a negative one (NOT EXISTS in 2024). The NOT EXISTS is correlated on customer_id and checks <i>any</i> status, as required.</p>`,
  py: `o23 = orders[(orders.status != 'Cancelled') & (orders.order_date.dt.year == 2023)]
active24 = orders[orders.order_date.dt.year == 2024].customer_id.unique()
g = o23[~o23.customer_id.isin(active24)].groupby('customer_id').agg(orders_2023=('order_id', 'count'), last_order_date=('order_date', 'max')).reset_index()
g = g[g.orders_2023 >= 3].merge(customers[['customer_id', 'customer_name']], on='customer_id')
result = g.sort_values(['last_order_date', 'customer_id'], ascending=[False, True])[['customer_id', 'customer_name', 'orders_2023', 'last_order_date']].reset_index(drop=True)`,
  py_explain: `<p>Anti-filter with <code>~isin</code>, then aggregate and threshold.</p>`
},
{
  id: 38, title: 'Signup → first purchase conversion by channel', difficulty: 'Medium', tier: 2, dataset: 'events',
  topics: ['Funnel', 'LEFT JOIN', 'Date functions'], companies: ['Meesho', 'Swiggy', 'Amazon', 'Groww'], ordered: true,
  prompt: `<p>For each acquisition <code>channel</code>: number of users, number who ever made a purchase, conversion %, and the average days from signup to <b>first</b> purchase (buyers only).</p>
<p>Return <code>channel</code>, <code>users</code>, <code>buyers</code>, <code>conversion_pct</code>, <code>avg_days_to_first_purchase</code> (2 dp). Sort by <code>conversion_pct</code> desc.</p>`,
  hint: 'First purchase per user (MIN event_time where event_name = purchase) LEFT JOINed to users. COUNT(fp.user_id) counts buyers.',
  sql: `WITH fp AS (
  SELECT user_id, MIN(event_time) AS first_purchase
  FROM events
  WHERE event_name = 'purchase'
  GROUP BY user_id
)
SELECT u.channel,
       COUNT(*)            AS users,
       COUNT(fp.user_id)   AS buyers,
       ROUND(100.0 * COUNT(fp.user_id) / COUNT(*), 2) AS conversion_pct,
       ROUND(AVG(DATEDIFF(fp.first_purchase, u.signup_date)), 2) AS avg_days_to_first_purchase
FROM app_users u
LEFT JOIN fp ON fp.user_id = u.user_id
GROUP BY u.channel
ORDER BY conversion_pct DESC;`,
  sql_explain: `<p>Reduce events to one row per buyer <i>before</i> joining (avoid fan-out). With a LEFT JOIN, non-buyers have NULL first_purchase → <code>COUNT(fp.user_id)</code> counts buyers and <code>AVG(DATEDIFF(...))</code> automatically averages over buyers only.</p>`,
  py: `fp = events[events.event_name == 'purchase'].groupby('user_id').event_time.min().rename('fp')
u = app_users.join(fp, on='user_id')
u['days'] = (u.fp.dt.normalize() - u.signup_date).dt.days
result = u.groupby('channel').agg(users=('user_id', 'count'), buyers=('fp', 'count'), avg_days_to_first_purchase=('days', 'mean')).reset_index()
result['conversion_pct'] = (100 * result.buyers / result.users).round(2)
result['avg_days_to_first_purchase'] = result.avg_days_to_first_purchase.round(2)
result = result[['channel', 'users', 'buyers', 'conversion_pct', 'avg_days_to_first_purchase']].sort_values('conversion_pct', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>DATEDIFF ignores time-of-day, so normalise the timestamp before subtracting dates.</p>`
}
);
