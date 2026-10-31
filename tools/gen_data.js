// Deterministic generator for all practice datasets.
// Run: node build/gen_data.js  -> writes site/datasets/*.js
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'datasets');
fs.mkdirSync(OUT, { recursive: true });

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = mulberry32(42);
const rnd = () => R();
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const wpick = (arr, w) => { const s = w.reduce((a, b) => a + b, 0); let x = rnd() * s; for (let i = 0; i < arr.length; i++) { x -= w[i]; if (x < 0) return arr[i]; } return arr[arr.length - 1]; };
const r2 = x => Math.round(x * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const D = s => new Date(s + 'T00:00:00Z');
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const addMin = (d, n) => new Date(d.getTime() + n * 60000);
const fd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fdt = d => `${fd(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const randDate = (a, b) => addDays(D(a), ri(0, daysBetween(D(a), D(b))));
const addMonths = (d, n) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)); const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(d.getUTCDate(), last)); return x; };

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Pari', 'Anika', 'Navya', 'Myra', 'Sara', 'Riya', 'Rohan', 'Karan', 'Neha', 'Pooja', 'Rahul', 'Sneha', 'Amit', 'Priya', 'Vikram', 'Meera', 'Kabir', 'Tara', 'Dev', 'Isha', 'Nikhil', 'Kavya', 'Manish', 'Shreya', 'Varun', 'Zoya'];
const LAST = ['Sharma', 'Verma', 'Iyer', 'Reddy', 'Nair', 'Gupta', 'Mehta', 'Rao', 'Das', 'Khan', 'Singh', 'Patel', 'Joshi', 'Kulkarni', 'Banerjee', 'Pillai', 'Chopra', 'Malhotra', 'Bose', 'Menon'];
const CITY_STATE = [['Mumbai', 'Maharashtra'], ['Pune', 'Maharashtra'], ['Delhi', 'Delhi'], ['Bengaluru', 'Karnataka'], ['Mysuru', 'Karnataka'], ['Chennai', 'Tamil Nadu'], ['Hyderabad', 'Telangana'], ['Kolkata', 'West Bengal'], ['Jaipur', 'Rajasthan'], ['Ahmedabad', 'Gujarat'], ['Lucknow', 'Uttar Pradesh']];
const CITY_W = [14, 8, 14, 15, 3, 9, 10, 7, 5, 6, 4];
const name = () => `${pick(FIRST)} ${pick(LAST)}`;

function save(key, ds) {
  for (const [t, def] of Object.entries(ds.tables)) def.row_count = def.rows.length;
  fs.writeFileSync(path.join(OUT, key + '.js'), `window.DATASETS=window.DATASETS||{};window.DATASETS[${JSON.stringify(key)}]=${JSON.stringify(ds)};\n`);
  const sizes = Object.entries(ds.tables).map(([t, d]) => `${t}:${d.rows.length}`).join(', ');
  console.log(key, sizes, (fs.statSync(path.join(OUT, key + '.js')).size / 1024).toFixed(0) + 'KB');
}
// table helper: cols = [['name','INT'],...]
const T = (cols, rows, desc) => ({ columns: cols.map(c => c[0]), types: cols.map(c => c[1]), rows, description: desc || '' });

// ============ RETAIL (ShopKart e-commerce) ============
(function () {
  R = mulberry32(101);
  const customers = [];
  for (let id = 1; id <= 300; id++) {
    const [city, state] = wpick(CITY_STATE, CITY_W);
    const signup = randDate('2022-01-01', '2024-09-30');
    const pool = [3, 7, 12, 15, 19, 22, 26, 29];
    const referred = id > 30 && rnd() < 0.2 ? (rnd() < 0.7 ? pick(pool) : ri(1, id - 1)) : null;
    customers.push([id, name(), city, state, fd(signup), wpick(['Consumer', 'Corporate', 'Home Office'], [70, 20, 10]), referred]);
  }
  const PRODUCTS = {
    Electronics: [['Wireless Earbuds', 'Boat', 1999], ['Smartwatch', 'Noise', 3499], ['Bluetooth Speaker', 'JBL', 4999], ['Power Bank 20000mAh', 'Mi', 1799], ['USB-C Charger 65W', 'Anker', 2499], ['Mechanical Keyboard', 'Redragon', 3999], ['Wireless Mouse', 'Logitech', 1299], ['4K Monitor 27in', 'LG', 24999]],
    Fashion: [['Running Shoes', 'Nike', 5999], ['Denim Jacket', 'Levis', 3999], ['Cotton T-Shirt', 'H&M', 799], ['Kurta Set', 'Biba', 2499], ['Sunglasses', 'Ray-Ban', 6999], ['Backpack', 'Wildcraft', 2199], ['Formal Shirt', 'Van Heusen', 1899], ['Sneakers', 'Puma', 4499]],
    Home: [['Non-stick Pan', 'Prestige', 1499], ['Mixer Grinder', 'Bajaj', 3299], ['Bedsheet Set', 'Bombay Dyeing', 1599], ['Air Fryer', 'Philips', 7999], ['Water Purifier', 'Kent', 14999], ['Table Lamp', 'Philips', 1199], ['Storage Boxes', 'Cello', 899], ['Office Chair', 'Green Soul', 9999]],
    Beauty: [['Face Serum', 'Minimalist', 599], ['Sunscreen SPF50', 'Lakme', 449], ['Hair Dryer', 'Philips', 1899], ['Perfume 100ml', 'Bella Vita', 799], ['Trimmer', 'Philips', 2299], ['Lipstick', 'Maybelline', 499], ['Shampoo 1L', 'Loreal', 699], ['Face Wash', 'Cetaphil', 549]],
    Grocery: [['Basmati Rice 5kg', 'India Gate', 749], ['Olive Oil 1L', 'Figaro', 899], ['Green Tea 100 bags', 'Lipton', 399], ['Dry Fruits Mix 1kg', 'Happilo', 1199], ['Coffee 200g', 'Nescafe', 549], ['Almond Milk 1L', 'So Good', 299], ['Protein Bar Box', 'Yoga Bar', 899], ['Honey 1kg', 'Dabur', 449]]
  };
  const products = []; let pid = 1;
  const margin = { Electronics: [0.70, 0.85], Fashion: [0.40, 0.60], Home: [0.55, 0.75], Beauty: [0.35, 0.55], Grocery: [0.75, 0.90] };
  for (const [cat, list] of Object.entries(PRODUCTS)) for (const [pn, br, price] of list) {
    products.push([pid++, pn, cat, br, price, Math.round(price * (margin[cat][0] + rnd() * (margin[cat][1] - margin[cat][0])))]);
  }
  // product 40 (Honey) is never sold in Q4 2024 -> handled by skipping; product 8 (4K monitor) rarely sold
  const catW = { Electronics: 25, Fashion: 25, Home: 15, Beauty: 18, Grocery: 17 };
  const orders = [], items = [], returns = [];
  let oid = 1001, iid = 1, rid = 1;
  const asOf = D('2024-12-31');
  const coupons = ['WELCOME10', 'FEST20', 'SAVE5', null];
  const neverOrder = new Set(); while (neverOrder.size < 22) neverOrder.add(ri(1, 300));
  const allOrders = [];
  for (const c of customers) {
    if (neverOrder.has(c[0])) continue;
    const signup = D(c[4]);
    let start = signup < D('2023-01-01') ? D('2023-01-01') : signup;
    const intensity = wpick([0.6, 2, 4, 8], [25, 40, 25, 10]); // orders per quarter-ish
    const churnAt = rnd() < 0.25 ? addDays(start, ri(60, 500)) : asOf;
    let d = addDays(start, ri(0, 40));
    while (d <= asOf && d <= churnAt) {
      allOrders.push([c[0], new Date(d)]);
      d = addDays(d, Math.max(1, Math.round(-Math.log(1 - rnd()) * 90 / intensity)));
    }
  }
  // festive boost: extra orders in Oct-Nov each year
  for (let k = 0; k < 260; k++) { const c = pick(customers); if (neverOrder.has(c[0])) continue; const d = rnd() < 0.5 ? randDate('2023-10-10', '2023-11-15') : randDate('2024-10-01', '2024-11-10'); if (d >= D(c[4])) allOrders.push([c[0], d]); }
  allOrders.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const firstOrderSeen = new Set();
  for (const [cid, d] of allOrders) {
    const recent = daysBetween(d, asOf) <= 6;
    let status = wpick(['Delivered', 'Cancelled', 'Returned'], [86, 7.5, 6.5]);
    if (recent && rnd() < 0.6) status = 'Shipped';
    const isFirst = !firstOrderSeen.has(cid); firstOrderSeen.add(cid);
    const coupon = isFirst && rnd() < 0.5 ? 'WELCOME10' : (rnd() < 0.22 ? pick(coupons.slice(1, 3)) : null);
    const id = oid++;
    orders.push([id, cid, fd(d), status, wpick(['App', 'Web'], [65, 35]), wpick(['UPI', 'Card', 'COD', 'Wallet'], [48, 27, 18, 7]), coupon]);
    const n = wpick([1, 2, 3, 4], [50, 28, 15, 7]);
    const used = new Set(); let total = 0;
    for (let k = 0; k < n; k++) {
      const cat = wpick(Object.keys(catW), Object.values(catW));
      let p = pick(products.filter(p => p[2] === cat));
      if (p[0] === 40 && d >= D('2024-10-01')) p = products[38];
      if (p[0] === 8 && rnd() < 0.7) p = products[6];
      if (used.has(p[0])) continue; used.add(p[0]);
      // co-purchase affinity: earbuds+powerbank, pan+mixer, rice+oil
      const disc = wpick([0, 5, 10, 15, 20], [40, 20, 20, 12, 8]);
      const q = p[2] === 'Grocery' ? ri(1, 4) : wpick([1, 2, 3], [80, 15, 5]);
      const up = r2(p[4] * (1 - disc / 100));
      items.push([iid++, id, p[0], q, up, disc]); total += q * up;
      const aff = { 1: 4, 17: 18, 33: 34, 9: 13, 25: 32 };
      if (aff[p[0]] && rnd() < 0.55 && !used.has(aff[p[0]])) { const p2 = products[aff[p[0]] - 1]; used.add(p2[0]); items.push([iid++, id, p2[0], 1, p2[4], 0]); total += p2[4]; }
    }
    if (status === 'Returned') {
      const reasons = { Fashion: ['Size issue', 'Size issue', 'Quality issue', 'Changed mind'], Electronics: ['Defective', 'Defective', 'Not as described', 'Changed mind'] };
      const cats = items.filter(x => x[1] === id).map(x => products[x[2] - 1][2]);
      const rs = reasons[cats[0]] || ['Damaged in transit', 'Changed mind', 'Not as described', 'Quality issue'];
      const full = rnd() < 0.8;
      returns.push([rid++, id, fd(addDays(d, ri(3, 18))), pick(rs), r2(full ? total : total * (0.3 + rnd() * 0.5))]);
    }
  }
  save('retail', {
    title: 'ShopKart — E-commerce Sales', domain: 'E-commerce / Retail',
    description: 'Indian e-commerce marketplace (Flipkart/Amazon/Meesho style). 2 years of orders (2023-01 → 2024-12), 5 categories, line-item level pricing with discounts, returns with partial refunds. Revenue of an order line = quantity * unit_price. "As of" date for analysis: 2024-12-31.',
    tables: {
      customers: T([['customer_id', 'INT'], ['customer_name', 'TEXT'], ['city', 'TEXT'], ['state', 'TEXT'], ['signup_date', 'DATE'], ['segment', 'TEXT'], ['referred_by', 'INT']], customers, 'One row per registered customer. referred_by = customer_id of referrer (NULL if organic). Some customers never ordered.'),
      products: T([['product_id', 'INT'], ['product_name', 'TEXT'], ['category', 'TEXT'], ['brand', 'TEXT'], ['list_price', 'REAL'], ['cost_price', 'REAL']], products, 'Product catalog. cost_price = what ShopKart pays the seller.'),
      orders: T([['order_id', 'INT'], ['customer_id', 'INT'], ['order_date', 'DATE'], ['status', 'TEXT'], ['channel', 'TEXT'], ['payment_mode', 'TEXT'], ['coupon_code', 'TEXT']], orders, "Order header. status in ('Delivered','Shipped','Cancelled','Returned')."),
      order_items: T([['item_id', 'INT'], ['order_id', 'INT'], ['product_id', 'INT'], ['quantity', 'INT'], ['unit_price', 'REAL'], ['discount_pct', 'INT']], items, 'Order lines. unit_price is the final selling price per unit after discount_pct.'),
      returns: T([['return_id', 'INT'], ['order_id', 'INT'], ['return_date', 'DATE'], ['reason', 'TEXT'], ['refund_amount', 'REAL']], returns, 'One row per returned order (status = Returned). Refund may be partial.')
    }
  });
})();

// ============ PAYMENTS (PayFlow — payment gateway) ============
(function () {
  R = mulberry32(202);
  const cats = ['Ecommerce', 'Education', 'Travel', 'Food', 'Gaming', 'SaaS'];
  const pre = ['Zip', 'Nova', 'Blue', 'Urban', 'Swift', 'Bright', 'Peak', 'Green', 'Pixel', 'Metro'];
  const suf = { Ecommerce: 'Mart', Education: 'Academy', Travel: 'Trips', Food: 'Kitchen', Gaming: 'Games', SaaS: 'Labs' };
  const merchants = [];
  for (let id = 1; id <= 50; id++) {
    const c = cats[(id - 1) % 6];
    merchants.push([id, `${pre[(id * 7) % 10]}${suf[c]} ${id}`, c, wpick(CITY_STATE, CITY_W)[0], fd(randDate('2021-01-01', '2024-08-31')), id % 5 === 0 ? 'Enterprise' : 'Standard']);
  }
  const mWeight = merchants.map(m => (m[5] === 'Enterprise' ? 6 : 1) * (0.3 + rnd() * 2));
  // merchants 47-50 go dormant in December
  const banks = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak'];
  const methods = ['UPI', 'Card', 'Netbanking', 'Wallet'];
  const base = { UPI: 0.93, Card: 0.88, Netbanking: 0.84, Wallet: 0.95 };
  const reasonsBy = { UPI: ['bank_timeout', 'user_dropped', 'insufficient_funds'], Card: ['risk_declined', 'insufficient_funds', 'otp_failed'], Netbanking: ['bank_timeout', 'user_dropped'], Wallet: ['insufficient_funds', 'user_dropped'] };
  const payments = []; let id = 500001;
  const start = D('2024-10-01');
  const amountFor = c => r2({ Ecommerce: 200 + rnd() * 4000, Education: 999 + rnd() * 20000, Travel: 1500 + rnd() * 25000, Food: 120 + rnd() * 900, Gaming: 49 + rnd() * 1500, SaaS: 499 + rnd() * 8000 }[c]);
  const raw = [];
  for (let day = 0; day < 92; day++) {
    const d = addDays(start, day);
    const n = Math.round(75 + rnd() * 25 + (day >= 31 && day < 45 ? 30 : 0));
    for (let k = 0; k < n; k++) {
      let m; do { m = wpick(merchants, mWeight); } while (m[0] >= 47 && d >= D('2024-12-01'));
      const ts = addMin(d, Math.floor(wpick([0, 6, 9, 12, 15, 18, 21], [1, 2, 4, 4, 4, 5, 4]) * 60 + rnd() * 180));
      raw.push([m, ts]);
    }
  }
  raw.sort((a, b) => a[1] - b[1]);
  for (const [m, ts] of raw) {
    const method = wpick(methods, [55, 25, 10, 10]);
    const bank = method === 'Wallet' ? null : wpick(banks, [30, 25, 25, 12, 8]);
    let p = base[method];
    const dstr = fd(ts);
    const incident = dstr === '2024-12-12' && (bank === 'HDFC' || bank === 'ICICI') && method === 'UPI';
    if (incident) p = 0.35;
    if (dstr === '2024-11-20' && method === 'Card') p = 0.55;
    const cust = ri(1, 1800);
    const amt = amountFor(m[2]);
    let status = rnd() < p ? 'success' : (rnd() < 0.08 ? 'pending' : 'failed');
    let reason = status === 'failed' ? (incident ? 'bank_timeout' : (dstr === '2024-11-20' && method === 'Card' ? 'otp_failed' : pick(reasonsBy[method]))) : null;
    payments.push([id++, m[0], cust, amt, method, bank, status, reason, fdt(ts)]);
    // retries after failure
    if (status === 'failed' && rnd() < 0.55) {
      const t2 = addMin(ts, ri(1, 14));
      const m2 = rnd() < 0.5 ? method : pick(methods);
      const b2 = m2 === 'Wallet' ? null : (m2 === method ? bank : pick(banks));
      const s2 = rnd() < 0.72 ? 'success' : 'failed';
      payments.push([id++, m[0], cust, amt, m2, b2, s2, s2 === 'failed' ? pick(reasonsBy[m2]) : null, fdt(t2)]);
    }
  }
  // planted card-testing fraud: a few customers hit many merchants within ~40 minutes
  for (const [cust, day, hh] of [[1901, '2024-10-18', 2], [1902, '2024-11-09', 3], [1903, '2024-12-03', 1], [1904, '2024-12-21', 4]]) {
    let t = addMin(D(day), hh * 60 + ri(0, 20));
    const ms = new Set(); while (ms.size < ri(4, 6)) ms.add(ri(1, 46));
    for (const mid of ms) { payments.push([0, mid, cust, r2(4999 + rnd() * 5000), 'Card', pick(banks), rnd() < 0.8 ? 'success' : 'failed', null, fdt(t)]); t = addMin(t, ri(3, 9)); }
    payments.filter(p => p[2] === cust && p[6] === 'failed').forEach(p => p[7] = 'risk_declined');
  }
  payments.sort((a, b) => a[8] < b[8] ? -1 : a[8] > b[8] ? 1 : a[0] - b[0]);
  payments.forEach((p, i) => p[0] = 500001 + i);
  const refunds = []; let rf = 9001;
  for (const p of payments) if (p[6] === 'success') {
    const m = merchants[p[1] - 1];
    const rate = m[2] === 'Travel' ? 0.14 : m[2] === 'Ecommerce' ? 0.07 : 0.025;
    if (rnd() < rate) {
      const full = rnd() < 0.7;
      const t = addMin(new Date(p[8].replace(' ', 'T') + 'Z'), ri(60 * 6, 60 * 24 * 12));
      if (t <= D('2025-01-05')) refunds.push([rf++, p[0], full ? p[3] : r2(p[3] * (0.2 + rnd() * 0.6)), rnd() < 0.9 ? 'processed' : 'pending', fdt(t)]);
    }
  }
  // settlements: T+2 for December payment days
  const settlements = []; let sid = 70001;
  const agg = {};
  for (const p of payments) if (p[6] === 'success' && p[8] >= '2024-12-01') { const k = p[1] + '|' + p[8].slice(0, 10); agg[k] = (agg[k] || 0) + p[3]; }
  const keys = Object.keys(agg).sort((a, b) => { const [ma, da] = a.split('|'), [mb, db] = b.split('|'); return da < db ? -1 : da > db ? 1 : ma - mb; });
  const skip = new Set(), wrong = new Set();
  while (skip.size < 4) skip.add(keys[ri(0, keys.length - 1)]);
  while (wrong.size < 7) { const k = keys[ri(0, keys.length - 1)]; if (!skip.has(k)) wrong.add(k); }
  for (const k of keys) {
    if (skip.has(k)) continue;
    const [mid, day] = k.split('|');
    const m = merchants[mid - 1];
    let gross = r2(agg[k]);
    if (wrong.has(k)) gross = r2(gross - pick([150, 499.5, 1000, 75.25, 2300]));
    const fee = r2(gross * (m[5] === 'Enterprise' ? 0.015 : 0.02));
    const tax = r2(fee * 0.18);
    settlements.push([sid++, +mid, fd(addDays(D(day), 2)), day, gross, fee, tax, r2(gross - fee - tax)]);
  }
  save('payments', {
    title: 'PayFlow — Payment Gateway', domain: 'Fintech / Payments',
    description: 'Payment-gateway data (Razorpay / PhonePe / Paytm style). Every payment attempt is a row — failed attempts are often retried by the same customer within minutes. Q4 2024 (Oct–Dec). Contains real-world incidents to investigate. Settlements are T+2 and exist for December payment dates only.',
    tables: {
      merchants: T([['merchant_id', 'INT'], ['merchant_name', 'TEXT'], ['category', 'TEXT'], ['city', 'TEXT'], ['onboarded_date', 'DATE'], ['pricing_plan', 'TEXT']], merchants, 'Merchants using the gateway. Fee: Standard 2%, Enterprise 1.5% (+18% GST on fee).'),
      payments: T([['payment_id', 'INT'], ['merchant_id', 'INT'], ['customer_id', 'INT'], ['amount', 'REAL'], ['method', 'TEXT'], ['bank', 'TEXT'], ['status', 'TEXT'], ['failure_reason', 'TEXT'], ['created_at', 'DATETIME']], payments, "One row per payment ATTEMPT. status in ('success','failed','pending'). bank is NULL for Wallet."),
      refunds: T([['refund_id', 'INT'], ['payment_id', 'INT'], ['refund_amount', 'REAL'], ['refund_status', 'TEXT'], ['created_at', 'DATETIME']], refunds, "Refunds against successful payments. refund_status in ('processed','pending'). Can be partial."),
      settlements: T([['settlement_id', 'INT'], ['merchant_id', 'INT'], ['settlement_date', 'DATE'], ['payment_date', 'DATE'], ['gross_amount', 'REAL'], ['fee', 'REAL'], ['tax', 'REAL'], ['net_amount', 'REAL']], settlements, 'T+2 payouts per merchant per payment_date (December only). gross_amount should equal that day\'s successful payment amount.')
    }
  });
})();

// ============ LENDING (NaviLoans — digital lender) ============
(function () {
  R = mulberry32(303);
  const asOf = D('2024-12-31');
  const borrowers = [], loans = [], emis = [], pays = [];
  for (let id = 1; id <= 420; id++) {
    const prof = wpick(['good', 'late', 'bad'], [68, 21, 11]);
    const cs = prof === 'good' ? ri(710, 860) : prof === 'late' ? ri(650, 770) : ri(560, 700);
    const emp = wpick(['Salaried', 'Self-employed'], [70, 30]);
    const inc = Math.round((emp === 'Salaried' ? 30000 + rnd() * 120000 : 20000 + rnd() * 180000) / 1000) * 1000;
    borrowers.push([id, name(), wpick(CITY_STATE, CITY_W)[0], ri(22, 58), emp, inc, cs, wpick(['App', 'Partner', 'Referral'], [60, 30, 10]), prof]);
  }
  let lid = 30001, pid = 1;
  for (const b of borrowers) {
    const nLoans = rnd() < 0.15 ? 2 : 1;
    for (let k = 0; k < nLoans; k++) {
      const product = wpick(['Personal', 'Two-Wheeler', 'Home'], [70, 22, 8]);
      const principal = product === 'Home' ? Math.round((1500000 + rnd() * 3500000) / 10000) * 10000 : product === 'Two-Wheeler' ? Math.round((60000 + rnd() * 90000) / 1000) * 1000 : Math.round((20000 + rnd() * 480000) / 5000) * 5000;
      const rate = product === 'Home' ? 8.5 + ri(0, 10) / 10 : product === 'Two-Wheeler' ? 11 + ri(0, 30) / 10 : 13 + ri(0, 100) / 10;
      const tenure = product === 'Home' ? 240 : pick(product === 'Two-Wheeler' ? [12, 24, 36] : [6, 12, 18, 24, 36]);
      const disb = randDate('2023-01-01', '2024-09-30');
      const r = rate / 1200; const emi = Math.round(principal * r * Math.pow(1 + r, tenure) / (Math.pow(1 + r, tenure) - 1));
      const loanId = lid++;
      const firstDue = new Date(Date.UTC(disb.getUTCFullYear(), disb.getUTCMonth() + 1, 5));
      let stopAfter = b[8] === 'bad' ? ri(0, 7) : 9999;
      let allPaid = true; let n = 0;
      for (let e = 1; e <= tenure; e++) {
        const due = addMonths(firstDue, e - 1);
        if (due > asOf) break;
        n = e;
        emis.push([loanId, e, fd(due), emi]);
        let paid = null;
        if (e <= stopAfter) {
          if (b[8] === 'good') paid = addDays(due, ri(-4, 2) + (rnd() < 0.05 ? ri(3, 12) : 0));
          else if (b[8] === 'late') paid = addDays(due, rnd() < 0.55 ? ri(-3, 2) : ri(4, 70));
          else paid = addDays(due, rnd() < 0.5 ? ri(-2, 3) : ri(5, 40));
        }
        if (paid && paid <= asOf) {
          if (rnd() < 0.04) { // partial payment then rest
            const part = Math.round(emi * (0.4 + rnd() * 0.4));
            pays.push([pid++, loanId, e, fd(paid), part, wpick(['Auto-debit', 'UPI', 'Cash'], [60, 30, 10])]);
            const p2 = addDays(paid, ri(3, 20));
            if (p2 <= asOf) pays.push([pid++, loanId, e, fd(p2), emi - part, 'UPI']); else allPaid = false;
          } else pays.push([pid++, loanId, e, fd(paid), emi, wpick(['Auto-debit', 'UPI', 'Cash'], [70, 25, 5])]);
        } else allPaid = false;
      }
      const status = n === tenure && allPaid ? 'Closed' : 'Active';
      loans.push([loanId, b[0], product, principal, rate, tenure, fd(disb), emi, status]);
    }
  }
  pays.sort((a, b) => a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[0] - b[0]);
  pays.forEach((p, i) => p[0] = 800001 + i);
  save('lending', {
    title: 'NaviLoans — Digital Lending', domain: 'Fintech / Lending',
    description: 'Digital lending book (Navi / Bajaj Finserv / KreditBee style). Loans disbursed 2023-01 → 2024-09, EMIs due on the 5th of every month, repayment ledger with late and partial payments, defaulters who stop paying. As-of date for all risk metrics: 2024-12-31. An EMI is "paid" only when the SUM of payments against it ≥ emi_amount.',
    tables: {
      borrowers: T([['borrower_id', 'INT'], ['borrower_name', 'TEXT'], ['city', 'TEXT'], ['age', 'INT'], ['employment_type', 'TEXT'], ['monthly_income', 'REAL'], ['credit_score', 'INT'], ['acquisition_channel', 'TEXT']], borrowers.map(b => b.slice(0, 8)), 'Borrower profile at application time.'),
      loans: T([['loan_id', 'INT'], ['borrower_id', 'INT'], ['product', 'TEXT'], ['principal', 'REAL'], ['annual_rate', 'REAL'], ['tenure_months', 'INT'], ['disbursal_date', 'DATE'], ['emi_amount', 'REAL'], ['loan_status', 'TEXT']], loans, 'One row per loan. Some borrowers hold 2 loans.'),
      emi_schedule: T([['loan_id', 'INT'], ['emi_no', 'INT'], ['due_date', 'DATE'], ['emi_amount', 'REAL']], emis, 'Only instalments that have fallen due on or before 2024-12-31.'),
      repayments: T([['payment_id', 'INT'], ['loan_id', 'INT'], ['emi_no', 'INT'], ['paid_date', 'DATE'], ['amount_paid', 'REAL'], ['mode', 'TEXT']], pays, 'Repayment ledger. An EMI can be paid in 2 parts (partial payments).')
    }
  });
})();

// ============ FOOD DELIVERY (QuickBite) ============
(function () {
  R = mulberry32(404);
  const cities = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune'];
  const cw = [30, 25, 22, 13, 10];
  const users = [];
  for (let id = 1; id <= 600; id++) users.push([id, wpick(cities, cw), fd(randDate('2023-06-01', '2024-12-15')), rnd() < 0.2 ? 1 : 0]);
  const cuisines = ['North Indian', 'South Indian', 'Chinese', 'Pizza', 'Biryani', 'Burgers', 'Desserts', 'Healthy'];
  const rn = ['Spice', 'Tandoor', 'Dosa', 'Wok', 'Slice', 'Dum', 'Patty', 'Sugar', 'Green', 'Royal', 'Urban', 'Masala'];
  const rs = ['House', 'Express', 'Corner', 'Kitchen', 'Hub', 'Point'];
  const restaurants = [];
  for (let id = 1; id <= 70; id++) restaurants.push([id, `${rn[id % 12]} ${rs[(id * 5) % 6]} #${id}`, cities[(id - 1) % 5], cuisines[(id * 3) % 8], r2(3.4 + rnd() * 1.5)]);
  const partners = [];
  for (let id = 1; id <= 90; id++) partners.push([id, cities[(id - 1) % 5], fd(randDate('2023-01-01', '2024-09-30')), wpick(['Bike', 'EV Scooter', 'Cycle'], [70, 22, 8])]);
  const orders = []; let oid = 1;
  const uw = users.map(() => wpick([0.2, 1, 3, 7], [30, 35, 25, 10]));
  const rr = {}; restaurants.forEach(r => (rr[r[2]] = rr[r[2]] || []).push(r));
  const pp = {}; partners.forEach(p => (pp[p[1]] = pp[p[1]] || []).push(p));
  const favs = {};
  const raw = [];
  for (let day = 0; day < 92; day++) {
    const d = addDays(D('2024-10-01'), day);
    const n = 48 + ri(0, 18) + ([5, 6].includes(d.getUTCDay()) ? 15 : 0);
    for (let k = 0; k < n; k++) {
      const u = wpick(users, uw.map((w, i) => (D(users[i][2]) <= d ? w : 0)));
      raw.push([u, d]);
    }
  }
  for (const [u, d] of raw) {
    const city = u[1];
    favs[u[0]] = favs[u[0]] || pick(rr[city]);
    const rest = rnd() < 0.35 ? favs[u[0]] : pick(rr[city]);
    const hour = wpick([8, 9, 11, 12, 13, 14, 16, 19, 20, 21, 22, 23], [2, 3, 4, 9, 10, 6, 4, 9, 12, 11, 6, 3]);
    const ts = addMin(d, hour * 60 + ri(0, 59));
    const value = r2(150 + rnd() * 900 + (rest[3] === 'Pizza' ? 200 : 0));
    const disc = rnd() < 0.3 ? r2(Math.min(value * 0.3, 150)) : 0;
    const fee = value > 499 ? 0 : 39;
    const partner = pick(pp[city]);
    let status = 'delivered', delivered = null, reason = null, rating = null;
    if (rnd() < 0.065) { status = 'cancelled'; reason = wpick(['Customer cancelled', 'Restaurant closed', 'No delivery partner', 'Payment failed'], [45, 20, 25, 10]); }
    else {
      const peak = [12, 13, 20, 21].includes(hour) ? ri(4, 14) : 0;
      const mins = Math.round(18 + rnd() * 22 + peak + (city === 'Bengaluru' ? 5 : 0) + (city === 'Mumbai' ? 3 : 0) + (rnd() < 0.06 ? ri(15, 40) : 0));
      delivered = fdt(addMin(ts, mins));
      if (rnd() < 0.55) rating = Math.max(1, Math.min(5, Math.round((mins > 45 ? 2.8 : 4.4) + (rnd() - 0.5) * 2)));
    }
    orders.push([oid++, u[0], rest[0], status === 'cancelled' && reason === 'No delivery partner' ? null : partner[0], fdt(ts), delivered, status, value, disc, fee, reason, rating]);
  }
  orders.sort((a, b) => a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : a[0] - b[0]);
  orders.forEach((o, i) => o[0] = 70001 + i);
  save('delivery', {
    title: 'QuickBite — Food Delivery', domain: 'Food delivery / Quick commerce',
    description: 'Food delivery marketplace (Swiggy / Zomato style), Oct–Dec 2024, 5 cities. Delivery time = delivered_at − ordered_at. Cancelled orders have no delivered_at; if no partner was found, partner_id is NULL.',
    tables: {
      users: T([['user_id', 'INT'], ['city', 'TEXT'], ['signup_date', 'DATE'], ['is_gold', 'INT']], users, 'is_gold = 1 if paid membership.'),
      restaurants: T([['restaurant_id', 'INT'], ['restaurant_name', 'TEXT'], ['city', 'TEXT'], ['cuisine', 'TEXT'], ['avg_rating', 'REAL']], restaurants),
      delivery_partners: T([['partner_id', 'INT'], ['city', 'TEXT'], ['joined_date', 'DATE'], ['vehicle', 'TEXT']], partners),
      food_orders: T([['order_id', 'INT'], ['user_id', 'INT'], ['restaurant_id', 'INT'], ['partner_id', 'INT'], ['ordered_at', 'DATETIME'], ['delivered_at', 'DATETIME'], ['status', 'TEXT'], ['order_value', 'REAL'], ['discount', 'REAL'], ['delivery_fee', 'REAL'], ['cancel_reason', 'TEXT'], ['rating', 'INT']], orders, "status in ('delivered','cancelled'). rating 1–5, NULL if not rated.")
    }
  });
})();

