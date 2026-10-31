/* Section 9 — Food delivery (Swiggy / Zomato) and Section 10 — Ride hailing (Uber / Ola) */
window.QUESTIONS.push(
{
  id: 69, title: 'Delivery SLA by city and meal time', difficulty: 'Medium', tier: 1, dataset: 'delivery',
  topics: ['Date functions', 'CASE', 'Aggregation'], companies: ['Swiggy', 'Zomato', 'Zepto', 'Blinkit'], ordered: true,
  prompt: `<p>For delivered orders, delivery time = minutes between <code>ordered_at</code> and <code>delivered_at</code>. A delivery is <b>late</b> if it took more than 45 minutes.</p>
<p>Time bands by order hour: <code>'Lunch'</code> (12–14), <code>'Dinner'</code> (19–22), <code>'Other'</code>. Return <code>city</code>, <code>time_band</code>, <code>orders</code>, <code>avg_delivery_min</code>, <code>late_pct</code> (2 dp). Restaurant city decides the city. Sort by city, time_band.</p>`,
  hint: 'TIMESTAMPDIFF(MINUTE, ordered_at, delivered_at); HOUR(ordered_at) BETWEEN 12 AND 14.',
  sql: `SELECT r.city,
       CASE WHEN HOUR(o.ordered_at) BETWEEN 12 AND 14 THEN 'Lunch'
            WHEN HOUR(o.ordered_at) BETWEEN 19 AND 22 THEN 'Dinner'
            ELSE 'Other' END AS time_band,
       COUNT(*) AS orders,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, o.ordered_at, o.delivered_at)), 2) AS avg_delivery_min,
       ROUND(100.0 * SUM(CASE WHEN TIMESTAMPDIFF(MINUTE, o.ordered_at, o.delivered_at) > 45 THEN 1 ELSE 0 END) / COUNT(*), 2) AS late_pct
FROM food_orders o
JOIN restaurants r ON r.restaurant_id = o.restaurant_id
WHERE o.status = 'delivered'
GROUP BY r.city, time_band
ORDER BY r.city, time_band;`,
  sql_explain: `<p><code>TIMESTAMPDIFF(MINUTE, start, end)</code> truncates to whole minutes. In Postgres you'd use <code>EXTRACT(EPOCH FROM end - start)/60</code>. Late % is a conditional average — same pattern as success rate.</p>`,
  py: `o = food_orders[food_orders.status == 'delivered'].merge(restaurants[['restaurant_id', 'city']], on='restaurant_id')
o['mins'] = ((o.delivered_at - o.ordered_at).dt.total_seconds() // 60)
h = o.ordered_at.dt.hour
o['time_band'] = np.select([h.between(12, 14), h.between(19, 22)], ['Lunch', 'Dinner'], default='Other')
o['late'] = (o.mins > 45).astype(int)
result = o.groupby(['city', 'time_band']).agg(orders=('order_id', 'count'), avg_delivery_min=('mins', 'mean'), late_pct=('late', 'mean')).reset_index()
result['late_pct'] = 100 * result.late_pct
result = result.round(2)`,
  py_explain: `<p>Floor-divide seconds by 60 to mimic TIMESTAMPDIFF's truncation.</p>`
},
{
  id: 70, title: 'Top restaurant in each city and its revenue share', difficulty: 'Medium', tier: 1, dataset: 'delivery',
  topics: ['Window ranking', 'Window aggregate'], companies: ['Zomato', 'Swiggy', 'EatSure', 'Magicpin'], ordered: true,
  prompt: `<p>Net revenue of an order = <code>order_value − discount</code>, delivered orders only. For each city, find the restaurant with the highest net revenue and its share of the city's net revenue.</p>
<p>Return <code>city</code>, <code>restaurant_name</code>, <code>net_revenue</code>, <code>city_share_pct</code> (2 dp). Sort by city.</p>`,
  hint: 'Revenue per restaurant; SUM() OVER (PARTITION BY city) for the city total; RANK/ROW_NUMBER for the top.',
  sql: `WITH r AS (
  SELECT re.city, re.restaurant_id, re.restaurant_name,
         SUM(o.order_value - o.discount) AS net_revenue
  FROM food_orders o
  JOIN restaurants re ON re.restaurant_id = o.restaurant_id
  WHERE o.status = 'delivered'
  GROUP BY re.city, re.restaurant_id, re.restaurant_name
), x AS (
  SELECT *,
         100.0 * net_revenue / SUM(net_revenue) OVER (PARTITION BY city) AS share,
         ROW_NUMBER() OVER (PARTITION BY city ORDER BY net_revenue DESC, restaurant_id) AS rn
  FROM r
)
SELECT city, restaurant_name, ROUND(net_revenue, 2) AS net_revenue, ROUND(share, 2) AS city_share_pct
FROM x
WHERE rn = 1
ORDER BY city;`,
  sql_explain: `<p>Compute the share <b>before</b> filtering to rn = 1 — after the filter, the partition sum would only contain the winner (share = 100%).</p>`,
  py: `o = food_orders[food_orders.status == 'delivered'].merge(restaurants, on='restaurant_id')
o['net'] = o.order_value - o.discount
r = o.groupby(['city', 'restaurant_id', 'restaurant_name']).net.sum().reset_index()
r['city_share_pct'] = 100 * r.net / r.groupby('city').net.transform('sum')
r = r.sort_values(['city', 'net', 'restaurant_id'], ascending=[True, False, True]).drop_duplicates('city')
result = r.rename(columns={'net': 'net_revenue'})[['city', 'restaurant_name', 'net_revenue', 'city_share_pct']].round(2).reset_index(drop=True)`,
  py_explain: `<p>Same order: share via transform first, then pick the top row per city.</p>`
},
{
  id: 71, title: 'Loyal users: 3+ orders from one restaurant in a month', difficulty: 'Medium', tier: 1, dataset: 'delivery',
  topics: ['HAVING', 'Aggregation', 'Date functions'], companies: ['Swiggy', 'Zomato', 'Dunzo'], ordered: true,
  prompt: `<p>Find (user, restaurant, month) combinations with <b>3 or more delivered orders</b>.</p>
<p>Return <code>user_id</code>, <code>restaurant_id</code>, <code>month</code> (YYYY-MM), <code>orders</code>, <code>spend</code> (Σ order_value − discount, 2 dp). Sort by orders desc, spend desc, user_id.</p>`,
  hint: 'GROUP BY three keys, HAVING COUNT(*) >= 3.',
  sql: `SELECT user_id, restaurant_id,
       DATE_FORMAT(ordered_at, '%Y-%m') AS month,
       COUNT(*) AS orders,
       ROUND(SUM(order_value - discount), 2) AS spend
FROM food_orders
WHERE status = 'delivered'
GROUP BY user_id, restaurant_id, month
HAVING COUNT(*) >= 3
ORDER BY orders DESC, spend DESC, user_id;`,
  sql_explain: `<p>Straightforward multi-key aggregation. Follow-up: "loyal for 2 consecutive months" → wrap this in a CTE and use LAG over month per (user, restaurant).</p>`,
  py: `o = food_orders[food_orders.status == 'delivered'].assign(month=lambda d: d.ordered_at.dt.strftime('%Y-%m'), net=lambda d: d.order_value - d.discount)
g = o.groupby(['user_id', 'restaurant_id', 'month']).agg(orders=('order_id', 'count'), spend=('net', 'sum')).reset_index()
g = g[g.orders >= 3]
g['spend'] = g.spend.round(2)
result = g.sort_values(['orders', 'spend', 'user_id'], ascending=[False, False, True]).reset_index(drop=True)`,
  py_explain: `<p><code>assign</code> with lambdas keeps the chain readable.</p>`
},
{
  id: 72, title: 'Delivery partner productivity', difficulty: 'Medium', tier: 2, dataset: 'delivery',
  topics: ['Aggregation', 'COUNT DISTINCT', 'Window ranking'], companies: ['Swiggy', 'Zomato', 'Shadowfax', 'Dunzo', 'Rapido'], ordered: true,
  prompt: `<p>For each delivery partner: <code>active_days</code> (distinct days with ≥1 delivered order), <code>deliveries</code>, <code>avg_per_active_day</code> (2 dp), <code>avg_delivery_min</code> (2 dp).</p>
<p>Return the top 10 partners by avg_per_active_day (then deliveries desc, then partner_id): <code>partner_id</code>, <code>city</code>, <code>active_days</code>, <code>deliveries</code>, <code>avg_per_active_day</code>, <code>avg_delivery_min</code>.</p>`,
  hint: 'COUNT(DISTINCT DATE(delivered_at)).',
  sql: `SELECT p.partner_id, p.city,
       COUNT(DISTINCT DATE(o.delivered_at)) AS active_days,
       COUNT(*) AS deliveries,
       ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT DATE(o.delivered_at)), 2) AS avg_per_active_day,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, o.ordered_at, o.delivered_at)), 2) AS avg_delivery_min
FROM food_orders o
JOIN delivery_partners p ON p.partner_id = o.partner_id
WHERE o.status = 'delivered'
GROUP BY p.partner_id, p.city
ORDER BY avg_per_active_day DESC, deliveries DESC, p.partner_id
LIMIT 10;`,
  sql_explain: `<p>Utilisation metrics need the right denominator: per <i>active</i> day, not per calendar day. Ask which one the business wants.</p>`,
  py: `o = food_orders[food_orders.status == 'delivered'].merge(delivery_partners[['partner_id', 'city']], on='partner_id')
o['d'] = o.delivered_at.dt.normalize()
o['mins'] = (o.delivered_at - o.ordered_at).dt.total_seconds() // 60
g = o.groupby(['partner_id', 'city']).agg(active_days=('d', 'nunique'), deliveries=('order_id', 'count'), avg_delivery_min=('mins', 'mean')).reset_index()
g['avg_per_active_day'] = (g.deliveries / g.active_days).round(2)   # SQL orders by the rounded alias
g = g.sort_values(['avg_per_active_day', 'deliveries', 'partner_id'], ascending=[False, False, True]).head(10)
result = g[['partner_id', 'city', 'active_days', 'deliveries', 'avg_per_active_day', 'avg_delivery_min']].round(2).reset_index(drop=True)`,
  py_explain: `<p><code>nunique</code> on a normalised date column = COUNT(DISTINCT DATE()).</p>`
},
{
  id: 73, title: 'Discount dependency: do discounted first orders retain?', difficulty: 'Hard', tier: 3, dataset: 'delivery',
  topics: ['First touch', 'Retention', 'Window ranking', 'Business case'], companies: ['Swiggy', 'Zomato', 'Zepto', 'Blinkit', 'Uber Eats'], ordered: true,
  prompt: `<p>Take each user's <b>first delivered order</b> in the data (earliest ordered_at, then order_id). Split users by whether that first order had a discount (&gt; 0). A user <b>repeated</b> if they placed another delivered order within <b>30 days after</b> the first order's time.</p>
<p>Only users whose first order is on or before 2024-11-30 (so they have 30 days of runway). Return <code>first_order_type</code> ('Discounted' / 'Full price'), <code>users</code>, <code>repeated_30d</code>, <code>repeat_rate_pct</code> (2 dp). Sort by first_order_type.</p>`,
  hint: 'ROW_NUMBER for the first order; EXISTS (or MIN of later orders) for the 30-day repeat.',
  sql: `WITH d AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ordered_at, order_id) AS rn
  FROM food_orders
  WHERE status = 'delivered'
), first_o AS (
  SELECT user_id, order_id, ordered_at, discount FROM d WHERE rn = 1 AND ordered_at < '2024-12-01'
), flags AS (
  SELECT f.user_id,
         CASE WHEN f.discount > 0 THEN 'Discounted' ELSE 'Full price' END AS first_order_type,
         CASE WHEN EXISTS (SELECT 1 FROM d WHERE d.user_id = f.user_id AND d.rn > 1
                           AND d.ordered_at <= DATE_ADD(f.ordered_at, INTERVAL 30 DAY))
              THEN 1 ELSE 0 END AS repeated
  FROM first_o f
)
SELECT first_order_type, COUNT(*) AS users, SUM(repeated) AS repeated_30d,
       ROUND(100.0 * SUM(repeated) / COUNT(*), 2) AS repeat_rate_pct
FROM flags
GROUP BY first_order_type
ORDER BY first_order_type;`,
  sql_explain: `<p>Cohort by acquisition characteristic → retention flag → compare rates. Caveat to voice: data starts in October, so "first order in the data" isn't necessarily the user's first ever order (left-censoring) — in a real analysis you'd anchor on signup_date or full history.</p>`,
  py: `d = food_orders[food_orders.status == 'delivered'].sort_values(['user_id', 'ordered_at', 'order_id'])
first = d.drop_duplicates('user_id')[['user_id', 'order_id', 'ordered_at', 'discount']]
first = first[first.ordered_at < '2024-12-01']
later = d.merge(first[['user_id', 'order_id', 'ordered_at']], on='user_id', suffixes=('', '_f'))
later = later[(later.order_id != later.order_id_f) & (later.ordered_at <= later.ordered_at_f + pd.Timedelta(days=30))]
first['repeated'] = first.user_id.isin(later.user_id).astype(int)
first['first_order_type'] = np.where(first.discount > 0, 'Discounted', 'Full price')
result = first.groupby('first_order_type').agg(users=('user_id', 'count'), repeated_30d=('repeated', 'sum')).reset_index()
result['repeat_rate_pct'] = (100 * result.repeated_30d / result.users).round(2)`,
  py_explain: `<p>Merge every order with the user's first order, keep later ones within 30 days, then flag users via <code>isin</code>.</p>`
},
{
  id: 74, title: 'Gold members vs non-members', difficulty: 'Medium', tier: 1, dataset: 'delivery',
  topics: ['Aggregation', 'CASE', 'Business case'], companies: ['Zomato', 'Swiggy', 'Amazon Prime', 'Flipkart Plus'], ordered: true,
  prompt: `<p>Compare <code>is_gold</code> users vs others using all orders (any status). Return <code>segment</code> ('Gold' / 'Non-gold'), <code>users_ordered</code>, <code>orders</code>, <code>orders_per_user</code>, <code>aov</code> (avg order_value of delivered orders), <code>cancel_pct</code> (2 dp). Sort by segment.</p>`,
  hint: 'AVG(CASE WHEN status = delivered THEN order_value END) ignores non-delivered rows (NULL).',
  sql: `SELECT CASE WHEN u.is_gold = 1 THEN 'Gold' ELSE 'Non-gold' END AS segment,
       COUNT(DISTINCT o.user_id) AS users_ordered,
       COUNT(*) AS orders,
       ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT o.user_id), 2) AS orders_per_user,
       ROUND(AVG(CASE WHEN o.status = 'delivered' THEN o.order_value END), 2) AS aov,
       ROUND(100.0 * SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) / COUNT(*), 2) AS cancel_pct
FROM food_orders o
JOIN users u ON u.user_id = o.user_id
GROUP BY segment
ORDER BY segment;`,
  sql_explain: `<p><code>AVG(CASE WHEN … THEN x END)</code> = conditional average: rows that don't match become NULL and are excluded from both numerator and denominator.</p>`,
  py: `o = food_orders.merge(users[['user_id', 'is_gold']], on='user_id')
o['segment'] = np.where(o.is_gold == 1, 'Gold', 'Non-gold')
o['dv'] = o.order_value.where(o.status == 'delivered')
o['canc'] = (o.status == 'cancelled').astype(int)
result = o.groupby('segment').agg(users_ordered=('user_id', 'nunique'), orders=('order_id', 'count'), aov=('dv', 'mean'), cancel_pct=('canc', 'mean')).reset_index()
result['orders_per_user'] = result.orders / result.users_ordered
result['cancel_pct'] = 100 * result.cancel_pct
result = result[['segment', 'users_ordered', 'orders', 'orders_per_user', 'aov', 'cancel_pct']].round(2)`,
  py_explain: `<p><code>Series.where(cond)</code> turns non-matching values into NaN — the pandas version of CASE WHEN … THEN x END.</p>`
},
{
  id: 75, title: 'Peak ordering hour per city', difficulty: 'Medium', tier: 1, dataset: 'delivery',
  topics: ['Window ranking', 'Date functions'], companies: ['Swiggy', 'Zomato', 'Zepto', 'Uber'], ordered: true,
  prompt: `<p>For each restaurant city, find the hour of day (0–23, of ordered_at) with the most orders (any status). Ties → earlier hour.</p>
<p>Return <code>city</code>, <code>peak_hour</code>, <code>orders</code>, <code>share_of_city_pct</code> (2 dp). Sort by city.</p>`,
  hint: 'GROUP BY city, HOUR → ROW_NUMBER per city ordered by count desc, hour.',
  sql: `WITH h AS (
  SELECT r.city, HOUR(o.ordered_at) AS hr, COUNT(*) AS orders,
         100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY r.city) AS share,
         ROW_NUMBER() OVER (PARTITION BY r.city ORDER BY COUNT(*) DESC, HOUR(o.ordered_at)) AS rn
  FROM food_orders o
  JOIN restaurants r ON r.restaurant_id = o.restaurant_id
  GROUP BY r.city, HOUR(o.ordered_at)
)
SELECT city, hr AS peak_hour, orders, ROUND(share, 2) AS share_of_city_pct
FROM h
WHERE rn = 1
ORDER BY city;`,
  sql_explain: `<p>"Mode per group" = aggregate + ROW_NUMBER by count. Everything in one SELECT because windows run after GROUP BY.</p>`,
  py: `o = food_orders.merge(restaurants[['restaurant_id', 'city']], on='restaurant_id')
g = o.groupby(['city', o.ordered_at.dt.hour.rename('peak_hour')]).size().reset_index(name='orders')
g['share_of_city_pct'] = (100 * g.orders / g.groupby('city').orders.transform('sum')).round(2)
result = g.sort_values(['city', 'orders', 'peak_hour'], ascending=[True, False, True]).drop_duplicates('city').reset_index(drop=True)`,
  py_explain: `<p>Group by a derived Series (renamed) to get a clean column name.</p>`
},
{
  id: 76, title: 'Daily cancellation rate excluding banned users', difficulty: 'Hard', tier: 2, dataset: 'rides',
  topics: ['Joins', 'Conditional aggregation', 'Business case'], companies: ['Uber', 'Ola', 'Rapido', 'BluSmart'], ordered: true,
  prompt: `<p>Cancellation rate per day = trips cancelled (by rider <i>or</i> driver) ÷ all trips, considering only trips where <b>both</b> the rider and the driver are not banned.</p>
<p>For <b>2024-10-01 to 2024-10-07</b> return <code>day</code>, <code>trips</code>, <code>cancelled</code>, <code>cancellation_rate</code> (as a fraction, 2 dp). Sort by day.</p>`,
  hint: "Join riders and drivers with banned = 'No' in the join; status LIKE 'cancelled%'.",
  sql: `SELECT DATE(t.requested_at) AS day,
       COUNT(*) AS trips,
       SUM(CASE WHEN t.status LIKE 'cancelled%' THEN 1 ELSE 0 END) AS cancelled,
       ROUND(SUM(CASE WHEN t.status LIKE 'cancelled%' THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 2) AS cancellation_rate
FROM trips t
JOIN riders  r ON r.rider_id  = t.rider_id  AND r.banned = 'No'
JOIN drivers d ON d.driver_id = t.driver_id AND d.banned = 'No'
WHERE t.requested_at >= '2024-10-01' AND t.requested_at < '2024-10-08'
GROUP BY DATE(t.requested_at)
ORDER BY day;`,
  sql_explain: `<p>Same shape as LeetCode's "Trips and Users" (one of the most-asked hard SQL problems). The two inner joins act as filters on both participants. Watch out: a single join on a combined users table (with a role column) needs <i>two</i> aliases.</p>`,
  py: `t = trips[(trips.requested_at >= '2024-10-01') & (trips.requested_at < '2024-10-08')]
t = t[t.rider_id.isin(riders[riders.banned == 'No'].rider_id) & t.driver_id.isin(drivers[drivers.banned == 'No'].driver_id)]
t = t.assign(day=t.requested_at.dt.normalize(), c=t.status.str.startswith('cancelled').astype(int))
result = t.groupby('day').agg(trips=('trip_id', 'count'), cancelled=('c', 'sum')).reset_index()
result['cancellation_rate'] = (result.cancelled / result.trips).round(2)`,
  py_explain: `<p>Filter with <code>isin</code> on the allowed ids of each side — a semi-join.</p>`
},
{
  id: 77, title: 'Top-earning driver per city per week', difficulty: 'Medium', tier: 2, dataset: 'rides',
  topics: ['Window ranking', 'Date functions', 'Top-N per group'], companies: ['Uber', 'Ola', 'Rapido', 'Porter'], ordered: true,
  prompt: `<p>Weeks start on Monday. For completed trips, find the driver with the highest total fare in each (city, week). Ties → smaller driver_id.</p>
<p>Return <code>city</code>, <code>week_start</code>, <code>driver_id</code>, <code>trips</code>, <code>earnings</code> (2 dp). Only weeks starting between 2024-10-07 and 2024-11-18. Sort by city, week_start.</p>`,
  hint: 'week_start = DATE_SUB(DATE(requested_at), INTERVAL WEEKDAY(requested_at) DAY).',
  sql: `WITH w AS (
  SELECT city,
         DATE_SUB(DATE(requested_at), INTERVAL WEEKDAY(requested_at) DAY) AS week_start,
         driver_id, COUNT(*) AS trips, SUM(fare) AS earnings
  FROM trips
  WHERE status = 'completed'
  GROUP BY city, week_start, driver_id
), r AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY city, week_start ORDER BY earnings DESC, driver_id) AS rn
  FROM w
)
SELECT city, week_start, driver_id, trips, ROUND(earnings, 2) AS earnings
FROM r
WHERE rn = 1 AND week_start BETWEEN '2024-10-07' AND '2024-11-18'
ORDER BY city, week_start;`,
  sql_explain: `<p>Truncating to week is a frequent need; MySQL has no <code>DATE_TRUNC</code>, so subtract <code>WEEKDAY()</code> days (Monday weeks) or use <code>YEARWEEK(date, 3)</code> for an ISO week key.</p>`,
  py: `t = trips[trips.status == 'completed'].copy()
d = t.requested_at.dt.normalize()
t['week_start'] = d - pd.to_timedelta(d.dt.weekday, unit='D')
g = t.groupby(['city', 'week_start', 'driver_id']).agg(trips=('trip_id', 'count'), earnings=('fare', 'sum')).reset_index()
g = g.sort_values(['city', 'week_start', 'earnings', 'driver_id'], ascending=[True, True, False, True]).drop_duplicates(['city', 'week_start'])
g = g[(g.week_start >= '2024-10-07') & (g.week_start <= '2024-11-18')]
g['earnings'] = g.earnings.round(2)
result = g.reset_index(drop=True)`,
  py_explain: `<p>Week start via weekday offset, then argmax per (city, week).</p>`
},
{
  id: 78, title: "Riders whose first and last trip cities differ (LAST_VALUE trap)", difficulty: 'Medium', tier: 2, dataset: 'rides',
  topics: ['FIRST_VALUE/LAST_VALUE', 'Window frame'], companies: ['Uber', 'Ola', 'Airbnb', 'MakeMyTrip'], ordered: true,
  prompt: `<p>For each rider, look at their first and last trip request (by requested_at, then trip_id; any status). Return riders whose first and last trip cities are different.</p>
<p>Return <code>rider_id</code>, <code>first_city</code>, <code>last_city</code>, <code>trips</code>. Sort by rider_id.</p>`,
  hint: 'LAST_VALUE needs ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING — the default frame stops at the current row.',
  sql: `WITH x AS (
  SELECT rider_id,
         FIRST_VALUE(city) OVER w AS first_city,
         LAST_VALUE(city)  OVER w AS last_city,
         COUNT(*)          OVER (PARTITION BY rider_id) AS trips
  FROM trips
  WINDOW w AS (PARTITION BY rider_id ORDER BY requested_at, trip_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
)
SELECT DISTINCT rider_id, first_city, last_city, trips
FROM x
WHERE first_city <> last_city
ORDER BY rider_id;`,
  sql_explain: `<p><b>The trap:</b> with ORDER BY, the default frame is <code>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>, so <code>LAST_VALUE</code> returns the <i>current</i> row's value — not the partition's last. Either widen the frame to UNBOUNDED FOLLOWING, or use <code>FIRST_VALUE(city) OVER (… ORDER BY requested_at DESC)</code>. The named <code>WINDOW</code> clause (MySQL 8) avoids repeating the spec.</p>`,
  py: `t = trips.sort_values(['rider_id', 'requested_at', 'trip_id'])
g = t.groupby('rider_id').agg(first_city=('city', 'first'), last_city=('city', 'last'), trips=('trip_id', 'count')).reset_index()
result = g[g.first_city != g.last_city].reset_index(drop=True)`,
  py_explain: `<p>After sorting, <code>'first'</code>/<code>'last'</code> aggregations give the boundary values directly.</p>`
},
{
  id: 79, title: 'Surge pricing: completion and fare per km', difficulty: 'Easy', tier: 1, dataset: 'rides',
  topics: ['Aggregation', 'CASE'], companies: ['Uber', 'Ola', 'Rapido'], ordered: true,
  prompt: `<p>For each <code>surge_multiplier</code>: <code>trips</code>, <code>completion_pct</code> (completed / all, 2 dp), <code>rider_cancel_pct</code> (2 dp), <code>avg_fare_per_km</code> for completed trips (2 dp). Sort by surge_multiplier.</p>`,
  hint: 'SUM(fare)/SUM(distance_km) for completed trips is fare per km weighted by distance — AVG(fare/distance) is a different metric; here use the weighted one.',
  sql: `SELECT surge_multiplier,
       COUNT(*) AS trips,
       ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) AS completion_pct,
       ROUND(100.0 * SUM(CASE WHEN status = 'cancelled_by_rider' THEN 1 ELSE 0 END) / COUNT(*), 2) AS rider_cancel_pct,
       ROUND(SUM(CASE WHEN status = 'completed' THEN fare END)
           / SUM(CASE WHEN status = 'completed' THEN distance_km END), 2) AS avg_fare_per_km
FROM trips
GROUP BY surge_multiplier
ORDER BY surge_multiplier;`,
  sql_explain: `<p>Weighted ratio (ratio of sums) vs average of ratios is a favourite follow-up. Here the business question is "how much do we earn per km under surge", so the weighted one is right.</p>`,
  py: `t = trips.assign(comp=(trips.status == 'completed').astype(int), rc=(trips.status == 'cancelled_by_rider').astype(int))
c = t[t.status == 'completed'].groupby('surge_multiplier').agg(f=('fare', 'sum'), d=('distance_km', 'sum'))
g = t.groupby('surge_multiplier').agg(trips=('trip_id', 'count'), completion_pct=('comp', 'mean'), rider_cancel_pct=('rc', 'mean')).join(c)
g['completion_pct'] *= 100
g['rider_cancel_pct'] *= 100
g['avg_fare_per_km'] = g.f / g.d
result = g[['trips', 'completion_pct', 'rider_cancel_pct', 'avg_fare_per_km']].round(2).reset_index()`,
  py_explain: `<p>Two aggregations (all trips / completed trips) joined on the group key.</p>`
}
);
