// Ledra web · core logic. No browser or Firebase code in here, so it can be tested on its own.
// Record shapes are exactly the JSON the phone app writes (see AppState.kt), so both sides read each other.

export const KIND_COLLECT = 'collect';
export const KIND_PAY = 'pay';
export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank', 'Cheque', 'Other'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DEFAULT_SETTINGS = {
  billingDay: 1, dueDay: 5, currency: '₹', charges: [],
  showEmail: true, showAddress: true, showIdNote: true, showNotes: true,
  fundDefaultDirection: 'collect', fundDefaultMode: 'Cash',
  employeeDefaultBasis: 'Monthly', employeeDefaultWorkingDays: 30
};

export const DEFAULT_SHOP = {
  name: 'My Shop', address: '', phone: '', gstin: '', prefix: 'INV-',
  taxInclusive: true, footer: 'Thank you! Visit again.', paper: 'a4', units: ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'dozen']
};

/* ---------------- ids, numbers, text ---------------- */

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const pad = n => String(n).padStart(2, '0');
export const round2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
export const fmt = x => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(x);
export const money = (sym, x) => (x < -0.004 ? '-' : '') + sym + fmt(Math.abs(x));
export const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
export const sum = (list, f = x => x) => list.reduce((a, b) => a + f(b), 0);

/* ---------------- dates ("YYYY-MM-DD") and months ----------------
 * A month is kept as one integer: year * 12 + (month - 1). That makes "next month" just +1. */