// ============ PRODUCT EVENTS (app analytics) ============
(function () {
  R = mulberry32(505);
  const users = [], events = [];
  for (let id = 1; id <= 450; id++) users.push([id, fd(randDate('2024-10-01', '2024-11-20')), wpick(['IN', 'US', 'AE', 'SG'], [70, 12, 10, 8]), wpick(['android', 'ios', 'web'], [60, 25, 15]), wpick(['organic', 'paid_ads', 'referral', 'influencer'], [40, 35, 15, 10])]);
  const end = D('2024-11-30');
  for (const u of users) {
    const s = D(u[1]);
    const engaged = wpick([0.05, 0.25, 0.55, 0.85], [30, 30, 28, 12]) * (u[4] === 'referral' ? 1.3 : u[4] === 'paid_ads' ? 0.8 : 1);
    const buyer = (u[3] === 'ios' ? 1.3 : u[3] === 'web' ? 0.7 : 1);
    let day = 0; let active = true;
    while (addDays(s, day) <= end) {
      const d = addDays(s, day);
      const isActive = day === 0 || rnd() < engaged;
      if (isActive) {
        const nSess = wpick([1, 2, 3], [65, 27, 8]);
        let hours = []; for (let k = 0; k < nSess; k++) hours.push(ri(7, 23)); hours.sort((a, b) => a - b);
        hours = [...new Set(hours)];
        for (const h of hours) {
          let t = addMin(d, h * 60 + ri(0, 25));
          const add = (e) => { events.push([0, u[0], fdt(t), e]); t = addMin(t, ri(1, 7)); t = new Date(t.getTime() + ri(0, 59) * 1000); };
          add('app_open');
          if (rnd() < 0.8) { add('search'); if (rnd() < 0.3) add('search'); }
          if (rnd() < 0.72) { add('view_product'); if (rnd() < 0.5) add('view_product');
            if (rnd() < 0.33 * buyer) { add('add_to_cart');
              if (rnd() < 0.62) { add('checkout'); if (rnd() < 0.8) add('purchase'); } } }
        }
      }
      day++;
      if (rnd() < 0.015) break;
    }
  }
  events.sort((a, b) => a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[1] - b[1]);
  events.forEach((e, i) => e[0] = i + 1);
  save('events', {
    title: 'ShopApp — Product Event Logs', domain: 'Product analytics',
    description: 'Clickstream / event logs from a shopping app (Meta / Amazon / Swiggy product-analytics style). Users signed up 2024-10-01 → 2024-11-20; events until 2024-11-30. Funnel: app_open → search → view_product → add_to_cart → checkout → purchase. No session_id is provided — you derive sessions yourself.',
    tables: {
      app_users: T([['user_id', 'INT'], ['signup_date', 'DATE'], ['country', 'TEXT'], ['platform', 'TEXT'], ['channel', 'TEXT']], users, 'Acquisition channel and platform captured at signup.'),
      events: T([['event_id', 'INT'], ['user_id', 'INT'], ['event_time', 'DATETIME'], ['event_name', 'TEXT']], events, 'Raw event log.')
    }
  });
})();

