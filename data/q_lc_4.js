/* LeetCode Database set — part 4 (1264 → 1336). Short rewrites + original sample data. */
LC(1264, {
  title: 'Page Recommendations', difficulty: 'Medium', topics: ['UNION ALL', 'Anti join', 'Self join'],
  tables: {
    Friendship: QT('user1_id:INT,user2_id:INT', [[1, 2], [1, 3], [4, 1], [2, 3], [2, 5], [6, 1]]),
    Likes: QT('user_id:INT,page_id:INT', [[1, 88], [2, 23], [3, 24], [4, 56], [5, 11], [6, 33], [2, 77], [3, 77], [6, 88]])
  },
  prompt: `<p>Recommend pages to user <b>1</b>: pages liked by at least one of user 1's friends that user 1 doesn't already like. Friendship is stored once per pair, in either column. Return distinct <code>recommended_page</code>.</p>`,
  hint: 'Friends = user2 where user1 = 1 UNION user1 where user2 = 1. Then their likes minus user 1\'s likes.',
  sql: `WITH friends AS (
  SELECT user2_id AS friend FROM Friendship WHERE user1_id = 1
  UNION
  SELECT user1_id FROM Friendship WHERE user2_id = 1
)
SELECT DISTINCT l.page_id AS recommended_page
FROM Likes l
JOIN friends f ON f.friend = l.user_id
WHERE NOT EXISTS (SELECT 1 FROM Likes m WHERE m.user_id = 1 AND m.page_id = l.page_id);`,
  sql_explain: `<p>Symmetric relationships stored once must be read from both columns. Then a semi-join (friends' likes) plus an anti-join (not already liked). Page 77 is liked by two friends → DISTINCT; page 88 is excluded because user 1 likes it.</p>`,
  py: `f = set(Friendship[Friendship.user1_id == 1].user2_id) | set(Friendship[Friendship.user2_id == 1].user1_id)
mine = set(Likes[Likes.user_id == 1].page_id)
pages = Likes[Likes.user_id.isin(f) & ~Likes.page_id.isin(mine)].page_id.unique()
result = pd.DataFrame({'recommended_page': pages})`,
  py_explain: `<p>Python sets for friends and own likes, then two <code>isin</code> filters.</p>`
});
LC(1270, {
  title: 'All People Report to the Given Manager', difficulty: 'Medium', topics: ['Self join', 'Hierarchy', 'Recursive CTE'],
  tables: { Employees: QT('employee_id:INT,employee_name:TEXT,manager_id:INT', [[1, 'Boss', 1], [3, 'Aditi', 3], [2, 'Bharat', 1], [4, 'Chandra', 2], [7, 'Dinesh', 4], [8, 'Esha', 3], [9, 'Faisal', 8], [77, 'Gita', 1], [10, 'Hari', 7]]) },
  prompt: `<p>The head of the company is employee 1, whose <code>manager_id</code> is 1 itself. Return the <code>employee_id</code> of every employee (other than the head) who reports to the head directly or indirectly through <b>at most 3 levels</b> of management.</p>`,
  hint: 'Follow manager_id three times; because 1 → 1 loops, "reaches 1 within 3 hops" = the 3rd hop is 1.',
  sql: `SELECT e.employee_id
FROM Employees e
JOIN Employees m1 ON m1.employee_id = e.manager_id
JOIN Employees m2 ON m2.employee_id = m1.manager_id
WHERE m2.manager_id = 1
  AND e.employee_id <> 1;`,
  sql_explain: `<p>The self-loop on the head is the trick: once a chain reaches 1 it stays at 1, so checking only the third hop covers depths 1, 2 and 3. Aditi (3) manages herself — a separate cycle that never reaches 1. Hari is 4 levels deep and is excluded. General version: a <code>WITH RECURSIVE</code> walk down from the head with a depth counter (stop at depth 3, and exclude the head's self-loop in the recursive step).</p>`,
  py: `mgr = Employees.set_index('employee_id').manager_id
hop3 = Employees.employee_id.map(mgr).map(mgr).map(mgr)
result = Employees[(hop3 == 1) & (Employees.employee_id != 1)][['employee_id']]`,
  py_explain: `<p>Map each employee to their manager three times with a lookup Series.</p>`
});
LC(1280, {
  title: 'Students and Examinations', difficulty: 'Easy', topics: ['CROSS JOIN', 'LEFT JOIN', 'Aggregation'], ordered: true,
  tables: {
    Students: QT('student_id:INT,student_name:TEXT', [[1, 'Ananya'], [2, 'Bilal'], [13, 'Chitra'], [6, 'Dev']]),
    Subjects: QT('subject_name:TEXT', [['Math'], ['Physics'], ['Programming']]),
    Examinations: QT('student_id:INT,subject_name:TEXT', [[1, 'Math'], [1, 'Physics'], [1, 'Programming'], [2, 'Programming'], [1, 'Physics'], [1, 'Math'], [13, 'Math'], [13, 'Programming'], [13, 'Physics'], [2, 'Math'], [1, 'Math']])
  },
  prompt: `<p>For <b>every</b> student and <b>every</b> subject, return how many times the student sat that exam (0 if never): <code>student_id</code>, <code>student_name</code>, <code>subject_name</code>, <code>attended_exams</code>, ordered by student_id, subject_name.</p>`,
  hint: 'All combinations = CROSS JOIN; then LEFT JOIN the exams and COUNT a column from them.',
  sql: `SELECT s.student_id, s.student_name, sub.subject_name,
       COUNT(e.student_id) AS attended_exams
FROM Students s
CROSS JOIN Subjects sub
LEFT JOIN Examinations e
       ON e.student_id = s.student_id AND e.subject_name = sub.subject_name
GROUP BY s.student_id, s.student_name, sub.subject_name
ORDER BY s.student_id, sub.subject_name;`,
  sql_explain: `<p>"Every combination, even with zero" = CROSS JOIN for the grid + LEFT JOIN for the facts. COUNT(e.student_id) gives 0 for missing combinations (Dev has no exams), whereas COUNT(*) would give 1.</p>`,
  py: `g = Students.merge(Subjects, how='cross')
c = Examinations.groupby(['student_id', 'subject_name']).size().rename('attended_exams').reset_index()
result = (g.merge(c, on=['student_id', 'subject_name'], how='left').fillna({'attended_exams': 0})
          .astype({'attended_exams': int}).sort_values(['student_id', 'subject_name']).reset_index(drop=True))`,
  py_explain: `<p>Cross merge for the grid, left merge the counts, fill 0.</p>`
});
LC(1285, {
  title: 'Find the Start and End Number of Continuous Ranges', difficulty: 'Medium', topics: ['Gaps & islands'], ordered: true,
  tables: { Logs: QT('log_id:INT', [[1], [2], [3], [7], [8], [10], [14], [15], [16], [17]]) },
  prompt: `<p>Collapse the ids into continuous ranges: <code>start_id</code>, <code>end_id</code>, ordered by start_id.</p>`,
  hint: 'log_id − ROW_NUMBER() is constant within a range.',
  sql: `SELECT MIN(log_id) AS start_id, MAX(log_id) AS end_id
FROM (
  SELECT log_id, log_id - ROW_NUMBER() OVER (ORDER BY log_id) AS grp
  FROM Logs
) t
GROUP BY grp
ORDER BY start_id;`,
  sql_explain: `<p>The canonical islands trick on integers: 1,2,3 → grp 0; 7,8 → grp 3; 10 → 4; 14..17 → 7.</p>`,
  py: `l = Logs.sort_values('log_id').reset_index(drop=True)
grp = l.log_id - l.index
result = l.groupby(grp).log_id.agg(start_id='min', end_id='max').reset_index(drop=True)`,
  py_explain: `<p>After sorting, the row index plays the role of ROW_NUMBER.</p>`
});
LC(1294, {
  title: 'Weather Type in Each Country', difficulty: 'Easy', topics: ['CASE', 'Date functions', 'Aggregation'],
  tables: {
    Countries: QT('country_id:INT,country_name:TEXT', [[2, 'Norvia'], [3, 'Zentar'], [5, 'Calmora'], [7, 'Brisa'], [9, 'Solenne']]),
    Weather: QT('country_id:INT,weather_state:INT,day:DATE', [[2, 15, '2019-11-01'], [2, 12, '2019-10-28'], [2, 12, '2019-10-27'], [3, -2, '2019-11-10'], [3, 0, '2019-11-11'], [3, 3, '2019-11-12'], [5, 16, '2019-11-07'], [5, 18, '2019-11-09'], [5, 21, '2019-11-23'], [7, 25, '2019-11-28'], [7, 22, '2019-12-01'], [9, 27, '2019-11-03']])
  },
  prompt: `<p>Using only <b>November 2019</b> readings, classify each country by its average <code>weather_state</code>: ≤ 15 → <code>'Cold'</code>, ≥ 25 → <code>'Hot'</code>, otherwise <code>'Warm'</code>. Return <code>country_name</code>, <code>weather_type</code> (countries with no November data are omitted).</p>`,
  hint: 'Filter the month, AVG per country, CASE on the average.',
  sql: `SELECT c.country_name,
       CASE WHEN AVG(w.weather_state) <= 15 THEN 'Cold'
            WHEN AVG(w.weather_state) >= 25 THEN 'Hot'
            ELSE 'Warm' END AS weather_type
FROM Weather w
JOIN Countries c ON c.country_id = w.country_id
WHERE w.day >= '2019-11-01' AND w.day < '2019-12-01'
GROUP BY c.country_id, c.country_name;`,
  sql_explain: `<p>CASE can wrap aggregate expressions. Classify on the <i>average</i>, after filtering the month with a sargable half-open range.</p>`,
  py: `w = Weather[(Weather.day >= '2019-11-01') & (Weather.day < '2019-12-01')]
a = w.groupby('country_id').weather_state.mean().reset_index().merge(Countries, on='country_id')
a['weather_type'] = np.select([a.weather_state <= 15, a.weather_state >= 25], ['Cold', 'Hot'], 'Warm')
result = a[['country_name', 'weather_type']]`,
  py_explain: `<p>Average first, then <code>np.select</code>.</p>`
});
LC(1303, {
  title: 'Find the Team Size', difficulty: 'Easy', topics: ['Window aggregate'],
  tables: { Employee: QT('employee_id:INT,team_id:INT', [[1, 8], [2, 8], [3, 8], [4, 7], [5, 9], [6, 9]]) },
  prompt: `<p>For every employee return the size of their team: <code>employee_id</code>, <code>team_size</code>.</p>`,
  hint: 'COUNT(*) OVER (PARTITION BY team_id).',
  sql: `SELECT employee_id, COUNT(*) OVER (PARTITION BY team_id) AS team_size
FROM Employee;`,
  sql_explain: `<p>A window count keeps every employee row. Pre-window: join to <code>(SELECT team_id, COUNT(*) …  GROUP BY team_id)</code>.</p>`,
  py: `result = Employee.assign(team_size=Employee.groupby('team_id').employee_id.transform('count'))[['employee_id', 'team_size']]`,
  py_explain: `<p><code>transform('count')</code>.</p>`
});
LC(1308, {
  title: 'Running Total for Different Genders', difficulty: 'Medium', topics: ['Running total', 'Window aggregate'], ordered: true,
  tables: { Scores: QT('player_name:TEXT,gender:TEXT,day:DATE,score_points:INT', [['Aruna', 'F', '2019-12-30', 17], ['Priya', 'F', '2019-12-31', 23], ['Jai', 'M', '2019-12-18', 2], ['Ravi', 'M', '2019-12-25', 11], ['Sunil', 'M', '2019-12-30', 13], ['Jai', 'M', '2019-12-31', 3], ['Meher', 'F', '2019-12-18', 2], ['Aruna', 'F', '2019-12-25', 11], ['Meher', 'F', '2020-01-01', 23], ['Sunil', 'M', '2020-01-07', 7]]) },
  prompt: `<p>Each (gender, day) appears once. Return the running total of points per gender by day: <code>gender</code>, <code>day</code>, <code>total</code>, ordered by gender, day.</p>`,
  hint: 'SUM(score_points) OVER (PARTITION BY gender ORDER BY day).',
  sql: `SELECT gender, day,
       SUM(score_points) OVER (PARTITION BY gender ORDER BY day) AS total
FROM Scores
ORDER BY gender, day;`,
  sql_explain: `<p>Partitioned running total. If a gender could have several rows per day, aggregate per (gender, day) first — the default RANGE frame would otherwise give tied days the same total.</p>`,
  py: `s = Scores.sort_values(['gender', 'day']).copy()
s['total'] = s.groupby('gender').score_points.cumsum()
result = s[['gender', 'day', 'total']].reset_index(drop=True)`,
  py_explain: `<p>Sort, groupby, cumsum.</p>`
});
LC(1321, {
  title: 'Restaurant Growth', difficulty: 'Medium', topics: ['Moving average', 'Window frame'], ordered: true,
  tables: { Customer: QT('customer_id:INT,name:TEXT,visited_on:DATE,amount:INT', [[1, 'Asha', '2019-01-01', 100], [2, 'Bunty', '2019-01-02', 110], [3, 'Chinu', '2019-01-03', 120], [4, 'Diya', '2019-01-04', 130], [5, 'Eshwar', '2019-01-05', 110], [6, 'Fai', '2019-01-06', 140], [7, 'Gary', '2019-01-07', 150], [8, 'Hina', '2019-01-08', 80], [9, 'Ishan', '2019-01-09', 110], [1, 'Asha', '2019-01-10', 130], [3, 'Chinu', '2019-01-10', 150]]) },
  prompt: `<p>There is at least one visit every day. For each day that has six earlier days, return the total amount over the 7-day window ending that day and its average per day: <code>visited_on</code>, <code>amount</code>, <code>average_amount</code> (rounded to 2), ordered by visited_on.</p>`,
  hint: 'Aggregate per day first (multiple customers per day!), then SUM/AVG OVER ROWS 6 PRECEDING, then skip the first 6 days.',
  sql: `WITH daily AS (
  SELECT visited_on, SUM(amount) AS amount
  FROM Customer
  GROUP BY visited_on
), w AS (
  SELECT visited_on,
         SUM(amount) OVER (ORDER BY visited_on ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS amount,
         ROW_NUMBER() OVER (ORDER BY visited_on) AS rn
  FROM daily
)
SELECT visited_on, amount, ROUND(amount / 7, 2) AS average_amount
FROM w
WHERE rn >= 7
ORDER BY visited_on;`,
  sql_explain: `<p>Two traps: (1) two customers on 2019-01-10 — summing the raw rows with a 7-row frame would mix days; aggregate per day first. (2) The average is per <i>day</i> (÷7), not per visit. Skip the first 6 days with ROW_NUMBER (or <code>visited_on &gt;= MIN(visited_on) + 6 days</code>).</p>`,
  py: `d = Customer.groupby('visited_on', as_index=False).amount.sum().sort_values('visited_on')
d['amount'] = d.amount.rolling(7).sum()
d = d.dropna()
d['average_amount'] = (d.amount / 7).round(2)
result = d.astype({'amount': int}).reset_index(drop=True)`,
  py_explain: `<p><code>rolling(7)</code> without min_periods yields NaN for the first 6 days, which <code>dropna</code> removes.</p>`
});
LC(1322, {
  title: 'Ads Performance', difficulty: 'Easy', topics: ['Conditional aggregation', 'NULL handling'], ordered: true,
  tables: { Ads: QT('ad_id:INT,user_id:INT,action:TEXT', [[1, 1, 'Clicked'], [2, 2, 'Clicked'], [3, 3, 'Viewed'], [5, 5, 'Ignored'], [1, 7, 'Ignored'], [2, 7, 'Viewed'], [3, 5, 'Clicked'], [1, 4, 'Viewed'], [2, 11, 'Viewed'], [1, 2, 'Clicked']]) },
  prompt: `<p>Click-through rate per ad = clicks ÷ (clicks + views) × 100, rounded to 2; an ad with no clicks and no views has CTR 0. Return <code>ad_id</code>, <code>ctr</code>, ordered by ctr descending, then ad_id ascending.</p>`,
  hint: 'Conditional sums; IFNULL(… / 0, 0) because x/0 is NULL in MySQL. Ignored actions don\'t count.',
  sql: `SELECT ad_id,
       ROUND(IFNULL(100.0 * SUM(CASE WHEN action = 'Clicked' THEN 1 ELSE 0 END)
                    / SUM(CASE WHEN action IN ('Clicked', 'Viewed') THEN 1 ELSE 0 END), 0), 2) AS ctr
FROM Ads
GROUP BY ad_id
ORDER BY ctr DESC, ad_id;`,
  sql_explain: `<p>Ad 5 has only an "Ignored" action → 0/0 → NULL → IFNULL makes it 0. The denominator excludes Ignored.</p>`,
  py: `a = Ads.assign(c=(Ads.action == 'Clicked').astype(int), v=Ads.action.isin(['Clicked', 'Viewed']).astype(int))
g = a.groupby('ad_id')[['c', 'v']].sum().reset_index()
g['ctr'] = np.where(g.v > 0, 100 * g.c / g.v.where(g.v > 0, 1), 0).round(2)
result = g[['ad_id', 'ctr']].sort_values(['ctr', 'ad_id'], ascending=[False, True]).reset_index(drop=True)`,
  py_explain: `<p>Guard division by zero with <code>np.where</code>.</p>`
});
LC(1327, {
  title: 'List the Products Ordered in a Period', difficulty: 'Easy', topics: ['HAVING', 'Date functions'],
  tables: {
    Products: QT('product_id:INT,product_name:TEXT,product_category:TEXT', [[1, 'Pencil Box', 'Stationery'], [2, 'Jasmine Tea', 'Grocery'], [3, 'Desk Fan', 'Appliance'], [4, 'Notebook', 'Stationery'], [5, 'Earphones', 'Electronics']]),
    Orders: QT('product_id:INT,order_date:DATE,unit:INT', [[1, '2020-02-05', 60], [1, '2020-02-10', 70], [2, '2020-01-18', 30], [2, '2020-02-11', 80], [3, '2020-02-17', 2], [3, '2020-02-24', 3], [4, '2020-03-01', 20], [4, '2020-03-04', 30], [4, '2020-03-04', 60], [5, '2020-02-25', 50], [5, '2020-02-27', 50], [5, '2020-03-01', 50]])
  },
  prompt: `<p>Return products with at least <b>100 units</b> ordered in <b>February 2020</b>: <code>product_name</code>, <code>unit</code> (the February total).</p>`,
  hint: 'Filter Feb 2020, SUM per product, HAVING ≥ 100.',
  sql: `SELECT p.product_name, SUM(o.unit) AS unit
FROM Orders o
JOIN Products p ON p.product_id = o.product_id
WHERE o.order_date >= '2020-02-01' AND o.order_date < '2020-03-01'
GROUP BY p.product_id, p.product_name
HAVING SUM(o.unit) >= 100;`,
  sql_explain: `<p>Half-open date range handles the 29-day February of 2020 without thinking about leap years. Earphones total exactly 100 in February → included (≥).</p>`,
  py: `o = Orders[(Orders.order_date >= '2020-02-01') & (Orders.order_date < '2020-03-01')]
g = o.groupby('product_id', as_index=False).unit.sum()
result = g[g.unit >= 100].merge(Products, on='product_id')[['product_name', 'unit']]`,
  py_explain: `<p>Filter, sum, threshold, then attach names.</p>`
});
LC(1336, {
  title: 'Number of Transactions per Visit', difficulty: 'Hard', topics: ['Recursive CTE', 'LEFT JOIN', 'Date spine'], ordered: true,
  tables: {
    Visits: QT('user_id:INT,visit_date:DATE', [[1, '2020-01-01'], [2, '2020-01-02'], [12, '2020-01-01'], [19, '2020-01-03'], [1, '2020-01-02'], [2, '2020-01-03'], [1, '2020-01-04'], [7, '2020-01-11'], [9, '2020-01-25'], [8, '2020-01-28']]),
    Transactions: QT('user_id:INT,transaction_date:DATE,amount:INT', [[1, '2020-01-02', 120], [2, '2020-01-03', 22], [7, '2020-01-11', 232], [1, '2020-01-04', 7], [9, '2020-01-25', 33], [9, '2020-01-25', 66], [8, '2020-01-28', 1], [9, '2020-01-25', 99]])
  },
  prompt: `<p>A user makes zero or more transactions during a visit (same user, same date). For every possible count from <b>0 up to the maximum</b> transactions in one visit, return how many visits had exactly that many: <code>transactions_count</code>, <code>visits_count</code> (0 if none), ordered by transactions_count.</p>`,
  hint: 'Per visit count (LEFT JOIN), then a number spine 0..max with WITH RECURSIVE, LEFT JOIN the histogram.',
  sql: `WITH RECURSIVE per_visit AS (
  SELECT v.user_id, v.visit_date, COUNT(t.user_id) AS cnt
  FROM Visits v
  LEFT JOIN Transactions t
         ON t.user_id = v.user_id AND t.transaction_date = v.visit_date
  GROUP BY v.user_id, v.visit_date
), nums AS (
  SELECT 0 AS n
  UNION ALL
  SELECT n + 1 FROM nums WHERE n < (SELECT MAX(cnt) FROM per_visit)
)
SELECT nums.n AS transactions_count, COUNT(pv.cnt) AS visits_count
FROM nums
LEFT JOIN per_visit pv ON pv.cnt = nums.n
GROUP BY nums.n
ORDER BY transactions_count;`,
  sql_explain: `<ol><li><b>Per visit</b>: LEFT JOIN so visits without transactions count 0 (COUNT of a column).</li><li><b>Number spine</b> 0..max via a recursive CTE — the "histogram with empty buckets" problem, like a date spine.</li><li><b>LEFT JOIN</b> the spine to the per-visit counts; COUNT(pv.cnt) gives 0 for empty buckets (count 2 here).</li></ol>`,
  py: `t = Transactions.groupby(['user_id', 'transaction_date']).size().rename('cnt').reset_index().rename(columns={'transaction_date': 'visit_date'})
pv = Visits.merge(t, on=['user_id', 'visit_date'], how='left').fillna({'cnt': 0})
h = pv.cnt.astype(int).value_counts()
n = range(0, int(pv.cnt.max()) + 1)
result = pd.DataFrame({'transactions_count': list(n), 'visits_count': [int(h.get(i, 0)) for i in n]})`,
  py_explain: `<p>Count per visit, histogram with <code>value_counts</code>, then fill every bucket 0..max.</p>`
});
