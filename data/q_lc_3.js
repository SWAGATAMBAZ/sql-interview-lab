/* LeetCode Database set — part 3 (1112 → 1251). Short rewrites + original sample data. */
LC(1112, {
  title: 'Highest Grade For Each Student', difficulty: 'Medium', topics: ['Window ranking', 'Top-N per group'], ordered: true,
  tables: { Enrollments: QT('student_id:INT,course_id:INT,grade:INT', [[2, 2, 95], [2, 3, 95], [1, 1, 22], [1, 2, 99], [3, 1, 80], [3, 2, 75], [3, 3, 82], [1, 3, 99]]) },
  prompt: `<p>For each student return their highest grade and its course; on a tie choose the smallest <code>course_id</code>. Return <code>student_id</code>, <code>course_id</code>, <code>grade</code> ordered by student_id.</p>`,
  hint: 'ROW_NUMBER() OVER (PARTITION BY student ORDER BY grade DESC, course_id).',
  sql: `SELECT student_id, course_id, grade
FROM (
  SELECT e.*, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY grade DESC, course_id) AS rn
  FROM Enrollments e
) t
WHERE rn = 1
ORDER BY student_id;`,
  sql_explain: `<p>Exactly one row per student with an explicit tie-break → ROW_NUMBER with the tie-break in ORDER BY. Pre-window: <code>WHERE (student_id, grade) IN (SELECT student_id, MAX(grade) …)</code>, then <code>MIN(course_id)</code> per student.</p>`,
  py: `result = (Enrollments.sort_values(['student_id', 'grade', 'course_id'], ascending=[True, False, True])
          .drop_duplicates('student_id').reset_index(drop=True))`,
  py_explain: `<p>Sort by the priority, keep the first per student.</p>`
});
LC(1113, {
  title: 'Reported Posts', difficulty: 'Easy', topics: ['COUNT DISTINCT', 'WHERE'],
  tables: { Actions: QT('user_id:INT,post_id:INT,action_date:DATE,action:TEXT,extra:TEXT', [[1, 1, '2019-07-01', 'view', null], [1, 1, '2019-07-01', 'like', null], [2, 4, '2019-07-04', 'view', null], [2, 4, '2019-07-04', 'report', 'spam'], [3, 4, '2019-07-04', 'report', 'spam'], [4, 3, '2019-07-02', 'report', 'spam'], [5, 2, '2019-07-04', 'report', 'racism'], [5, 5, '2019-07-04', 'report', 'racism'], [6, 6, '2019-07-04', 'report', 'spam'], [7, 6, '2019-07-05', 'report', 'racism']]) },
  prompt: `<p>For reports made on <b>2019-07-04</b> (the day before 2019-07-05), count the number of distinct posts reported per reason (<code>extra</code>). Return <code>report_reason</code>, <code>report_count</code>.</p>`,
  hint: 'Filter action = report and the date, GROUP BY extra, COUNT(DISTINCT post_id).',
  sql: `SELECT extra AS report_reason, COUNT(DISTINCT post_id) AS report_count
FROM Actions
WHERE action = 'report' AND action_date = '2019-07-04'
GROUP BY extra;`,
  sql_explain: `<p>Post 4 was reported for spam by two users → counts once. "Yesterday" relative to a date: <code>action_date = DATE_SUB('2019-07-05', INTERVAL 1 DAY)</code>.</p>`,
  py: `a = Actions[(Actions.action == 'report') & (Actions.action_date == '2019-07-04')]
result = a.groupby('extra').post_id.nunique().reset_index(name='report_count').rename(columns={'extra': 'report_reason'})`,
  py_explain: `<p>Filter, then nunique per reason.</p>`
});
LC(1126, {
  title: 'Active Businesses', difficulty: 'Medium', topics: ['Window aggregate', 'HAVING'],
  tables: { Events: QT('business_id:INT,event_type:TEXT,occurrences:INT', [[1, 'reviews', 7], [3, 'reviews', 3], [1, 'ads', 11], [2, 'ads', 7], [3, 'ads', 6], [1, 'page views', 3], [2, 'page views', 12], [3, 'page views', 15]]) },
  prompt: `<p>The average activity of an event type = average <code>occurrences</code> across businesses that have that event. A business is <b>active</b> if it has <b>more than one</b> event type whose occurrences are strictly greater than that type's average. Return <code>business_id</code>.</p>`,
  hint: 'AVG(occurrences) OVER (PARTITION BY event_type), then count above-average events per business.',
  sql: `SELECT business_id
FROM (
  SELECT business_id, occurrences,
         AVG(occurrences) OVER (PARTITION BY event_type) AS type_avg
  FROM Events
) t
WHERE occurrences > type_avg
GROUP BY business_id
HAVING COUNT(*) > 1;`,
  sql_explain: `<p>A window average attaches the per-type benchmark to every row without a join-back. Then it's a WHERE + GROUP BY + HAVING.</p>`,
  py: `e = Events.assign(avg=Events.groupby('event_type').occurrences.transform('mean'))
c = e[e.occurrences > e.avg].business_id.value_counts()
result = pd.DataFrame({'business_id': c[c > 1].index})`,
  py_explain: `<p>transform('mean') = AVG OVER (PARTITION BY).</p>`
});
LC(1141, {
  title: 'User Activity for the Past 30 Days I', difficulty: 'Easy', topics: ['Date functions', 'COUNT DISTINCT'],
  tables: { Activity: QT('user_id:INT,session_id:INT,activity_date:DATE,activity_type:TEXT', [[1, 1, '2019-07-20', 'open_session'], [1, 1, '2019-07-20', 'scroll_down'], [1, 1, '2019-07-20', 'end_session'], [2, 4, '2019-07-20', 'open_session'], [2, 4, '2019-07-21', 'send_message'], [2, 4, '2019-07-21', 'end_session'], [3, 2, '2019-07-21', 'open_session'], [3, 2, '2019-07-21', 'send_message'], [4, 3, '2019-06-25', 'open_session'], [4, 3, '2019-06-28', 'end_session'], [5, 6, '2019-07-28', 'open_session']]) },
  prompt: `<p>For the 30 days ending <b>2019-07-27</b> inclusive (2019-06-28 → 2019-07-27), return the daily active user count: <code>day</code>, <code>active_users</code>. Only days with activity appear.</p>`,
  hint: 'Window: activity_date BETWEEN DATE_SUB(\'2019-07-27\', INTERVAL 29 DAY) AND \'2019-07-27\'.',
  sql: `SELECT activity_date AS day, COUNT(DISTINCT user_id) AS active_users
FROM Activity
WHERE activity_date BETWEEN DATE_SUB('2019-07-27', INTERVAL 29 DAY) AND '2019-07-27'
GROUP BY activity_date;`,
  sql_explain: `<p>"30 days ending X inclusive" = X − 29 days … X. Off-by-one (−30) is the classic mistake — 2019-06-27 must be excluded, 2019-06-28 included.</p>`,
  py: `a = Activity[(Activity.activity_date >= '2019-06-28') & (Activity.activity_date <= '2019-07-27')]
result = a.groupby('activity_date').user_id.nunique().reset_index(name='active_users').rename(columns={'activity_date': 'day'})`,
  py_explain: `<p>Date range filter, nunique per day.</p>`
});
LC(1142, {
  title: 'User Activity for the Past 30 Days II', difficulty: 'Easy', topics: ['Date functions', 'COUNT DISTINCT', 'NULL handling'],
  tables: { Activity: QT('user_id:INT,session_id:INT,activity_date:DATE,activity_type:TEXT', [[1, 1, '2019-07-20', 'open_session'], [1, 1, '2019-07-20', 'end_session'], [2, 4, '2019-07-20', 'open_session'], [2, 4, '2019-07-21', 'end_session'], [3, 2, '2019-07-21', 'open_session'], [3, 5, '2019-07-21', 'open_session'], [3, 5, '2019-07-25', 'end_session'], [4, 3, '2019-06-25', 'open_session'], [4, 7, '2019-07-27', 'open_session']]) },
  prompt: `<p>For the same 30-day window (2019-06-28 → 2019-07-27), return the average number of sessions per user, rounded to 2 decimals, as <code>average_sessions_per_user</code> (0 if nobody was active).</p>`,
  hint: 'COUNT(DISTINCT session_id) / COUNT(DISTINCT user_id), wrapped in IFNULL.',
  sql: `SELECT ROUND(IFNULL(COUNT(DISTINCT session_id) / COUNT(DISTINCT user_id), 0), 2) AS average_sessions_per_user
FROM Activity
WHERE activity_date BETWEEN '2019-06-28' AND '2019-07-27';`,
  sql_explain: `<p>Ratio of two distinct counts in one pass. Sessions here are unique per user (LeetCode guarantees this); if they weren't, count distinct (user_id, session_id) pairs.</p>`,
  py: `a = Activity[(Activity.activity_date >= '2019-06-28') & (Activity.activity_date <= '2019-07-27')]
u = a.user_id.nunique()
result = pd.DataFrame({'average_sessions_per_user': [round(a.session_id.nunique() / u, 2) if u else 0.0]})`,
  py_explain: `<p>Guard the zero-user case explicitly.</p>`
});
LC(1148, {
  title: 'Article Views I', difficulty: 'Easy', topics: ['DISTINCT', 'WHERE'], ordered: true,
  tables: { Views: QT('article_id:INT,author_id:INT,viewer_id:INT,view_date:DATE', [[1, 3, 5, '2019-08-01'], [1, 3, 6, '2019-08-02'], [2, 7, 7, '2019-08-01'], [2, 7, 6, '2019-08-02'], [4, 7, 1, '2019-07-22'], [3, 4, 4, '2019-07-21'], [3, 4, 4, '2019-07-21']]) },
  prompt: `<p>Return the distinct authors who viewed at least one of their own articles, as <code>id</code>, sorted ascending.</p>`,
  hint: 'author_id = viewer_id, DISTINCT, ORDER BY.',
  sql: `SELECT DISTINCT author_id AS id
FROM Views
WHERE author_id = viewer_id
ORDER BY id;`,
  sql_explain: `<p>Duplicate view rows exist (author 4) → DISTINCT.</p>`,
  py: `result = pd.DataFrame({'id': sorted(Views[Views.author_id == Views.viewer_id].author_id.unique())})`,
  py_explain: `<p>Mask, unique, sort.</p>`
});
LC(1164, {
  title: 'Product Price at a Given Date', difficulty: 'Medium', topics: ['Window ranking', 'LEFT JOIN', 'NULL handling'],
  tables: { Products: QT('product_id:INT,new_price:INT,change_date:DATE', [[1, 20, '2019-08-14'], [2, 50, '2019-08-14'], [1, 30, '2019-08-15'], [1, 35, '2019-08-16'], [2, 65, '2019-08-17'], [3, 20, '2019-08-18']]) },
  prompt: `<p>Every product starts at price 10. Each row is a price change. Return every product's price on <b>2019-08-16</b>: <code>product_id</code>, <code>price</code>.</p>`,
  hint: 'Latest change on or before the date per product; products without one → 10.',
  sql: `SELECT p.product_id, COALESCE(l.new_price, 10) AS price
FROM (SELECT DISTINCT product_id FROM Products) p
LEFT JOIN (
  SELECT product_id, new_price,
         ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY change_date DESC) AS rn
  FROM Products
  WHERE change_date <= '2019-08-16'
) l ON l.product_id = p.product_id AND l.rn = 1;`,
  sql_explain: `<p>"Value as of a date" = latest row on or before it (an <b>as-of</b> lookup). Products whose first change is later (product 3) need the default, so start from the full product list and LEFT JOIN. A change dated exactly on the day counts (product 1 → 35).</p>`,
  py: `upto = Products[Products.change_date <= '2019-08-16'].sort_values('change_date').drop_duplicates('product_id', keep='last')
ids = pd.DataFrame({'product_id': Products.product_id.unique()})
result = ids.merge(upto[['product_id', 'new_price']], on='product_id', how='left').fillna({'new_price': 10}).rename(columns={'new_price': 'price'})`,
  py_explain: `<p>Last change per product up to the date, left-merged onto all products, default 10.</p>`
});
LC(1173, {
  title: 'Immediate Food Delivery I', difficulty: 'Easy', topics: ['Conditional aggregation'],
  tables: { Delivery: QT('delivery_id:INT,customer_id:INT,order_date:DATE,customer_pref_delivery_date:DATE', [[1, 1, '2019-08-01', '2019-08-02'], [2, 5, '2019-08-02', '2019-08-02'], [3, 1, '2019-08-11', '2019-08-11'], [4, 3, '2019-08-24', '2019-08-26'], [5, 4, '2019-08-21', '2019-08-22'], [6, 2, '2019-08-11', '2019-08-13'], [7, 4, '2019-08-09', '2019-08-09']]) },
  prompt: `<p>An order is <b>immediate</b> if the preferred delivery date equals the order date. Return the percentage of immediate orders, rounded to 2 decimals, as <code>immediate_percentage</code>.</p>`,
  hint: 'AVG of a boolean condition × 100.',
  sql: `SELECT ROUND(100.0 * SUM(CASE WHEN order_date = customer_pref_delivery_date THEN 1 ELSE 0 END) / COUNT(*), 2)
       AS immediate_percentage
FROM Delivery;`,
  sql_explain: `<p>A rate is a conditional count over a total. MySQL shorthand: <code>ROUND(AVG(order_date = customer_pref_delivery_date) * 100, 2)</code> because a comparison evaluates to 1/0.</p>`,
  py: `result = pd.DataFrame({'immediate_percentage': [round(100 * (Delivery.order_date == Delivery.customer_pref_delivery_date).mean(), 2)]})`,
  py_explain: `<p>Mean of a boolean Series = share of True.</p>`
});
LC(1174, {
  title: 'Immediate Food Delivery II', difficulty: 'Medium', topics: ['First touch', 'Window ranking', 'Conditional aggregation'],
  tables: { Delivery: QT('delivery_id:INT,customer_id:INT,order_date:DATE,customer_pref_delivery_date:DATE', [[1, 1, '2019-08-01', '2019-08-02'], [2, 2, '2019-08-02', '2019-08-02'], [3, 1, '2019-08-11', '2019-08-12'], [4, 3, '2019-08-24', '2019-08-24'], [5, 3, '2019-08-21', '2019-08-22'], [6, 2, '2019-08-11', '2019-08-13'], [7, 4, '2019-08-09', '2019-08-09']]) },
  prompt: `<p>Consider only each customer's <b>first</b> order (earliest order_date; unique per customer). Return the percentage of those first orders that are immediate, rounded to 2 decimals, as <code>immediate_percentage</code>.</p>`,
  hint: 'First order per customer via ROW_NUMBER or (customer_id, order_date) IN (… MIN …).',
  sql: `SELECT ROUND(100.0 * SUM(CASE WHEN order_date = customer_pref_delivery_date THEN 1 ELSE 0 END) / COUNT(*), 2)
       AS immediate_percentage
FROM (
  SELECT d.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) AS rn
  FROM Delivery d
) t
WHERE rn = 1;`,
  sql_explain: `<p>Reduce to the first order per customer, then compute the same rate as 1173. Customer 3's first order is 2019-08-21 even though its row comes later — order by date, not by id.</p>`,
  py: `f = Delivery.sort_values(['customer_id', 'order_date']).drop_duplicates('customer_id')
result = pd.DataFrame({'immediate_percentage': [round(100 * (f.order_date == f.customer_pref_delivery_date).mean(), 2)]})`,
  py_explain: `<p>First row per customer, then the boolean mean.</p>`
});
LC(1179, {
  title: 'Reformat Department Table', difficulty: 'Easy', topics: ['Pivot', 'Conditional aggregation'],
  tables: { Department: QT('id:INT,revenue:INT,month:TEXT', [[1, 8000, 'Jan'], [2, 9000, 'Jan'], [3, 10000, 'Feb'], [1, 7000, 'Feb'], [1, 6000, 'Mar'], [2, 4500, 'Dec']]) },
  prompt: `<p>Pivot the table to one row per department <code>id</code> with twelve columns <code>Jan_Revenue</code> … <code>Dec_Revenue</code> (NULL when there's no revenue that month).</p>`,
  hint: 'SUM(CASE WHEN month = \'Jan\' THEN revenue END) AS Jan_Revenue — twelve times. No ELSE, so missing months stay NULL.',
  sql: `SELECT id,
  SUM(CASE WHEN month = 'Jan' THEN revenue END) AS Jan_Revenue,
  SUM(CASE WHEN month = 'Feb' THEN revenue END) AS Feb_Revenue,
  SUM(CASE WHEN month = 'Mar' THEN revenue END) AS Mar_Revenue,
  SUM(CASE WHEN month = 'Apr' THEN revenue END) AS Apr_Revenue,
  SUM(CASE WHEN month = 'May' THEN revenue END) AS May_Revenue,
  SUM(CASE WHEN month = 'Jun' THEN revenue END) AS Jun_Revenue,
  SUM(CASE WHEN month = 'Jul' THEN revenue END) AS Jul_Revenue,
  SUM(CASE WHEN month = 'Aug' THEN revenue END) AS Aug_Revenue,
  SUM(CASE WHEN month = 'Sep' THEN revenue END) AS Sep_Revenue,
  SUM(CASE WHEN month = 'Oct' THEN revenue END) AS Oct_Revenue,
  SUM(CASE WHEN month = 'Nov' THEN revenue END) AS Nov_Revenue,
  SUM(CASE WHEN month = 'Dec' THEN revenue END) AS Dec_Revenue
FROM Department
GROUP BY id;`,
  sql_explain: `<p>The standard MySQL pivot. Leaving out <code>ELSE 0</code> is deliberate: SUM over only NULLs is NULL, which is what "no revenue" should show. MAX would also work because (id, month) is unique.</p>`,
  py: `months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
p = Department.pivot_table(index='id', columns='month', values='revenue', aggfunc='sum').reindex(columns=months)
p.columns = [m + '_Revenue' for m in months]
result = p.reset_index()`,
  py_explain: `<p><code>pivot_table</code> then <code>reindex(columns=…)</code> to force all twelve months in calendar order.</p>`
});
LC(1193, {
  title: 'Monthly Transactions I', difficulty: 'Medium', topics: ['Conditional aggregation', 'Date functions'],
  tables: { Transactions: QT('id:INT,country:TEXT,state:TEXT,amount:INT,trans_date:DATE', [[121, 'US', 'approved', 1000, '2018-12-18'], [122, 'US', 'declined', 2000, '2018-12-19'], [123, 'US', 'approved', 2000, '2019-01-01'], [124, 'DE', 'approved', 2000, '2019-01-07'], [125, null, 'approved', 500, '2019-01-09'], [126, 'DE', 'declined', 700, '2019-01-21']]) },
  prompt: `<p>For each month (<code>YYYY-MM</code>) and country return <code>month</code>, <code>country</code>, <code>trans_count</code>, <code>approved_count</code>, <code>trans_total_amount</code>, <code>approved_total_amount</code>. Country can be NULL and is still a group.</p>`,
  hint: 'DATE_FORMAT(trans_date, \'%Y-%m\'), conditional SUMs for the approved columns.',
  sql: `SELECT DATE_FORMAT(trans_date, '%Y-%m') AS month, country,
       COUNT(*) AS trans_count,
       SUM(CASE WHEN state = 'approved' THEN 1 ELSE 0 END) AS approved_count,
       SUM(amount) AS trans_total_amount,
       SUM(CASE WHEN state = 'approved' THEN amount ELSE 0 END) AS approved_total_amount
FROM Transactions
GROUP BY month, country;`,
  sql_explain: `<p>GROUP BY puts all NULL countries in one group (unlike <code>=</code>, grouping treats NULLs as equal). ELSE 0 matters for the approved columns so a month with only declines shows 0, not NULL.</p>`,
  py: `t = Transactions.assign(month=Transactions.trans_date.dt.strftime('%Y-%m'), ok=(Transactions.state == 'approved').astype(int))
t['ok_amt'] = t.amount * t.ok
result = t.groupby(['month', 'country'], dropna=False).agg(trans_count=('id', 'count'), approved_count=('ok', 'sum'),
        trans_total_amount=('amount', 'sum'), approved_total_amount=('ok_amt', 'sum')).reset_index()`,
  py_explain: `<p><code>dropna=False</code> keeps the NULL-country group — pandas drops NaN keys by default, a classic pandas-vs-SQL difference.</p>`
});
LC(1204, {
  title: 'Last Person to Fit in the Elevator', difficulty: 'Medium', topics: ['Running total', 'Window aggregate'],
  tables: { Queue: QT('person_id:INT,person_name:TEXT,weight:INT,turn:INT', [[5, 'Alka', 250, 1], [4, 'Bhuvan', 175, 5], [3, 'Chhavi', 350, 2], [6, 'Darsh', 400, 3], [1, 'Ela', 500, 6], [2, 'Firoz', 200, 4]]) },
  prompt: `<p>People board in <code>turn</code> order; the elevator holds at most 1000 kg. Return the <code>person_name</code> of the last person who can board without exceeding the limit.</p>`,
  hint: 'Running SUM(weight) by turn; the last row with running total ≤ 1000.',
  sql: `SELECT person_name
FROM (
  SELECT person_name, turn,
         SUM(weight) OVER (ORDER BY turn) AS total
  FROM Queue
) t
WHERE total <= 1000
ORDER BY turn DESC
LIMIT 1;`,
  sql_explain: `<p>Cumulative sum ordered by boarding turn, keep the fitting prefix, take its last member. Pre-window: self join on <code>q2.turn &lt;= q1.turn</code> with HAVING SUM ≤ 1000.</p>`,
  py: `q = Queue.sort_values('turn')
q = q[q.weight.cumsum() <= 1000]
result = pd.DataFrame({'person_name': [q.person_name.iloc[-1]]})`,
  py_explain: `<p>Sort by turn, cumsum, last fitting row.</p>`
});
LC(1211, {
  title: 'Queries Quality and Percentage', difficulty: 'Easy', topics: ['Aggregation', 'Conditional aggregation'],
  tables: { Queries: QT('query_name:TEXT,result:TEXT,position:INT,rating:INT', [['Dog', 'Golden Retriever', 1, 5], ['Dog', 'German Shepherd', 2, 5], ['Dog', 'Mule', 200, 1], ['Cat', 'Shirazi', 5, 2], ['Cat', 'Siamese', 3, 3], ['Cat', 'Sphynx', 7, 4]]) },
  prompt: `<p>Per <code>query_name</code>: <code>quality</code> = average of rating ÷ position; <code>poor_query_percentage</code> = % of results with rating &lt; 3. Both rounded to 2 decimals.</p>`,
  hint: 'AVG(rating / position) and AVG(rating < 3) * 100.',
  sql: `SELECT query_name,
       ROUND(AVG(rating / position), 2) AS quality,
       ROUND(100.0 * SUM(CASE WHEN rating < 3 THEN 1 ELSE 0 END) / COUNT(*), 2) AS poor_query_percentage
FROM Queries
GROUP BY query_name;`,
  sql_explain: `<p>An average of ratios (each row's rating/position), which is what's asked — not SUM(rating)/SUM(position). MySQL's <code>/</code> is decimal division, so 5/200 isn't truncated to 0.</p>`,
  py: `q = Queries.assign(r=Queries.rating / Queries.position, poor=(Queries.rating < 3).astype(int) * 100)
result = q.groupby('query_name', as_index=False).agg(quality=('r', 'mean'), poor_query_percentage=('poor', 'mean')).round(2)`,
  py_explain: `<p>Build per-row columns, then mean per group.</p>`
});
LC(1212, {
  title: 'Team Scores in Football Tournament', difficulty: 'Medium', topics: ['UNION ALL', 'LEFT JOIN', 'Conditional aggregation'], ordered: true,
  tables: {
    Teams: QT('team_id:INT,team_name:TEXT', [[10, 'Lions'], [20, 'Hawks'], [30, 'Wolves'], [40, 'Sharks'], [50, 'Bears']]),
    Matches: QT('match_id:INT,host_team:INT,guest_team:INT,host_goals:INT,guest_goals:INT', [[1, 10, 20, 3, 0], [2, 30, 10, 2, 2], [3, 10, 50, 5, 1], [4, 20, 30, 1, 0], [5, 50, 30, 1, 0]])
  },
  prompt: `<p>A win gives 3 points, a draw 1, a loss 0. Return every team (including teams that played no match) with <code>team_id</code>, <code>team_name</code>, <code>num_points</code>, ordered by num_points descending, then team_id ascending.</p>`,
  hint: 'Unpivot each match into two (team, points) rows with UNION ALL; LEFT JOIN from Teams.',
  sql: `WITH pts AS (
  SELECT host_team AS team_id,
         CASE WHEN host_goals > guest_goals THEN 3 WHEN host_goals = guest_goals THEN 1 ELSE 0 END AS p
  FROM Matches
  UNION ALL
  SELECT guest_team,
         CASE WHEN guest_goals > host_goals THEN 3 WHEN guest_goals = host_goals THEN 1 ELSE 0 END
  FROM Matches
)
SELECT t.team_id, t.team_name, COALESCE(SUM(pts.p), 0) AS num_points
FROM Teams t
LEFT JOIN pts ON pts.team_id = t.team_id
GROUP BY t.team_id, t.team_name
ORDER BY num_points DESC, t.team_id;`,
  sql_explain: `<p>Each match produces points for two teams in different columns → unpivot first. LEFT JOIN + COALESCE so the Sharks (no matches) show 0.</p>`,
  py: `m = Matches
h = pd.DataFrame({'team_id': m.host_team, 'p': np.select([m.host_goals > m.guest_goals, m.host_goals == m.guest_goals], [3, 1], 0)})
g = pd.DataFrame({'team_id': m.guest_team, 'p': np.select([m.guest_goals > m.host_goals, m.guest_goals == m.host_goals], [3, 1], 0)})
pts = pd.concat([h, g]).groupby('team_id').p.sum()
result = Teams.assign(num_points=Teams.team_id.map(pts).fillna(0).astype(int)).sort_values(['num_points', 'team_id'], ascending=[False, True])`,
  py_explain: `<p>Two point frames concatenated (UNION ALL), summed, then mapped onto all teams.</p>`
});
LC(1225, {
  title: 'Report Contiguous Dates', difficulty: 'Hard', topics: ['Gaps & islands', 'UNION ALL'], ordered: true,
  tables: {
    Failed: QT('fail_date:DATE', [['2018-12-28'], ['2018-12-29'], ['2019-01-04'], ['2019-01-05'], ['2019-01-09']]),
    Succeeded: QT('success_date:DATE', [['2018-12-30'], ['2018-12-31'], ['2019-01-01'], ['2019-01-02'], ['2019-01-03'], ['2019-01-06'], ['2019-01-07'], ['2019-01-08']])
  },
  prompt: `<p>Every day is either failed or succeeded. For days in <b>2019</b> only, report the contiguous periods: <code>period_state</code> ('failed' / 'succeeded'), <code>start_date</code>, <code>end_date</code>, ordered by start_date.</p>`,
  hint: 'Combine both tables with a state label, then islands: date − ROW_NUMBER() per state.',
  sql: `WITH d AS (
  SELECT fail_date AS dt, 'failed' AS period_state FROM Failed
  WHERE fail_date BETWEEN '2019-01-01' AND '2019-12-31'
  UNION ALL
  SELECT success_date, 'succeeded' FROM Succeeded
  WHERE success_date BETWEEN '2019-01-01' AND '2019-12-31'
), g AS (
  SELECT dt, period_state,
         DATE_SUB(dt, INTERVAL ROW_NUMBER() OVER (PARTITION BY period_state ORDER BY dt) DAY) AS grp
  FROM d
)
SELECT period_state, MIN(dt) AS start_date, MAX(dt) AS end_date
FROM g
GROUP BY period_state, grp
ORDER BY start_date;`,
  sql_explain: `<p>Gaps & islands per state: within a run of consecutive days, date − row number is constant. Filter to 2019 <i>before</i> numbering, otherwise the Dec-30/31 successes would merge into the Jan run (and they must be excluded anyway).</p>`,
  py: `d = pd.concat([pd.DataFrame({'dt': Failed.fail_date, 'period_state': 'failed'}),
               pd.DataFrame({'dt': Succeeded.success_date, 'period_state': 'succeeded'})])
d = d[d.dt.dt.year == 2019].sort_values('dt')
d['run'] = (d.period_state != d.period_state.shift()).cumsum()
result = d.groupby(['run', 'period_state']).dt.agg(start_date='min', end_date='max').reset_index().drop(columns='run')`,
  py_explain: `<p>Because every day has exactly one state, sorting by date and starting a new run whenever the state changes gives the periods.</p>`
});
LC(1241, {
  title: 'Number of Comments per Post', difficulty: 'Easy', topics: ['Self join', 'LEFT JOIN', 'COUNT DISTINCT'], ordered: true,
  tables: { Submissions: QT('sub_id:INT,parent_id:INT', [[1, null], [2, null], [1, null], [12, null], [3, 1], [5, 2], [3, 1], [4, 1], [9, 1], [10, 2], [6, 7]]) },
  prompt: `<p>Rows with NULL <code>parent_id</code> are posts; others are comments on post <code>parent_id</code>. The table has duplicate rows. Return every post with its number of <b>distinct</b> comments: <code>post_id</code>, <code>number_of_comments</code>, ordered by post_id. Comments on non-existent posts are ignored.</p>`,
  hint: 'Distinct posts LEFT JOIN comments; COUNT(DISTINCT comment id).',
  sql: `SELECT p.sub_id AS post_id, COUNT(DISTINCT c.sub_id) AS number_of_comments
FROM (SELECT DISTINCT sub_id FROM Submissions WHERE parent_id IS NULL) p
LEFT JOIN Submissions c ON c.parent_id = p.sub_id
GROUP BY p.sub_id
ORDER BY post_id;`,
  sql_explain: `<p>Three traps in one: duplicate post rows (DISTINCT in the post set), duplicate comment rows (COUNT DISTINCT), and posts with zero comments (LEFT JOIN; COUNT of a column ignores the NULL).</p>`,
  py: `posts = Submissions[Submissions.parent_id.isna()].sub_id.drop_duplicates()
c = Submissions.dropna(subset=['parent_id']).drop_duplicates().groupby('parent_id').sub_id.nunique()
result = pd.DataFrame({'post_id': posts.sort_values().values})
result['number_of_comments'] = result.post_id.map(c).fillna(0).astype(int)`,
  py_explain: `<p>Distinct posts; distinct comment counts per parent; map with default 0.</p>`
});
LC(1251, {
  title: 'Average Selling Price', difficulty: 'Easy', topics: ['Range join', 'LEFT JOIN', 'Weighted average'],
  tables: {
    Prices: QT('product_id:INT,start_date:DATE,end_date:DATE,price:INT', [[1, '2019-02-17', '2019-02-28', 5], [1, '2019-03-01', '2019-03-22', 20], [2, '2019-02-01', '2019-02-20', 15], [2, '2019-02-21', '2019-03-31', 30], [3, '2019-01-01', '2019-12-31', 40]]),
    UnitsSold: QT('product_id:INT,purchase_date:DATE,units:INT', [[1, '2019-02-25', 100], [1, '2019-03-01', 15], [2, '2019-02-10', 200], [2, '2019-03-22', 30]])
  },
  prompt: `<p>Each price applies from <code>start_date</code> to <code>end_date</code> (inclusive, non-overlapping per product). Return each product's average selling price weighted by units sold, rounded to 2: <code>product_id</code>, <code>average_price</code>. Products with no sales get 0.</p>`,
  hint: 'LEFT JOIN UnitsSold on product AND purchase_date BETWEEN start and end; SUM(price*units)/SUM(units).',
  sql: `SELECT p.product_id,
       ROUND(IFNULL(SUM(p.price * u.units) / SUM(u.units), 0), 2) AS average_price
FROM Prices p
LEFT JOIN UnitsSold u
       ON u.product_id = p.product_id
      AND u.purchase_date BETWEEN p.start_date AND p.end_date
GROUP BY p.product_id;`,
  sql_explain: `<p>A <b>range join</b> matches each sale to the price valid on that date. The date condition must be in the ON clause (in WHERE it would drop product 3, which has no sales). Weighted average = Σ(price·units) / Σunits, not AVG(price).</p>`,
  py: `m = UnitsSold.merge(Prices, on='product_id')
m = m[(m.purchase_date >= m.start_date) & (m.purchase_date <= m.end_date)]
g = m.assign(rev=m.price * m.units).groupby('product_id').agg(rev=('rev', 'sum'), units=('units', 'sum'))
avg = (g.rev / g.units).round(2)
ids = pd.Series(Prices.product_id.unique(), name='product_id')
result = pd.DataFrame({'product_id': ids, 'average_price': ids.map(avg).fillna(0).values})`,
  py_explain: `<p>Merge on product, filter the date range (a non-equi join), weighted average, then default 0 for products without sales.</p>`
});