// ============ SUBSCRIPTIONS (StreamBox OTT / SaaS) ============
(function () {
  R = mulberry32(606);
  const plans = [[1, 'Basic', 199], [2, 'Standard', 499], [3, 'Premium', 799]];
  const subs = []; let sid = 1;
  for (let u = 1; u <= 320; u++) {
    let d = randDate('2024-01-01', '2024-11-30');
    let plan = wpick([1, 2, 3], [50, 35, 15]);
    const asOf = D('2024-12-31');
    while (true) {
      const months = ri(1, 9);
      let end = addMonths(d, months);
      const ev = wpick(['cancel', 'upgrade', 'downgrade', 'stay'], [35, 15, 8, 42]);
      if (end > asOf || ev === 'stay') { subs.push([sid++, u, plan, fd(d), null]); break; }
      subs.push([sid++, u, plan, fd(d), fd(end)]);
      if (ev === 'cancel') {
        if (rnd() < 0.25) { d = addDays(end, ri(20, 90)); if (d > asOf) break; plan = wpick([1, 2], [60, 40]); continue; }
        break;
      }
      if (ev === 'upgrade') plan = Math.min(3, plan + 1); else plan = Math.max(1, plan - 1);
      d = end;
    }
  }
  subs.sort((a, b) => a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[0] - b[0]);
  subs.forEach((s, i) => s[0] = i + 1);
  save('subscriptions', {
    title: 'StreamBox — Subscriptions', domain: 'Subscription / SaaS / OTT',
    description: 'Subscription periods for an OTT / SaaS product in 2024. Each row is a continuous period on ONE plan. A plan change ends the row and starts a new one on the same date. end_date NULL = still active on 2024-12-31. A period [start_date, end_date) is active on day d when start_date ≤ d < end_date.',
    tables: {
      plans: T([['plan_id', 'INT'], ['plan_name', 'TEXT'], ['monthly_price', 'REAL']], plans),
      subscriptions: T([['sub_id', 'INT'], ['user_id', 'INT'], ['plan_id', 'INT'], ['start_date', 'DATE'], ['end_date', 'DATE']], subs)
    }
  });
})();

