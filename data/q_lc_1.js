/* LeetCode Database set — part 1 (175 → 603).
   Problem numbers and titles follow LeetCode's Database list; statements are short rewrites and
   all sample data is original. Open the official problem with the link on each page. */
LC(175, {
  title: 'Combine Two Tables', difficulty: 'Easy', topics: ['Joins', 'LEFT JOIN'],
  tables: {
    Person: QT('personId:INT,firstName:TEXT,lastName:TEXT', [[1, 'Asha', 'Rao'], [2, 'Kunal', 'Mehta'], [3, 'Divya', 'Iyer'], [4, 'Farhan', 'Ali']]),
    Address: QT('addressId:INT,personId:INT,city:TEXT,state:TEXT', [[1, 2, 'Pune', 'Maharashtra'], [2, 4, 'Kochi', 'Kerala'], [3, 9, 'Jaipur', 'Rajasthan']])
  },
  prompt: `<p>Report every person's <code>firstName</code>, <code>lastName</code>, <code>city</code> and <code>state</code>. People without an address must still appear, with NULL city and state. Any order.</p>`,
  hint: 'Every person must survive → Person on the left of a LEFT JOIN.',
  sql: `SELECT p.firstName, p.lastName, a.city, a.state
FROM Person p
LEFT JOIN Address a ON a.personId = p.personId;`,
  sql_explain: `<p>"Every X, with Y if it exists" = <b>LEFT JOIN</b> from X. An INNER JOIN would drop Asha and Divya (no address). Address 3 belongs to a person who doesn't exist and is ignored automatically.</p>`,
  py: `result = Person.merge(Address, on='personId', how='left')[['firstName', 'lastName', 'city', 'state']]`,
  py_explain: `<p><code>merge(how='left')</code> = LEFT JOIN.</p>`
});
LC(176, {
  title: 'Second Highest Salary', difficulty: 'Medium', topics: ['Subquery', 'NULL handling', 'Window ranking'],
  tables: { Employee: QT('id:INT,salary:INT', [[1, 52000], [2, 87000], [3, 87000], [4, 61000], [5, 45000]]) },
  prompt: `<p>Return the second highest <b>distinct</b> salary as <code>SecondHighestSalary</code>. If it doesn't exist, return a single row containing NULL.</p>`,
  hint: 'Two people share the top salary here — DISTINCT matters. An aggregate/scalar subquery returns NULL instead of no row.',
  sql: `SELECT (
  SELECT DISTINCT salary
  FROM Employee
  ORDER BY salary DESC
  LIMIT 1 OFFSET 1
) AS SecondHighestSalary;`,
  sql_explain: `<p>Sorting distinct salaries and skipping one gives the 2nd highest. Wrapping it as a <b>scalar subquery</b> turns "no row" into NULL (the edge case). Equivalent: <code>SELECT MAX(salary) FROM Employee WHERE salary &lt; (SELECT MAX(salary) FROM Employee)</code>. Without DISTINCT you'd return 87000 again.</p>`,
  py: `s = Employee.salary.drop_duplicates().sort_values(ascending=False)
result = pd.DataFrame({'SecondHighestSalary': [s.iloc[1] if len(s) > 1 else None]})`,
  py_explain: `<p>Unique, sort, take the 2nd if present.</p>`
});
LC(177, {
  title: 'Nth Highest Salary', difficulty: 'Medium', topics: ['Subquery', 'Window ranking'],
  tables: { Employee: QT('id:INT,salary:INT', [[1, 300], [2, 700], [3, 500], [4, 700], [5, 200], [6, 500], [7, 900]]) },
  prompt: `<p>On LeetCode this is a <code>CREATE FUNCTION getNthHighestSalary(N)</code>. Here, write the query for <b>N = 3</b>: return the 3rd highest distinct salary as <code>getNthHighestSalary</code> (NULL if there are fewer than 3 distinct salaries).</p>`,
  hint: 'DENSE_RANK gives distinct-salary positions; or LIMIT 1 OFFSET N-1 on DISTINCT salaries.',
  sql: `SELECT (
  SELECT DISTINCT salary
  FROM Employee
  ORDER BY salary DESC
  LIMIT 1 OFFSET 2          -- N - 1
) AS getNthHighestSalary;

/* LeetCode function form (MySQL):
CREATE FUNCTION getNthHighestSalary(N INT) RETURNS INT
BEGIN
  SET N = N - 1;            -- LIMIT/OFFSET can't take an expression
  RETURN (SELECT DISTINCT salary FROM Employee ORDER BY salary DESC LIMIT 1 OFFSET N);
END */`,
  sql_explain: `<p>Same idea as 176 with a variable offset. In MySQL, <code>LIMIT</code>/<code>OFFSET</code> accept only literals or variables, not <code>N-1</code>, which is why the function first does <code>SET N = N - 1</code>. Window alternative: <code>SELECT MAX(salary) FROM (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) dr FROM Employee) t WHERE dr = N</code> (MAX turns "no row" into NULL).</p>`,
  py: `N = 3
s = Employee.salary.drop_duplicates().sort_values(ascending=False)
result = pd.DataFrame({'getNthHighestSalary': [s.iloc[N - 1] if len(s) >= N else None]})`,
  py_explain: `<p>Unique, sort descending, index N−1.</p>`
});
LC(178, {
  title: 'Rank Scores', difficulty: 'Medium', topics: ['Window ranking', 'DENSE_RANK'], ordered: true,
  tables: { Scores: QT('id:INT,score:REAL', [[1, 3.2], [2, 3.9], [3, 4.5], [4, 3.9], [5, 4.5], [6, 2.8], [7, 3.9]]) },
  prompt: `<p>Rank the scores highest first. Ties share a rank and the next rank is the next integer (no gaps). Return <code>score</code>, <code>rank</code>, ordered by score descending.</p>`,
  hint: 'DENSE_RANK. "rank" is a reserved word in MySQL 8 — quote the alias.',
  sql: "SELECT score,\n       DENSE_RANK() OVER (ORDER BY score DESC) AS `rank`\nFROM Scores\nORDER BY score DESC;",
  sql_explain: "<p><code>DENSE_RANK</code> = no gaps (1,1,2); <code>RANK</code> would give 1,1,3. In MySQL 8 <code>RANK</code> became a reserved word, so the alias needs backticks: <code>AS `rank`</code> — a common \"why does my query fail\" moment. Pre-window solution: <code>(SELECT COUNT(DISTINCT score) FROM Scores s2 WHERE s2.score &gt;= s.score)</code>.</p>",
  py: `result = Scores[['score']].copy()
result['rank'] = result.score.rank(method='dense', ascending=False).astype(int)
result = result.sort_values('score', ascending=False).reset_index(drop=True)`,
  py_explain: `<p><code>rank(method='dense')</code>.</p>`
});
LC(180, {
  title: 'Consecutive Numbers', difficulty: 'Medium', topics: ['LAG/LEAD', 'Gaps & islands'],
  tables: { Logs: QT('id:INT,num:INT', [[1, 5], [2, 5], [3, 5], [4, 8], [5, 5], [6, 8], [7, 8], [8, 8], [9, 8], [10, 3], [11, 3]]) },
  prompt: `<p>Find every number that appears at least <b>three times in a row</b> (consecutive ids). Return distinct <code>ConsecutiveNums</code>.</p>`,
  hint: 'Compare num with LAG(num,1) and LAG(num,2).',
  sql: `SELECT DISTINCT num AS ConsecutiveNums
FROM (
  SELECT num,
         LAG(num, 1) OVER (ORDER BY id) AS p1,
         LAG(num, 2) OVER (ORDER BY id) AS p2
  FROM Logs
) t
WHERE num = p1 AND num = p2;`,
  sql_explain: `<p>A row qualifies when it equals the two rows before it. DISTINCT because a run of 4 qualifies twice. The classic 3-way self join (<code>l2.id = l1.id+1</code>, <code>l3.id = l1.id+2</code>) only works when ids have no gaps.</p>`,
  py: `l = Logs.sort_values('id')
m = (l.num == l.num.shift(1)) & (l.num == l.num.shift(2))
result = pd.DataFrame({'ConsecutiveNums': l[m].num.unique()})`,
  py_explain: `<p><code>shift</code> = LAG.</p>`
});
LC(181, {
  title: 'Employees Earning More Than Their Managers', difficulty: 'Easy', topics: ['Self join'],
  tables: { Employee: QT('id:INT,name:TEXT,salary:INT,managerId:INT', [[1, 'Ravi', 82000, 3], [2, 'Meena', 64000, 3], [3, 'Arjun', 75000, null], [4, 'Sana', 91000, 5], [5, 'Tom', 90000, null], [6, 'Lata', 40000, 4]]) },
  prompt: `<p>Return the names (<code>Employee</code>) of employees who earn more than their direct manager.</p>`,
  hint: 'Join Employee to itself: e.managerId = m.id.',
  sql: `SELECT e.name AS Employee
FROM Employee e
JOIN Employee m ON m.id = e.managerId
WHERE e.salary > m.salary;`,
  sql_explain: `<p>Self join with two roles. Employees without a manager drop out of the inner join, which is what we want.</p>`,
  py: `m = Employee.merge(Employee, left_on='managerId', right_on='id', suffixes=('', '_m'))
result = m[m.salary > m.salary_m][['name']].rename(columns={'name': 'Employee'})`,
  py_explain: `<p>Self merge with suffixes.</p>`
});
LC(182, {
  title: 'Duplicate Emails', difficulty: 'Easy', topics: ['HAVING', 'Aggregation'],
  tables: { Person: QT('id:INT,email:TEXT', [[1, 'neha@x.com'], [2, 'raj@y.com'], [3, 'neha@x.com'], [4, 'amit@z.com'], [5, 'raj@y.com'], [6, 'neha@x.com']]) },
  prompt: `<p>Return each email that appears more than once (once per email) as <code>Email</code>.</p>`,
  hint: 'GROUP BY email HAVING COUNT(*) > 1.',
  sql: `SELECT email AS Email
FROM Person
GROUP BY email
HAVING COUNT(*) > 1;`,
  sql_explain: `<p>Group filter → HAVING. A self join (<code>p1.email = p2.email AND p1.id &lt;&gt; p2.id</code>) also works but needs DISTINCT and is slower.</p>`,
  py: `c = Person.email.value_counts()
result = pd.DataFrame({'Email': c[c > 1].index})`,
  py_explain: `<p><code>value_counts</code> then filter.</p>`
});
LC(183, {
  title: 'Customers Who Never Order', difficulty: 'Easy', topics: ['Anti join', 'NOT EXISTS'],
  tables: {
    Customers: QT('id:INT,name:TEXT', [[1, 'Ishaan'], [2, 'Pooja'], [3, 'Vikram'], [4, 'Zara'], [5, 'Neil']]),
    Orders: QT('id:INT,customerId:INT', [[1, 3], [2, 1], [3, 3], [4, 5]])
  },
  prompt: `<p>Return the names (<code>Customers</code>) of customers who never placed an order.</p>`,
  hint: 'Anti-join: NOT EXISTS or LEFT JOIN … IS NULL.',
  sql: `SELECT c.name AS Customers
FROM Customers c
WHERE NOT EXISTS (SELECT 1 FROM Orders o WHERE o.customerId = c.id);`,
  sql_explain: `<p>NOT EXISTS stops at the first matching order and is NULL-safe. <code>NOT IN (SELECT customerId FROM Orders)</code> returns nothing at all if any customerId is NULL — know why.</p>`,
  py: `result = Customers[~Customers.id.isin(Orders.customerId)][['name']].rename(columns={'name': 'Customers'})`,
  py_explain: `<p><code>~isin</code> = anti-join.</p>`
});
LC(196, {
  title: 'Delete Duplicate Emails', difficulty: 'Easy', topics: ['DELETE', 'Dedup'], ordered: true,
  after: 'SELECT * FROM Person ORDER BY id',
  tables: { Person: QT('id:INT,email:TEXT', [[1, 'kiran@mail.com'], [2, 'dev@mail.com'], [3, 'kiran@mail.com'], [4, 'dev@mail.com'], [5, 'esha@mail.com'], [6, 'kiran@mail.com']]) },
  prompt: `<p>Write a <b>DELETE</b> statement that removes duplicate emails, keeping for each email only the row with the smallest <code>id</code>.</p>
<p>The checker runs your statement and then compares <code>SELECT * FROM Person ORDER BY id</code>. (In pandas, modify <code>Person</code> and set <code>result = Person</code>.)</p>`,
  hint: 'Keep MIN(id) per email; delete everything else. MySQL needs a derived table to read from the table it deletes from.',
  sql: `DELETE FROM Person
WHERE id NOT IN (
  SELECT keep_id FROM (
    SELECT MIN(id) AS keep_id FROM Person GROUP BY email
  ) t
);

-- LeetCode's popular MySQL-only form (multi-table DELETE, not supported in this browser engine):
-- DELETE p1 FROM Person p1 JOIN Person p2 ON p1.email = p2.email AND p1.id > p2.id;`,
  sql_explain: `<p>Compute survivors (MIN id per email) and delete the rest. The extra <code>SELECT … FROM (…) t</code> wrapper is required in MySQL: error 1093 "You can't specify target table for update in FROM clause" happens if the subquery reads Person directly. The self-join DELETE is shorter but MySQL-specific.</p>`,
  py: `Person = Person.sort_values('id').drop_duplicates('email', keep='first')
result = Person.sort_values('id').reset_index(drop=True)`,
  py_explain: `<p>pandas has no in-place DELETE in SQL's sense; you rebuild the frame. LeetCode's pandas version requires modifying the frame <i>in place</i>: <code>Person.drop(Person[Person.duplicated('email')].index, inplace=True)</code> after sorting by id.</p>`
});
LC(197, {
  title: 'Rising Temperature', difficulty: 'Easy', topics: ['Self join', 'Date functions'],
  tables: { Weather: QT('id:INT,recordDate:DATE,temperature:INT', [[1, '2024-01-01', 12], [2, '2024-01-02', 15], [3, '2024-01-03', 14], [4, '2024-01-05', 20], [5, '2024-01-06', 22], [6, '2024-01-04', 9]]) },
  prompt: `<p>Return the <code>id</code> of every date whose temperature is higher than the <b>previous calendar day's</b> (yesterday, not "previous row"). Rows are not in date order and a day may be missing.</p>`,
  hint: 'Join on DATEDIFF(today, yesterday) = 1 — LAG over rows would compare against the previous existing row, which may not be yesterday.',
  sql: `SELECT w.id
FROM Weather w
JOIN Weather y ON DATEDIFF(w.recordDate, y.recordDate) = 1
WHERE w.temperature > y.temperature;`,
  sql_explain: `<p>The join condition encodes "yesterday" exactly. If you use LAG you must also check <code>DATEDIFF(recordDate, LAG(recordDate)) = 1</code>, otherwise a missing day compares against the wrong row. Rows here are deliberately inserted out of order.</p>`,
  py: `y = Weather.assign(recordDate=Weather.recordDate + pd.Timedelta(days=1))
m = Weather.merge(y, on='recordDate', suffixes=('', '_y'))
result = m[m.temperature > m.temperature_y][['id']]`,
  py_explain: `<p>Shift yesterday's dates forward by one day and merge on date.</p>`
});
LC(511, {
  title: 'Game Play Analysis I', difficulty: 'Easy', topics: ['Aggregation', 'First touch'],
  tables: { Activity: QT('player_id:INT,device_id:INT,event_date:DATE,games_played:INT', [[1, 4, '2024-03-02', 3], [1, 4, '2024-03-05', 1], [2, 7, '2024-02-11', 0], [3, 1, '2024-03-08', 6], [3, 2, '2024-01-20', 2], [2, 7, '2024-02-12', 5]]) },
  prompt: `<p>Report each player's first login date: <code>player_id</code>, <code>first_login</code>.</p>`,
  hint: 'MIN per player.',
  sql: `SELECT player_id, MIN(event_date) AS first_login
FROM Activity
GROUP BY player_id;`,
  sql_explain: `<p>"First X per group" when you only need the value itself → plain <code>MIN</code>. Need other columns of that row? → ROW_NUMBER (see 512).</p>`,
  py: `result = Activity.groupby('player_id', as_index=False).event_date.min().rename(columns={'event_date': 'first_login'})`,
  py_explain: `<p>groupby + min.</p>`
});
LC(512, {
  title: 'Game Play Analysis II', difficulty: 'Easy', topics: ['Window ranking', 'First touch'],
  tables: { Activity: QT('player_id:INT,device_id:INT,event_date:DATE,games_played:INT', [[1, 4, '2024-03-02', 3], [1, 9, '2024-03-05', 1], [2, 7, '2024-02-11', 0], [3, 1, '2024-03-08', 6], [3, 2, '2024-01-20', 2], [2, 8, '2024-02-12', 5]]) },
  prompt: `<p>Report the device each player used on their <b>first</b> login: <code>player_id</code>, <code>device_id</code>.</p>`,
  hint: 'You need a column from the min-date row → ROW_NUMBER = 1, or (player_id, event_date) IN (SELECT player_id, MIN(...)).',
  sql: `SELECT player_id, device_id
FROM (
  SELECT player_id, device_id,
         ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY event_date) AS rn
  FROM Activity
) t
WHERE rn = 1;`,
  sql_explain: `<p>"Argmin per group". The tuple-IN version <code>WHERE (player_id, event_date) IN (SELECT player_id, MIN(event_date) …)</code> works in MySQL and relies on (player_id, event_date) being unique.</p>`,
  py: `result = Activity.sort_values(['player_id', 'event_date']).drop_duplicates('player_id')[['player_id', 'device_id']]`,
  py_explain: `<p>Sort + drop_duplicates = first row per group.</p>`
});
LC(534, {
  title: 'Game Play Analysis III', difficulty: 'Medium', topics: ['Running total', 'Window aggregate'],
  tables: { Activity: QT('player_id:INT,device_id:INT,event_date:DATE,games_played:INT', [[1, 4, '2024-03-02', 3], [1, 4, '2024-03-05', 1], [1, 4, '2024-03-09', 4], [2, 7, '2024-02-11', 0], [2, 7, '2024-02-12', 5], [3, 1, '2024-01-20', 2], [3, 1, '2024-03-08', 6]]) },
  prompt: `<p>For each player and date, report how many games the player has played <b>so far</b> (up to and including that date): <code>player_id</code>, <code>event_date</code>, <code>games_played_so_far</code>.</p>`,
  hint: 'SUM() OVER (PARTITION BY player ORDER BY date).',
  sql: `SELECT player_id, event_date,
       SUM(games_played) OVER (PARTITION BY player_id ORDER BY event_date) AS games_played_so_far
FROM Activity;`,
  sql_explain: `<p>Running total per partition. Pre-MySQL-8 answer: self join <code>a2.player_id = a1.player_id AND a2.event_date &lt;= a1.event_date</code> + GROUP BY (O(n²)).</p>`,
  py: `a = Activity.sort_values(['player_id', 'event_date']).copy()
a['games_played_so_far'] = a.groupby('player_id').games_played.cumsum()
result = a[['player_id', 'event_date', 'games_played_so_far']]`,
  py_explain: `<p>groupby + cumsum after sorting.</p>`
});
LC(570, {
  title: 'Managers with at Least 5 Direct Reports', difficulty: 'Medium', topics: ['Self join', 'HAVING'],
  tables: { Employee: QT('id:INT,name:TEXT,department:TEXT,managerId:INT', [[101, 'Anil', 'A', null], [102, 'Bina', 'A', 101], [103, 'Chetan', 'A', 101], [104, 'Deepa', 'A', 101], [105, 'Eshan', 'A', 101], [106, 'Fiza', 'B', 101], [107, 'Gopi', 'B', 108], [108, 'Hema', 'B', null], [109, 'Ira', 'B', 108]]) },
  prompt: `<p>Return the <code>name</code> of every manager who has at least five direct reports.</p>`,
  hint: 'Group reports by managerId, HAVING ≥ 5, then join back for the name.',
  sql: `SELECT m.name
FROM Employee m
JOIN (
  SELECT managerId FROM Employee
  WHERE managerId IS NOT NULL
  GROUP BY managerId
  HAVING COUNT(*) >= 5
) r ON r.managerId = m.id;`,
  sql_explain: `<p>Aggregate first, then join for the name — grouping by m.id, m.name after a self join also works. The trap: grouping only the reports and returning managerId instead of the name, or forgetting that a manager id might not exist as an employee.</p>`,
  py: `c = Employee.managerId.value_counts()
result = Employee[Employee.id.isin(c[c >= 5].index)][['name']]`,
  py_explain: `<p>Count reports per manager, then filter employees whose id is in that set.</p>`
});
LC(577, {
  title: 'Employee Bonus', difficulty: 'Easy', topics: ['LEFT JOIN', 'NULL handling'],
  tables: {
    Employee: QT('empId:INT,name:TEXT,supervisor:INT,salary:INT', [[1, 'Nitin', 3, 1000], [2, 'Shreya', 3, 2000], [3, 'Bala', null, 4000], [4, 'Mona', 3, 3000], [5, 'Omar', 1, 1500]]),
    Bonus: QT('empId:INT,bonus:INT', [[2, 500], [4, 2000], [5, 999]])
  },
  prompt: `<p>Return <code>name</code> and <code>bonus</code> of employees whose bonus is less than 1000 — including employees with no bonus row (bonus NULL).</p>`,
  hint: 'LEFT JOIN, then bonus < 1000 OR bonus IS NULL.',
  sql: `SELECT e.name, b.bonus
FROM Employee e
LEFT JOIN Bonus b ON b.empId = e.empId
WHERE b.bonus < 1000 OR b.bonus IS NULL;`,
  sql_explain: `<p><code>NULL &lt; 1000</code> is UNKNOWN, not TRUE, so the IS NULL branch is required. <code>COALESCE(b.bonus, 0) &lt; 1000</code> is an equivalent one-liner.</p>`,
  py: `m = Employee.merge(Bonus, on='empId', how='left')
result = m[(m.bonus < 1000) | m.bonus.isna()][['name', 'bonus']]`,
  py_explain: `<p>NaN comparisons are False in pandas too — add <code>isna()</code>.</p>`
});
LC(584, {
  title: 'Find Customer Referee', difficulty: 'Easy', topics: ['NULL handling', 'WHERE'],
  tables: { Customer: QT('id:INT,name:TEXT,referee_id:INT', [[1, 'Ajay', null], [2, 'Bela', null], [3, 'Chirag', 2], [4, 'Dia', null], [5, 'Eklavya', 1], [6, 'Fatima', 2], [7, 'Gaurav', 4]]) },
  prompt: `<p>Return the <code>name</code> of customers who were <b>not</b> referred by customer 2 (including customers with no referee).</p>`,
  hint: 'referee_id <> 2 silently drops NULLs.',
  sql: `SELECT name
FROM Customer
WHERE referee_id <> 2 OR referee_id IS NULL;`,
  sql_explain: `<p>The most common NULL trap: <code>NULL &lt;&gt; 2</code> is UNKNOWN, so a plain <code>&lt;&gt;</code> loses the unreferred customers. MySQL's NULL-safe operator: <code>WHERE NOT (referee_id &lt;=&gt; 2)</code>.</p>`,
  py: `result = Customer[Customer.referee_id.ne(2) | Customer.referee_id.isna()][['name']]`,
  py_explain: `<p>Note: with pandas' nullable Int64, <code>ne(2)</code> on NA is NA, so OR it with <code>isna()</code>.</p>`
});
LC(586, {
  title: 'Customer Placing the Largest Number of Orders', difficulty: 'Easy', topics: ['Aggregation', 'Top-N per group'],
  tables: { Orders: QT('order_number:INT,customer_number:INT', [[1, 7], [2, 3], [3, 7], [4, 2], [5, 3], [6, 7], [7, 9]]) },
  prompt: `<p>Return the <code>customer_number</code> of the customer with the most orders (exactly one customer has the most).</p>
<p>Follow-up worth knowing: what if several customers tie?</p>`,
  hint: 'GROUP BY, ORDER BY COUNT(*) DESC, LIMIT 1.',
  sql: `SELECT customer_number
FROM Orders
GROUP BY customer_number
ORDER BY COUNT(*) DESC
LIMIT 1;

-- Tie-safe version:
-- SELECT customer_number FROM Orders GROUP BY customer_number
-- HAVING COUNT(*) = (SELECT COUNT(*) FROM Orders GROUP BY customer_number ORDER BY COUNT(*) DESC LIMIT 1);`,
  sql_explain: `<p>LIMIT 1 is fine when one winner is guaranteed. For ties, compare each count with the max count (HAVING) or use <code>RANK() OVER (ORDER BY COUNT(*) DESC) = 1</code>.</p>`,
  py: `result = pd.DataFrame({'customer_number': [Orders.customer_number.value_counts().idxmax()]})`,
  py_explain: `<p><code>value_counts().idxmax()</code>; for ties use <code>c[c == c.max()].index</code>.</p>`
});
LC(595, {
  title: 'Big Countries', difficulty: 'Easy', topics: ['WHERE', 'UNION'],
  tables: { World: QT('name:TEXT,continent:TEXT,area:INT,population:INT,gdp:INT', [['Kestria', 'Asia', 3500000, 12000000, 90000000], ['Lomara', 'Europe', 200000, 31000000, 120000000], ['Nubira', 'Africa', 900000, 8000000, 15000000], ['Ostavia', 'Europe', 3000000, 25000000, 300000000], ['Pelion', 'Oceania', 70000, 2000000, 9000000]]) },
  prompt: `<p>A country is <b>big</b> if its area is at least 3,000,000 km² <i>or</i> its population is at least 25,000,000. Return <code>name</code>, <code>population</code>, <code>area</code> of big countries.</p>`,
  hint: 'OR — and mind ≥ vs >.',
  sql: `SELECT name, population, area
FROM World
WHERE area >= 3000000 OR population >= 25000000;`,
  sql_explain: `<p>Boundaries are inclusive (Ostavia sits exactly on both). A famous "optimisation" rewrites the OR as two queries joined with <code>UNION</code> so each branch can use its own index.</p>`,
  py: `result = World[(World.area >= 3000000) | (World.population >= 25000000)][['name', 'population', 'area']]`,
  py_explain: `<p>Use <code>|</code> with parentheses, not <code>or</code>.</p>`
});
LC(596, {
  title: 'Classes More Than 5 Students', difficulty: 'Easy', topics: ['HAVING', 'COUNT DISTINCT'],
  tables: { Courses: QT('student:TEXT,class:TEXT', [['A', 'Maths'], ['B', 'Maths'], ['C', 'Maths'], ['D', 'Maths'], ['E', 'Maths'], ['A', 'Art'], ['B', 'Art'], ['C', 'Art'], ['D', 'Art'], ['D', 'Art'], ['F', 'Music'], ['F', 'Maths']]) },
  prompt: `<p>Return every <code>class</code> with <b>at least 5 distinct</b> students. The table may contain duplicate rows.</p>`,
  hint: 'COUNT(DISTINCT student) — Art has a duplicate row.',
  sql: `SELECT class
FROM Courses
GROUP BY class
HAVING COUNT(DISTINCT student) >= 5;`,
  sql_explain: `<p>With <code>COUNT(*)</code>, Art (4 students, 5 rows) would wrongly qualify. Always ask whether the table can have duplicates.</p>`,
  py: `c = Courses.groupby('class').student.nunique()
result = pd.DataFrame({'class': c[c >= 5].index})`,
  py_explain: `<p><code>nunique</code> = COUNT(DISTINCT).</p>`
});
LC(597, {
  title: 'Friend Requests I: Overall Acceptance Rate', difficulty: 'Easy', topics: ['COUNT DISTINCT', 'NULL handling', 'Subquery'],
  tables: {
    FriendRequest: QT('sender_id:INT,send_to_id:INT,request_date:DATE', [[1, 2, '2024-06-01'], [1, 3, '2024-06-01'], [1, 4, '2024-06-02'], [2, 3, '2024-06-02'], [3, 4, '2024-06-09'], [1, 2, '2024-06-10']]),
    RequestAccepted: QT('requester_id:INT,accepter_id:INT,accept_date:DATE', [[1, 2, '2024-06-03'], [1, 3, '2024-06-08'], [2, 3, '2024-06-08'], [3, 4, '2024-06-10'], [3, 4, '2024-06-11'], [5, 6, '2024-06-12']])
  },
  prompt: `<p>Overall acceptance rate = number of <b>distinct</b> accepted (requester, accepter) pairs ÷ number of <b>distinct</b> requested (sender, receiver) pairs, rounded to 2 decimals. Return it as <code>accept_rate</code>; return 0.00 if there are no requests. (Accepts don't have to match a request — just count both sides.)</p>`,
  hint: 'Count distinct pairs on each side in subqueries; IFNULL(…, 0) handles divide-by-zero (x/0 is NULL in MySQL).',
  sql: `SELECT ROUND(IFNULL(
  (SELECT COUNT(*) FROM (SELECT DISTINCT requester_id, accepter_id FROM RequestAccepted) a)
  / (SELECT COUNT(*) FROM (SELECT DISTINCT sender_id, send_to_id FROM FriendRequest) r),
0), 2) AS accept_rate;`,
  sql_explain: `<p>Duplicates on both sides (a repeated request and a repeated accept) are the trap. MySQL allows <code>COUNT(DISTINCT requester_id, accepter_id)</code>; counting rows of a DISTINCT subquery is the portable form. Division by zero yields NULL in MySQL, so IFNULL turns it into 0.</p>`,
  py: `a = len(RequestAccepted[['requester_id', 'accepter_id']].drop_duplicates())
r = len(FriendRequest[['sender_id', 'send_to_id']].drop_duplicates())
result = pd.DataFrame({'accept_rate': [round(a / r, 2) if r else 0.0]})`,
  py_explain: `<p>drop_duplicates on the pair columns, then divide.</p>`
});
LC(603, {
  title: 'Consecutive Available Seats', difficulty: 'Easy', topics: ['Self join', 'LAG/LEAD'], ordered: true,
  tables: { Cinema: QT('seat_id:INT,free:INT', [[1, 1], [2, 0], [3, 1], [4, 1], [5, 1], [6, 0], [7, 1], [8, 0], [9, 1], [10, 1]]) },
  prompt: `<p><code>free</code> is 1 for an empty seat. Return the <code>seat_id</code> of every free seat that has a free neighbour (consecutive ids), ordered by seat_id.</p>`,
  hint: 'A free seat qualifies if seat_id − 1 or seat_id + 1 is also free.',
  sql: `SELECT c.seat_id
FROM Cinema c
WHERE c.free = 1
  AND EXISTS (SELECT 1 FROM Cinema n
              WHERE n.free = 1 AND ABS(n.seat_id - c.seat_id) = 1)
ORDER BY c.seat_id;`,
  sql_explain: `<p>Neighbour check via EXISTS (no duplicates, unlike a self join that needs DISTINCT). Window version: keep rows where <code>free = 1 AND (LAG(free) OVER w = 1 OR LEAD(free) OVER w = 1)</code>.</p>`,
  py: `c = Cinema.sort_values('seat_id')
ok = (c.free == 1) & ((c.free.shift(1) == 1) | (c.free.shift(-1) == 1))
result = c[ok][['seat_id']]`,
  py_explain: `<p>shift(±1) for neighbours (ids are consecutive).</p>`
});
