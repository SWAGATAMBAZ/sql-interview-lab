/* Section 6 — E-commerce business case studies (multi-table) */
window.QUESTIONS.push(
{
  id: 44, title: 'Return rate by category with the top return reason', difficulty: 'Hard', tier: 2, dataset: 'retail',
  topics: ['Business case', 'Multi-table', 'Window ranking', 'COUNT DISTINCT'], companies: ['Myntra', 'Flipkart', 'Amazon', 'Meesho', 'Ajio'], ordered: true,
  prompt: `<p>An order "contains" a category if any of its lines is from that category. Consider orders that are not Cancelled.</p>
<p>For each category: <code>orders</code> (distinct non-cancelled orders containing it), <code>returned_orders</code> (those with status Returned), <code>return_rate_pct</code> (2 dp), and <code>top_reason</code> — the most frequent return reason among its returned orders (ties → alphabetical).</p>
<p>Sort by <code>return_rate_pct</code> desc.</p>`,
  hint: 'Distinct (order, category) pairs first — an order with two Fashion lines must count once. Then join returns for reasons; rank reasons per category.',
  sql: `WITH oc AS (
  SELECT DISTINCT o.order_id, o.status, p.category
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  JOIN products p     ON p.product_id = oi.product_id
  WHERE o.status <> 'Cancelled'
), rates AS (
  SELECT category,
         COUNT(*) AS orders,
         SUM(CASE WHEN status = 'Returned' THEN 1 ELSE 0 END) AS returned_orders
  FROM oc
  GROUP BY category
), reasons AS (
  SELECT oc.category, r.reason,
         ROW_NUMBER() OVER (PARTITION BY oc.category ORDER BY COUNT(*) DESC, r.reason) AS rn
  FROM oc
  JOIN returns r ON r.order_id = oc.order_id
  GROUP BY oc.category, r.reason
)
SELECT rt.category, rt.orders, rt.returned_orders,
       ROUND(100.0 * rt.returned_orders / rt.orders, 2) AS return_rate_pct,
       rs.reason AS top_reason
FROM rates rt
LEFT JOIN reasons rs ON rs.category = rt.category AND rs.rn = 1
ORDER BY return_rate_pct DESC;`,
  sql_explain: `<p>This is the kind of multi-table question that feels overwhelming in a live round. Decompose it:</p>
<ol><li><b>Fix the grain</b>: (order, category) with DISTINCT.</li><li><b>Metric CTE</b>: rates per category.</li><li><b>Mode CTE</b>: most frequent reason per category via ROW_NUMBER over a GROUP BY.</li><li><b>Stitch</b> with a LEFT JOIN (a category with no returns would still appear).</li></ol>`,
  py: `oc = (orders[orders.status != 'Cancelled'].merge(order_items, on='order_id').merge(products, on='product_id')
      [['order_id', 'status', 'category']].drop_duplicates())
rates = oc.assign(ret=(oc.status == 'Returned').astype(int)).groupby('category').agg(orders=('order_id', 'count'), returned_orders=('ret', 'sum')).reset_index()
rs = oc.merge(returns, on='order_id').groupby(['category', 'reason']).size().reset_index(name='n')
rs = rs.sort_values(['category', 'n', 'reason'], ascending=[True, False, True]).drop_duplicates('category')
result = rates.merge(rs[['category', 'reason']].rename(columns={'reason': 'top_reason'}), on='category', how='left')
result['return_rate_pct'] = (100 * result.returned_orders / result.orders).round(2)
result = result[['category', 'orders', 'returned_orders', 'return_rate_pct', 'top_reason']].sort_values('return_rate_pct', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Same decomposition: grain → rates → mode (sort + drop_duplicates) → left merge.</p>`
},
{
  id: 45, title: 'Brand profitability (gross margin)', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['Joins', 'Aggregation', 'Business case'], companies: ['Amazon', 'Nykaa', 'Reliance Retail', 'Tata Cliq'], ordered: true,
  prompt: `<p>For 2024 recognised sales (Delivered or Shipped): revenue = Σ quantity × unit_price, COGS = Σ quantity × cost_price, gross_profit = revenue − COGS, margin_pct = gross_profit / revenue × 100.</p>
<p>Return the top 10 brands by gross profit: <code>brand</code>, <code>revenue</code>, <code>cogs</code>, <code>gross_profit</code>, <code>margin_pct</code> (all 2 dp). Sort by gross_profit desc.</p>`,
  hint: 'unit_price is on order_items (actual selling price); cost_price is on products.',
  sql: `SELECT p.brand,
       ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue,
       ROUND(SUM(oi.quantity * p.cost_price), 2)  AS cogs,
       ROUND(SUM(oi.quantity * (oi.unit_price - p.cost_price)), 2) AS gross_profit,
       ROUND(100.0 * SUM(oi.quantity * (oi.unit_price - p.cost_price)) / SUM(oi.quantity * oi.unit_price), 2) AS margin_pct
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.status IN ('Delivered', 'Shipped')
  AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
GROUP BY p.brand
ORDER BY gross_profit DESC
LIMIT 10;`,
  sql_explain: `<p>Ratio of sums, not average of ratios: <code>SUM(profit)/SUM(revenue)</code> weights by revenue. <code>AVG(line_margin_pct)</code> would let a ₹299 item count as much as a ₹24,999 monitor — a classic analyst mistake.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
l = o.merge(order_items, on='order_id').merge(products, on='product_id')
l['rev'] = l.quantity * l.unit_price
l['cogs'] = l.quantity * l.cost_price
b = l.groupby('brand').agg(revenue=('rev', 'sum'), cogs=('cogs', 'sum')).reset_index()
b['gross_profit'] = b.revenue - b.cogs
b['margin_pct'] = 100 * b.gross_profit / b.revenue
result = b.sort_values('gross_profit', ascending=False).head(10).round(2).reset_index(drop=True)`,
  py_explain: `<p>Aggregate revenue and COGS separately, then derive profit and margin from the totals.</p>`
},
{
  id: 46, title: 'City revenue per active customer, ranked within state', difficulty: 'Medium', tier: 2, dataset: 'retail',
  topics: ['Window ranking', 'Aggregation', 'Business case'], companies: ['Flipkart', 'Swiggy', 'Reliance Retail', 'DMart'], ordered: true,
  prompt: `<p>For 2024 recognised sales (Delivered/Shipped), per city: <code>active_customers</code> (distinct customers who bought), <code>revenue</code>, <code>revenue_per_customer</code>, and <code>rank_in_state</code> by revenue_per_customer (RANK, highest = 1).</p>
<p>Return <code>state</code>, <code>city</code>, <code>active_customers</code>, <code>revenue</code>, <code>revenue_per_customer</code> (2 dp), <code>rank_in_state</code>. Sort by state, rank_in_state.</p>`,
  hint: 'City attributes come from customers. Aggregate per state/city, then RANK() OVER (PARTITION BY state …).',
  sql: `WITH city AS (
  SELECT c.state, c.city,
         COUNT(DISTINCT c.customer_id)       AS active_customers,
         SUM(oi.quantity * oi.unit_price)    AS revenue
  FROM customers c
  JOIN orders o       ON o.customer_id = c.customer_id
  JOIN order_items oi ON oi.order_id   = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY c.state, c.city
)
SELECT state, city, active_customers,
       ROUND(revenue, 2) AS revenue,
       ROUND(revenue / active_customers, 2) AS revenue_per_customer,
       RANK() OVER (PARTITION BY state ORDER BY revenue / active_customers DESC) AS rank_in_state
FROM city
ORDER BY state, rank_in_state;`,
  sql_explain: `<p>Per-customer metrics need <code>COUNT(DISTINCT customer_id)</code> as the denominator (orders and lines repeat customers). The window can order by an expression of already-aggregated columns.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
l = o.merge(order_items, on='order_id').merge(customers[['customer_id', 'city', 'state']], on='customer_id')
l['v'] = l.quantity * l.unit_price
c = l.groupby(['state', 'city']).agg(active_customers=('customer_id', 'nunique'), revenue=('v', 'sum')).reset_index()
c['revenue_per_customer'] = c.revenue / c.active_customers
c['rank_in_state'] = c.groupby('state').revenue_per_customer.rank(method='min', ascending=False).astype(int)
c = c.round({'revenue': 2, 'revenue_per_customer': 2})
result = c.sort_values(['state', 'rank_in_state']).reset_index(drop=True)`,
  py_explain: `<p><code>rank(method='min')</code> = SQL RANK().</p>`
},
{
  id: 47, title: 'Do coupons raise order value? (by channel)', difficulty: 'Easy', tier: 1, dataset: 'retail',
  topics: ['CASE', 'Aggregation', 'Business case'], companies: ['Swiggy', 'Zomato', 'Meesho', 'Myntra'], ordered: true,
  prompt: `<p>For 2024 orders with status Delivered or Shipped, compare orders that used a coupon (<code>coupon_code</code> not NULL) vs not.</p>
<p>Return <code>channel</code>, <code>coupon_used</code> ('Yes'/'No'), <code>orders</code>, <code>aov</code> (2 dp), <code>avg_lines</code> (2 dp). Sort by channel, coupon_used.</p>`,
  hint: 'Order-level CTE (value, lines), then group by channel and CASE WHEN coupon_code IS NULL.',
  sql: `WITH o AS (
  SELECT o.order_id, o.channel,
         CASE WHEN o.coupon_code IS NULL THEN 'No' ELSE 'Yes' END AS coupon_used,
         SUM(oi.quantity * oi.unit_price) AS value,
         COUNT(*) AS lines
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY o.order_id, o.channel, coupon_used
)
SELECT channel, coupon_used, COUNT(*) AS orders,
       ROUND(AVG(value), 2) AS aov, ROUND(AVG(lines), 2) AS avg_lines
FROM o
GROUP BY channel, coupon_used
ORDER BY channel, coupon_used;`,
  sql_explain: `<p><code>= NULL</code> never matches — always <code>IS NULL</code>. Talk about the bias too: coupon users self-select (e.g. WELCOME10 is for first orders), so this is correlation, not causation — an A/B test is needed for causal impact.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
l = o.merge(order_items, on='order_id')
l['v'] = l.quantity * l.unit_price
ov = l.groupby(['order_id', 'channel']).agg(value=('v', 'sum'), lines=('item_id', 'count')).reset_index()
ov = ov.merge(o[['order_id', 'coupon_code']], on='order_id')
ov['coupon_used'] = np.where(ov.coupon_code.isna(), 'No', 'Yes')
result = ov.groupby(['channel', 'coupon_used']).agg(orders=('order_id', 'count'), aov=('value', 'mean'), avg_lines=('lines', 'mean')).reset_index().round(2)`,
  py_explain: `<p><code>np.where(cond, a, b)</code> is a 2-branch CASE. <code>isna()</code> catches None/NaN.</p>`
},
{
  id: 48, title: 'Market basket: products most often bought together', difficulty: 'Hard', tier: 2, dataset: 'retail',
  topics: ['Self join', 'Market basket', 'Aggregation'], companies: ['Amazon', 'Flipkart', 'BigBasket', 'Walmart', 'Instacart'], ordered: true,
  prompt: `<p>Considering 2024 orders that are not Cancelled, find the 5 product pairs that appear together in the most orders. Each unordered pair must appear once (use product_a &lt; product_b by id).</p>
<p>Return <code>product_a</code>, <code>product_b</code> (product names), <code>orders_together</code>. Sort by <code>orders_together</code> desc, then product_a id, product_b id.</p>`,
  hint: 'Self join order_items on the same order_id with a.product_id < b.product_id.',
  sql: `WITH lines AS (
  SELECT DISTINCT oi.order_id, oi.product_id
  FROM order_items oi
  JOIN orders o ON o.order_id = oi.order_id
  WHERE o.status <> 'Cancelled'
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
), pairs AS (
  SELECT a.product_id AS pa, b.product_id AS pb, COUNT(*) AS orders_together
  FROM lines a
  JOIN lines b ON b.order_id = a.order_id AND a.product_id < b.product_id
  GROUP BY a.product_id, b.product_id
)
SELECT p1.product_name AS product_a, p2.product_name AS product_b, orders_together
FROM pairs
JOIN products p1 ON p1.product_id = pairs.pa
JOIN products p2 ON p2.product_id = pairs.pb
ORDER BY orders_together DESC, pairs.pa, pairs.pb
LIMIT 5;`,
  sql_explain: `<p><code>a.product_id &lt; b.product_id</code> does three things at once: removes self-pairs, removes mirrored duplicates (A,B)/(B,A), and halves the join size. Follow-ups: support, confidence (P(B|A)) and lift = P(A,B) / (P(A)·P(B)).</p>`,
  py: `o = orders[(orders.status != 'Cancelled') & (orders.order_date.dt.year == 2024)]
l = order_items[order_items.order_id.isin(o.order_id)][['order_id', 'product_id']].drop_duplicates()
pr = l.merge(l, on='order_id', suffixes=('_a', '_b'))
pr = pr[pr.product_id_a < pr.product_id_b]
c = pr.groupby(['product_id_a', 'product_id_b']).size().reset_index(name='orders_together')
c = c.sort_values(['orders_together', 'product_id_a', 'product_id_b'], ascending=[False, True, True]).head(5)
names = products.set_index('product_id').product_name
result = pd.DataFrame({'product_a': c.product_id_a.map(names).values, 'product_b': c.product_id_b.map(names).values, 'orders_together': c.orders_together.values})`,
  py_explain: `<p>Self-merge on order_id, keep a &lt; b, count. <code>Series.map</code> with an id→name Series is a fast lookup join.</p>`
},
{
  id: 49, title: 'Referral leaderboard', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['Self join', 'LEFT JOIN', 'Aggregation'], companies: ['CRED', 'PhonePe', 'Groww', 'Zepto'], ordered: true,
  prompt: `<p><code>customers.referred_by</code> points to the referring customer. For each referrer: <code>referred_customers</code>, <code>converted</code> (referred customers with ≥1 Delivered/Shipped order), <code>referred_revenue</code> (all-time recognised revenue of their referees, 2 dp; 0 if none).</p>
<p>Return the top 10 referrers: <code>referrer_id</code>, <code>referrer_name</code>, <code>referred_customers</code>, <code>converted</code>, <code>referred_revenue</code>. Sort by referred_revenue desc, then referrer_id.</p>`,
  hint: 'Revenue per customer CTE; self join customers (referee → referrer); LEFT JOIN revenue.',
  sql: `WITH rev AS (
  SELECT o.customer_id, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
  GROUP BY o.customer_id
)
SELECT r.customer_id   AS referrer_id,
       r.customer_name AS referrer_name,
       COUNT(*)                       AS referred_customers,
       COUNT(rev.customer_id)         AS converted,
       ROUND(COALESCE(SUM(rev.revenue), 0), 2) AS referred_revenue
FROM customers c
JOIN customers r ON r.customer_id = c.referred_by
LEFT JOIN rev    ON rev.customer_id = c.customer_id
GROUP BY r.customer_id, r.customer_name
ORDER BY referred_revenue DESC, referrer_id
LIMIT 10;`,
  sql_explain: `<p>Pre-aggregate revenue per customer so the self join stays one row per referee (no fan-out). <code>COUNT(rev.customer_id)</code> counts only referees with revenue.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped'])].merge(order_items, on='order_id')
o['v'] = o.quantity * o.unit_price
rev = o.groupby('customer_id').v.sum().rename('revenue')
c = customers[customers.referred_by.notna()].join(rev, on='customer_id')
g = c.groupby('referred_by').agg(referred_customers=('customer_id', 'count'), converted=('revenue', 'count'), referred_revenue=('revenue', 'sum')).reset_index()
g['referrer_id'] = g.referred_by.astype(int)
g = g.merge(customers[['customer_id', 'customer_name']].rename(columns={'customer_id': 'referrer_id', 'customer_name': 'referrer_name'}), on='referrer_id')
g['referred_revenue'] = g.referred_revenue.round(2)
result = (g.sort_values(['referred_revenue', 'referrer_id'], ascending=[False, True]).head(10)
          [['referrer_id', 'referrer_name', 'referred_customers', 'converted', 'referred_revenue']].reset_index(drop=True))`,
  py_explain: `<p>Group referees by <code>referred_by</code>; <code>'count'</code> on revenue counts only converted ones (non-NaN).</p>`
},
{
  id: 50, title: 'Customers whose spend grew every quarter of 2024', difficulty: 'Hard', tier: 2, dataset: 'retail',
  topics: ['Pivot', 'Conditional aggregation', 'LAG/LEAD'], companies: ['American Express', 'Amazon', 'CRED', 'HDFC Bank'], ordered: true,
  prompt: `<p>Quarterly recognised spend (Delivered/Shipped) per customer for 2024. Find customers with spend in all four quarters where each quarter is <b>strictly greater</b> than the previous one.</p>
<p>Return <code>customer_id</code>, <code>q1</code>, <code>q2</code>, <code>q3</code>, <code>q4</code> (2 dp). Sort by q4 desc.</p>`,
  hint: 'Pivot with SUM(CASE WHEN QUARTER(order_date)=k …). Then a simple WHERE q1>0 AND q2>q1 AND q3>q2 AND q4>q3.',
  sql: `WITH q AS (
  SELECT o.customer_id,
         SUM(CASE WHEN QUARTER(o.order_date) = 1 THEN oi.quantity * oi.unit_price ELSE 0 END) AS q1,
         SUM(CASE WHEN QUARTER(o.order_date) = 2 THEN oi.quantity * oi.unit_price ELSE 0 END) AS q2,
         SUM(CASE WHEN QUARTER(o.order_date) = 3 THEN oi.quantity * oi.unit_price ELSE 0 END) AS q3,
         SUM(CASE WHEN QUARTER(o.order_date) = 4 THEN oi.quantity * oi.unit_price ELSE 0 END) AS q4
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY o.customer_id
)
SELECT customer_id, ROUND(q1, 2) AS q1, ROUND(q2, 2) AS q2, ROUND(q3, 2) AS q3, ROUND(q4, 2) AS q4
FROM q
WHERE q1 > 0 AND q2 > q1 AND q3 > q2 AND q4 > q3
ORDER BY q4 DESC;`,
  sql_explain: `<p>Pivoting turns a row-wise comparison problem into a column-wise one that a plain WHERE can express. The window alternative (LAG over quarters + "all diffs &gt; 0") breaks when a quarter is missing — the pivot fills it with 0 and the check fails correctly.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)].merge(order_items, on='order_id')
o['v'] = o.quantity * o.unit_price
o['q'] = 'q' + o.order_date.dt.quarter.astype(str)
p = o.pivot_table(index='customer_id', columns='q', values='v', aggfunc='sum', fill_value=0).reindex(columns=['q1', 'q2', 'q3', 'q4'], fill_value=0)
p = p[(p.q1 > 0) & (p.q2 > p.q1) & (p.q3 > p.q2) & (p.q4 > p.q3)]
result = p.round(2).reset_index().sort_values('q4', ascending=False).reset_index(drop=True)
result.columns.name = None`,
  py_explain: `<p><code>pivot_table(..., fill_value=0)</code> then vectorised comparisons across columns.</p>`
},
{
  id: 51, title: 'Q4 year-over-year growth by category', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['Pivot', 'Conditional aggregation', 'Date functions'], companies: ['Flipkart', 'Amazon', 'Reliance Retail', 'Nykaa'], ordered: true,
  prompt: `<p>Compare festive-quarter (Oct–Dec) recognised revenue (Delivered/Shipped) of 2024 vs 2023 for each category.</p>
<p>Return <code>category</code>, <code>q4_2023</code>, <code>q4_2024</code>, <code>yoy_growth_pct</code> (all 2 dp). Sort by yoy_growth_pct desc.</p>`,
  hint: 'One scan: filter to both Q4 windows, then SUM(CASE WHEN YEAR(order_date)=2023 …) and the same for 2024.',
  sql: `SELECT p.category,
       ROUND(SUM(CASE WHEN YEAR(o.order_date) = 2023 THEN oi.quantity * oi.unit_price ELSE 0 END), 2) AS q4_2023,
       ROUND(SUM(CASE WHEN YEAR(o.order_date) = 2024 THEN oi.quantity * oi.unit_price ELSE 0 END), 2) AS q4_2024,
       ROUND(100.0 * (SUM(CASE WHEN YEAR(o.order_date) = 2024 THEN oi.quantity * oi.unit_price ELSE 0 END)
                    - SUM(CASE WHEN YEAR(o.order_date) = 2023 THEN oi.quantity * oi.unit_price ELSE 0 END))
             / SUM(CASE WHEN YEAR(o.order_date) = 2023 THEN oi.quantity * oi.unit_price ELSE 0 END), 2) AS yoy_growth_pct
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.status IN ('Delivered', 'Shipped')
  AND ((o.order_date >= '2023-10-01' AND o.order_date < '2024-01-01')
    OR (o.order_date >= '2024-10-01' AND o.order_date < '2025-01-01'))
GROUP BY p.category
ORDER BY yoy_growth_pct DESC;`,
  sql_explain: `<p>Comparing periods side-by-side = conditional aggregation in one pass (instead of two subqueries joined). Wrap it in a CTE if the repeated CASE feels noisy.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.month >= 10) & orders.order_date.dt.year.isin([2023, 2024])]
l = o.merge(order_items, on='order_id').merge(products, on='product_id')
l['v'] = l.quantity * l.unit_price
p = l.pivot_table(index='category', columns=l.order_date.dt.year, values='v', aggfunc='sum')
result = pd.DataFrame({'category': p.index, 'q4_2023': p[2023].values, 'q4_2024': p[2024].values})
result['yoy_growth_pct'] = 100 * (result.q4_2024 - result.q4_2023) / result.q4_2023
result = result.round(2).sort_values('yoy_growth_pct', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Pivot by year, then compute growth between the two columns.</p>`
}
);