// ============ HR (classic company) ============
(function () {
  R = mulberry32(707);
  const depts = [[10, 'Engineering', 'Bengaluru'], [20, 'Analytics', 'Bengaluru'], [30, 'Sales', 'Mumbai'], [40, 'Finance', 'Mumbai'], [50, 'HR', 'Delhi'], [60, 'Legal', 'Delhi']];
  const E = [];
  const add = (id, nm, dept, mgr, title, sal, hire, g) => E.push([id, nm, dept, mgr, title, sal, hire, g]);
  add(1, 'Rajesh Kumar', null, null, 'CEO', 900000, '2015-04-01', 'M');
  add(2, 'Anita Desai', 10, 1, 'VP Engineering', 520000, '2016-02-15', 'F');
  add(3, 'Suresh Menon', 20, 1, 'Head of Analytics', 450000, '2017-07-01', 'M');
  add(4, 'Farah Khan', 30, 1, 'VP Sales', 480000, '2016-09-10', 'F');
  add(5, 'Gopal Iyer', 40, 1, 'CFO', 500000, '2015-11-20', 'M');
  add(6, 'Lata Joshi', 50, 1, 'HR Head', 300000, '2018-01-05', 'F');
  let id = 7;
  const plan = [[10, 2, ['Engineering Manager', 2], ['Senior Engineer', 5], ['Software Engineer', 7]], [20, 3, ['Analytics Manager', 1], ['Senior Data Scientist', 3], ['Data Analyst', 5]], [30, 4, ['Sales Manager', 2], ['Account Executive', 6]], [40, 5, ['Finance Manager', 1], ['Accountant', 3]], [50, 6, ['HR Executive', 3]]];
  const salBand = { 'Engineering Manager': [280000, 340000], 'Senior Engineer': [200000, 260000], 'Software Engineer': [120000, 180000], 'Analytics Manager': [260000, 300000], 'Senior Data Scientist': [190000, 240000], 'Data Analyst': [90000, 140000], 'Sales Manager': [220000, 260000], 'Account Executive': [80000, 150000], 'Finance Manager': [230000, 260000], 'Accountant': [70000, 110000], 'HR Executive': [60000, 90000] };
  for (const [dept, head, ...roles] of plan) {
    let managers = [head];
    for (const [title, n] of roles) {
      const newIds = [];
      for (let k = 0; k < n; k++) {
        const [lo, hi] = salBand[title];
        let sal = Math.round((lo + rnd() * (hi - lo)) / 5000) * 5000;
        const mgr = title.includes('Manager') ? head : managers[k % managers.length];
        add(id, name(), dept, mgr, title, sal, fd(randDate('2018-01-01', '2024-06-30')), rnd() < 0.42 ? 'F' : 'M');
        newIds.push(id++);
      }
      if (title.includes('Manager')) managers = newIds;
    }
  }
  // ties for dense rank questions + an employee earning more than manager
  E.find(e => e[4] === 'Software Engineer')[5] = E.filter(e => e[4] === 'Senior Engineer')[0][5];
  const se = E.filter(e => e[4] === 'Data Analyst'); se[0][5] = se[1][5];
  const ae = E.filter(e => e[4] === 'Account Executive'); ae[0][5] = 265000; // earns more than sales manager
  const acc = E.filter(e => e[4] === 'Accountant'); acc[0][5] = 255000;
  const hist = [];
  for (const e of E) {
    let s = Math.round(e[5] * 0.78 / 1000) * 1000; let d = D(e[6]);
    const changes = [];
    while (true) { changes.push([fd(d), s]); d = addMonths(d, 12); if (d > D('2024-07-01')) break; s = Math.round(s * (1.06 + rnd() * 0.08) / 1000) * 1000; }
    changes[changes.length - 1][1] = e[5];
    for (const [dd, ss] of changes) hist.push([e[0], dd, ss]);
  }
  save('hr', {
    title: 'Acme Corp — HR', domain: 'HR / Org (classic)',
    description: 'Classic employees–departments–salary schema used by most "Top-N per group", "self join" and "hierarchy" questions. The CEO has dept_id NULL and manager_id NULL. Legal department has no employees.',
    tables: {
      departments: T([['dept_id', 'INT'], ['dept_name', 'TEXT'], ['location', 'TEXT']], depts),
      employees: T([['emp_id', 'INT'], ['emp_name', 'TEXT'], ['dept_id', 'INT'], ['manager_id', 'INT'], ['job_title', 'TEXT'], ['salary', 'REAL'], ['hire_date', 'DATE'], ['gender', 'TEXT']], E, 'salary = current monthly salary (INR).'),
      salary_history: T([['emp_id', 'INT'], ['effective_date', 'DATE'], ['salary', 'REAL']], hist, 'Salary revisions. The last row per employee = current salary.')
    }
  });
})();

