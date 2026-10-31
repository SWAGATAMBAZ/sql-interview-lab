/* Section 2 — Window functions */
window.QUESTIONS.push(
{
  id: 13, title: 'Month-over-month revenue growth (2024)', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['LAG/LEAD', 'Window functions', 'Date functions'], companies: ['Flipkart', 'Amazon', 'Meesho', 'Razorpay'], ordered: true,
  prompt: `<p>For each month of <b>2024</b>, show recognised revenue (orders Delivered or Shipped), the previous month's revenue and MoM growth %.</p>
<p>Important: January 2024 must compare against <b>December 2023</b> (not NULL).</p>
<p>Return <code>month</code> (YYYY-MM), <code>revenue</code>, <code>prev_month_revenue</code>, <code>mom_growth_pct</code> — all money rounded to 2, growth = (rev − prev)/prev × 100 rounded to 2. Sort by month.</p>`,
  hint: 'Aggregate ALL months first, apply LAG, and only THEN filter to 2024. If you filter first, LAG for January has nothing to look back at.',
  sql: `WITH monthly AS (
  SELECT DATE_FORMAT(o.order_date, '%Y-%m') AS month,
         SUM(oi.quantity * oi.unit_price)   AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
  GROUP BY month
), with_prev AS (
  SELECT month, revenue,
         LAG(revenue) OVER (ORDER BY month) AS prev_month_revenue
  FROM monthly
)
SELECT month,
       ROUND(revenue, 2)            AS revenue,
       ROUND(prev_month_revenue, 2) AS prev_month_revenue,
       ROUND(100.0 * (revenue - prev_month_revenue) / prev_month_revenue, 2) AS mom_growth_pct
FROM with_prev
WHERE month >= '2024-01'
ORDER BY month;`,
  sql_explain: `<p><b>Order of operations matters:</b> window functions run after WHERE. If the 2024 filter sits in the same query as <code>LAG</code>, December 2023 is gone before LAG runs. So: aggregate → LAG over the full history → filter in the outer query.</p>
<p><code>'YYYY-MM'</code> strings sort chronologically, so ordering by the string is safe. If months could be missing, LAG would compare with the last <i>available</i> month — mention that and suggest a calendar table.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped'])].merge(order_items, on='order_id')
o['month'] = o.order_date.dt.strftime('%Y-%m')
o['v'] = o.quantity * o.unit_price
m = o.groupby('month', as_index=False).agg(revenue=('v', 'sum')).sort_values('month')
m['prev_month_revenue'] = m.revenue.shift(1)
m['mom_growth_pct'] = (100 * (m.revenue - m.prev_month_revenue) / m.prev_month_revenue).round(2)
m['revenue'] = m.revenue.round(2)
m['prev_month_revenue'] = m.prev_month_revenue.round(2)
result = m[m.month >= '2024-01'].reset_index(drop=True)`,
  py_explain: `<p><code>shift(1)</code> is LAG, <code>shift(-1)</code> is LEAD. Sort before shifting! (<code>pct_change()</code> is a shortcut for the growth ratio.)</p>`
},
{
  id: 14, title: 'Running total of daily revenue (Dec 2024)', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['Running total', 'Window aggregate'], companies: ['Razorpay', 'Paytm', 'Amazon'], ordered: true,
  prompt: `<p>For each day of December 2024 that has recognised revenue (Delivered or Shipped), return:</p>
<ul><li><code>order_date</code>, <code>daily_revenue</code></li><li><code>running_revenue</code> – cumulative revenue month-to-date</li><li><code>pct_of_month</code> – running revenue as % of the full December total</li></ul>
<p>Round money and % to 2 decimals. Sort by date.</p>`,
  hint: 'SUM(x) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) for the running sum, SUM(x) OVER () for the total.',
  sql: `WITH daily AS (
  SELECT o.order_date, SUM(oi.quantity * oi.unit_price) AS daily_revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-12-01' AND o.order_date < '2025-01-01'
  GROUP BY o.order_date
)
SELECT order_date,
       ROUND(daily_revenue, 2) AS daily_revenue,
       ROUND(SUM(daily_revenue) OVER (ORDER BY order_date
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 2) AS running_revenue,
       ROUND(100.0 * SUM(daily_revenue) OVER (ORDER BY order_date
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
             / SUM(daily_revenue) OVER (), 2) AS pct_of_month
FROM daily
ORDER BY order_date;`,
  sql_explain: `<p>With <code>ORDER BY</code> and no frame, the default frame is <code>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code> — rows with the same ORDER BY value are summed together (peers). Writing <code>ROWS</code> explicitly avoids surprises and is faster. Here dates are unique after grouping so both give the same answer.</p>
<p><code>SUM() OVER ()</code> with an empty window = grand total on every row.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date >= '2024-12-01')].merge(order_items, on='order_id')
o['v'] = o.quantity * o.unit_price
d = o.groupby('order_date', as_index=False).agg(daily_revenue=('v', 'sum')).sort_values('order_date')
d['running_revenue'] = d.daily_revenue.cumsum()
d['pct_of_month'] = (100 * d.running_revenue / d.daily_revenue.sum()).round(2)
d['daily_revenue'] = d.daily_revenue.round(2)
d['running_revenue'] = d.running_revenue.round(2)
result = d.reset_index(drop=True)`,
  py_explain: `<p><code>cumsum()</code> after sorting = running total. For per-group running totals: <code>df.groupby('key').col.cumsum()</code>.</p>`
},
{
  id: 15, title: '7-day moving average of daily revenue (Nov 2024)', difficulty: 'Medium', tier: 2, dataset: 'retail',
  topics: ['Moving average', 'Window frame'], companies: ['Meesho', 'Swiggy', 'Amazon', 'Zepto'], ordered: true,
  prompt: `<p>Compute a <b>7-day trailing moving average</b> (current day + 6 previous rows/days) of recognised daily revenue (Delivered or Shipped).</p>
<p>Return only November 2024 days: <code>order_date</code>, <code>daily_revenue</code>, <code>ma_7d</code> (both 2 decimals), sorted by date. The average for Nov 1 must include Oct 26–31 (don't truncate the window at the month start). Every day in this period has sales.</p>`,
  hint: 'AVG(x) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), computed on a wider date range, filtered afterwards.',
  sql: `WITH daily AS (
  SELECT o.order_date, SUM(oi.quantity * oi.unit_price) AS daily_revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-10-25' AND o.order_date < '2024-12-01'
  GROUP BY o.order_date
), ma AS (
  SELECT order_date, daily_revenue,
         AVG(daily_revenue) OVER (ORDER BY order_date
             ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma_7d
  FROM daily
)
SELECT order_date, ROUND(daily_revenue, 2) AS daily_revenue, ROUND(ma_7d, 2) AS ma_7d
FROM ma
WHERE order_date >= '2024-11-01'
ORDER BY order_date;`,
  sql_explain: `<p><code>ROWS BETWEEN 6 PRECEDING AND CURRENT ROW</code> = 7 rows. It is a <i>row</i> window — it equals a 7-<i>day</i> window only when there are no missing days (true here). Q16 handles the sparse case.</p>
<p>Pull a few extra days before the reporting window (warm-up), compute, then filter — same idea as Q13.</p>
<p>Interviewer follow-up: "Should the average include today?" — clarify trailing vs centred vs excluding current day (<code>BETWEEN 7 PRECEDING AND 1 PRECEDING</code>).</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date >= '2024-10-25') & (orders.order_date < '2024-12-01')].merge(order_items, on='order_id')
o['v'] = o.quantity * o.unit_price
d = o.groupby('order_date', as_index=False).agg(daily_revenue=('v', 'sum')).sort_values('order_date')
d['ma_7d'] = d.daily_revenue.rolling(7, min_periods=1).mean()
d = d[d.order_date >= '2024-11-01']
d['daily_revenue'] = d.daily_revenue.round(2)
d['ma_7d'] = d.ma_7d.round(2)
result = d.reset_index(drop=True)`,
  py_explain: `<p><code>rolling(7)</code> is row-based like ROWS; <code>rolling('7D')</code> on a DatetimeIndex is calendar-based like RANGE INTERVAL 6 DAY.</p>`
},
{
  id: 16, title: 'True 7-calendar-day rolling sum with missing days', difficulty: 'Hard', tier: 3,
  tables: {
    store_sales: QT('sale_date:DATE,store_id:TEXT,amount:REAL', [
      ['2024-03-01', 'S1', 1200], ['2024-03-02', 'S1', 800], ['2024-03-05', 'S1', 1500], ['2024-03-06', 'S1', 700],
      ['2024-03-10', 'S1', 2000], ['2024-03-11', 'S1', 300], ['2024-03-14', 'S1', 900],
      ['2024-03-01', 'S2', 500], ['2024-03-03', 'S2', 650], ['2024-03-04', 'S2', 400], ['2024-03-08', 'S2', 1100],
      ['2024-03-09', 'S2', 250], ['2024-03-13', 'S2', 1800]
    ])
  },
  topics: ['Recursive CTE', 'Date spine', 'Moving average', 'CROSS JOIN'], companies: ['Amazon', 'Walmart', 'Uber', 'Zepto'], ordered: true,
  prompt: `<p><code>store_sales</code> only has rows for days a store sold something. Build a complete daily series for each store from <b>2024-03-01 to 2024-03-14</b> (missing days = 0) and compute the rolling sum over the <b>last 7 calendar days</b> (current day + 6 previous days).</p>
<p>Return <code>store_id</code>, <code>sale_date</code>, <code>amount</code> (0 when no sale), <code>rolling_7d</code>. Sort by <code>store_id</code>, <code>sale_date</code>.</p>`,
  hint: 'Generate dates with WITH RECURSIVE, CROSS JOIN with the distinct stores, LEFT JOIN the sales, COALESCE to 0, then a ROWS window works correctly because the series is now dense.',
  sql: `WITH RECURSIVE dates AS (
  SELECT DATE('2024-03-01') AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < '2024-03-14'
), grid AS (
  SELECT s.store_id, dt.d AS sale_date
  FROM (SELECT DISTINCT store_id FROM store_sales) s
  CROSS JOIN dates dt
), filled AS (
  SELECT g.store_id, g.sale_date, COALESCE(SUM(ss.amount), 0) AS amount
  FROM grid g
  LEFT JOIN store_sales ss ON ss.store_id = g.store_id AND ss.sale_date = g.sale_date
  GROUP BY g.store_id, g.sale_date
)
SELECT store_id, sale_date, amount,
       SUM(amount) OVER (PARTITION BY store_id ORDER BY sale_date
                         ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7d
FROM filled
ORDER BY store_id, sale_date;

-- MySQL 8 alternative without the spine (but then missing days produce no output row):
-- SUM(amount) OVER (PARTITION BY store_id ORDER BY sale_date
--                   RANGE BETWEEN INTERVAL 6 DAY PRECEDING AND CURRENT ROW)`,
  sql_explain: `<ol><li><b>Date spine</b>: a recursive CTE generates every date. (In production you'd use a calendar table.)</li>
<li><b>Grid</b> = stores × dates (CROSS JOIN) so each store has every day.</li>
<li><b>LEFT JOIN</b> actual sales and <code>COALESCE</code> to 0.</li>
<li>Now the series is dense, so <code>ROWS 6 PRECEDING</code> = exactly 7 calendar days.</li></ol>
<p>Using ROWS on the raw sparse table would silently sum 7 <i>sale-days</i> that may span 2+ weeks — a subtle bug interviewers look for.</p>`,
  py: `dates = pd.date_range('2024-03-01', '2024-03-14', freq='D')
grid = pd.MultiIndex.from_product([sorted(store_sales.store_id.unique()), dates], names=['store_id', 'sale_date']).to_frame(index=False)
daily = store_sales.groupby(['store_id', 'sale_date'], as_index=False).amount.sum()
f = grid.merge(daily, on=['store_id', 'sale_date'], how='left').fillna({'amount': 0})
f = f.sort_values(['store_id', 'sale_date'])
f['rolling_7d'] = f.groupby('store_id').amount.transform(lambda s: s.rolling(7, min_periods=1).sum())
result = f.reset_index(drop=True)`,
  py_explain: `<p><code>pd.date_range</code> + <code>MultiIndex.from_product</code> = date spine × stores. Then left-merge, fill 0 and a per-group rolling sum via <code>transform</code>.</p>`
},
{
  id: 17, title: 'Top 3 products by revenue in each category (2024)', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['Window ranking', 'Top-N per group'], companies: ['Amazon', 'Flipkart', 'Myntra', 'Nykaa'], ordered: true,
  prompt: `<p>Using 2024 recognised revenue (Delivered or Shipped), return the top 3 products of each category.</p>
<p>Return <code>category</code>, <code>product_name</code>, <code>revenue</code> (2 decimals), <code>rank_in_category</code> (1..3, use ROW_NUMBER; ties broken by product_id). Sort by <code>category</code>, <code>rank_in_category</code>.</p>`,
  hint: 'Aggregate per product, ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC, product_id), filter ≤ 3.',
  sql: `WITH prod AS (
  SELECT p.category, p.product_id, p.product_name,
         SUM(oi.quantity * oi.unit_price) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  JOIN products p     ON p.product_id = oi.product_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY p.category, p.product_id, p.product_name
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC, product_id) AS rank_in_category
  FROM prod
)
SELECT category, product_name, ROUND(revenue, 2) AS revenue, rank_in_category
FROM ranked
WHERE rank_in_category <= 3
ORDER BY category, rank_in_category;`,
  sql_explain: `<p>Aggregate → rank → filter. The aggregation and window can live in the same SELECT (<code>ROW_NUMBER() OVER (PARTITION BY category ORDER BY SUM(...) DESC)</code>) because windows run after GROUP BY, but two CTEs read better in interviews.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
l = o.merge(order_items, on='order_id').merge(products, on='product_id')
l['v'] = l.quantity * l.unit_price
p = l.groupby(['category', 'product_id', 'product_name'], as_index=False).agg(revenue=('v', 'sum'))
p = p.sort_values(['category', 'revenue', 'product_id'], ascending=[True, False, True])
p['rank_in_category'] = p.groupby('category').cumcount() + 1
p['revenue'] = p.revenue.round(2)
result = p[p.rank_in_category <= 3][['category', 'product_name', 'revenue', 'rank_in_category']].reset_index(drop=True)`,
  py_explain: `<p>Sort by the window's ORDER BY, then <code>groupby().cumcount()+1</code> = ROW_NUMBER. Or <code>groupby().head(3)</code> after sorting.</p>`
},
{
  id: 18, title: 'Average gap between orders (frequent buyers)', difficulty: 'Medium', tier: 2, dataset: 'retail',
  topics: ['LAG/LEAD', 'Date functions'], companies: ['Amazon', 'Swiggy', 'BigBasket', 'Zepto'], ordered: true,
  prompt: `<p>For customers with at least 20 non-cancelled orders (any year), compute the average number of days between consecutive orders.</p>
<p>Return the 10 customers with the <b>shortest</b> average gap: <code>customer_id</code>, <code>orders</code>, <code>avg_gap_days</code> (2 decimals). Sort by <code>avg_gap_days</code>, then <code>customer_id</code>.</p>`,
  hint: 'LAG(order_date) OVER (PARTITION BY customer ORDER BY order_date, order_id), DATEDIFF, then AVG ignoring the first NULL gap.',
  sql: `WITH o AS (
  SELECT customer_id, order_id, order_date,
         LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS prev_date
  FROM orders
  WHERE status <> 'Cancelled'
)
SELECT customer_id,
       COUNT(*)                                  AS orders,
       ROUND(AVG(DATEDIFF(order_date, prev_date)), 2) AS avg_gap_days
FROM o
GROUP BY customer_id
HAVING COUNT(*) >= 20
ORDER BY avg_gap_days, customer_id
LIMIT 10;`,
  sql_explain: `<p>The first order of each customer has <code>prev_date = NULL</code>, so <code>DATEDIFF</code> is NULL and <code>AVG</code> ignores it — exactly n−1 gaps. Shortcut many seniors mention: average gap = (last − first) / (n − 1), no window needed.</p>`,
  py: `o = orders[orders.status != 'Cancelled'].sort_values(['customer_id', 'order_date', 'order_id'])
o['gap'] = o.groupby('customer_id').order_date.diff().dt.days
g = o.groupby('customer_id').agg(orders=('order_id', 'count'), avg_gap_days=('gap', 'mean')).reset_index()
g = g[g.orders >= 20]
g['avg_gap_days'] = g.avg_gap_days.round(2)
result = g.sort_values(['avg_gap_days', 'customer_id']).head(10).reset_index(drop=True)`,
  py_explain: `<p><code>groupby().diff()</code> on a datetime column gives a Timedelta; <code>.dt.days</code> converts. <code>mean()</code> skips the NaN of the first row.</p>`
},
{
  id: 19, title: 'What do customers buy in their first order?', difficulty: 'Medium', tier: 2, dataset: 'retail',
  topics: ['Window ranking', 'First touch', 'CTE'], companies: ['Amazon', 'Meesho', 'Nykaa', 'Flipkart'], ordered: true,
  prompt: `<p>For each customer, find their <b>first order</b> (earliest <code>order_date</code>, then smallest <code>order_id</code>; any status). Within that order, take the <b>highest-value line</b> (quantity × unit_price, tie → smaller product_id) and its category — the "entry category".</p>
<p>Return <code>entry_category</code>, <code>customers</code>, <code>pct_customers</code> (2 decimals). Sort by <code>customers</code> desc.</p>`,
  hint: 'Two ROW_NUMBERs: one over orders per customer, one over lines per order.',
  sql: `WITH first_order AS (
  SELECT order_id, customer_id
  FROM (SELECT order_id, customer_id,
               ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS rn
        FROM orders) t
  WHERE rn = 1
), top_line AS (
  SELECT f.customer_id, p.category,
         ROW_NUMBER() OVER (PARTITION BY f.order_id
                            ORDER BY oi.quantity * oi.unit_price DESC, oi.product_id) AS rn
  FROM first_order f
  JOIN order_items oi ON oi.order_id = f.order_id
  JOIN products p     ON p.product_id = oi.product_id
)
SELECT category AS entry_category,
       COUNT(*) AS customers,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct_customers
FROM top_line
WHERE rn = 1
GROUP BY category
ORDER BY customers DESC;`,
  sql_explain: `<p>"First X per group" = <code>ROW_NUMBER() … = 1</code>. Chaining two of them answers nested questions (first order → top line). Alternative to ROW_NUMBER: correlated <code>MIN()</code> subqueries, but they break on ties and are slower.</p>`,
  py: `fo = orders.sort_values(['customer_id', 'order_date', 'order_id']).drop_duplicates('customer_id')[['order_id', 'customer_id']]
l = fo.merge(order_items, on='order_id').merge(products, on='product_id')
l['v'] = l.quantity * l.unit_price
top = l.sort_values(['order_id', 'v', 'product_id'], ascending=[True, False, True]).drop_duplicates('order_id')
result = top.groupby('category').size().reset_index(name='customers').rename(columns={'category': 'entry_category'})
result['pct_customers'] = (100 * result.customers / result.customers.sum()).round(2)
result = result.sort_values('customers', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Sort + <code>drop_duplicates(key)</code> = "first row per group" — the most common pandas idiom for ROW_NUMBER = 1.</p>`
},
{
  id: 20, title: 'Salary vs department average and payroll share', difficulty: 'Medium', tier: 1, dataset: 'hr',
  topics: ['Window aggregate', 'PARTITION BY'], companies: ['Deloitte', 'Amazon', 'Goldman Sachs'], ordered: true,
  prompt: `<p>For every employee with a department, show how they compare with their department.</p>
<p>Return <code>dept_name</code>, <code>emp_name</code>, <code>salary</code>, <code>dept_avg</code> (2 dp), <code>diff_from_avg</code> (salary − dept_avg, 2 dp), <code>pct_of_dept_payroll</code> (2 dp). Sort by <code>dept_name</code>, <code>salary</code> desc, <code>emp_name</code>.</p>`,
  hint: 'AVG(salary) OVER (PARTITION BY dept_id) keeps every row — unlike GROUP BY.',
  sql: `SELECT d.dept_name, e.emp_name, e.salary,
       ROUND(AVG(e.salary) OVER (PARTITION BY e.dept_id), 2)                AS dept_avg,
       ROUND(e.salary - AVG(e.salary) OVER (PARTITION BY e.dept_id), 2)     AS diff_from_avg,
       ROUND(100.0 * e.salary / SUM(e.salary) OVER (PARTITION BY e.dept_id), 2) AS pct_of_dept_payroll
FROM employees e
JOIN departments d ON d.dept_id = e.dept_id
ORDER BY d.dept_name, e.salary DESC, e.emp_name;`,
  sql_explain: `<p>Aggregate window functions attach group-level numbers to each detail row. Without windows you'd need a GROUP BY subquery joined back on dept_id. Frequently asked: <i>"difference between GROUP BY and window functions?"</i> → GROUP BY collapses rows; windows don't.</p>`,
  py: `e = employees.merge(departments, on='dept_id')
g = e.groupby('dept_id').salary
e['dept_avg'] = g.transform('mean')
e['diff_from_avg'] = (e.salary - e.dept_avg).round(2)
e['pct_of_dept_payroll'] = (100 * e.salary / g.transform('sum')).round(2)
e['dept_avg'] = e.dept_avg.round(2)
result = (e[['dept_name', 'emp_name', 'salary', 'dept_avg', 'diff_from_avg', 'pct_of_dept_payroll']]
          .sort_values(['dept_name', 'salary', 'emp_name'], ascending=[True, False, True]).reset_index(drop=True))`,
  py_explain: `<p><code>groupby().transform()</code> is pandas' <code>OVER (PARTITION BY …)</code>: returns a result aligned to the original rows.</p>`
},
{
  id: 21, title: 'Pareto: products driving 80% of revenue', difficulty: 'Hard', tier: 2, dataset: 'retail',
  topics: ['Running total', 'Window aggregate', 'Business case'], companies: ['Amazon', 'Flipkart', 'Walmart', 'Meesho'], ordered: true,
  prompt: `<p>Rank products by 2024 recognised revenue (Delivered or Shipped). Return the smallest set of top products whose cumulative share of total revenue reaches <b>80%</b> — include the product that crosses 80%.</p>
<p>Return <code>product_name</code>, <code>revenue</code> (2 dp), <code>cum_pct</code> (cumulative share %, 2 dp). Sort by revenue desc.</p>`,
  hint: 'Keep rows where the cumulative % BEFORE adding this product is < 80. That automatically includes the crossing product.',
  sql: `WITH prod AS (
  SELECT p.product_id, p.product_name, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  JOIN products p     ON p.product_id = oi.product_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY p.product_id, p.product_name
), cum AS (
  SELECT product_name, revenue,
         100.0 * SUM(revenue) OVER (ORDER BY revenue DESC, product_id ROWS UNBOUNDED PRECEDING)
               / SUM(revenue) OVER () AS cum_pct
  FROM prod
)
SELECT product_name, ROUND(revenue, 2) AS revenue, ROUND(cum_pct, 2) AS cum_pct
FROM cum
WHERE cum_pct - 100.0 * revenue / (SELECT SUM(revenue) FROM prod) < 80
ORDER BY revenue DESC;`,
  sql_explain: `<p>Cumulative share = running sum ÷ total. The boundary detail is the real test: <code>WHERE cum_pct &lt;= 80</code> excludes the product that pushes you over 80%, so you never actually reach 80%. Using "previous cumulative &lt; 80" (cum − own share) fixes it. Alternatively use <code>LAG(cum_pct, 1, 0)</code>.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
l = o.merge(order_items, on='order_id').merge(products, on='product_id')
l['v'] = l.quantity * l.unit_price
p = l.groupby(['product_id', 'product_name'], as_index=False).agg(revenue=('v', 'sum'))
p = p.sort_values(['revenue', 'product_id'], ascending=[False, True])
p['cum_pct'] = 100 * p.revenue.cumsum() / p.revenue.sum()
p['prev_cum'] = p.cum_pct - 100 * p.revenue / p.revenue.sum()
p = p[p.prev_cum < 80]
p['revenue'] = p.revenue.round(2)
p['cum_pct'] = p.cum_pct.round(2)
result = p[['product_name', 'revenue', 'cum_pct']].reset_index(drop=True)`,
  py_explain: `<p>Sort descending, <code>cumsum()</code>, divide by total; filter on the previous cumulative share.</p>`
},
{
  id: 22, title: 'Customer spend quartiles with NTILE', difficulty: 'Medium', tier: 2, dataset: 'retail',
  topics: ['NTILE', 'Segmentation'], companies: ['Amazon', 'American Express', 'CRED', 'Myntra'], ordered: true,
  prompt: `<p>Take customers with recognised (Delivered/Shipped) spend in 2024 and split them into 4 equal-size buckets with <code>NTILE(4)</code> ordered by spend <b>descending</b> (bucket 1 = top spenders; ties broken by customer_id).</p>
<p>Return <code>quartile</code>, <code>customers</code>, <code>min_spend</code>, <code>max_spend</code>, <code>avg_spend</code>, <code>revenue_share_pct</code> (all money/pct 2 dp). Sort by quartile.</p>`,
  hint: 'Spend per customer → NTILE(4) OVER (ORDER BY spend DESC, customer_id) → group by bucket.',
  sql: `WITH spend AS (
  SELECT o.customer_id, SUM(oi.quantity * oi.unit_price) AS spend
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY o.customer_id
), q AS (
  SELECT customer_id, spend, NTILE(4) OVER (ORDER BY spend DESC, customer_id) AS quartile
  FROM spend
)
SELECT quartile,
       COUNT(*)              AS customers,
       ROUND(MIN(spend), 2)  AS min_spend,
       ROUND(MAX(spend), 2)  AS max_spend,
       ROUND(AVG(spend), 2)  AS avg_spend,
       ROUND(100.0 * SUM(spend) / SUM(SUM(spend)) OVER (), 2) AS revenue_share_pct
FROM q
GROUP BY quartile
ORDER BY quartile;`,
  sql_explain: `<p><code>NTILE(n)</code> deals rows into n buckets as evenly as possible; when rows don't divide evenly, the first buckets get one extra row. It's count-based, so equal spends can land in different buckets — a tie-breaker keeps it deterministic. If the business wants value-based cut-offs, use <code>PERCENT_RANK()</code> or fixed thresholds instead.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
l = o.merge(order_items, on='order_id')
l['v'] = l.quantity * l.unit_price
s = l.groupby('customer_id', as_index=False).agg(spend=('v', 'sum')).sort_values(['spend', 'customer_id'], ascending=[False, True]).reset_index(drop=True)
n = len(s); base, extra = divmod(n, 4)
sizes = [base + (1 if i < extra else 0) for i in range(4)]
s['quartile'] = np.repeat([1, 2, 3, 4], sizes)
result = s.groupby('quartile').agg(customers=('customer_id', 'count'), min_spend=('spend', 'min'),
                                   max_spend=('spend', 'max'), avg_spend=('spend', 'mean'), total=('spend', 'sum')).reset_index()
result['revenue_share_pct'] = 100 * result.total / result.total.sum()
result = result.drop(columns='total').round(2)`,
  py_explain: `<p>pandas has no NTILE; replicate it exactly with bucket sizes from <code>divmod(n, 4)</code> (first buckets get the remainder). <code>pd.qcut(rank, 4)</code> is close but distributes the remainder differently.</p>`
},
{
  id: 23, title: 'Largest successful payment per merchant per month', difficulty: 'Medium', tier: 1, dataset: 'payments',
  topics: ['Window ranking', 'Top-N per group'], companies: ['Razorpay', 'PhonePe', 'Cashfree', 'Juspay'], ordered: true,
  prompt: `<p>For each merchant and month (YYYY-MM of <code>created_at</code>), find the single largest <b>successful</b> payment. If two payments tie on amount, take the smaller <code>payment_id</code>.</p>
<p>Return <code>month</code>, <code>merchant_id</code>, <code>payment_id</code>, <code>amount</code>. Only for merchants in the <code>Travel</code> category. Sort by <code>month</code>, <code>merchant_id</code>.</p>`,
  hint: 'ROW_NUMBER() OVER (PARTITION BY merchant, month ORDER BY amount DESC, payment_id).',
  sql: `WITH ranked AS (
  SELECT DATE_FORMAT(p.created_at, '%Y-%m') AS month, p.merchant_id, p.payment_id, p.amount,
         ROW_NUMBER() OVER (PARTITION BY p.merchant_id, DATE_FORMAT(p.created_at, '%Y-%m')
                            ORDER BY p.amount DESC, p.payment_id) AS rn
  FROM payments p
  JOIN merchants m ON m.merchant_id = p.merchant_id
  WHERE p.status = 'success' AND m.category = 'Travel'
)
SELECT month, merchant_id, payment_id, amount
FROM ranked
WHERE rn = 1
ORDER BY month, merchant_id;`,
  sql_explain: `<p>You can partition by an expression. Why not <code>GROUP BY merchant, month</code> + <code>MAX(amount)</code>? Because you also need the <code>payment_id</code> of that max row — GROUP BY can't return it without a join back (which duplicates on ties). ROW_NUMBER solves "argmax" cleanly.</p>`,
  py: `p = payments[payments.status == 'success'].merge(merchants[merchants.category == 'Travel'][['merchant_id']], on='merchant_id')
p['month'] = p.created_at.dt.strftime('%Y-%m')
p = p.sort_values(['merchant_id', 'month', 'amount', 'payment_id'], ascending=[True, True, False, True])
result = (p.drop_duplicates(['merchant_id', 'month'])[['month', 'merchant_id', 'payment_id', 'amount']]
          .sort_values(['month', 'merchant_id']).reset_index(drop=True))`,
  py_explain: `<p>Argmax per group = sort + <code>drop_duplicates</code>. (<code>idxmax</code> also works but doesn't handle the tie rule as explicitly.)</p>`
}
);
