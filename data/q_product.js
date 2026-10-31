/* Section 5 — Funnels, sessions & product analytics */
window.QUESTIONS.push(
{
  id: 39, title: 'Strictly ordered funnel: view → cart → purchase', difficulty: 'Hard', tier: 3, dataset: 'events',
  topics: ['Funnel', 'CTE', 'Correlated subquery'], companies: ['Meta', 'Amazon', 'Flipkart', 'Meesho', 'Swiggy'], ordered: true,
  prompt: `<p>Build an <b>ordered</b> funnel: a user reaches step 2 only if they did <code>add_to_cart</code> <i>after</i> their first <code>view_product</code>, and step 3 only if they did <code>purchase</code> <i>after</i> that first qualifying add_to_cart.</p>
<p>Return 3 rows: <code>step</code> ('1_view', '2_cart', '3_purchase'), <code>users</code>, <code>pct_of_step1</code> (2 dp). Sort by step.</p>`,
  hint: 'Chain CTEs: first view time per user → first cart time strictly after it → first purchase strictly after that.',
  sql: `WITH v AS (
  SELECT user_id, MIN(event_time) AS t_view
  FROM events WHERE event_name = 'view_product'
  GROUP BY user_id
), c AS (
  SELECT v.user_id, MIN(e.event_time) AS t_cart
  FROM v
  JOIN events e ON e.user_id = v.user_id AND e.event_name = 'add_to_cart' AND e.event_time > v.t_view
  GROUP BY v.user_id
), p AS (
  SELECT c.user_id
  FROM c
  JOIN events e ON e.user_id = c.user_id AND e.event_name = 'purchase' AND e.event_time > c.t_cart
  GROUP BY c.user_id
), steps AS (
  SELECT '1_view' AS step, COUNT(*) AS users FROM v
  UNION ALL SELECT '2_cart', COUNT(*) FROM c
  UNION ALL SELECT '3_purchase', COUNT(*) FROM p
)
SELECT step, users,
       ROUND(100.0 * users / (SELECT users FROM steps WHERE step = '1_view'), 2) AS pct_of_step1
FROM steps
ORDER BY step;`,
  sql_explain: `<p>A naive funnel (<code>COUNT(DISTINCT CASE WHEN event_name='purchase' …)</code>) ignores order: someone who purchased (from a link) and later viewed would count as converted. Interviewers at Meta/Amazon explicitly test this.</p>
<p>Each CTE carries the timestamp that "unlocks" the next step and joins forward in time (<code>event_time &gt; previous step time</code>). <code>MIN</code> picks the earliest qualifying event so the next step has the widest window.</p>`,
  py: `v = events[events.event_name == 'view_product'].groupby('user_id').event_time.min().rename('t_view').reset_index()
c = events[events.event_name == 'add_to_cart'].merge(v, on='user_id')
c = c[c.event_time > c.t_view].groupby('user_id').event_time.min().rename('t_cart').reset_index()
p = events[events.event_name == 'purchase'].merge(c, on='user_id')
p = p[p.event_time > p.t_cart].user_id.unique()
counts = [len(v), len(c), len(p)]
result = pd.DataFrame({'step': ['1_view', '2_cart', '3_purchase'], 'users': counts})
result['pct_of_step1'] = (100 * result.users / counts[0]).round(2)`,
  py_explain: `<p>Merge each step's events with the previous step's timestamp, filter forward in time, take the min. Same logic as the SQL chain.</p>`
},
{
  id: 40, title: 'Sessionize raw events (30-minute inactivity rule)', difficulty: 'Hard', tier: 3, dataset: 'events',
  topics: ['Sessionization', 'LAG/LEAD', 'Running total', 'Gaps & islands'], companies: ['Meta', 'LinkedIn', 'Amazon', 'Hotstar', 'Swiggy'], ordered: true,
  prompt: `<p>There is no session_id. A new session starts at a user's first event, or whenever the gap since that user's previous event is <b>more than 30 minutes</b>.</p>
<p>Per <code>platform</code> (from app_users) return <code>platform</code>, <code>users</code>, <code>sessions</code>, <code>avg_sessions_per_user</code>, <code>avg_events_per_session</code>, <code>avg_session_minutes</code> (last event − first event of the session, in minutes). All averages 2 dp. Sort by <code>sessions</code> desc.</p>`,
  hint: 'LAG(event_time) → flag new session (1/0) → SUM(flag) OVER (PARTITION BY user ORDER BY time) = session number.',
  sql: `WITH flagged AS (
  SELECT user_id, event_time,
         CASE WHEN LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time, event_id) IS NULL
                OR TIMESTAMPDIFF(SECOND,
                       LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time, event_id),
                       event_time) > 1800
              THEN 1 ELSE 0 END AS new_session,
         event_id
  FROM events
), numbered AS (
  SELECT user_id, event_time,
         SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_time, event_id
                                ROWS UNBOUNDED PRECEDING) AS session_no
  FROM flagged
), sessions AS (
  SELECT user_id, session_no, COUNT(*) AS events,
         TIMESTAMPDIFF(SECOND, MIN(event_time), MAX(event_time)) / 60.0 AS minutes
  FROM numbered
  GROUP BY user_id, session_no
)
SELECT u.platform,
       COUNT(DISTINCT s.user_id)                          AS users,
       COUNT(*)                                           AS sessions,
       ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT s.user_id), 2) AS avg_sessions_per_user,
       ROUND(AVG(s.events), 2)                            AS avg_events_per_session,
       ROUND(AVG(s.minutes), 2)                           AS avg_session_minutes
FROM sessions s
JOIN app_users u ON u.user_id = s.user_id
GROUP BY u.platform
ORDER BY sessions DESC;`,
  sql_explain: `<ol><li><b>Flag</b> the first event of each session: no previous event, or gap &gt; 30 min.</li>
<li><b>Running sum of flags</b> per user turns the flags into session numbers 1,1,1,2,2,3…</li>
<li><b>Aggregate</b> per (user, session) for length and duration, then per platform.</li></ol>
<p>This "flag + cumulative sum" is the universal recipe for sessionization and most gaps-and-islands variants.</p>`,
  py: `e = events.sort_values(['user_id', 'event_time', 'event_id']).copy()
gap = e.groupby('user_id').event_time.diff()
e['new'] = (gap.isna() | (gap > pd.Timedelta(minutes=30))).astype(int)
e['session_no'] = e.groupby('user_id').new.cumsum()
s = e.groupby(['user_id', 'session_no']).agg(events=('event_id', 'count'), t0=('event_time', 'min'), t1=('event_time', 'max')).reset_index()
s['minutes'] = (s.t1 - s.t0).dt.total_seconds() / 60
s = s.merge(app_users[['user_id', 'platform']], on='user_id')
result = s.groupby('platform').agg(users=('user_id', 'nunique'), sessions=('session_no', 'count'),
                                   avg_events_per_session=('events', 'mean'), avg_session_minutes=('minutes', 'mean')).reset_index()
result['avg_sessions_per_user'] = result.sessions / result.users
result = result[['platform', 'users', 'sessions', 'avg_sessions_per_user', 'avg_events_per_session', 'avg_session_minutes']].round(2)
result = result.sort_values('sessions', ascending=False).reset_index(drop=True)`,
  py_explain: `<p><code>groupby().diff()</code> → gap, boolean flag, <code>groupby().cumsum()</code> → session number. Exactly the SQL recipe.</p>`
},
{
  id: 41, title: 'Cart abandonment rate by country', difficulty: 'Medium', tier: 1, dataset: 'events',
  topics: ['Conditional aggregation', 'Funnel'], companies: ['Amazon', 'Myntra', 'Nykaa', 'Shopify'], ordered: true,
  prompt: `<p>A <b>cart user</b> has at least one <code>add_to_cart</code>. An <b>abandoner</b> is a cart user with zero <code>purchase</code> events ever.</p>
<p>Return <code>country</code>, <code>cart_users</code>, <code>abandoners</code>, <code>abandon_pct</code> (2 dp). Sort by <code>abandon_pct</code> desc.</p>`,
  hint: 'Per user: MAX(event_name = add_to_cart), MAX(event_name = purchase). Then aggregate per country.',
  sql: `WITH u AS (
  SELECT e.user_id,
         MAX(CASE WHEN e.event_name = 'add_to_cart' THEN 1 ELSE 0 END) AS carted,
         MAX(CASE WHEN e.event_name = 'purchase'    THEN 1 ELSE 0 END) AS bought
  FROM events e
  GROUP BY e.user_id
)
SELECT a.country,
       SUM(u.carted)                                        AS cart_users,
       SUM(CASE WHEN u.carted = 1 AND u.bought = 0 THEN 1 ELSE 0 END) AS abandoners,
       ROUND(100.0 * SUM(CASE WHEN u.carted = 1 AND u.bought = 0 THEN 1 ELSE 0 END) / SUM(u.carted), 2) AS abandon_pct
FROM u
JOIN app_users a ON a.user_id = u.user_id
GROUP BY a.country
ORDER BY abandon_pct DESC;`,
  sql_explain: `<p>Collapsing to one row per user with <code>MAX(CASE …)</code> flags is the cleanest way to express "has ever done X / never done Y" — no self joins, single scan.</p>`,
  py: `f = events.assign(carted=(events.event_name == 'add_to_cart').astype(int), bought=(events.event_name == 'purchase').astype(int))
u = f.groupby('user_id')[['carted', 'bought']].max().reset_index().merge(app_users[['user_id', 'country']], on='user_id')
u['ab'] = ((u.carted == 1) & (u.bought == 0)).astype(int)
result = u.groupby('country').agg(cart_users=('carted', 'sum'), abandoners=('ab', 'sum')).reset_index()
result['abandon_pct'] = (100 * result.abandoners / result.cart_users).round(2)
result = result.sort_values('abandon_pct', ascending=False).reset_index(drop=True)`,
  py_explain: `<p>Same flags-then-aggregate pattern with <code>groupby().max()</code>.</p>`
},
{
  id: 42, title: 'Funnel conversion by platform (pivot)', difficulty: 'Medium', tier: 1, dataset: 'events',
  topics: ['Pivot', 'COUNT DISTINCT', 'Funnel'], companies: ['Swiggy', 'Zomato', 'PhonePe', 'Meta'], ordered: true,
  prompt: `<p>For each <code>platform</code>, count distinct users who performed each event type at least once (order not required).</p>
<p>Return <code>platform</code>, <code>active_users</code>, <code>searched</code>, <code>viewed</code>, <code>carted</code>, <code>purchased</code>, <code>purchase_conv_pct</code> (purchased / active_users × 100, 2 dp). Sort by platform.</p>`,
  hint: 'COUNT(DISTINCT CASE WHEN event_name = … THEN user_id END) per column.',
  sql: `SELECT a.platform,
       COUNT(DISTINCT e.user_id) AS active_users,
       COUNT(DISTINCT CASE WHEN e.event_name = 'search'       THEN e.user_id END) AS searched,
       COUNT(DISTINCT CASE WHEN e.event_name = 'view_product' THEN e.user_id END) AS viewed,
       COUNT(DISTINCT CASE WHEN e.event_name = 'add_to_cart'  THEN e.user_id END) AS carted,
       COUNT(DISTINCT CASE WHEN e.event_name = 'purchase'     THEN e.user_id END) AS purchased,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN e.event_name = 'purchase' THEN e.user_id END)
             / COUNT(DISTINCT e.user_id), 2) AS purchase_conv_pct
FROM events e
JOIN app_users a ON a.user_id = e.user_id
GROUP BY a.platform
ORDER BY a.platform;`,
  sql_explain: `<p>MySQL has no <code>PIVOT</code> keyword; conditional aggregation is the portable pivot. <code>COUNT(DISTINCT CASE … END)</code> counts users, not events.</p>`,
  py: `e = events.merge(app_users[['user_id', 'platform']], on='user_id')
piv = e.pivot_table(index='platform', columns='event_name', values='user_id', aggfunc='nunique', fill_value=0)
act = e.groupby('platform').user_id.nunique().rename('active_users')
result = pd.concat([act, piv[['search', 'view_product', 'add_to_cart', 'purchase']]], axis=1).reset_index()
result.columns = ['platform', 'active_users', 'searched', 'viewed', 'carted', 'purchased']
result['purchase_conv_pct'] = (100 * result.purchased / result.active_users).round(2)
result = result.sort_values('platform').reset_index(drop=True)`,
  py_explain: `<p><code>pivot_table(aggfunc='nunique')</code> is the pandas equivalent of the conditional COUNT DISTINCT pivot.</p>`
},
{
  id: 43, title: 'What happens right after a search?', difficulty: 'Medium', tier: 2, dataset: 'events',
  topics: ['LAG/LEAD', 'Path analysis'], companies: ['Google', 'Amazon', 'Flipkart', 'Myntra'], ordered: true,
  prompt: `<p>For every <code>search</code> event, find the user's <b>next</b> event (by time, then event_id). Ignore searches that are the user's last event, and ignore next events more than <b>30 minutes</b> later.</p>
<p>Return <code>next_event</code>, <code>occurrences</code>, <code>pct</code> (share of qualifying searches, 2 dp). Sort by occurrences desc.</p>`,
  hint: 'LEAD(event_name) and LEAD(event_time) over the user timeline, then filter to event_name = search.',
  sql: `WITH seq AS (
  SELECT event_name, event_time,
         LEAD(event_name) OVER (PARTITION BY user_id ORDER BY event_time, event_id) AS next_event,
         LEAD(event_time) OVER (PARTITION BY user_id ORDER BY event_time, event_id) AS next_time
  FROM events
)
SELECT next_event,
       COUNT(*) AS occurrences,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM seq
WHERE event_name = 'search'
  AND next_event IS NOT NULL
  AND TIMESTAMPDIFF(MINUTE, event_time, next_time) <= 30
GROUP BY next_event
ORDER BY occurrences DESC;`,
  sql_explain: `<p>Compute LEAD over <b>all</b> events, then filter to searches — filtering first would make LEAD jump to the next <i>search</i>. Same "window before filter" lesson as Q13.</p>`,
  py: `e = events.sort_values(['user_id', 'event_time', 'event_id']).copy()
g = e.groupby('user_id')
e['next_event'] = g.event_name.shift(-1)
e['next_time'] = g.event_time.shift(-1)
s = e[(e.event_name == 'search') & e.next_event.notna()]
s = s[(s.next_time - s.event_time) <= pd.Timedelta(minutes=30, seconds=59)]
s = s[((s.next_time - s.event_time).dt.total_seconds() // 60) <= 30]
result = s.groupby('next_event').size().reset_index(name='occurrences')
result['pct'] = (100 * result.occurrences / result.occurrences.sum()).round(2)
result = result.sort_values('occurrences', ascending=False).reset_index(drop=True)`,
  py_explain: `<p><code>groupby().shift(-1)</code> = LEAD per partition. <code>TIMESTAMPDIFF(MINUTE)</code> truncates to whole minutes, so the pandas filter uses floor-division of seconds by 60 to match exactly.</p>`
}
);