export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const parseDate = s => { const [y, m, d] = String(s).split('-').map(Number); return { y, m, d }; };
export const dateText = s => { if (!s) return ''; const { y, m, d } = parseDate(s); return `${pad(d)} ${MONTHS[m - 1]} ${y}`; };
export const ym = (y, m) => y * 12 + (m - 1);
export const ymOfDate = s => { const { y, m } = parseDate(s); return ym(y, m); };
export const ymFromStr = s => { const [y, m] = String(s).split('-').map(Number); return ym(y, m); };
export const ymStr = i => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
export const monthText = i => `${MONTHS[((i % 12) + 12) % 12]} ${Math.floor(i / 12)}`;
export const daysInMonth = i => new Date(Math.floor(i / 12), (i % 12) + 1, 0).getDate();
export const ymDate = (i, day) => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}-${pad(day)}`;
export const addDays = (s, n) => { const { y, m, d } = parseDate(s); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };

/* ---------------- people billing (port of Billing.kt) ---------------- */

export const cycleMonthOf = (dateStr, billingDay) => {
  const { y, m, d } = parseDate(dateStr);
  const i = ym(y, m);
  return d >= billingDay ? i : i - 1;
};

export const isActive = (p, today = todayStr()) => !p.end || p.end >= today;
export const firstMonth = (p, s) => cycleMonthOf(p.billingStart || p.start, s.billingDay);

export function lastMonth(p, s, today) {
  if (p.end) return cycleMonthOf(p.end, s.billingDay);
  const cur = cycleMonthOf(today, s.billingDay);
  return p.arrears ? cur - 1 : cur;
}

export function dueDateOf(month, p, s) {
  let base = p.arrears ? month + 1 : month;
  if (s.dueDay < s.billingDay) base += 1;
  return ymDate(base, Math.min(s.dueDay, daysInMonth(base)));
}

export const monthlyDue = p => sum(p.charges || [], c => c.amount);

/** Month by month: what is due, what was paid, what is left. Same rules as the phone app. */
export function summarize(person, payments, s, today = todayStr()) {
  const first = firstMonth(person, s);
  const last = lastMonth(person, s, today);
  const monthly = monthlyDue(person);
  const active = !person.end;
  const dueFor = m => (m >= first && m <= last ? monthly : 0);
  const slices = new Map();
  const paid = new Map();
  const put = (m, pay, amount) => {
    if (!slices.has(m)) slices.set(m, []);
    slices.get(m).push({ payment: pay, amount });
    paid.set(m, (paid.get(m) || 0) + amount);
  };

  let from = first, to = last;
  for (const p of payments) {
    if (!p.month) continue;
    const m = ymFromStr(p.month);
    put(m, p, p.amount);
    if (m < from) from = m;
    if (m > to) to = m;
  }

  const auto = payments.filter(p => !p.month)
    .sort((a, b) => (a.paidOn < b.paidOn ? -1 : a.paidOn > b.paidOn ? 1 : (a.created || 0) - (b.created || 0)));
  for (const p of auto) {
    let rest = p.amount;
    let m = first;
    let guard = 0;
    while (rest > 0.004 && guard < 600) {
      const room = m > last
        ? (active ? Math.max(monthly - (paid.get(m) || 0), 0) : 0)
        : Math.max(dueFor(m) - (paid.get(m) || 0), 0);
      const take = Math.min(rest, room);
      if (take > 0.004) { put(m, p, take); rest -= take; if (m > to) to = m; }
      if (m > last && (!active || monthly <= 0.004)) break;
      m += 1; guard += 1;
    }
    if (rest > 0.004) {
      const m2 = last < first ? first : last;
      put(m2, p, rest);
      if (m2 > to) to = m2;
    }
  }

  const rows = [];
  for (let m = from; m <= to; m++) {
    const list = (slices.get(m) || []).slice().sort((a, b) => (a.payment.paidOn < b.payment.paidOn ? -1 : a.payment.paidOn > b.payment.paidOn ? 1 : 0));
    const p = sum(list, x => x.amount);
    const d = dueFor(m);
    rows.push({ month: m, due: d, paid: p, balance: d - p, dueDate: dueDateOf(m, person, s), slices: list });
  }
  const totalDue = sum(rows, r => r.due);
  const totalPaid = sum(rows, r => r.paid);
  return { rows, totalDue, totalPaid, left: totalDue - totalPaid };
}

/** [label, tone] for one billing month. Tones: good, bad, warn, neutral. */
export function rowStatus(r, today = todayStr()) {
  const overdue = r.balance > 0.005 && r.dueDate < today;
  if (r.due <= 0.005 && r.paid > 0) return ['Advance', 'good'];
  if (r.due > 0 && r.balance <= 0.005) return ['Paid', 'good'];
  if (r.paid > 0) return [overdue ? 'Partial, overdue' : 'Partial', 'warn'];
  if (r.due > 0) return overdue ? ['Overdue', 'bad'] : ['Unpaid', 'neutral'];
  return ['—', 'neutral'];
}

/* ---------------- funds ---------------- */

/** Newest month first. Inside a month each source appears once, with its payments under it. */
export function fundMonths(entries, sources) {
  const byMonth = new Map();
  for (const e of entries) {
    const m = ymOfDate(e.date);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(e);
  }
  return [...byMonth.keys()].sort((a, b) => b - a).map(m => {
    const list = byMonth.get(m);
    const groups = new Map();
    for (const e of list) {
      if (!groups.has(e.contributorId)) groups.set(e.contributorId, []);
      groups.get(e.contributorId).push(e);
    }
    const rows = [...groups.entries()].map(([id, pays]) => {
      pays.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created || 0) - (b.created || 0)));
      return { id, name: (sources.find(s => s.id === id) || {}).name || 'Source', total: sum(pays, p => p.amount), pays };
    }).sort((a, b) => (a.pays[0].date < b.pays[0].date ? -1 : a.pays[0].date > b.pays[0].date ? 1 : a.name.localeCompare(b.name)));
    return { month: m, total: sum(list, e => e.amount), count: list.length, rows };
  });
}

/* ---------------- employees ---------------- */

export function monthlyExpected(e, att) {
  switch (e.basis) {
    case 'Daily': return Math.max(att ? att.present : e.workingDays, 0) * e.rate;
    case 'Yearly': return e.rate / 12;
    case 'Work / Project': return e.rate;
    default: {
      const absent = att ? Math.max(att.notPresent, 0) : 0;
      const work = Math.max(e.workingDays, 1);
      return e.rate * Math.max(work - absent, 0) / work;
    }
  }
}

export const payMonth = p => (p.month ? ymFromStr(p.month) : ymOfDate(p.date));

/** Months with a payment or attendance record, plus the current cycle. Newest first. */
export function employeeMonths(e, attendance, payments, cycle) {
  const mine = payments.filter(p => p.employeeId === e.id);
  const att = attendance.filter(a => a.employeeId === e.id);
  const months = new Set([cycle]);
  mine.forEach(p => months.add(payMonth(p)));
  att.forEach(a => months.add(ymFromStr(a.month)));
  return [...months].sort((a, b) => b - a).map(m => {
    const pays = mine.filter(p => payMonth(p) === m)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created || 0) - (b.created || 0)));
    const a = att.find(x => ymFromStr(x.month) === m) || null;
    const expected = e.basis === 'Work / Project' ? null : monthlyExpected(e, a);
    const paid = sum(pays, p => p.amount);
    return { month: m, expected, paid, pays, attendance: a, pending: Math.max((expected || 0) - paid, 0) };
  });
}

export function employeeStatus(m, cycle) {
  const exp = m.expected;
  if (exp == null) return m.paid > 0 ? ['Recorded', 'good'] : ['—', 'neutral'];
  if (exp <= 0.005) return m.paid > 0 ? ['Advance', 'good'] : ['—', 'neutral'];
  if (m.paid > exp + 0.005) return ['Advance', 'good'];
  if (m.paid >= exp - 0.005) return ['Paid', 'good'];
  if (m.paid > 0) return ['Partial', 'warn'];
  return m.month < cycle ? ['Unpaid', 'bad'] : ['Unpaid', 'neutral'];
}

/* ---------------- invoices (grocery billing) ---------------- */

/**
 * items: [{ qty, rate, discPct, taxPct }]. discount is a flat amount off the whole bill.
 * inclusive = prices already contain tax (normal for grocery MRP). The bill discount is
 * spread over every line first, so tax is always worked out on what the customer really pays.
 */
export function calcInvoice(items, discount, inclusive, roundOn = true) {
  const gross = items.map(it => Math.max(num(it.qty) * num(it.rate), 0) * (1 - Math.min(Math.max(num(it.discPct), 0), 100) / 100));
  const subtotal = sum(gross);
  const disc = Math.min(Math.max(num(discount), 0), subtotal);
  const f = subtotal > 0 ? 1 - disc / subtotal : 1;
  let taxable = 0, tax = 0, total = 0;
  const lines = items.map((it, i) => {
    const g = gross[i] * f;
    const t = Math.max(num(it.taxPct), 0) / 100;
    const base = inclusive ? g / (1 + t) : g;
    const tx = inclusive ? g - base : g * t;
    taxable += base; tax += tx; total += base + tx;
    return { amount: gross[i], base, tax: tx, total: base + tx };
  });
  const rounded = roundOn ? Math.round(total) : round2(total);
  return {
    lines, subtotal: round2(subtotal), discount: round2(disc), taxable: round2(taxable), tax: round2(tax),
    roundOff: round2(rounded - total), total: rounded
  };
}

export function nextInvoiceNo(invoices, prefix) {
  let max = 0;
  for (const inv of invoices) {
    const m = String(inv.no || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return prefix + String(max + 1).padStart(4, '0');
}

export const invoiceDue = inv => Math.max(round2((inv.total || 0) - (inv.paid || 0)), 0);
