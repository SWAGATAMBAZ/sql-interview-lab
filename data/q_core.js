/* Section 1 — Joins, aggregation & fundamentals that still trip people up */
window.QUESTIONS = window.QUESTIONS || [];
window.QUESTIONS.push(
{
  id: 1, title: 'Monthly revenue by category (2024)', difficulty: 'Easy', tier: 1, dataset: 'retail',
  topics: ['Joins', 'Aggregation', 'Date functions'], companies: ['Razorpay', 'Flipkart', 'Amazon'], ordered: true,
  prompt: `<p>Finance wants a monthly category view for 2024. <b>Recognised revenue</b> = <code>quantity * unit_price</code> of order lines whose order status is <b>Delivered</b> or <b>Shipped</b> (cancelled and returned orders are excluded).</p>
<p>Return <code>month</code> (format <code>YYYY-MM</code>), <code>category</code>, <code>revenue</code> (rounded to 2 decimals) for every month of 2024.</p>
<p>Sort by <code>month</code> ascending, then <code>revenue</code> descending.</p>`,
  hint: 'Join orders → order_items → products. Filter on the order date range (not YEAR(order_date)=2024 — that blocks index use), then GROUP BY month and category.',
  sql: `SELECT DATE_FORMAT(o.order_date, '%Y-%m')            AS month,
       p.category,
       ROUND(SUM(oi.quantity * oi.unit_price), 2)   AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id   = o.order_id
JOIN products    p  ON p.product_id  = oi.product_id
WHERE o.status IN ('Delivered', 'Shipped')
  AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
GROUP BY month, p.category
ORDER BY month, revenue DESC;`,
  sql_explain: `<ol><li><b>Grain first:</b> revenue lives at the order-line grain (order_items), status lives on the order header, category on products — so we need all three tables.</li>
<li><b>Filter early:</b> status + a half-open date range (<code>&gt;= '2024-01-01' AND &lt; '2025-01-01'</code>). A range on the raw column is <i>sargable</i> (can use an index); wrapping it in <code>YEAR()</code> is not.</li>
<li><b>Aggregate</b> by the formatted month and category, then sort.</li></ol>
<p><b>Common mistakes:</b> forgetting to multiply by quantity; filtering only <code>'Delivered'</code> when the definition says Delivered + Shipped; using <code>BETWEEN '2024-01-01' AND '2024-12-31'</code> on DATETIME columns (drops everything after midnight on Dec 31).</p>`,
  py: `df = (orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
      .merge(order_items, on='order_id')
      .merge(products, on='product_id'))
df['month'] = df.order_date.dt.strftime('%Y-%m')
df['rev'] = df.quantity * df.unit_price
result = (df.groupby(['month', 'category'], as_index=False)
            .agg(revenue=('rev', 'sum')))
result['revenue'] = result.revenue.round(2)
result = result.sort_values(['month', 'revenue'], ascending=[True, False]).reset_index(drop=True)`,
  py_explain: `<p>Filter the header first (smaller frame → cheaper merges), merge down to line level, build a <code>month</code> string with <code>dt.strftime</code>, then <code>groupby(...).agg()</code> with a named aggregation. <code>as_index=False</code> keeps the keys as columns.</p>`
},
{
  id: 2, title: 'Customers who never placed an order', difficulty: 'Easy', tier: 1, dataset: 'retail',
  topics: ['Joins', 'Anti join'], companies: ['Amazon', 'Meesho', 'TCS', 'Swiggy'], ordered: true,
  prompt: `<p>Marketing wants to target registered customers who have <b>never placed any order</b> (any status).</p>
<p>Return <code>customer_id</code>, <code>customer_name</code>, <code>city</code>, <code>signup_date</code>, sorted by <code>customer_id</code>.</p>`,
  hint: 'This is an anti-join. Know three ways: LEFT JOIN … IS NULL, NOT EXISTS, NOT IN — and why NOT IN is dangerous when the subquery can return NULL.',
  sql: `SELECT c.customer_id, c.customer_name, c.city, c.signup_date
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
ORDER BY c.customer_id;`,
  sql_explain: `<p><code>NOT EXISTS</code> stops at the first matching order per customer (semi-join), so it is usually the fastest and it is <b>NULL-safe</b>.</p>
<p>Equivalent: <code>LEFT JOIN orders o ON … WHERE o.order_id IS NULL</code>.</p>
<p><b>Trap:</b> <code>WHERE customer_id NOT IN (SELECT customer_id FROM orders)</code> returns <b>zero rows</b> if any <code>orders.customer_id</code> is NULL, because <code>x NOT IN (…, NULL)</code> evaluates to UNKNOWN. Interviewers love this follow-up.</p>`,
  py: `result = (customers[~customers.customer_id.isin(orders.customer_id)]
          [['customer_id', 'customer_name', 'city', 'signup_date']]
          .sort_values('customer_id').reset_index(drop=True))`,
  py_explain: `<p><code>isin</code> builds a hash set of ordered customer ids; <code>~</code> negates it. Alternative: <code>merge(how='left', indicator=True)</code> and keep <code>_merge == 'left_only'</code>.</p>`
},
{
  id: 3, title: 'Second highest salary', difficulty: 'Easy', tier: 1, dataset: 'hr',
  topics: ['Subquery', 'Window ranking'], companies: ['Flipkart', 'Amazon', 'Infosys', 'Accenture', 'Deloitte'], ordered: true,
  prompt: `<p>The single most asked SQL question in India. Return the <b>second highest distinct salary</b> in the company as one column <code>second_highest_salary</code>. If there is no second highest salary, the query must return <code>NULL</code> (one row), not an empty result.</p>`,
  hint: 'MAX of everything below the MAX. Aggregates over an empty set return one row with NULL — that solves the edge case for free.',
  sql: `SELECT MAX(salary) AS second_highest_salary
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);

-- Generalises to the Nth highest:
-- SELECT MAX(salary) FROM (
--   SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS dr FROM employees
-- ) t WHERE dr = 2;`,
  sql_explain: `<p>The inner query finds the top salary; the outer <code>MAX</code> picks the highest salary strictly below it. Because the outer query is an aggregate without GROUP BY, it always returns exactly one row — NULL if nothing qualifies.</p>
<p><b>Why not <code>ORDER BY salary DESC LIMIT 1 OFFSET 1</code>?</b> It breaks on duplicates (two people on the top salary) and returns no row instead of NULL. Fix with <code>SELECT DISTINCT</code> and wrapping it: <code>SELECT (SELECT DISTINCT … LIMIT 1 OFFSET 1) AS second_highest_salary</code>.</p>
<p>For "Nth highest", use <code>DENSE_RANK()</code> — it gives tied salaries the same rank with no gaps.</p>`,
  py: `s = employees.salary.drop_duplicates().nlargest(2)
result = pd.DataFrame({'second_highest_salary': [s.iloc[1] if len(s) > 1 else None]})`,
  py_explain: `<p>Drop duplicate salaries, take the two largest, return the 2nd if it exists. Always wrap scalar answers in a one-row DataFrame.</p>`
},
{
  id: 4, title: 'Top 3 earners in every department (ties included)', difficulty: 'Medium', tier: 1, dataset: 'hr',
  topics: ['Window ranking', 'Top-N per group'], companies: ['Amazon', 'Flipkart', 'Meesho', 'Walmart'], ordered: true,
  prompt: `<p>For each department, return employees whose salary is among the <b>top 3 distinct salaries</b> of that department (so ties share a rank and can produce more than 3 rows).</p>
<p>Return <code>dept_name</code>, <code>emp_name</code>, <code>salary</code>, <code>salary_rank</code>. Sort by <code>dept_name</code>, <code>salary_rank</code>, <code>emp_name</code>. Employees without a department (the CEO) are excluded.</p>`,
  hint: 'DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC). You cannot filter a window function in WHERE — wrap it in a CTE.',
  sql: `WITH ranked AS (
  SELECT d.dept_name, e.emp_name, e.salary,
         DENSE_RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS salary_rank
  FROM employees e
  JOIN departments d ON d.dept_id = e.dept_id
)
SELECT dept_name, emp_name, salary, salary_rank
FROM ranked
WHERE salary_rank <= 3
ORDER BY dept_name, salary_rank, emp_name;`,
  sql_explain: `<ul><li><code>ROW_NUMBER</code> → 1,2,3,4 (ties broken arbitrarily) — use when you need exactly N rows.</li>
<li><code>RANK</code> → 1,1,3 (gaps) — "top 3 positions".</li>
<li><code>DENSE_RANK</code> → 1,1,2 (no gaps) — "top 3 distinct salaries". That's what's asked here.</li></ul>
<p>Window functions are evaluated after WHERE/GROUP BY, so the filter on the rank must happen in an outer query (CTE or subquery). The inner JOIN naturally drops the CEO (NULL dept).</p>`,
  py: `e = employees.merge(departments, on='dept_id')
e['salary_rank'] = (e.groupby('dept_id').salary
                     .rank(method='dense', ascending=False).astype(int))
result = (e[e.salary_rank <= 3][['dept_name', 'emp_name', 'salary', 'salary_rank']]
          .sort_values(['dept_name', 'salary_rank', 'emp_name']).reset_index(drop=True))`,
  py_explain: `<p><code>groupby().rank(method='dense', ascending=False)</code> is pandas' DENSE_RANK. <code>method='min'</code> = RANK, <code>method='first'</code> ≈ ROW_NUMBER. Inner merge drops the CEO.</p>`
},
{
  id: 5, title: 'Employees who earn more than their manager', difficulty: 'Easy', tier: 1, dataset: 'hr',
  topics: ['Self join'], companies: ['Flipkart', 'Amazon', 'PhonePe'], ordered: true,
  prompt: `<p>Find every employee whose salary is <b>strictly greater</b> than their direct manager's salary.</p>
<p>Return <code>emp_name</code>, <code>emp_salary</code>, <code>manager_name</code>, <code>manager_salary</code> sorted by <code>emp_name</code>.</p>`,
  hint: 'Join employees to itself: e.manager_id = m.emp_id.',
  sql: `SELECT e.emp_name,
       e.salary  AS emp_salary,
       m.emp_name AS manager_name,
       m.salary  AS manager_salary
FROM employees e
JOIN employees m ON m.emp_id = e.manager_id
WHERE e.salary > m.salary
ORDER BY e.emp_name;`,
  sql_explain: `<p>A <b>self join</b> treats the same table as two roles: <code>e</code> (employee) and <code>m</code> (manager). Inner join automatically excludes the CEO whose <code>manager_id</code> is NULL.</p>`,
  py: `m = employees[['emp_id', 'emp_name', 'salary']].rename(
        columns={'emp_id': 'manager_id', 'emp_name': 'manager_name', 'salary': 'manager_salary'})
df = employees.merge(m, on='manager_id')
result = (df[df.salary > df.manager_salary]
          .rename(columns={'salary': 'emp_salary'})
          [['emp_name', 'emp_salary', 'manager_name', 'manager_salary']]
          .sort_values('emp_name').reset_index(drop=True))`,
  py_explain: `<p>Rename the manager copy's columns so the merge key matches <code>manager_id</code> and names don't collide.</p>`
},
{
  id: 6, title: 'Department headcount including empty departments', difficulty: 'Easy', tier: 1, dataset: 'hr',
  topics: ['Joins', 'Aggregation', 'NULL handling'], companies: ['Deloitte', 'Amazon', 'EY'], ordered: true,
  prompt: `<p>HR needs headcount and average salary for <b>every</b> department, including departments with no employees (they must show headcount 0 and a NULL average).</p>
<p>Return <code>dept_name</code>, <code>headcount</code>, <code>avg_salary</code> (rounded to 2). Sort by <code>headcount</code> desc, then <code>dept_name</code>.</p>`,
  hint: "LEFT JOIN from departments. COUNT(*) counts the NULL-extended row as 1 — what should you count instead?",
  sql: `SELECT d.dept_name,
       COUNT(e.emp_id)          AS headcount,
       ROUND(AVG(e.salary), 2)  AS avg_salary
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name
ORDER BY headcount DESC, d.dept_name;`,
  sql_explain: `<p>The driving table must be <code>departments</code> so empty departments survive. For an empty department the LEFT JOIN produces one row with all employee columns NULL:</p>
<ul><li><code>COUNT(*)</code> → 1 ❌ (counts the row)</li><li><code>COUNT(e.emp_id)</code> → 0 ✅ (ignores NULLs)</li><li><code>AVG(e.salary)</code> → NULL ✅</li></ul>`,
  py: `df = departments.merge(employees, on='dept_id', how='left')
result = (df.groupby('dept_name', as_index=False)
            .agg(headcount=('emp_id', 'count'), avg_salary=('salary', 'mean')))
result['avg_salary'] = result.avg_salary.round(2)
result = result.sort_values(['headcount', 'dept_name'], ascending=[False, True]).reset_index(drop=True)`,
  py_explain: `<p>In pandas, <code>'count'</code> ignores NaN (like <code>COUNT(col)</code>) while <code>'size'</code> counts rows (like <code>COUNT(*)</code>).</p>`
},
{
  id: 7, title: 'Payment-mode mix and AOV', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['CTE', 'Aggregation', 'Window aggregate'], companies: ['Razorpay', 'PhonePe', 'Paytm', 'Flipkart'], ordered: true,
  prompt: `<p>For 2024 orders with status Delivered or Shipped, compute per <code>payment_mode</code>:</p>
<ul><li><code>orders</code> – number of orders</li><li><code>pct_of_orders</code> – share of all such orders (×100, 2 decimals)</li><li><code>aov</code> – average order value, where order value = Σ quantity × unit_price of its lines (2 decimals)</li></ul>
<p>Sort by <code>orders</code> desc.</p>`,
  hint: 'Compute order value at the ORDER grain first (CTE), then aggregate by payment mode. SUM(COUNT(*)) OVER () gives the grand total without a second query.',
  sql: `WITH order_value AS (
  SELECT o.order_id, o.payment_mode, SUM(oi.quantity * oi.unit_price) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY o.order_id, o.payment_mode
)
SELECT payment_mode,
       COUNT(*)                                           AS orders,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct_of_orders,
       ROUND(AVG(value), 2)                               AS aov
FROM order_value
GROUP BY payment_mode
ORDER BY orders DESC;`,
  sql_explain: `<p><b>Grain discipline:</b> if you compute <code>AVG(quantity*unit_price)</code> directly on the joined rows you get <i>average line value</i>, not average <i>order</i> value. So collapse to one row per order first.</p>
<p><code>SUM(COUNT(*)) OVER ()</code> — the window runs <i>after</i> GROUP BY, over the grouped rows, so it sums the per-mode counts into a grand total. Multiplying by <code>100.0</code> forces decimal math (important in Postgres/SQL Server where int/int truncates).</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
lines = o.merge(order_items, on='order_id')
lines['v'] = lines.quantity * lines.unit_price
ov = lines.groupby(['order_id', 'payment_mode'], as_index=False).agg(value=('v', 'sum'))
result = ov.groupby('payment_mode', as_index=False).agg(orders=('order_id', 'count'), aov=('value', 'mean'))
result['pct_of_orders'] = (100 * result.orders / result.orders.sum()).round(2)
result['aov'] = result.aov.round(2)
result = result[['payment_mode', 'orders', 'pct_of_orders', 'aov']].sort_values('orders', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Same two-step grain logic: line → order (sum), order → payment mode (count, mean). The share is just a vectorised division by the column total.</p>`
},
{
  id: 8, title: 'De-duplicate messy leads (keep the earliest)', difficulty: 'Medium', tier: 1,
  tables: {
    leads: QT('lead_id:INT,email:TEXT,phone:TEXT,created_at:DATETIME,source:TEXT', [
      [1, 'Riya.Sharma@gmail.com', '98450 11111', '2024-03-01 09:15:00', 'Google Ads'],
      [2, 'arjun.k@yahoo.com', '9845022222', '2024-03-01 10:02:00', 'Instagram'],
      [3, ' riya.sharma@gmail.com', '9845011111', '2024-03-02 18:40:00', 'Referral'],
      [4, 'neha.gupta@outlook.com', '9845033333', '2024-03-03 11:11:00', 'Google Ads'],
      [5, 'ARJUN.K@YAHOO.COM', '9845022222', '2024-02-28 08:00:00', 'Website'],
      [6, 'kabir@startup.io', null, '2024-03-04 12:00:00', 'LinkedIn'],
      [7, 'neha.gupta@outlook.com ', '9845033333', '2024-03-03 11:11:00', 'Website'],
      [8, 'meera.n@gmail.com', '9845044444', '2024-03-05 16:30:00', 'Instagram'],
      [9, 'Kabir@Startup.io', '9845055555', '2024-03-06 09:00:00', 'Google Ads'],
      [10, 'riya.sharma@gmail.com', '9845011111', '2024-03-07 13:20:00', 'Website']
    ])
  },
  topics: ['Data cleaning', 'Dedup', 'Window ranking'], companies: ['Zomato', 'Razorpay', 'Unacademy', 'LinkedIn'], ordered: true,
  prompt: `<p>The CRM has duplicate leads: the same email appears with different case and stray spaces. Two leads are duplicates if <code>LOWER(TRIM(email))</code> is equal.</p>
<p>Keep exactly one lead per clean email — the one with the earliest <code>created_at</code> (if tied, the smaller <code>lead_id</code>).</p>
<p>Return <code>lead_id</code>, <code>email_clean</code>, <code>created_at</code>, <code>source</code>, <code>duplicates_removed</code> (how many other rows shared that email). Sort by <code>lead_id</code>.</p>`,
  hint: 'ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY created_at, lead_id) and COUNT(*) OVER (same partition).',
  sql: `WITH x AS (
  SELECT lead_id, LOWER(TRIM(email)) AS email_clean, created_at, source,
         ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY created_at, lead_id) AS rn,
         COUNT(*)     OVER (PARTITION BY LOWER(TRIM(email)))                          AS cnt
  FROM leads
)
SELECT lead_id, email_clean, created_at, source, cnt - 1 AS duplicates_removed
FROM x
WHERE rn = 1
ORDER BY lead_id;

-- To physically delete duplicates in MySQL 8:
-- DELETE FROM leads WHERE lead_id IN (SELECT lead_id FROM x WHERE rn > 1);`,
  sql_explain: `<p>Normalise the key <b>inside</b> the PARTITION BY. <code>ROW_NUMBER</code> picks a single survivor deterministically (always add a tie-breaker like <code>lead_id</code>). A second window with the same partition counts the group size.</p>
<p>Interview follow-up: "Delete the duplicates" — select ids where <code>rn &gt; 1</code> and delete them (MySQL needs the CTE/derived table because you can't select from the table you're deleting from directly).</p>`,
  py: `df = leads.copy()
df['email_clean'] = df.email.str.strip().str.lower()
df['duplicates_removed'] = df.groupby('email_clean').lead_id.transform('count') - 1
df = df.sort_values(['created_at', 'lead_id'])
result = (df.drop_duplicates('email_clean', keep='first')
          [['lead_id', 'email_clean', 'created_at', 'source', 'duplicates_removed']]
          .sort_values('lead_id').reset_index(drop=True))`,
  py_explain: `<p>Sort by the priority order, then <code>drop_duplicates(subset, keep='first')</code> keeps the survivor. <code>transform('count')</code> broadcasts the group size back to each row (a window function in pandas).</p>`
},
{
  id: 9, title: 'WHERE vs HAVING: cities with many 2023 sign-ups', difficulty: 'Easy', tier: 1, dataset: 'retail',
  topics: ['Aggregation', 'HAVING', 'Conditional aggregation'], companies: ['Flipkart', 'Meesho', 'Accenture'], ordered: true,
  prompt: `<p>Find cities where <b>at least 12 customers signed up in 2023</b>. For those cities show how many of those 2023 sign-ups are in the <code>Corporate</code> segment.</p>
<p>Return <code>city</code>, <code>signups_2023</code>, <code>corporate_signups</code>. Sort by <code>signups_2023</code> desc, then <code>city</code>.</p>`,
  hint: 'Row filter (year) goes in WHERE, group filter (count ≥ 12) goes in HAVING. Conditional count = SUM(CASE WHEN … THEN 1 ELSE 0 END).',
  sql: `SELECT city,
       COUNT(*)                                             AS signups_2023,
       SUM(CASE WHEN segment = 'Corporate' THEN 1 ELSE 0 END) AS corporate_signups
FROM customers
WHERE signup_date >= '2023-01-01' AND signup_date < '2024-01-01'
GROUP BY city
HAVING COUNT(*) >= 12
ORDER BY signups_2023 DESC, city;`,
  sql_explain: `<p>Logical order of execution: <code>FROM → WHERE → GROUP BY → HAVING → SELECT → (window) → ORDER BY → LIMIT</code>. WHERE filters rows before grouping; HAVING filters groups after aggregation. That's also why you can't use a SELECT alias in WHERE in standard SQL (MySQL allows aliases in HAVING/ORDER BY).</p>`,
  py: `c = customers[customers.signup_date.dt.year == 2023].copy()
c['is_corp'] = (c.segment == 'Corporate').astype(int)
g = c.groupby('city', as_index=False).agg(signups_2023=('customer_id', 'count'), corporate_signups=('is_corp', 'sum'))
result = (g[g.signups_2023 >= 12]
          .sort_values(['signups_2023', 'city'], ascending=[False, True]).reset_index(drop=True))`,
  py_explain: `<p>Boolean filter before groupby = WHERE; boolean filter after = HAVING.</p>`
},
{
  id: 10, title: 'Basket size buckets', difficulty: 'Easy', tier: 1, dataset: 'retail',
  topics: ['CASE', 'CTE', 'Aggregation'], companies: ['Amazon', 'BigBasket', 'Blinkit'], ordered: true,
  prompt: `<p>Classify each 2024 order (status Delivered or Shipped) by the number of <b>order lines</b> it has: <code>'1 item'</code>, <code>'2-3 items'</code>, <code>'4+ items'</code>.</p>
<p>Return <code>basket_type</code>, <code>orders</code>, <code>avg_order_value</code> (2 decimals). Sort by <code>orders</code> desc.</p>`,
  hint: 'One CTE at order grain with COUNT(*) lines and SUM(value); then a CASE to bucket.',
  sql: `WITH o AS (
  SELECT o.order_id, COUNT(*) AS lines, SUM(oi.quantity * oi.unit_price) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status IN ('Delivered', 'Shipped')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY o.order_id
)
SELECT CASE WHEN lines = 1 THEN '1 item'
            WHEN lines <= 3 THEN '2-3 items'
            ELSE '4+ items' END AS basket_type,
       COUNT(*)              AS orders,
       ROUND(AVG(value), 2)  AS avg_order_value
FROM o
GROUP BY basket_type
ORDER BY orders DESC;`,
  sql_explain: `<p>CASE branches are evaluated top-down, so <code>lines &lt;= 3</code> already implies <code>lines &gt;= 2</code>. Grouping by the CASE alias works in MySQL; in strict ANSI you'd repeat the expression or wrap in a subquery.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped']) & (orders.order_date.dt.year == 2024)]
l = o.merge(order_items, on='order_id')
l['v'] = l.quantity * l.unit_price
g = l.groupby('order_id').agg(lines=('item_id', 'count'), value=('v', 'sum')).reset_index()
g['basket_type'] = np.select([g.lines == 1, g.lines <= 3], ['1 item', '2-3 items'], default='4+ items')
result = g.groupby('basket_type', as_index=False).agg(orders=('order_id', 'count'), avg_order_value=('value', 'mean'))
result['avg_order_value'] = result.avg_order_value.round(2)
result = result.sort_values('orders', ascending=False).reset_index(drop=True)`,
  py_explain: `<p><code>np.select(conditions, choices, default)</code> is the vectorised CASE WHEN. <code>pd.cut</code> also works for numeric bins.</p>`
},
{
  id: 11, title: 'Top 5 customers by lifetime value', difficulty: 'Medium', tier: 1, dataset: 'retail',
  topics: ['Joins', 'Aggregation', 'COUNT DISTINCT'], companies: ['Amazon', 'Myntra', 'Nykaa'], ordered: true,
  prompt: `<p>Lifetime value (LTV) = total recognised revenue (orders with status Delivered or Shipped, all years).</p>
<p>Return the top 5 customers: <code>customer_id</code>, <code>customer_name</code>, <code>city</code>, <code>orders</code> (distinct recognised orders), <code>first_order_date</code> (first recognised order), <code>ltv</code> (2 decimals). Sort by <code>ltv</code> desc.</p>`,
  hint: 'Joining orders to order_items multiplies order rows — use COUNT(DISTINCT o.order_id).',
  sql: `SELECT c.customer_id, c.customer_name, c.city,
       COUNT(DISTINCT o.order_id)                  AS orders,
       MIN(o.order_date)                           AS first_order_date,
       ROUND(SUM(oi.quantity * oi.unit_price), 2)  AS ltv
FROM customers c
JOIN orders o       ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.order_id   = o.order_id
WHERE o.status IN ('Delivered', 'Shipped')
GROUP BY c.customer_id, c.customer_name, c.city
ORDER BY ltv DESC
LIMIT 5;`,
  sql_explain: `<p><b>Fan-out:</b> after joining to order_items, an order with 3 lines appears 3 times. <code>COUNT(*)</code> would count lines; <code>COUNT(DISTINCT o.order_id)</code> counts orders. <code>MIN(order_date)</code> is unaffected by duplication, <code>SUM</code> of line revenue is correct because each line appears once.</p>`,
  py: `o = orders[orders.status.isin(['Delivered', 'Shipped'])]
l = o.merge(order_items, on='order_id')
l['v'] = l.quantity * l.unit_price
g = l.groupby('customer_id').agg(orders=('order_id', 'nunique'), first_order_date=('order_date', 'min'), ltv=('v', 'sum')).reset_index()
g['ltv'] = g.ltv.round(2)
result = (g.merge(customers[['customer_id', 'customer_name', 'city']], on='customer_id')
          .sort_values('ltv', ascending=False).head(5)
          [['customer_id', 'customer_name', 'city', 'orders', 'first_order_date', 'ltv']].reset_index(drop=True))`,
  py_explain: `<p><code>'nunique'</code> = COUNT(DISTINCT). Aggregate first, then attach descriptive columns — cheaper than grouping by name/city.</p>`
},
{
  id: 12, title: 'Products with zero sales in Q4 2024', difficulty: 'Easy', tier: 1, dataset: 'retail',
  topics: ['Anti join', 'NOT EXISTS'], companies: ['Amazon', 'Meesho', 'BigBasket'], ordered: true,
  prompt: `<p>Category managers want to delist products that did not sell at all in Q4 2024 (Oct 1 – Dec 31). A product "sold" if it appears in any order in that window whose status is not <code>Cancelled</code>.</p>
<p>Return <code>product_id</code>, <code>product_name</code>, <code>category</code> sorted by <code>product_id</code>.</p>`,
  hint: 'The date and status filters must be INSIDE the NOT EXISTS subquery (or inside the LEFT JOIN ON clause), not in the outer WHERE.',
  sql: `SELECT p.product_id, p.product_name, p.category
FROM products p
WHERE NOT EXISTS (
  SELECT 1
  FROM order_items oi
  JOIN orders o ON o.order_id = oi.order_id
  WHERE oi.product_id = p.product_id
    AND o.status <> 'Cancelled'
    AND o.order_date >= '2024-10-01' AND o.order_date < '2025-01-01'
)
ORDER BY p.product_id;`,
  sql_explain: `<p>Classic trap with the LEFT JOIN version: putting <code>o.order_date &gt;= '2024-10-01'</code> in the outer <code>WHERE</code> turns the LEFT JOIN into an INNER JOIN (NULL rows fail the predicate), and you get an empty answer. Conditions about the <i>optional</i> table belong in the <code>ON</code> clause or in the <code>NOT EXISTS</code> subquery.</p>`,
  py: `o = orders[(orders.status != 'Cancelled') & (orders.order_date >= '2024-10-01') & (orders.order_date < '2025-01-01')]
sold = order_items[order_items.order_id.isin(o.order_id)].product_id.unique()
result = (products[~products.product_id.isin(sold)][['product_id', 'product_name', 'category']]
          .sort_values('product_id').reset_index(drop=True))`,
  py_explain: `<p>Build the set of products sold in-window, then anti-filter the catalog with <code>~isin</code>.</p>`
}
);
