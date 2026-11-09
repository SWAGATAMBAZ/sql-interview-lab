/* LeetCode Database set — part 2 (607 → 1084). Short rewrites + original sample data. */
LC(607, {
  title: 'Sales Person', difficulty: 'Easy', topics: ['Anti join', 'NOT EXISTS', 'Joins'],
  tables: {
    SalesPerson: QT('sales_id:INT,name:TEXT,salary:INT,commission_rate:INT,hire_date:DATE', [[1, 'Ritu', 90000, 6, '2019-03-01'], [2, 'Sameer', 12000, 5, '2020-05-01'], [3, 'Tanvi', 65000, 12, '2018-12-25'], [4, 'Uday', 25000, 25, '2021-01-01'], [5, 'Vani', 10000, 10, '2022-02-03']]),
    Company: QT('com_id:INT,name:TEXT,city:TEXT', [[1, 'RED', 'Boston'], [2, 'ORANGE', 'New York'], [3, 'YELLOW', 'Boston'], [4, 'GREEN', 'Austin']]),
    Orders: QT('order_id:INT,order_date:DATE,com_id:INT,sales_id:INT,amount:INT', [[1, '2024-01-01', 3, 4, 10000], [2, '2024-02-01', 4, 5, 5000], [3, '2024-03-01', 1, 1, 50000], [4, '2024-04-01', 1, 4, 25000], [5, '2024-05-01', 2, 2, 6000]])
  },
  prompt: `<p>Return the <code>name</code> of every salesperson who has <b>no</b> orders with the company named <code>'RED'</code> (salespeople with no orders at all included).</p>`,
  hint: 'Anti-join against the set of sales_ids that sold to RED.',
  sql: `SELECT s.name
FROM SalesPerson s
WHERE NOT EXISTS (
  SELECT 1
  FROM Orders o
  JOIN Company c ON c.com_id = o.com_id
  WHERE c.name = 'RED' AND o.sales_id = s.sales_id
);`,
  sql_explain: `<p>"Not related to X" across two hops = NOT EXISTS with the join inside the subquery. A common wrong answer is <code>JOIN … WHERE c.name &lt;&gt; 'RED'</code>, which keeps anyone who sold to <i>any</i> other company (Uday sold to RED <i>and</i> YELLOW) and drops people with no orders.</p>`,
  py: `red = Company[Company.name == 'RED'].com_id
bad = Orders[Orders.com_id.isin(red)].sales_id
result = SalesPerson[~SalesPerson.sales_id.isin(bad)][['name']]`,
  py_explain: `<p>Build the set of sales_ids that sold to RED, then anti-filter.</p>`
});
LC(608, {
  title: 'Tree Node', difficulty: 'Medium', topics: ['CASE', 'EXISTS', 'Hierarchy'],
  tables: { Tree: QT('id:INT,p_id:INT', [[1, null], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 6]]) },
  prompt: `<p>Label each node: <code>'Root'</code> if it has no parent, <code>'Inner'</code> if it has a parent and at least one child, <code>'Leaf'</code> otherwise. Return <code>id</code>, <code>type</code>.</p>`,
  hint: 'CASE with p_id IS NULL first, then EXISTS (child whose p_id = this id).',
  sql: `SELECT t.id,
       CASE WHEN t.p_id IS NULL THEN 'Root'
            WHEN EXISTS (SELECT 1 FROM Tree c WHERE c.p_id = t.id) THEN 'Inner'
            ELSE 'Leaf' END AS type
FROM Tree t;`,
  sql_explain: `<p>Order of CASE branches matters: a single-node tree's root has no children but is still Root. Avoid <code>id IN (SELECT p_id FROM Tree)</code> inverted as <code>NOT IN</code> — the root's NULL p_id would poison it.</p>`,
  py: `parents = set(Tree.p_id.dropna())
result = Tree[['id']].copy()
result['type'] = np.where(Tree.p_id.isna(), 'Root', np.where(Tree.id.isin(parents), 'Inner', 'Leaf'))`,
  py_explain: `<p>Nested <code>np.where</code>; <code>dropna</code> keeps the NULL out of the parent set.</p>`
});
LC(610, {
  title: 'Triangle Judgement', difficulty: 'Easy', topics: ['CASE'],
  tables: { Triangle: QT('x:INT,y:INT,z:INT', [[13, 15, 30], [10, 20, 15], [5, 5, 10], [7, 24, 25]]) },
  prompt: `<p>For each row decide whether the three lengths can form a triangle (each side strictly less than the sum of the other two). Return <code>x</code>, <code>y</code>, <code>z</code>, <code>triangle</code> ('Yes'/'No').</p>`,
  hint: 'Three inequalities ANDed together.',
  sql: `SELECT x, y, z,
       CASE WHEN x + y > z AND x + z > y AND y + z > x THEN 'Yes' ELSE 'No' END AS triangle
FROM Triangle;`,
  sql_explain: `<p>Strict inequality: 5, 5, 10 is a degenerate "flat" triangle → No.</p>`,
  py: `t = Triangle
result = t.assign(triangle=np.where((t.x + t.y > t.z) & (t.x + t.z > t.y) & (t.y + t.z > t.x), 'Yes', 'No'))`,
  py_explain: `<p>Vectorised condition with <code>np.where</code>.</p>`
});
LC(612, {
  title: 'Shortest Distance in a Plane', difficulty: 'Medium', topics: ['Self join', 'Math'],
  tables: { Point2D: QT('x:INT,y:INT', [[-1, -1], [0, 0], [-1, -2], [4, 3], [2, 5]]) },
  prompt: `<p>Find the shortest Euclidean distance between any two distinct points, rounded to 2 decimals, as <code>shortest</code>.</p>`,
  hint: 'Self join every pair once and take MIN(SQRT(dx² + dy²)).',
  sql: `SELECT ROUND(MIN(SQRT(POWER(a.x - b.x, 2) + POWER(a.y - b.y, 2))), 2) AS shortest
FROM Point2D a
JOIN Point2D b ON (a.x, a.y) < (b.x, b.y);`,
  sql_explain: `<p>Comparing the row-value <code>(a.x, a.y) &lt; (b.x, b.y)</code> visits each unordered pair once and skips self-pairs. Optimisation talk: take the SQRT only once, after MIN of the squared distance — SQRT is monotonic.</p>`,
  py: `p = Point2D.merge(Point2D, how='cross', suffixes=('_a', '_b'))
p = p[(p.x_a != p.x_b) | (p.y_a != p.y_b)]
result = pd.DataFrame({'shortest': [round(np.sqrt(((p.x_a - p.x_b) ** 2 + (p.y_a - p.y_b) ** 2).min()), 2)]})`,
  py_explain: `<p><code>merge(how='cross')</code> = CROSS JOIN; drop self-pairs; min squared distance; sqrt once.</p>`
});
LC(613, {
  title: 'Shortest Distance in a Line', difficulty: 'Easy', topics: ['LAG/LEAD', 'Self join'],
  tables: { Point: QT('x:INT', [[-3], [9], [2], [15], [5]]) },
  prompt: `<p>Points lie on the x-axis (all distinct). Return the shortest distance between two points as <code>shortest</code>.</p>`,
  hint: 'After sorting, the closest pair is always adjacent → LAG.',
  sql: `SELECT MIN(x - prev_x) AS shortest
FROM (SELECT x, LAG(x) OVER (ORDER BY x) AS prev_x FROM Point) t;`,
  sql_explain: `<p>Sorting makes it O(n log n) instead of the O(n²) self join (<code>MIN(ABS(a.x - b.x)) … ON a.x &lt;&gt; b.x</code>). MIN ignores the first row's NULL.</p>`,
  py: `result = pd.DataFrame({'shortest': [Point.x.sort_values().diff().min()]}).astype(int)`,
  py_explain: `<p>Sort, <code>diff()</code>, min.</p>`
});
LC(619, {
  title: 'Biggest Single Number', difficulty: 'Easy', topics: ['HAVING', 'NULL handling'],
  tables: { MyNumbers: QT('num:INT', [[8], [8], [3], [3], [1], [4], [5], [6], [6]]) },
  prompt: `<p>A <b>single number</b> appears exactly once. Return the largest single number as <code>num</code>, or NULL if there is none.</p>`,
  hint: 'Group, HAVING COUNT = 1, then MAX — the outer MAX returns NULL on empty input.',
  sql: `SELECT MAX(num) AS num
FROM (SELECT num FROM MyNumbers GROUP BY num HAVING COUNT(*) = 1) t;`,
  sql_explain: `<p><code>ORDER BY num DESC LIMIT 1</code> on the subquery would return <i>no row</i> when there are no singles; aggregating with MAX returns NULL — exactly what's required.</p>`,
  py: `c = MyNumbers.num.value_counts()
s = c[c == 1]
result = pd.DataFrame({'num': [s.index.max() if len(s) else None]})`,
  py_explain: `<p>value_counts, keep count 1, max.</p>`
});
LC(620, {
  title: 'Not Boring Movies', difficulty: 'Easy', topics: ['WHERE', 'MOD'], ordered: true,
  tables: { Cinema: QT('id:INT,movie:TEXT,description:TEXT,rating:REAL', [[1, 'Monsoon', 'great 3D', 8.9], [2, 'Ripple', 'fiction', 8.5], [3, 'Lantern', 'boring', 6.2], [4, 'Summit', 'boring', 8.6], [5, 'Echoes', 'Fantasy', 9.1], [7, 'Drift', 'thriller', 7.4]]) },
  prompt: `<p>Return movies with an <b>odd</b> id and a description that is not <code>'boring'</code>, ordered by <code>rating</code> descending. Return all columns.</p>`,
  hint: 'id % 2 = 1 (or MOD(id, 2) = 1).',
  sql: `SELECT *
FROM Cinema
WHERE id % 2 = 1 AND description <> 'boring'
ORDER BY rating DESC;`,
  sql_explain: `<p>Straight filtering. <code>MOD(id, 2) = 1</code> and <code>id &amp; 1</code> are equivalent in MySQL.</p>`,
  py: `result = Cinema[(Cinema.id % 2 == 1) & (Cinema.description != 'boring')].sort_values('rating', ascending=False)`,
  py_explain: `<p>Boolean mask + sort.</p>`
});
LC(626, {
  title: 'Exchange Seats', difficulty: 'Medium', topics: ['CASE', 'LAG/LEAD'], ordered: true,
  tables: { Seat: QT('id:INT,student:TEXT', [[1, 'Anya'], [2, 'Bhavin'], [3, 'Charu'], [4, 'Dhruv'], [5, 'Elina']]) },
  prompt: `<p>Swap every two consecutive students' seats (1↔2, 3↔4 …). If the count is odd, the last student stays. Return <code>id</code>, <code>student</code> ordered by id.</p>`,
  hint: 'Odd id → LEAD(student), even id → LAG(student); COALESCE for the last odd seat.',
  sql: `SELECT id,
       CASE WHEN id % 2 = 1 THEN COALESCE(LEAD(student) OVER (ORDER BY id), student)
            ELSE LAG(student) OVER (ORDER BY id) END AS student
FROM Seat
ORDER BY id;`,
  sql_explain: `<p>Classic alternative: remap the id (<code>CASE WHEN id % 2 = 0 THEN id - 1 WHEN id = (SELECT MAX(id) FROM Seat) THEN id ELSE id + 1 END</code>) and re-sort.</p>`,
  py: `s = Seat.sort_values('id').reset_index(drop=True)
s['student'] = np.where(s.id % 2 == 1, s.student.shift(-1).fillna(s.student), s.student.shift(1))
result = s`,
  py_explain: `<p>shift(-1)/shift(1) = LEAD/LAG.</p>`
});
LC(627, {
  title: 'Swap Salary', difficulty: 'Easy', topics: ['UPDATE', 'CASE'], ordered: true,
  after: 'SELECT * FROM Salary ORDER BY id',
  tables: { Salary: QT('id:INT,name:TEXT,sex:TEXT,salary:INT', [[1, 'Aman', 'm', 2500], [2, 'Bina', 'f', 1500], [3, 'Chris', 'm', 5500], [4, 'Divya', 'f', 500]]) },
  prompt: `<p>Write a single <b>UPDATE</b> (no SELECT, no temp table) that swaps every <code>'m'</code> to <code>'f'</code> and vice versa. The checker then compares <code>SELECT * FROM Salary ORDER BY id</code>. (pandas: modify <code>Salary</code> and set <code>result = Salary</code>.)</p>`,
  hint: 'One UPDATE with a CASE expression.',
  sql: `UPDATE Salary
SET sex = CASE sex WHEN 'm' THEN 'f' ELSE 'm' END;`,
  sql_explain: `<p>All rows are evaluated against their <i>old</i> value in one statement, so a CASE swap is safe. Two separate UPDATEs (m→f then f→m) would turn everyone into 'm'. MySQL alternative: <code>SET sex = IF(sex = 'm', 'f', 'm')</code>.</p>`,
  py: `Salary['sex'] = Salary.sex.map({'m': 'f', 'f': 'm'})
result = Salary.sort_values('id')`,
  py_explain: `<p><code>map</code> with a dict swaps values in one vectorised pass.</p>`
});
LC(1045, {
  title: 'Customers Who Bought All Products', difficulty: 'Medium', topics: ['Relational division', 'HAVING', 'COUNT DISTINCT'],
  tables: {
    Customer: QT('customer_id:INT,product_key:INT', [[1, 5], [2, 6], [3, 5], [3, 6], [1, 6], [4, 5], [4, 6], [4, 7], [3, 6]]),
    Product: QT('product_key:INT', [[5], [6]])
  },
  prompt: `<p>Return the <code>customer_id</code> of every customer who bought <b>every</b> product in <code>Product</code>. Customer rows may repeat; a customer may also buy products not in the list.</p>`,
  hint: 'Count distinct catalogue products per customer and compare with the catalogue size.',
  sql: `SELECT c.customer_id
FROM Customer c
JOIN Product p ON p.product_key = c.product_key
GROUP BY c.customer_id
HAVING COUNT(DISTINCT c.product_key) = (SELECT COUNT(*) FROM Product);`,
  sql_explain: `<p><b>Relational division</b>. Joining to Product first ignores off-catalogue purchases (customer 4's product 7) so they can't inflate the count, and DISTINCT absorbs repeated rows (customer 3).</p>`,
  py: `c = Customer[Customer.product_key.isin(Product.product_key)].groupby('customer_id').product_key.nunique()
result = pd.DataFrame({'customer_id': c[c == Product.product_key.nunique()].index})`,
  py_explain: `<p>Filter to the catalogue, nunique per customer, compare to catalogue size.</p>`
});
LC(1050, {
  title: 'Actors and Directors Who Cooperated At Least Three Times', difficulty: 'Easy', topics: ['HAVING'],
  tables: { ActorDirector: QT('actor_id:INT,director_id:INT,timestamp:INT', [[1, 1, 0], [1, 1, 1], [1, 1, 2], [1, 2, 3], [1, 2, 4], [2, 1, 5], [2, 1, 6], [2, 1, 7], [3, 3, 8]]) },
  prompt: `<p>Return <code>actor_id</code>, <code>director_id</code> pairs that worked together at least three times.</p>`,
  hint: 'GROUP BY both columns.',
  sql: `SELECT actor_id, director_id
FROM ActorDirector
GROUP BY actor_id, director_id
HAVING COUNT(*) >= 3;`,
  sql_explain: `<p>Grouping by a pair of columns treats the pair as the key.</p>`,
  py: `c = ActorDirector.groupby(['actor_id', 'director_id']).size().reset_index(name='n')
result = c[c.n >= 3][['actor_id', 'director_id']]`,
  py_explain: `<p><code>size()</code> counts rows per pair.</p>`
});
LC(1068, {
  title: 'Product Sales Analysis I', difficulty: 'Easy', topics: ['Joins'],
  tables: {
    Sales: QT('sale_id:INT,product_id:INT,year:INT,quantity:INT,price:INT', [[1, 100, 2008, 10, 5000], [2, 100, 2009, 12, 5000], [7, 200, 2011, 15, 9000], [8, 300, 2010, 4, 1200], [9, 300, 2010, 6, 1100]]),
    Product: QT('product_id:INT,product_name:TEXT', [[100, 'Nokia'], [200, 'Apple'], [300, 'Samsung'], [400, 'Oppo']])
  },
  prompt: `<p>For each sale, return <code>product_name</code>, <code>year</code>, <code>price</code>.</p>`,
  hint: 'Inner join Sales to Product.',
  sql: `SELECT p.product_name, s.year, s.price
FROM Sales s
JOIN Product p ON p.product_id = s.product_id;`,
  sql_explain: `<p>One row per sale → Sales drives the join.</p>`,
  py: `result = Sales.merge(Product, on='product_id')[['product_name', 'year', 'price']]`,
  py_explain: `<p>Inner merge.</p>`
});
LC(1069, {
  title: 'Product Sales Analysis II', difficulty: 'Easy', topics: ['Aggregation'],
  tables: {
    Sales: QT('sale_id:INT,product_id:INT,year:INT,quantity:INT,price:INT', [[1, 100, 2008, 10, 5000], [2, 100, 2009, 12, 5000], [7, 200, 2011, 15, 9000], [8, 300, 2010, 4, 1200], [9, 300, 2010, 6, 1100]]),
    Product: QT('product_id:INT,product_name:TEXT', [[100, 'Nokia'], [200, 'Apple'], [300, 'Samsung']])
  },
  prompt: `<p>Return the total quantity sold per product: <code>product_id</code>, <code>total_quantity</code>.</p>`,
  hint: 'No join needed.',
  sql: `SELECT product_id, SUM(quantity) AS total_quantity
FROM Sales
GROUP BY product_id;`,
  sql_explain: `<p>Don't join tables you don't need — the Product table adds nothing here.</p>`,
  py: `result = Sales.groupby('product_id', as_index=False).quantity.sum().rename(columns={'quantity': 'total_quantity'})`,
  py_explain: `<p>groupby + sum.</p>`
});
LC(1070, {
  title: 'Product Sales Analysis III', difficulty: 'Medium', topics: ['Window ranking', 'First touch'],
  tables: {
    Sales: QT('sale_id:INT,product_id:INT,year:INT,quantity:INT,price:INT', [[1, 100, 2008, 10, 5000], [2, 100, 2009, 12, 5000], [7, 200, 2011, 15, 9000], [8, 300, 2010, 4, 1200], [9, 300, 2010, 6, 1100], [10, 300, 2012, 2, 1000]]),
    Product: QT('product_id:INT,product_name:TEXT', [[100, 'Nokia'], [200, 'Apple'], [300, 'Samsung']])
  },
  prompt: `<p>For every product, return <b>all</b> its sales from the first year it was sold: <code>product_id</code>, <code>first_year</code>, <code>quantity</code>, <code>price</code>.</p>`,
  hint: 'A product can have several sales in its first year → RANK/DENSE_RANK, or join with MIN(year) per product.',
  sql: `SELECT product_id, year AS first_year, quantity, price
FROM (
  SELECT s.*, RANK() OVER (PARTITION BY product_id ORDER BY year) AS rk
  FROM Sales s
) t
WHERE rk = 1;`,
  sql_explain: `<p>ROW_NUMBER would keep only one of product 300's two first-year sales — RANK keeps all ties. Join form: <code>WHERE (product_id, year) IN (SELECT product_id, MIN(year) FROM Sales GROUP BY product_id)</code>.</p>`,
  py: `s = Sales.assign(first_year=Sales.groupby('product_id').year.transform('min'))
result = s[s.year == s.first_year][['product_id', 'first_year', 'quantity', 'price']]`,
  py_explain: `<p><code>transform('min')</code> broadcasts the first year; keep matching rows.</p>`
});
LC(1075, {
  title: 'Project Employees I', difficulty: 'Easy', topics: ['Joins', 'Aggregation'],
  tables: {
    Project: QT('project_id:INT,employee_id:INT', [[1, 1], [1, 2], [1, 3], [2, 1], [2, 4]]),
    Employee: QT('employee_id:INT,name:TEXT,experience_years:INT', [[1, 'Kavya', 3], [2, 'Laksh', 2], [3, 'Mira', 1], [4, 'Naveen', 2]])
  },
  prompt: `<p>Return each project's average employee experience, rounded to 2 decimals: <code>project_id</code>, <code>average_years</code>.</p>`,
  hint: 'Join, group by project, ROUND(AVG(...), 2).',
  sql: `SELECT p.project_id, ROUND(AVG(e.experience_years), 2) AS average_years
FROM Project p
JOIN Employee e ON e.employee_id = p.employee_id
GROUP BY p.project_id;`,
  sql_explain: `<p>AVG of integers is decimal in MySQL (2/1 → 2.0000), so no casting is needed — unlike SQL Server/Postgres where int ÷ int truncates.</p>`,
  py: `m = Project.merge(Employee, on='employee_id')
result = m.groupby('project_id', as_index=False).experience_years.mean().rename(columns={'experience_years': 'average_years'}).round(2)`,
  py_explain: `<p>merge → groupby mean → round.</p>`
});
LC(1076, {
  title: 'Project Employees II', difficulty: 'Easy', topics: ['Aggregation', 'Window ranking'],
  tables: {
    Project: QT('project_id:INT,employee_id:INT', [[1, 1], [1, 2], [1, 3], [2, 1], [2, 4], [3, 2], [3, 3], [3, 4]]),
    Employee: QT('employee_id:INT,name:TEXT,experience_years:INT', [[1, 'Kavya', 3], [2, 'Laksh', 2], [3, 'Mira', 1], [4, 'Naveen', 2]])
  },
  prompt: `<p>Return the <code>project_id</code>(s) with the most employees (all of them if tied).</p>`,
  hint: 'Count per project, keep counts equal to the max (or RANK = 1).',
  sql: `SELECT project_id
FROM (
  SELECT project_id, RANK() OVER (ORDER BY COUNT(*) DESC) AS rk
  FROM Project
  GROUP BY project_id
) t
WHERE rk = 1;`,
  sql_explain: `<p>Window over an aggregate, evaluated after GROUP BY. Projects 1 and 3 tie — <code>LIMIT 1</code> would be wrong.</p>`,
  py: `c = Project.project_id.value_counts()
result = pd.DataFrame({'project_id': c[c == c.max()].index})`,
  py_explain: `<p>All indices equal to the max count.</p>`
});
LC(1077, {
  title: 'Project Employees III', difficulty: 'Medium', topics: ['Window ranking', 'Top-N per group'],
  tables: {
    Project: QT('project_id:INT,employee_id:INT', [[1, 1], [1, 2], [1, 3], [2, 1], [2, 4]]),
    Employee: QT('employee_id:INT,name:TEXT,experience_years:INT', [[1, 'Kavya', 3], [2, 'Laksh', 2], [3, 'Mira', 3], [4, 'Naveen', 2]])
  },
  prompt: `<p>For each project, return the most experienced employee(s) — all of them on ties: <code>project_id</code>, <code>employee_id</code>.</p>`,
  hint: 'RANK() OVER (PARTITION BY project ORDER BY experience DESC) = 1.',
  sql: `SELECT project_id, employee_id
FROM (
  SELECT p.project_id, p.employee_id,
         RANK() OVER (PARTITION BY p.project_id ORDER BY e.experience_years DESC) AS rk
  FROM Project p
  JOIN Employee e ON e.employee_id = p.employee_id
) t
WHERE rk = 1;`,
  sql_explain: `<p>Top-1 per group with ties → RANK (or DENSE_RANK), never ROW_NUMBER.</p>`,
  py: `m = Project.merge(Employee, on='employee_id')
m = m[m.experience_years == m.groupby('project_id').experience_years.transform('max')]
result = m[['project_id', 'employee_id']]`,
  py_explain: `<p>Keep rows equal to the group max (ties included).</p>`
});
LC(1082, {
  title: 'Sales Analysis I', difficulty: 'Easy', topics: ['Aggregation', 'Window ranking'],
  tables: {
    Product: QT('product_id:INT,product_name:TEXT,unit_price:INT', [[1, 'S8', 1000], [2, 'G4', 800], [3, 'iPhone', 1400]]),
    Sales: QT('seller_id:INT,product_id:INT,buyer_id:INT,sale_date:DATE,quantity:INT,price:INT', [[1, 1, 1, '2019-01-21', 2, 2000], [1, 2, 2, '2019-02-17', 1, 800], [2, 2, 3, '2019-06-02', 1, 800], [3, 3, 4, '2019-05-13', 2, 2800], [2, 1, 5, '2019-07-01', 2, 1500]])
  },
  prompt: `<p>Return the <code>seller_id</code>(s) with the highest total sales price (sum of <code>price</code>), all on ties.</p>`,
  hint: 'SUM per seller, then RANK = 1 or HAVING SUM = (max of sums).',
  sql: `SELECT seller_id
FROM (
  SELECT seller_id, RANK() OVER (ORDER BY SUM(price) DESC) AS rk
  FROM Sales
  GROUP BY seller_id
) t
WHERE rk = 1;`,
  sql_explain: `<p>Sellers 1 and 3 both total 2800 (seller 2 has 2300) — a tie, which is exactly why "top with ties" must not use LIMIT 1.</p>`,
  py: `t = Sales.groupby('seller_id').price.sum()
result = pd.DataFrame({'seller_id': t[t == t.max()].index})`,
  py_explain: `<p>Sum, keep the max(es).</p>`
});
LC(1083, {
  title: 'Sales Analysis II', difficulty: 'Easy', topics: ['Conditional aggregation', 'HAVING'],
  tables: {
    Product: QT('product_id:INT,product_name:TEXT,unit_price:INT', [[1, 'S8', 1000], [2, 'G4', 800], [3, 'iPhone', 1400]]),
    Sales: QT('seller_id:INT,product_id:INT,buyer_id:INT,sale_date:DATE,quantity:INT,price:INT', [[1, 1, 1, '2019-01-21', 2, 2000], [1, 2, 2, '2019-02-17', 1, 800], [2, 1, 3, '2019-06-02', 1, 800], [3, 3, 3, '2019-05-13', 2, 2800], [2, 1, 5, '2019-07-01', 1, 1000], [3, 2, 5, '2019-07-09', 1, 800]])
  },
  prompt: `<p>Return the <code>buyer_id</code> of buyers who bought <code>'S8'</code> but never bought <code>'iPhone'</code>.</p>`,
  hint: 'Per buyer: SUM(name = S8) > 0 AND SUM(name = iPhone) = 0.',
  sql: `SELECT s.buyer_id
FROM Sales s
JOIN Product p ON p.product_id = s.product_id
GROUP BY s.buyer_id
HAVING SUM(CASE WHEN p.product_name = 'S8' THEN 1 ELSE 0 END) > 0
   AND SUM(CASE WHEN p.product_name = 'iPhone' THEN 1 ELSE 0 END) = 0;`,
  sql_explain: `<p>"Did A but never B" in one pass via conditional sums in HAVING — no subqueries. Buyer 3 bought both and is excluded.</p>`,
  py: `m = Sales.merge(Product, on='product_id')
g = m.groupby('buyer_id').product_name.agg(lambda s: ('S8' in set(s)) and ('iPhone' not in set(s)))
result = pd.DataFrame({'buyer_id': g[g].index})`,
  py_explain: `<p>Set membership per buyer.</p>`
});
LC(1084, {
  title: 'Sales Analysis III', difficulty: 'Easy', topics: ['HAVING', 'Date functions'],
  tables: {
    Product: QT('product_id:INT,product_name:TEXT,unit_price:INT', [[1, 'S8', 1000], [2, 'G4', 800], [3, 'iPhone', 1400], [4, 'Pixel', 900]]),
    Sales: QT('seller_id:INT,product_id:INT,buyer_id:INT,sale_date:DATE,quantity:INT,price:INT', [[1, 1, 1, '2019-01-21', 2, 2000], [1, 2, 2, '2019-02-17', 1, 800], [2, 2, 3, '2019-06-02', 1, 800], [3, 3, 4, '2019-05-13', 2, 2800], [2, 4, 5, '2019-03-31', 1, 900]])
  },
  prompt: `<p>Return products that were sold <b>only</b> in the first quarter of 2019 (2019-01-01 to 2019-03-31 inclusive): <code>product_id</code>, <code>product_name</code>. Products never sold are excluded.</p>`,
  hint: 'Per product: MIN(sale_date) ≥ Jan 1 and MAX(sale_date) ≤ Mar 31.',
  sql: `SELECT p.product_id, p.product_name
FROM Sales s
JOIN Product p ON p.product_id = s.product_id
GROUP BY p.product_id, p.product_name
HAVING MIN(s.sale_date) >= '2019-01-01' AND MAX(s.sale_date) <= '2019-03-31';`,
  sql_explain: `<p>"All rows satisfy X" ⇔ the extremes satisfy it. A WHERE filter on dates would wrongly keep G4, which also sold in June.</p>`,
  py: `g = Sales.groupby('product_id').sale_date.agg(['min', 'max'])
ok = g[(g['min'] >= '2019-01-01') & (g['max'] <= '2019-03-31')].index
result = Product[Product.product_id.isin(ok)][['product_id', 'product_name']]`,
  py_explain: `<p>Min/max per product, then filter.</p>`
});
