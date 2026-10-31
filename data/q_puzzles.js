/* Section 11 — Classic puzzles, transformations & data cleaning */
window.QUESTIONS.push(
{
  id: 80, title: 'Build a cricket points table', difficulty: 'Medium', tier: 1,
  tables: { matches: QT('match_id:INT,team_1:TEXT,team_2:TEXT,winner:TEXT', [[1, 'India', 'Sri Lanka', 'India'], [2, 'Sri Lanka', 'Australia', 'Australia'], [3, 'South Africa', 'England', 'England'], [4, 'England', 'New Zealand', 'New Zealand'], [5, 'Australia', 'India', 'India'], [6, 'New Zealand', 'South Africa', 'Draw'], [7, 'India', 'England', 'India'], [8, 'Australia', 'New Zealand', 'Draw'], [9, 'Sri Lanka', 'South Africa', 'South Africa']]) },
  topics: ['UNION ALL', 'Unpivot', 'Conditional aggregation'], companies: ['Amazon', 'Deloitte', 'PwC', 'Dream11'], ordered: true,
  prompt: `<p>Each row is one match; <code>winner</code> is a team name or <code>'Draw'</code>. Points: win = 2, draw = 1, loss = 0.</p>
<p>Return <code>team</code>, <code>played</code>, <code>won</code>, <code>lost</code>, <code>drawn</code>, <code>points</code>. Sort by points desc, then team.</p>`,
  hint: 'Unpivot team_1 and team_2 into one "team" column with UNION ALL, carrying the winner.',
  sql: `WITH t AS (
  SELECT team_1 AS team, winner FROM matches
  UNION ALL
  SELECT team_2 AS team, winner FROM matches
)
SELECT team,
       COUNT(*) AS played,
       SUM(CASE WHEN winner = team THEN 1 ELSE 0 END)                     AS won,
       SUM(CASE WHEN winner <> team AND winner <> 'Draw' THEN 1 ELSE 0 END) AS lost,
       SUM(CASE WHEN winner = 'Draw' THEN 1 ELSE 0 END)                   AS drawn,
       SUM(CASE WHEN winner = team THEN 2 WHEN winner = 'Draw' THEN 1 ELSE 0 END) AS points
FROM t
GROUP BY team
ORDER BY points DESC, team;`,
  sql_explain: `<p>A team can appear in either column, so first <b>unpivot</b> to one row per (match, team). <code>UNION ALL</code> (not <code>UNION</code>) — UNION would remove legit duplicate rows like two India wins against the same opponent.</p>`,
  py: `t = pd.concat([matches[['team_1', 'winner']].rename(columns={'team_1': 'team'}), matches[['team_2', 'winner']].rename(columns={'team_2': 'team'})])
t['won'] = (t.winner == t.team).astype(int)
t['drawn'] = (t.winner == 'Draw').astype(int)
t['lost'] = 1 - t.won - t.drawn
result = t.groupby('team').agg(played=('winner', 'size'), won=('won', 'sum'), lost=('lost', 'sum'), drawn=('drawn', 'sum')).reset_index()
result['points'] = 2 * result.won + result.drawn
result = result.sort_values(['points', 'team'], ascending=[False, True]).reset_index(drop=True)`,
  py_explain: `<p><code>pd.concat</code> of the two renamed column pairs = UNION ALL.</p>`
},
{
  id: 81, title: 'Unpivot wide quarterly sales and find each region\'s best quarter', difficulty: 'Medium', tier: 1,
  tables: { sales_wide: QT('region:TEXT,q1:REAL,q2:REAL,q3:REAL,q4:REAL', [['North', 120, 135, 150, 210], ['South', 200, 180, 190, 185], ['East', 90, 95, 140, 130], ['West', 160, 175, 175, 150]]) },
  topics: ['Unpivot', 'UNION ALL', 'Window ranking'], companies: ['Deloitte', 'KPMG', 'Mu Sigma', 'Tiger Analytics'], ordered: true,
  prompt: `<p>Finance exported sales in a wide format (one column per quarter). Convert to long format and return each region's best quarter (ties → earlier quarter) and its share of the region's annual sales.</p>
<p>Return <code>region</code>, <code>best_quarter</code> ('Q1'..'Q4'), <code>sales</code>, <code>share_pct</code> (2 dp). Sort by region.</p>`,
  hint: 'Unpivot with 4 SELECTs glued by UNION ALL, then ROW_NUMBER per region.',
  sql: `WITH long AS (
  SELECT region, 'Q1' AS quarter, q1 AS sales FROM sales_wide
  UNION ALL SELECT region, 'Q2', q2 FROM sales_wide
  UNION ALL SELECT region, 'Q3', q3 FROM sales_wide
  UNION ALL SELECT region, 'Q4', q4 FROM sales_wide
), r AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY region ORDER BY sales DESC, quarter) AS rn,
         100.0 * sales / SUM(sales) OVER (PARTITION BY region) AS share
  FROM long
)
SELECT region, quarter AS best_quarter, sales, ROUND(share, 2) AS share_pct
FROM r
WHERE rn = 1
ORDER BY region;`,
  sql_explain: `<p>MySQL has no UNPIVOT; <code>UNION ALL</code> of one SELECT per column is the standard approach (a CROSS JOIN with a 4-row quarter list + CASE is another). Long format makes ranking/aggregation trivial.</p>`,
  py: `long = sales_wide.melt(id_vars='region', var_name='quarter', value_name='sales')
long['quarter'] = long.quarter.str.upper()
long['share_pct'] = (100 * long.sales / long.groupby('region').sales.transform('sum')).round(2)
best = long.sort_values(['region', 'sales', 'quarter'], ascending=[True, False, True]).drop_duplicates('region')
result = best.rename(columns={'quarter': 'best_quarter'})[['region', 'best_quarter', 'sales', 'share_pct']].reset_index(drop=True)`,
  py_explain: `<p><code>melt</code> is pandas' unpivot; <code>pivot</code>/<code>pivot_table</code> go the other way.</p>`
},
{
  id: 82, title: 'Swap adjacent seats', difficulty: 'Medium', tier: 1,
  tables: { seats: QT('id:INT,student:TEXT', [[1, 'Aarav'], [2, 'Diya'], [3, 'Kabir'], [4, 'Meera'], [5, 'Rohan'], [6, 'Sara'], [7, 'Vikram']]) },
  topics: ['CASE', 'LAG/LEAD', 'Puzzle'], companies: ['Amazon', 'Microsoft', 'Adobe'], ordered: true,
  prompt: `<p>Swap the seat of every two consecutive students (1↔2, 3↔4, …). If the number of students is odd, the last student stays.</p>
<p>Return <code>id</code>, <code>student</code> sorted by id.</p>`,
  hint: 'Odd id → take the next student (LEAD), even id → the previous (LAG). Last odd id keeps its own (COALESCE).',
  sql: `SELECT id,
       CASE WHEN id % 2 = 1 THEN COALESCE(LEAD(student) OVER (ORDER BY id), student)
            ELSE LAG(student) OVER (ORDER BY id) END AS student
FROM seats
ORDER BY id;`,
  sql_explain: `<p>Window version reads naturally. The classic alternative remaps ids: <code>CASE WHEN id%2=1 AND id=(SELECT MAX(id) FROM seats) THEN id WHEN id%2=1 THEN id+1 ELSE id-1 END</code> and re-sorts.</p>`,
  py: `s = seats.sort_values('id').reset_index(drop=True)
nxt, prv = s.student.shift(-1), s.student.shift(1)
s['student'] = np.where(s.id % 2 == 1, nxt.fillna(s.student), prv)
result = s`,
  py_explain: `<p><code>shift(-1)</code>/<code>shift(1)</code> = LEAD/LAG, <code>fillna</code> handles the last odd seat.</p>`
},
{
  id: 83, title: 'Median salary per company without a MEDIAN function', difficulty: 'Hard', tier: 2,
  tables: { company_emp: QT('emp_id:INT,company:TEXT,salary:REAL', [[1, 'A', 2341], [2, 'A', 341], [3, 'A', 15], [4, 'A', 15314], [5, 'A', 451], [6, 'A', 513], [7, 'B', 15], [8, 'B', 13], [9, 'B', 1154], [10, 'B', 1345], [11, 'B', 1221], [12, 'B', 234], [13, 'C', 2345], [14, 'C', 2645], [15, 'C', 2645], [16, 'C', 2652], [17, 'C', 65]]) },
  topics: ['Median', 'Window ranking', 'Statistics'], companies: ['Google', 'Amazon', 'Uber', 'Goldman Sachs'], ordered: true,
  prompt: `<p>MySQL has no MEDIAN(). Compute the median salary per company (for an even count, the average of the two middle values).</p>
<p>Return <code>company</code>, <code>median_salary</code> (2 dp). Sort by company.</p>`,
  hint: 'ROW_NUMBER ascending and COUNT(*) per company; keep rows where rn is in (floor((n+1)/2), floor(n/2)+1); average them.',
  sql: `WITH r AS (
  SELECT company, salary,
         ROW_NUMBER() OVER (PARTITION BY company ORDER BY salary, emp_id) AS rn,
         COUNT(*)     OVER (PARTITION BY company) AS n
  FROM company_emp
)
SELECT company, ROUND(AVG(salary), 2) AS median_salary
FROM r
WHERE rn IN (FLOOR((n + 1) / 2), FLOOR(n / 2) + 1)
GROUP BY company
ORDER BY company;`,
  sql_explain: `<p>For n = 6: positions 3 and 4 → average. For n = 5: FLOOR(3) = 3 and FLOOR(2.5)+1 = 3 → the same middle row once. One formula covers both. (In MySQL, <code>/</code> is decimal division, hence FLOOR.)</p>`,
  py: `result = company_emp.groupby('company').salary.median().round(2).reset_index(name='median_salary')`,
  py_explain: `<p>pandas has <code>median()</code> built in. Knowing the SQL trick is what the interviewer wants; in pandas the one-liner is fine.</p>`
},
{
  id: 84, title: 'Who has the most friends?', difficulty: 'Medium', tier: 1,
  tables: { friend_requests: QT('requester_id:INT,accepter_id:INT,accept_date:DATE', [[1, 2, '2024-06-03'], [1, 3, '2024-06-08'], [2, 3, '2024-06-08'], [3, 4, '2024-06-09'], [5, 3, '2024-06-11'], [4, 1, '2024-06-12'], [6, 3, '2024-06-14'], [6, 1, '2024-06-15']]) },
  topics: ['UNION ALL', 'Window ranking'], companies: ['Meta', 'LinkedIn', 'ShareChat'], ordered: true,
  prompt: `<p>Each row is an accepted friendship (friendship is mutual). Return the person(s) with the most friends — all of them if tied.</p>
<p>Return <code>id</code>, <code>friends</code>. Sort by id.</p>`,
  hint: 'Count each side: UNION ALL requester_id and accepter_id into one column, then RANK.',
  sql: `WITH f AS (
  SELECT requester_id AS id FROM friend_requests
  UNION ALL
  SELECT accepter_id FROM friend_requests
), c AS (
  SELECT id, COUNT(*) AS friends, RANK() OVER (ORDER BY COUNT(*) DESC) AS rk
  FROM f
  GROUP BY id
)
SELECT id, friends FROM c WHERE rk = 1 ORDER BY id;`,
  sql_explain: `<p>Mutual relationships stored once must be counted from both ends. Using RANK (not LIMIT 1) handles ties — interviewers usually follow up with "what if two people tie?".</p>`,
  py: `ids = pd.concat([friend_requests.requester_id, friend_requests.accepter_id])
c = ids.value_counts()
result = c[c == c.max()].rename_axis('id').reset_index(name='friends').sort_values('id').reset_index(drop=True)`,
  py_explain: `<p><code>value_counts()</code> on the stacked ids; keep all rows equal to the max.</p>`
},
{
  id: 85, title: 'Org chart: everyone under a VP (recursive CTE)', difficulty: 'Hard', tier: 2, dataset: 'hr',
  topics: ['Recursive CTE', 'Hierarchy'], companies: ['Amazon', 'Microsoft', 'Oracle', 'SAP'], ordered: true,
  prompt: `<p>Return every employee who reports to <b>Anita Desai</b> (emp_id 2) directly or indirectly, with their depth: direct reports are level 1, their reports level 2, …, and the chain of manager names from Anita down (e.g. <code>Anita Desai &gt; X &gt; Y</code>).</p>
<p>Return <code>emp_id</code>, <code>emp_name</code>, <code>job_title</code>, <code>level</code>, <code>chain</code>. Sort by level, emp_id.</p>`,
  hint: 'Anchor: direct reports of 2. Recursive step: employees whose manager_id is in the previous level. Build the chain with CONCAT.',
  sql: `WITH RECURSIVE tree AS (
  SELECT e.emp_id, e.emp_name, e.job_title, 1 AS level,
         CAST(CONCAT('Anita Desai > ', e.emp_name) AS CHAR(500)) AS chain
  FROM employees e
  WHERE e.manager_id = 2
  UNION ALL
  SELECT e.emp_id, e.emp_name, e.job_title, t.level + 1,
         CONCAT(t.chain, ' > ', e.emp_name)
  FROM employees e
  JOIN tree t ON e.manager_id = t.emp_id
)
SELECT emp_id, emp_name, job_title, level, chain
FROM tree
ORDER BY level, emp_id;`,
  sql_explain: `<p>Recursive CTE = anchor query + <code>UNION ALL</code> + recursive member that joins back to the CTE. It stops when the recursive member returns no rows. In MySQL, the anchor defines the column type — CAST the chain to a wide CHAR or longer strings get truncated ("Data too long" error).</p>`,
  py: `rows, frontier, level = [], [(2, 'Anita Desai')], 1
while frontier:
    nxt = []
    for mid, chain in frontier:
        for r in employees[employees.manager_id == mid].itertuples():
            c = chain + ' > ' + r.emp_name
            rows.append({'emp_id': r.emp_id, 'emp_name': r.emp_name, 'job_title': r.job_title, 'level': level, 'chain': c})
            nxt.append((r.emp_id, c))
    frontier, level = nxt, level + 1
result = pd.DataFrame(rows).sort_values(['level', 'emp_id']).reset_index(drop=True)`,
  py_explain: `<p>Breadth-first traversal level by level — exactly what the recursive CTE does internally.</p>`
},
{
  id: 86, title: 'Hotel occupancy per night (expand date ranges)', difficulty: 'Hard', tier: 3,
  tables: { bookings: QT('booking_id:INT,guest:TEXT,check_in:DATE,check_out:DATE', [[1, 'Aarav', '2024-03-01', '2024-03-04'], [2, 'Diya', '2024-03-02', '2024-03-03'], [3, 'Kabir', '2024-03-03', '2024-03-08'], [4, 'Meera', '2024-03-05', '2024-03-06'], [5, 'Rohan', '2024-03-05', '2024-03-09'], [6, 'Sara', '2024-03-06', '2024-03-07']]) },
  topics: ['Recursive CTE', 'Date spine', 'Range join'], companies: ['MakeMyTrip', 'OYO', 'Airbnb', 'Booking.com', 'Goibibo'], ordered: true,
  prompt: `<p>A booking occupies a room on every night from <code>check_in</code> up to but <b>not including</b> <code>check_out</code>. Report occupancy for every night from 2024-03-01 to 2024-03-10 (nights with no guests must show 0).</p>
<p>Return <code>night</code>, <code>rooms_occupied</code>, <code>guests</code> (comma-separated names ordered alphabetically, NULL if none). Sort by night.</p>`,
  hint: 'Date spine + LEFT JOIN on night >= check_in AND night < check_out. GROUP_CONCAT(guest ORDER BY guest).',
  sql: `WITH RECURSIVE nights AS (
  SELECT DATE('2024-03-01') AS night
  UNION ALL
  SELECT DATE_ADD(night, INTERVAL 1 DAY) FROM nights WHERE night < '2024-03-10'
)
SELECT n.night,
       COUNT(b.booking_id) AS rooms_occupied,
       GROUP_CONCAT(b.guest ORDER BY b.guest SEPARATOR ',') AS guests
FROM nights n
LEFT JOIN bookings b ON n.night >= b.check_in AND n.night < b.check_out
GROUP BY n.night
ORDER BY n.night;`,
  sql_explain: `<p>Interval data (stays, subscriptions, shifts) becomes per-day data by joining a spine with a <b>half-open</b> range condition <code>[check_in, check_out)</code>. The half-open choice matters: the check-out night is not occupied.</p>`,
  py: `nights = pd.date_range('2024-03-01', '2024-03-10', freq='D')
rows = []
for n in nights:
    g = bookings[(bookings.check_in <= n) & (bookings.check_out > n)]
    rows.append({'night': n, 'rooms_occupied': len(g), 'guests': ','.join(sorted(g.guest)) or None})
result = pd.DataFrame(rows)`,
  py_explain: `<p>Loop over the spine with a boolean range filter; for big data use a cross merge + filter, or <code>explode</code> a per-booking <code>date_range</code>.</p>`
},
{
  id: 87, title: 'Latest address per customer (SCD history)', difficulty: 'Medium', tier: 1,
  tables: { address_history: QT('customer_id:INT,city:TEXT,pincode:TEXT,updated_at:DATETIME', [[1, 'Pune', '411001', '2023-01-10 10:00:00'], [1, 'Mumbai', '400050', '2024-02-15 09:30:00'], [2, 'Delhi', '110001', '2023-05-01 12:00:00'], [3, 'Bengaluru', '560001', '2022-11-20 08:00:00'], [3, 'Bengaluru', '560034', '2023-07-07 18:20:00'], [3, 'Chennai', '600001', '2024-06-01 11:11:00'], [4, 'Hyderabad', '500001', '2024-01-01 00:00:00'], [4, 'Hyderabad', '500081', '2024-01-01 00:00:00'], [5, 'Kolkata', '700001', '2023-03-03 03:03:00'], [5, 'Jaipur', '302001', '2023-09-09 09:09:00'], [5, 'Kolkata', '700091', '2024-04-04 04:04:00']]) },
  topics: ['Window ranking', 'LAG/LEAD', 'Dedup'], companies: ['Flipkart', 'Amazon', 'Delhivery', 'Shiprocket'], ordered: true,
  prompt: `<p><code>address_history</code> keeps every address change. For each customer return the current (latest) address and the city they lived in just before it. If two rows share the same latest timestamp, prefer the larger pincode (deterministic tie-break). Also count how many times the <b>city</b> actually changed.</p>
<p>Return <code>customer_id</code>, <code>current_city</code>, <code>current_pincode</code>, <code>previous_city</code> (NULL if none), <code>city_changes</code>. Sort by customer_id.</p>`,
  hint: 'Order rows per customer; LAG(city) gives the previous row; a city change is city <> LAG(city).',
  sql: `WITH h AS (
  SELECT customer_id, city, pincode, updated_at,
         LAG(city) OVER (PARTITION BY customer_id ORDER BY updated_at, pincode) AS prev_city,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, pincode DESC) AS rn_desc
  FROM address_history
), changes AS (
  SELECT customer_id, SUM(CASE WHEN prev_city IS NOT NULL AND city <> prev_city THEN 1 ELSE 0 END) AS city_changes
  FROM h GROUP BY customer_id
)
SELECT h.customer_id, h.city AS current_city, h.pincode AS current_pincode,
       h.prev_city AS previous_city, c.city_changes
FROM h
JOIN changes c ON c.customer_id = h.customer_id
WHERE h.rn_desc = 1
ORDER BY h.customer_id;`,
  sql_explain: `<p>"Latest record per key" is the most common dedup in real pipelines (CDC / SCD type-2 tables). Always add a tie-breaker — two updates with the same timestamp are common in real data. Note how the ascending and descending orderings are mirror images so that LAG on the latest row really is the previous row.</p>`,
  py: `h = address_history.sort_values(['customer_id', 'updated_at', 'pincode']).copy()
h['prev_city'] = h.groupby('customer_id').city.shift(1)
h['chg'] = (h.prev_city.notna() & (h.city != h.prev_city)).astype(int)
chg = h.groupby('customer_id').chg.sum().rename('city_changes')
last = h.drop_duplicates('customer_id', keep='last').join(chg, on='customer_id')
result = last.rename(columns={'city': 'current_city', 'pincode': 'current_pincode', 'prev_city': 'previous_city'})[
    ['customer_id', 'current_city', 'current_pincode', 'previous_city', 'city_changes']].reset_index(drop=True)`,
  py_explain: `<p>Sort ascending, <code>shift</code> for the previous city, then <code>drop_duplicates(keep='last')</code> for the latest row.</p>`
},
{
  id: 88, title: 'Split comma-separated skills into rows', difficulty: 'Hard', tier: 2,
  tables: { candidates: QT('candidate_id:INT,name:TEXT,skills:TEXT', [[1, 'Ananya', 'SQL,Python,Tableau'], [2, 'Rahul', 'Python,Excel'], [3, 'Isha', 'SQL,Power BI,Excel,Python'], [4, 'Varun', 'SQL'], [5, 'Neha', 'Tableau,SQL,Statistics'], [6, 'Dev', 'Excel,Power BI']]) },
  topics: ['Recursive CTE', 'String functions', 'Data cleaning'], companies: ['LinkedIn', 'Naukri', 'Amazon', 'Accenture'], ordered: true,
  prompt: `<p>Skills are stored as a comma-separated string (a 1NF violation you will meet in real data). Normalise them into one row per (candidate, skill) and count candidates per skill.</p>
<p>Return <code>skill</code>, <code>candidates</code>. Sort by candidates desc, then skill.</p>`,
  hint: 'Recursive CTE that peels off SUBSTRING_INDEX(rest, \',\', 1) and continues with the remainder after the first comma.',
  sql: `WITH RECURSIVE split AS (
  SELECT candidate_id,
         SUBSTRING_INDEX(skills, ',', 1) AS skill,
         CASE WHEN LOCATE(',', skills) > 0 THEN SUBSTRING(skills, LOCATE(',', skills) + 1) END AS rest
  FROM candidates
  UNION ALL
  SELECT candidate_id,
         SUBSTRING_INDEX(rest, ',', 1),
         CASE WHEN LOCATE(',', rest) > 0 THEN SUBSTRING(rest, LOCATE(',', rest) + 1) END
  FROM split
  WHERE rest IS NOT NULL
)
SELECT TRIM(skill) AS skill, COUNT(DISTINCT candidate_id) AS candidates
FROM split
GROUP BY TRIM(skill)
ORDER BY candidates DESC, skill;`,
  sql_explain: `<p>Each recursion step emits the first token and passes the remainder on; it stops when no comma is left. Alternative in MySQL 8: <code>JSON_TABLE</code> on <code>CONCAT('["', REPLACE(skills, ',', '","'), '"]')</code>, or a numbers table with <code>SUBSTRING_INDEX(SUBSTRING_INDEX(skills, ',', n), ',', -1)</code>.</p>
<p>Related question: "candidates who have Python AND SQL AND Tableau" → after splitting, <code>HAVING COUNT(DISTINCT skill) = 3</code> with a skill IN-list.</p>`,
  py: `s = candidates.assign(skill=candidates.skills.str.split(',')).explode('skill')
s['skill'] = s.skill.str.strip()
result = s.groupby('skill').candidate_id.nunique().reset_index(name='candidates').sort_values(['candidates', 'skill'], ascending=[False, True]).reset_index(drop=True)`,
  py_explain: `<p><code>str.split</code> + <code>explode</code> is the one-liner for this in pandas.</p>`
},
{
  id: 89, title: 'Symmetric pairs', difficulty: 'Medium', tier: 1,
  tables: { pairs: QT('x:INT,y:INT', [[20, 20], [20, 20], [20, 21], [23, 22], [22, 23], [21, 20], [24, 25], [26, 27], [27, 26], [30, 30]]) },
  topics: ['Self join', 'HAVING'], companies: ['HackerRank', 'Amazon', 'Goldman Sachs'], ordered: true,
  prompt: `<p>Two rows (x1, y1) and (x2, y2) are symmetric if x1 = y2 and x2 = y1. Return each symmetric pair once with <code>x ≤ y</code>. A pair with x = y is symmetric only if it appears at least twice.</p>
<p>Return <code>x</code>, <code>y</code> sorted by x, then y.</p>`,
  hint: 'Self join for x<y; for x=y use GROUP BY x, y HAVING COUNT(*) > 1. Combine with UNION.',
  sql: `SELECT a.x, a.y
FROM pairs a
JOIN pairs b ON a.x = b.y AND a.y = b.x
WHERE a.x < a.y
UNION
SELECT x, y FROM pairs WHERE x = y GROUP BY x, y HAVING COUNT(*) > 1
ORDER BY x, y;`,
  sql_explain: `<p>The x = y case is the trick: a row joins with itself, so the self join alone would report (30,30) wrongly. Handle it separately by requiring a duplicate row. <code>UNION</code> (not ALL) de-duplicates.</p>`,
  py: `m = pairs.merge(pairs.rename(columns={'x': 'y', 'y': 'x'}), on=['x', 'y'])
a = m[m.x < m.y][['x', 'y']].drop_duplicates()
c = pairs[pairs.x == pairs.y].value_counts()
b = c[c > 1].reset_index()[['x', 'y']]
result = pd.concat([a, b]).drop_duplicates().sort_values(['x', 'y']).reset_index(drop=True)`,
  py_explain: `<p>Merge with the swapped copy to find symmetric matches, and count duplicates for the diagonal.</p>`
},
{
  id: 90, title: 'Tournament winner in each group', difficulty: 'Hard', tier: 2,
  tables: {
    players: QT('player_id:INT,group_id:INT', [[15, 1], [25, 1], [30, 1], [45, 1], [10, 2], [35, 2], [50, 2], [20, 3], [40, 3]]),
    games: QT('match_id:INT,first_player:INT,second_player:INT,first_score:INT,second_score:INT', [[1, 15, 45, 3, 0], [2, 30, 25, 1, 2], [3, 30, 15, 2, 0], [4, 40, 20, 5, 2], [5, 35, 50, 1, 1], [6, 10, 35, 2, 1], [7, 25, 45, 1, 3]])
  },
  topics: ['UNION ALL', 'Window ranking', 'LEFT JOIN'], companies: ['Amazon', 'Dream11', 'MPL', 'Wayfair'], ordered: true,
  prompt: `<p>A player's total = the sum of points they scored across all their games (as first or second player). The winner of each group is the player with the highest total; ties → lowest player_id. Players with no games have 0.</p>
<p>Return <code>group_id</code>, <code>player_id</code>, <code>total_points</code>. Sort by group_id.</p>`,
  hint: 'Unpivot games into (player, points) with UNION ALL, LEFT JOIN from players, ROW_NUMBER per group.',
  sql: `WITH pts AS (
  SELECT first_player AS player_id, first_score AS points FROM games
  UNION ALL
  SELECT second_player, second_score FROM games
), tot AS (
  SELECT p.group_id, p.player_id, COALESCE(SUM(pts.points), 0) AS total_points
  FROM players p
  LEFT JOIN pts ON pts.player_id = p.player_id
  GROUP BY p.group_id, p.player_id
), r AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY total_points DESC, player_id) AS rn
  FROM tot
)
SELECT group_id, player_id, total_points FROM r WHERE rn = 1 ORDER BY group_id;`,
  sql_explain: `<p>Combines three patterns: unpivot (two player columns → one), LEFT JOIN with COALESCE for players without games, and top-1 per group with a tie-break.</p>`,
  py: `pts = pd.concat([games[['first_player', 'first_score']].set_axis(['player_id', 'points'], axis=1),
                 games[['second_player', 'second_score']].set_axis(['player_id', 'points'], axis=1)])
tot = players.merge(pts.groupby('player_id').points.sum().reset_index(), on='player_id', how='left').fillna({'points': 0})
tot = tot.sort_values(['group_id', 'points', 'player_id'], ascending=[True, False, True]).drop_duplicates('group_id')
result = tot.rename(columns={'points': 'total_points'})[['group_id', 'player_id', 'total_points']].astype(int).reset_index(drop=True)`,
  py_explain: `<p><code>set_axis</code> renames positionally — handy for stacking differently named column pairs.</p>`
},
{
  id: 91, title: 'Clean a messy transactions export', difficulty: 'Hard', tier: 2,
  tables: { raw_txn: QT('txn_ref:TEXT,txn_date:TEXT,amount:TEXT,status:TEXT,city:TEXT', [
    ['T001', '2024-07-01', '₹1,250.00', 'SUCCESS', 'mumbai'], ['T002', '01/07/2024', '980', 'success ', 'Mumbai '], ['T003', '2024-07-01', 'Rs. 2,000', 'Failed', 'Pune'],
    ['T004', '02/07/2024', '₹ 450.50', 'Success', 'PUNE'], ['T005', '2024-07-02', '3,100', 'SUCCESS', 'Delhi'], ['T006', '2024-07-02', null, 'SUCCESS', 'delhi'],
    ['T007', '03/07/2024', '₹750', 'pending', 'Mumbai'], ['T008', '2024-07-03', '1,999.99', ' success', 'New Delhi'], ['T009', '03/07/2024', 'Rs.500', 'SUCCESS', 'pune '],
    ['T002', '01/07/2024', '980', 'success ', 'Mumbai ']]) },
  topics: ['Data cleaning', 'String functions', 'Date functions', 'Dedup'], companies: ['Razorpay', 'Deloitte', 'EY', 'Fractal', 'Swiggy'], ordered: true,
  prompt: `<p>An ops team shared a raw export. Clean it and report daily successful revenue per city:</p>
<ul><li><code>txn_date</code> is either <code>YYYY-MM-DD</code> or <code>DD/MM/YYYY</code></li><li><code>amount</code> may contain <code>₹</code>, <code>Rs.</code>, spaces and thousands separators; NULL amounts are excluded</li><li><code>status</code> has inconsistent case/spaces — only <b>success</b> counts</li><li><code>city</code>: trim + proper case; treat <code>'New Delhi'</code> as <code>'Delhi'</code></li><li>The file contains an exact duplicate row — count each <code>txn_ref</code> once</li></ul>
<p>Return <code>txn_date</code> (YYYY-MM-DD), <code>city</code>, <code>txns</code>, <code>revenue</code> (2 dp). Sort by txn_date, city.</p>`,
  hint: "STR_TO_DATE(x, '%d/%m/%Y') when x LIKE '%/%'; nested REPLACE for ₹, 'Rs.', ',', ' '; UPPER(TRIM(status)); dedupe with SELECT DISTINCT first.",
  sql: `WITH dedup AS (
  SELECT DISTINCT txn_ref, txn_date, amount, status, city FROM raw_txn
), clean AS (
  SELECT txn_ref,
         CASE WHEN txn_date LIKE '%/%' THEN STR_TO_DATE(txn_date, '%d/%m/%Y')
              ELSE DATE(txn_date) END AS txn_date,
         CAST(REPLACE(REPLACE(REPLACE(REPLACE(amount, '₹', ''), 'Rs.', ''), ',', ''), ' ', '') AS DECIMAL(12, 2)) AS amount,
         UPPER(TRIM(status)) AS status,
         CASE WHEN UPPER(TRIM(city)) IN ('DELHI', 'NEW DELHI') THEN 'Delhi'
              ELSE CONCAT(UPPER(LEFT(TRIM(city), 1)), LOWER(SUBSTRING(TRIM(city), 2))) END AS city
  FROM dedup
)
SELECT txn_date, city, COUNT(*) AS txns, ROUND(SUM(amount), 2) AS revenue
FROM clean
WHERE status = 'SUCCESS' AND amount IS NOT NULL
GROUP BY txn_date, city
ORDER BY txn_date, city;`,
  sql_explain: `<p>Real take-home assignments look like this. Work column by column inside one <code>clean</code> CTE, then aggregate. Key functions: <code>STR_TO_DATE</code>, nested <code>REPLACE</code>, <code>TRIM</code>/<code>UPPER</code>/<code>LOWER</code>, <code>CAST(… AS DECIMAL)</code>. Always dedupe <b>before</b> aggregating, and say what you'd do with invalid rows (quarantine table, data-quality alert).</p>`,
  py: `d = raw_txn.drop_duplicates().copy()
iso = pd.to_datetime(d.txn_date, format='%Y-%m-%d', errors='coerce')
dmy = pd.to_datetime(d.txn_date, format='%d/%m/%Y', errors='coerce')
d['txn_date'] = iso.fillna(dmy)
d['amount'] = pd.to_numeric(d.amount.str.replace('₹', '', regex=False).str.replace('Rs.', '', regex=False)
                            .str.replace(',', '', regex=False).str.replace(' ', '', regex=False), errors='coerce')
d['status'] = d.status.str.strip().str.upper()
c = d.city.str.strip().str.title()
d['city'] = c.replace({'New Delhi': 'Delhi'})
d = d[(d.status == 'SUCCESS') & d.amount.notna()]
result = d.groupby(['txn_date', 'city']).agg(txns=('txn_ref', 'count'), revenue=('amount', 'sum')).reset_index()
result['revenue'] = result.revenue.round(2)`,
  py_explain: `<p>Parse each date format with <code>errors='coerce'</code> and combine with <code>fillna</code>; vectorised <code>.str</code> methods for cleaning; <code>pd.to_numeric(errors='coerce')</code> turns junk into NaN.</p>`
},
{
  id: 92, title: 'Wallet running balance and first overdraft', difficulty: 'Hard', tier: 2,
  tables: { wallet_txns: QT('txn_id:INT,user_id:INT,txn_time:DATETIME,txn_type:TEXT,amount:REAL', [
    [1, 101, '2024-08-01 09:00:00', 'credit', 1000], [2, 101, '2024-08-01 12:30:00', 'debit', 400], [3, 102, '2024-08-01 13:00:00', 'credit', 500],
    [4, 101, '2024-08-02 08:15:00', 'debit', 700], [5, 102, '2024-08-02 10:00:00', 'debit', 200], [6, 101, '2024-08-02 18:00:00', 'credit', 300],
    [7, 103, '2024-08-02 19:00:00', 'credit', 250], [8, 102, '2024-08-03 09:45:00', 'debit', 350], [9, 103, '2024-08-03 11:00:00', 'debit', 100],
    [10, 101, '2024-08-03 20:00:00', 'debit', 250], [11, 102, '2024-08-04 07:30:00', 'credit', 1000], [12, 103, '2024-08-04 08:00:00', 'debit', 200]]) },
  topics: ['Running total', 'Window ranking', 'Business case'], companies: ['Paytm', 'PhonePe', 'CRED', 'Jupiter', 'Fi Money'], ordered: true,
  prompt: `<p>Compute each user's running wallet balance (credits add, debits subtract) in time order. For every user whose balance ever went <b>negative</b>, return the <b>first</b> transaction that made it negative.</p>
<p>Return <code>user_id</code>, <code>txn_id</code>, <code>txn_time</code>, <code>balance_after</code>. Sort by user_id.</p>`,
  hint: 'SUM(CASE WHEN credit THEN amount ELSE -amount END) OVER (PARTITION BY user ORDER BY time ROWS UNBOUNDED PRECEDING); then ROW_NUMBER among negative rows.',
  sql: `WITH bal AS (
  SELECT txn_id, user_id, txn_time,
         SUM(CASE WHEN txn_type = 'credit' THEN amount ELSE -amount END)
           OVER (PARTITION BY user_id ORDER BY txn_time, txn_id ROWS UNBOUNDED PRECEDING) AS balance_after
  FROM wallet_txns
), neg AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY txn_time, txn_id) AS rn
  FROM bal
  WHERE balance_after < 0
)
SELECT user_id, txn_id, txn_time, balance_after
FROM neg
WHERE rn = 1
ORDER BY user_id;`,
  sql_explain: `<p>Signed running sum = ledger balance. Filtering to negative rows <i>after</i> computing the balance, then taking the first one, gives the overdraft moment. This is the core of many fintech questions (credit-limit breaches, negative inventory, account reconciliation).</p>`,
  py: `w = wallet_txns.sort_values(['user_id', 'txn_time', 'txn_id']).copy()
w['signed'] = np.where(w.txn_type == 'credit', w.amount, -w.amount)
w['balance_after'] = w.groupby('user_id').signed.cumsum()
result = (w[w.balance_after < 0].drop_duplicates('user_id')[['user_id', 'txn_id', 'txn_time', 'balance_after']]
          .sort_values('user_id').reset_index(drop=True))`,
  py_explain: `<p>Signed amounts + <code>groupby().cumsum()</code>; first negative row per user via <code>drop_duplicates</code>.</p>`
}
);