// ============ RIDES (RideNow) ============
(function () {
  R = mulberry32(808);
  const cities = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad'];
  const riders = [], drivers = [], trips = [];
  for (let id = 1; id <= 350; id++) riders.push([id, cities[ri(0, 3)], fd(randDate('2022-01-01', '2024-10-15')), rnd() < 0.06 ? 'Yes' : 'No']);
  for (let id = 1; id <= 120; id++) drivers.push([id, cities[(id - 1) % 4], fd(randDate('2021-01-01', '2024-09-30')), wpick(['Mini', 'Sedan', 'Auto', 'Bike'], [35, 25, 25, 15]), rnd() < 0.05 ? 'Yes' : 'No']);
  const dByCity = {}; drivers.forEach(d => (dByCity[d[1]] = dByCity[d[1]] || []).push(d));
  let tid = 1; const rw = riders.map(() => wpick([0.3, 1, 3], [30, 50, 20]));
  for (let day = 0; day < 61; day++) {
    const d = addDays(D('2024-10-01'), day);
    const n = 40 + ri(0, 20);
    for (let k = 0; k < n; k++) {
      const r = wpick(riders, rw.map((w, i) => (D(riders[i][2]) <= d ? w : 0)));
      const city = rnd() < 0.92 ? r[1] : cities[ri(0, 3)];
      const dr = pick(dByCity[city]);
      const hour = wpick([7, 8, 9, 10, 13, 17, 18, 19, 20, 22, 23], [4, 9, 10, 5, 4, 7, 10, 10, 7, 4, 3]);
      const ts = addMin(d, hour * 60 + ri(0, 59));
      const surge = [8, 9, 18, 19].includes(hour) && rnd() < 0.5 ? pick([1.2, 1.5, 1.8]) : 1.0;
      let st = wpick(['completed', 'cancelled_by_rider', 'cancelled_by_driver'], [82, 10, 8]);
      if (surge > 1.4 && rnd() < 0.15) st = 'cancelled_by_rider';
      const dist = r2(1.5 + rnd() * 18);
      const base = { Mini: 12, Sedan: 16, Auto: 10, Bike: 7 }[dr[3]];
      const fare = st === 'completed' ? r2((40 + dist * base) * surge) : null;
      const rating = st === 'completed' && rnd() < 0.7 ? wpick([1, 2, 3, 4, 5], [2, 3, 10, 35, 50]) : null;
      trips.push([0, r[0], dr[0], city, fdt(ts), st, dist, surge, fare, rating]);
    }
  }
  trips.sort((a, b) => a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : 0);
  trips.forEach((t, i) => t[0] = 900001 + i);
  save('rides', {
    title: 'RideNow — Ride Hailing', domain: 'Mobility (Uber / Ola)',
    description: 'Ride-hailing trips Oct–Nov 2024 (Uber / Ola / Rapido style). Riders and drivers can be banned. Cancelled trips have NULL fare.',
    tables: {
      riders: T([['rider_id', 'INT'], ['home_city', 'TEXT'], ['signup_date', 'DATE'], ['banned', 'TEXT']], riders),
      drivers: T([['driver_id', 'INT'], ['city', 'TEXT'], ['joined_date', 'DATE'], ['vehicle_type', 'TEXT'], ['banned', 'TEXT']], drivers),
      trips: T([['trip_id', 'INT'], ['rider_id', 'INT'], ['driver_id', 'INT'], ['city', 'TEXT'], ['requested_at', 'DATETIME'], ['status', 'TEXT'], ['distance_km', 'REAL'], ['surge_multiplier', 'REAL'], ['fare', 'REAL'], ['rider_rating', 'INT']], trips, "status in ('completed','cancelled_by_rider','cancelled_by_driver').")
    }
  });
})();
