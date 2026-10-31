/* Section 3 — Gaps & islands, consecutive patterns */
window.QUESTIONS.push(
{
  id: 24, title: 'Numbers that appear 3+ times consecutively', difficulty: 'Medium', tier: 1,
  tables: { readings: QT('id:INT,num:INT', [[1, 4], [2, 4], [3, 4], [4, 7], [5, 4], [6, 9], [7, 9], [8, 9], [9, 9], [10, 2], [11, 7], [12, 7], [13, 2], [14, 2], [15, 2]]) },
  topics: ['LAG/LEAD', 'Gaps & islands', 'Self join'], companies: ['Amazon', 'Adobe', 'Flipkart'], ordered: true,
  prompt: `<p><code>readings</code> is ordered by <code>id</code> (ids are consecutive). Find every number that appears at least <b>three times in a row</b>.</p>
<p>Return distinct <code>num</code> sorted ascending.</p>`,
  hint: 'Compare each row with the previous two using LAG(num,1) and LAG(num,2). Or a 3-way self join on id, id+1, id+2.',
  sql: `SELECT DISTINCT num
FROM (
  SELECT num,
         LAG(num, 1) OVER (ORDER BY id) AS p1,
         LAG(num, 2) OVER (ORDER BY id) AS p2
  FROM readings
) t
WHERE num = p1 AND num = p2
ORDER BY num;`,
  sql_explain: `<p>LAG with an offset looks back <i>n</i> rows. A row qualifies when it equals the two before it. DISTINCT because a run of 4 produces two qualifying rows.</p>
<p>Self-join version: <code>FROM readings a JOIN readings b ON b.id = a.id+1 JOIN readings c ON c.id = a.id+2 WHERE a.num=b.num AND b.num=c.num</code> — only correct when ids have no gaps, which is why the window version is preferred.</p>
<p>Generalising to "N in a row" → use the islands technique (Q25).</p>`,
  py: `r = readings.sort_values('id')
m = (r.num == r.num.shift(1)) & (r.num == r.num.shift(2))
result = pd.DataFrame({'num': sorted(r[m].num.unique())})`,
  py_explain: `<p><code>shift(1)</code>/<code>shift(2)</code> are LAG 1/2. Boolean mask, then unique.</p>`
},
{
  id: 25, title: 'Longest daily activity streak per user', difficulty: 'Hard', tier: 2, dataset: 'events',
  topics: ['Gaps & islands', 'Window ranking', 'Date functions'], companies: ['Meta', 'LinkedIn', 'Duolingo', 'Swiggy', 'Amazon'], ordered: true,
  prompt: `<p>An active day = a date on which the user logged at least one event. A streak = consecutive calendar days that are all active.</p>
<p>For every user find their <b>longest</b> streak (if tied, the earliest). Return the top 10 users: <code>user_id</code>, <code>longest_streak</code>, <code>streak_start</code>, <code>streak_end</code>. Sort by <code>longest_streak</code> desc, then <code>user_id</code>.</p>`,
  hint: 'Islands trick: activity_date − ROW_NUMBER() days is constant within a run of consecutive dates. Group by (user, that anchor).',
  sql: `WITH days AS (
  SELECT DISTINCT user_id, DATE(event_time) AS d FROM events
), grp AS (
  SELECT user_id, d,
         DATE_SUB(d, INTERVAL ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) DAY) AS anchor
  FROM days
), streaks AS (
  SELECT user_id, MIN(d) AS streak_start, MAX(d) AS streak_end, COUNT(*) AS len
  FROM grp
  GROUP BY user_id, anchor
), best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY len DESC, streak_start) AS rn
  FROM streaks
)
SELECT user_id, len AS longest_streak, streak_start, streak_end
FROM best
WHERE rn = 1
ORDER BY longest_streak DESC, user_id
LIMIT 10;`,
  sql_explain: `<p><b>The gaps-and-islands trick:</b> number each user's active dates 1,2,3… If dates are consecutive, <code>date − rn</code> is the same value (the "anchor"); a gap changes the anchor. Example: Oct 3,4,5,8,9 with rn 1..5 → anchors Oct 2,2,2,3,3 → two islands.</p>
<ol><li>DISTINCT dates first (multiple events per day would break the numbering).</li><li>anchor = date − rn days.</li><li>GROUP BY anchor → island length/start/end.</li><li>ROW_NUMBER to keep each user's best island.</li></ol>`,
  py: `d = events.assign(d=events.event_time.dt.normalize())[['user_id', 'd']].drop_duplicates().sort_values(['user_id', 'd'])
d['rn'] = d.groupby('user_id').cumcount() + 1
d['anchor'] = d.d - pd.to_timedelta(d.rn, unit='D')
s = d.groupby(['user_id', 'anchor']).agg(streak_start=('d', 'min'), streak_end=('d', 'max'), longest_streak=('d', 'size')).reset_index()
s = s.sort_values(['user_id', 'longest_streak', 'streak_start'], ascending=[True, False, True]).drop_duplicates('user_id')
result = (s.sort_values(['longest_streak', 'user_id'], ascending=[False, True]).head(10)
          [['user_id', 'longest_streak', 'streak_start', 'streak_end']].reset_index(drop=True))`,
  py_explain: `<p>Same anchor trick with <code>cumcount()</code> and <code>to_timedelta</code>. An alternative pandas idiom: <code>(d.diff() != 1 day).cumsum()</code> as a run id.</p>`
},
{
  id: 26, title: 'Stadium: 3+ consecutive busy days', difficulty: 'Hard', tier: 2,
  tables: { stadium: QT('visit_id:INT,visit_date:DATE,people:INT', [[1, '2024-01-01', 40], [2, '2024-01-02', 120], [3, '2024-01-03', 160], [4, '2024-01-04', 95], [5, '2024-01-05', 140], [6, '2024-01-06', 1550], [7, '2024-01-07', 199], [8, '2024-01-09', 188], [9, '2024-01-10', 20], [10, '2024-01-11', 130], [11, '2024-01-12', 210]]) },
  topics: ['Gaps & islands', 'Window aggregate'], companies: ['Amazon', 'Uber', 'Adobe'], ordered: true,
  prompt: `<p>Return every row that belongs to a run of <b>3 or more consecutive <code>visit_id</code>s</b> where <code>people ≥ 100</code> (ids are consecutive; dates may have gaps — consecutiveness is by id).</p>
<p>Return <code>visit_id</code>, <code>visit_date</code>, <code>people</code> sorted by <code>visit_date</code>.</p>`,
  hint: 'Filter busy rows, island id = visit_id − ROW_NUMBER(), then keep islands whose COUNT(*) OVER (PARTITION BY island) ≥ 3.',
  sql: `WITH busy AS (
  SELECT visit_id, visit_date, people,
         visit_id - ROW_NUMBER() OVER (ORDER BY visit_id) AS grp
  FROM stadium
  WHERE people >= 100
), sized AS (
  SELECT *, COUNT(*) OVER (PARTITION BY grp) AS run_len
  FROM busy
)
SELECT visit_id, visit_date, people
FROM sized
WHERE run_len >= 3
ORDER BY visit_date;`,
  sql_explain: `<p>After filtering to busy rows, consecutive ids share the same <code>visit_id − rn</code>. A window <code>COUNT(*) OVER (PARTITION BY grp)</code> tags every row with its island size without collapsing rows — so we can return the original rows directly.</p>`,
  py: `b = stadium[stadium.people >= 100].sort_values('visit_id').copy()
b['grp'] = b.visit_id - np.arange(1, len(b) + 1)
b['run_len'] = b.groupby('grp').visit_id.transform('count')
result = b[b.run_len >= 3][['visit_id', 'visit_date', 'people']].sort_values('visit_date').reset_index(drop=True)`,
  py_explain: `<p><code>np.arange</code> gives the row number; <code>transform('count')</code> gives island size per row.</p>`
},
{
  id: 27, title: 'Loans with 3+ consecutive bounced EMIs', difficulty: 'Hard', tier: 3, dataset: 'lending',
  topics: ['Gaps & islands', 'Conditional aggregation', 'Business case'], companies: ['Navi', 'Bajaj Finserv', 'KreditBee', 'Slice', 'Paytm'], ordered: true,
  prompt: `<p>An EMI <b>bounced</b> if the total paid against it <b>within a 3-day grace period</b> (paid_date ≤ due_date + 3 days) is less than <code>emi_amount</code> (late payments and partial payments both count as bounced).</p>
<p>Find loans having a run of <b>3 or more consecutive bounced EMIs</b> (by <code>emi_no</code>). Return <code>loan_id</code>, <code>borrower_id</code>, <code>longest_bounce_run</code>, <code>run_start_emi</code> (first emi_no of that longest run; earliest if tied). Sort by <code>longest_bounce_run</code> desc, then <code>loan_id</code>.</p>`,
  hint: 'Step 1: per EMI, SUM(CASE WHEN paid_date <= due_date + 3 days THEN amount_paid END) via LEFT JOIN. Step 2: keep bounced EMIs, island id = emi_no − ROW_NUMBER().',
  sql: `WITH emi_status AS (
  SELECT s.loan_id, s.emi_no,
         CASE WHEN COALESCE(SUM(CASE WHEN r.paid_date <= DATE_ADD(s.due_date, INTERVAL 3 DAY)
                                    THEN r.amount_paid END), 0) < s.emi_amount
              THEN 1 ELSE 0 END AS bounced
  FROM emi_schedule s
  LEFT JOIN repayments r ON r.loan_id = s.loan_id AND r.emi_no = s.emi_no
  GROUP BY s.loan_id, s.emi_no, s.due_date, s.emi_amount
), islands AS (
  SELECT loan_id, emi_no,
         emi_no - ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY emi_no) AS grp
  FROM emi_status
  WHERE bounced = 1
), runs AS (
  SELECT loan_id, MIN(emi_no) AS run_start_emi, COUNT(*) AS run_len,
         ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY COUNT(*) DESC, MIN(emi_no)) AS rn
  FROM islands
  GROUP BY loan_id, grp
)
SELECT r.loan_id, l.borrower_id, r.run_len AS longest_bounce_run, r.run_start_emi
FROM runs r
JOIN loans l ON l.loan_id = r.loan_id
WHERE r.rn = 1 AND r.run_len >= 3
ORDER BY longest_bounce_run DESC, r.loan_id;`,
  sql_explain: `<ol><li><b>Ledger → status:</b> LEFT JOIN so EMIs with no payment at all still appear (they're bounced). The <code>CASE</code> inside <code>SUM</code> counts only money received within the grace period; partial payments stay below emi_amount.</li>
<li><b>Islands</b> on <code>emi_no</code> (already consecutive integers) among bounced EMIs.</li>
<li>Aggregate islands and rank them per loan; window over an aggregate (<code>ORDER BY COUNT(*)</code>) is legal because windows run after GROUP BY.</li></ol>
<p>This is how collections teams build "3 consecutive bounce" lists for field agents.</p>`,
  py: `on_time = repayments.merge(emi_schedule[['loan_id', 'emi_no', 'due_date']], on=['loan_id', 'emi_no'])
on_time = on_time[on_time.paid_date <= on_time.due_date + pd.Timedelta(days=3)].groupby(['loan_id', 'emi_no'], as_index=False).amount_paid.sum()
s = emi_schedule.merge(on_time, on=['loan_id', 'emi_no'], how='left').fillna({'amount_paid': 0})
b = s[s.amount_paid < s.emi_amount].sort_values(['loan_id', 'emi_no']).copy()
b['grp'] = b.emi_no - (b.groupby('loan_id').cumcount() + 1)
runs = b.groupby(['loan_id', 'grp']).agg(run_start_emi=('emi_no', 'min'), longest_bounce_run=('emi_no', 'size')).reset_index()
runs = runs.sort_values(['loan_id', 'longest_bounce_run', 'run_start_emi'], ascending=[True, False, True]).drop_duplicates('loan_id')
runs = runs[runs.longest_bounce_run >= 3].merge(loans[['loan_id', 'borrower_id']], on='loan_id')
result = (runs.sort_values(['longest_bounce_run', 'loan_id'], ascending=[False, True])
          [['loan_id', 'borrower_id', 'longest_bounce_run', 'run_start_emi']].reset_index(drop=True))`,
  py_explain: `<p>Filter the ledger to on-time payments <i>before</i> summing, left-merge onto the schedule (so unpaid EMIs get 0), then the same islands trick.</p>`
},
{
  id: 28, title: 'Collapse a server log into UP/DOWN periods', difficulty: 'Hard', tier: 2,
  tables: { server_log: QT('log_time:DATETIME,status:TEXT', [
    ['2024-05-01 00:00:00', 'UP'], ['2024-05-01 01:00:00', 'UP'], ['2024-05-01 02:00:00', 'DOWN'], ['2024-05-01 03:00:00', 'DOWN'], ['2024-05-01 04:00:00', 'DOWN'],
    ['2024-05-01 05:00:00', 'UP'], ['2024-05-01 06:00:00', 'UP'], ['2024-05-01 07:00:00', 'UP'], ['2024-05-01 08:00:00', 'DOWN'], ['2024-05-01 09:00:00', 'UP'],
    ['2024-05-01 10:00:00', 'UP'], ['2024-05-01 11:00:00', 'DOWN'], ['2024-05-01 12:00:00', 'DOWN'], ['2024-05-01 13:00:00', 'UP']]) },
  topics: ['Gaps & islands', 'Window ranking'], companies: ['Microsoft', 'Razorpay', 'Atlassian', 'Uber'], ordered: true,
  prompt: `<p>A monitoring job logs the status every hour. Collapse consecutive readings with the same status into periods.</p>
<p>Return <code>status</code>, <code>period_start</code>, <code>period_end</code> (first and last reading time), <code>readings</code>. Sort by <code>period_start</code>.</p>`,
  hint: 'Difference of two ROW_NUMBERs: overall rn minus rn partitioned by status is constant within a run.',
  sql: `WITH x AS (
  SELECT log_time, status,
         ROW_NUMBER() OVER (ORDER BY log_time)
       - ROW_NUMBER() OVER (PARTITION BY status ORDER BY log_time) AS grp
  FROM server_log
)
SELECT status, MIN(log_time) AS period_start, MAX(log_time) AS period_end, COUNT(*) AS readings
FROM x
GROUP BY status, grp
ORDER BY period_start;`,
  sql_explain: `<p>Within a run of the same status, both row numbers increase together, so their difference is constant. When the status switches and later comes back, the overall counter has advanced more than the per-status counter, so the difference changes → new group. Group by <b>(status, grp)</b> — grp alone can collide across statuses.</p>
<p>Alternative: flag changes with <code>CASE WHEN status &lt;&gt; LAG(status) THEN 1 ELSE 0 END</code> and running-SUM the flags into a run id.</p>`,
  py: `s = server_log.sort_values('log_time').copy()
s['run'] = (s.status != s.status.shift()).cumsum()
result = (s.groupby(['run', 'status'])
           .agg(period_start=('log_time', 'min'), period_end=('log_time', 'max'), readings=('log_time', 'count'))
           .reset_index().sort_values('period_start')
           [['status', 'period_start', 'period_end', 'readings']].reset_index(drop=True))`,
  py_explain: `<p>The "change flag + cumsum" idiom: <code>(s != s.shift()).cumsum()</code> gives a run id that increments whenever the value changes. The single most useful pandas trick for islands.</p>`
},
{
  id: 29, title: 'Find missing invoice number ranges', difficulty: 'Medium', tier: 2,
  tables: { invoices: QT('invoice_no:INT,invoice_date:DATE,amount:REAL', [[1001, '2024-04-01', 500], [1002, '2024-04-01', 750], [1003, '2024-04-02', 120], [1007, '2024-04-03', 990], [1008, '2024-04-03', 310], [1010, '2024-04-04', 640], [1011, '2024-04-05', 220], [1012, '2024-04-05', 180], [1020, '2024-04-07', 880], [1021, '2024-04-08', 410]]) },
  topics: ['Gaps & islands', 'LAG/LEAD'], companies: ['Deloitte', 'EY', 'Razorpay', 'Zoho'], ordered: true,
  prompt: `<p>Auditors need the ranges of <b>missing invoice numbers</b> between the smallest and largest invoice.</p>
<p>Return <code>gap_start</code>, <code>gap_end</code>, <code>missing_count</code>. Sort by <code>gap_start</code>.</p>`,
  hint: 'LEAD(invoice_no) − invoice_no > 1 means a gap from invoice_no+1 to next−1.',
  sql: `SELECT invoice_no + 1      AS gap_start,
       next_no - 1         AS gap_end,
       next_no - invoice_no - 1 AS missing_count
FROM (
  SELECT invoice_no, LEAD(invoice_no) OVER (ORDER BY invoice_no) AS next_no
  FROM invoices
) t
WHERE next_no - invoice_no > 1
ORDER BY gap_start;`,
  sql_explain: `<p>"Gaps" is the inverse of "islands": look at each row and the next one; a jump bigger than 1 is a hole. The last row has <code>next_no = NULL</code> and is dropped by the WHERE automatically.</p>`,
  py: `s = invoices.sort_values('invoice_no')
nxt = s.invoice_no.shift(-1)
g = s[(nxt - s.invoice_no) > 1]
result = pd.DataFrame({'gap_start': g.invoice_no + 1, 'gap_end': nxt[g.index] - 1,
                       'missing_count': nxt[g.index] - g.invoice_no - 1}).astype(int).reset_index(drop=True)`,
  py_explain: `<p><code>shift(-1)</code> = LEAD.</p>`
}
);
