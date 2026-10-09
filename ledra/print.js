// Ledra web · printable documents. "Print" in the browser also lets you Save as PDF.
// Footer is deliberately plain: record name + date on the left, printed date in the right corner.

import {
  money, fmt, dateText, monthText, todayStr, rowStatus, fundMonths, employeeStatus, monthlyDue, ymFromStr, calcInvoice, invoiceDue
} from './core.js';
import { esc } from './ui.js';

const CSS = `
*{box-sizing:border-box}html,body{margin:0}
body{font:13px/1.45 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0E1726;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:12mm 12mm 22mm}
.hero{background:linear-gradient(120deg,#0B5FFF,#0A3FB8);color:#fff;border-radius:14px;padding:14px 22px 16px;margin-bottom:16px;position:relative;overflow:hidden}
.hero .top{text-align:right;font-size:12px;opacity:.92}
.hero h1{margin:6px 0 4px;font-size:28px;line-height:1.1}.hero .meta{font-size:12.5px;opacity:.92}
h2{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#0B5FFF;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid #DFE7F1}
.stats{display:flex;gap:10px}.stat{flex:1;background:#F3F6FB;border-radius:10px;padding:10px 12px;border-left:4px solid var(--c,#0E1726)}
.stat span{display:block;font-size:10.5px;color:#5B6B7F}.stat b{font-size:17px;color:var(--c,#0E1726)}
.good{--c:#12A150}.bad{--c:#E5484D}.blue{--c:#0B5FFF}.warn{--c:#D97706}
.bar{height:7px;background:#E8F0FF;border-radius:4px;margin:10px 0 0;overflow:hidden}.bar i{display:block;height:100%;background:#0B5FFF}
.cap{font-size:11px;color:#5B6B7F;margin-top:8px}
.kv{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px}.kv div span{display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#5B6B7F}.kv div b{font-weight:500}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#0E1726;color:#fff;text-align:left;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:7px 8px}
th:first-child{border-radius:7px 0 0 7px}th:last-child{border-radius:0 7px 7px 0}
td{padding:7px 8px;vertical-align:top}.r{text-align:right}.mut{color:#5B6B7F}
tr.m td{border-top:1px solid #DFE7F1;font-weight:600}tr.m:nth-child(odd) td{background:#F3F6FB}
tr.s td{font-size:11px;color:#5B6B7F;padding-top:2px;padding-bottom:3px}tr.s td:first-child{padding-left:20px}
tr.s td:first-child:before{content:"";display:inline-block;width:5px;height:5px;border-radius:50%;background:#0B5FFF;margin-right:7px;vertical-align:middle}
tr.mh td{background:#E8F0FF;font-weight:700;padding:8px;border-radius:0}tr.tot td{background:#E8F0FF;font-weight:700}
tr{break-inside:avoid}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap}
.pill.good{background:#E3F6EA;color:#12A150}.pill.bad{background:#FDEBEC;color:#E5484D}.pill.warn{background:#FEF1DC;color:#D97706}.pill.neutral{background:#EAEFF6;color:#5B6B7F}
.gc{color:#12A150}.rc{color:#E5484D}
.foot{position:fixed;left:0;right:0;bottom:-15mm;font-size:10px;color:#5B6B7F;border-top:1px solid #DFE7F1;padding-top:6px}
.foot .row{display:flex;justify-content:space-between}.foot .brand{text-align:center;font-weight:600;margin-top:3px}
`;

export function printHTML(title, body, extraCss = '') {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}${extraCss}</style></head><body>${body}</body></html>`);
  d.close();
  const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 60000); } };
  if (f.contentWindow.document.readyState === 'complete') setTimeout(go, 150); else f.onload = () => setTimeout(go, 150);
}

const BRAND = 'Ledra · Payment records';
const hero = (kind, name, chips) => `<div class="hero"><div class="top">${esc(dateText(todayStr()))}</div><h1>${esc(name)}</h1><div class="meta">${chips.filter(Boolean).map(esc).join('  ·  ')}</div></div>`;
const footer = left => `<div class="foot"><div class="row"><span>${esc(left)}</span><span>Printed ${esc(dateText(todayStr()))}</span></div><div class="brand">${BRAND}</div></div>`;
const stats = list => `<div class="stats">${list.map(([l, v, t]) => `<div class="stat ${t || ''}"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
const kv = pairs => `<div class="kv">${pairs.filter(p => p[1]).map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
const bar = (f, cap) => `<div class="bar"><i style="width:${Math.round(Math.min(Math.max(f, 0), 1) * 100)}%"></i></div><div class="cap">${esc(cap)}</div>`;
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pillOf = ([label, tone]) => `<span class="pill ${tone}">${esc(label)}</span>`;

/* ---------------- person ---------------- */

export function printPerson(person, summary, s) {
  const sym = s.currency, today = todayStr();
  const left = summary.left;
  const rows = summary.rows.map(r => {
    const bal = r.balance;
    const one = r.slices.length === 1 ? r.slices[0].payment : null;
    return `<tr class="m"><td>${esc(monthText(r.month))}</td><td class="r">${sym}${fmt(r.due)}</td><td class="r">${sym}${fmt(r.paid)}</td>
      <td class="r ${bal > 0.005 ? 'rc' : 'gc'}">${bal > 0.005 ? sym + fmt(bal) : bal < -0.005 ? '+' + sym + fmt(-bal) : sym + '0'}</td>
      <td>${one ? esc(dateText(one.paidOn)) : r.slices.length ? `<span class="mut">${pl(r.slices.length, 'payment')}</span>` : '—'}</td>
      <td>${one ? esc(one.mode) : ''}</td><td>${pillOf(rowStatus(r, today))}</td></tr>` +
      (r.slices.length >= 2 ? r.slices.map((sl, i) => `<tr class="s"><td>payment ${i + 1}</td><td></td><td class="r">${sym}${fmt(sl.amount)}</td><td></td><td>${esc(dateText(sl.payment.paidOn))}</td><td>${esc(sl.payment.mode)}</td><td></td></tr>`).join('') : '');
  }).join('');
  const dueT = summary.totalDue, paidT = summary.totalPaid;
  const body = hero('Payment records', person.name, [person.kind === 'pay' ? 'I pay' : 'I collect', person.phone, 'Since ' + dateText(person.start), person.end ? 'Ended ' + dateText(person.end) : 'Active']) +
    '<h2>Summary</h2>' + stats([['Total due', money(sym, dueT)], ['Total paid', money(sym, paidT), 'good'], [left < -0.005 ? 'Advance' : 'Balance left', money(sym, Math.abs(left)), left > 0.005 ? 'bad' : 'good']]) +
    (dueT > 0.005 ? bar(paidT / dueT, `Paid ${Math.round(Math.min(paidT / dueT, 1) * 100)}% of the amount due`) : '') +
    '<h2>Details</h2>' + kv([
      ['Type', person.kind === 'pay' ? 'I pay' : 'I collect'], ['Status', person.end ? 'Ended on ' + dateText(person.end) : 'Active'],
      ['Phone', person.phone], ['Email', person.email], ['Start date', dateText(person.start)],
      ['Billing from', person.billingStart ? dateText(person.billingStart) : 'Same as start date'],
      ['Billed', person.arrears ? 'After the month ends' : 'At the start of the month'],
      ['Billing day', `Day ${s.billingDay} of every month`], ['Payment day', `Day ${s.dueDay} of every month`],
      ['Address', person.address], ['ID note', person.idNote], ['Notes', person.notes]
    ]) +
    ((person.charges || []).length ? '<h2>Fixed charges</h2>' + kv([...person.charges.map(c => [c.name, money(sym, c.amount) + ' per month']), ['Monthly total', money(sym, monthlyDue(person))]]) : '') +
    '<h2>Payment history</h2>' + (rows ? `<table><thead><tr><th>Month</th><th class="r">Due</th><th class="r">Paid</th><th class="r">Balance</th><th>Paid on</th><th>Mode</th><th>Status</th></tr></thead><tbody>${rows}
      <tr class="tot"><td>Total</td><td class="r">${sym}${fmt(dueT)}</td><td class="r gc">${sym}${fmt(paidT)}</td><td class="r ${left > 0.005 ? 'rc' : 'gc'}">${sym}${fmt(Math.max(left, 0))}</td><td colspan="3"></td></tr></tbody></table>` : '<p class="mut">No billing months yet.</p>') +
    footer(`${person.name} · ${dateText(person.start)} to ${person.end ? dateText(person.end) : 'present'}`);
  printHTML(`${person.name} - payment records`, body);
}

/* ---------------- fund ---------------- */

export function printFund(fund, sources, entries, s) {
  const sym = s.currency;
  const total = entries.reduce((a, e) => a + e.amount, 0);
  const target = fund.target;
  const leftAmt = target ? Math.max(target - total, 0) : 0;
  const accent = fund.direction === 'collect' ? 'good' : 'blue';
  const months = fundMonths(entries, sources);
  const bySource = sources.map(src => {
    const mine = entries.filter(e => e.contributorId === src.id);
    return { src, count: mine.length, sum: mine.reduce((a, e) => a + e.amount, 0) };
  }).sort((a, b) => b.sum - a.sum);
  const srcRows = bySource.map(b => `<tr class="m"><td>${esc(b.src.name)}</td><td class="r">${b.count}</td><td class="r">${sym}${fmt(b.sum)}</td><td style="width:120px"><div class="bar" style="margin:0"><i style="width:${total > 0 ? Math.round(b.sum / total * 100) : 0}%"></i></div></td><td class="r mut">${total > 0 ? Math.round(b.sum / total * 100) : 0}%</td></tr>`).join('');
  const monthRows = months.map(mg => `<tr class="mh"><td>${esc(monthText(mg.month))}</td><td class="mut">${pl(mg.count, 'payment')} · ${pl(mg.rows.length, 'source')}</td><td></td><td class="r ${accent === 'good' ? 'gc' : ''}">${sym}${fmt(mg.total)}</td></tr>` +
    mg.rows.map(g => {
      if (g.pays.length === 1) {
        const e = g.pays[0];
        return `<tr class="m"><td>${esc(g.name)}${e.note ? `<div class="mut" style="font-weight:400;font-size:11px">${esc(e.note)}</div>` : ''}</td><td>${esc(dateText(e.date))}</td><td>${esc(e.mode)}</td><td class="r">${sym}${fmt(e.amount)}</td></tr>`;
      }
      return `<tr class="m"><td>${esc(g.name)}</td><td class="mut" style="font-weight:400">${pl(g.pays.length, 'payment')}</td><td></td><td class="r">${sym}${fmt(g.total)}</td></tr>` +
        g.pays.map((e, i) => `<tr class="s"><td>payment ${i + 1}${e.note ? ' · ' + esc(e.note) : ''}</td><td>${esc(dateText(e.date))}</td><td>${esc(e.mode)}</td><td class="r">${sym}${fmt(e.amount)}</td></tr>`).join('');
    }).join('')).join('');
  const dates = entries.map(e => e.date).sort();
  const body = hero('Fund records', fund.name, [fund.direction === 'collect' ? 'Collection fund' : 'Payment fund', 'Started ' + dateText(fund.start)]) +
    '<h2>Summary</h2>' + stats([
      [fund.direction === 'collect' ? 'Collected' : 'Recorded', money(sym, total), accent],
      ...(target ? [['Target', money(sym, target)], ['Balance left', money(sym, leftAmt), leftAmt > 0.005 ? 'bad' : 'good']] : [['Sources', String(sources.length)]]),
      ['Payments', String(entries.length)]
    ]) +
    (target ? bar(total / target, `${Math.round(Math.min(total / target, 1) * 100)}% of the target reached`) : '') +
    '<h2>Fund details</h2>' + kv([
      ['Type', fund.direction === 'collect' ? 'Collection fund' : 'Payment fund'], ['Started', dateText(fund.start)],
      ['Sources', String(sources.length)], ['First payment', dates[0] ? dateText(dates[0]) : ''],
      ['Latest payment', dates.length ? dateText(dates[dates.length - 1]) : ''], ['Notes', fund.notes]
    ]) +
    (srcRows ? `<h2>By source</h2><table><thead><tr><th>Source</th><th class="r">Payments</th><th class="r">Total</th><th colspan="2">Share</th></tr></thead><tbody>${srcRows}</tbody></table>` : '') +
    '<h2>Payment history</h2>' + (monthRows ? `<table><thead><tr><th>Source</th><th>Paid on</th><th>Method</th><th class="r">Amount</th></tr></thead><tbody>${monthRows}</tbody></table>` : '<p class="mut">No entries yet.</p>') +
    footer(`${fund.name} · started ${dateText(fund.start)}`);
  printHTML(`${fund.name} - fund records`, body);
}

/* ---------------- employee ---------------- */

export function printEmployee(e, months, cycle, allPaid, s) {
  const sym = s.currency;
  const cur = months.find(m => m.month === cycle);
  const expected = cur && cur.expected != null ? cur.expected : e.rate;
  const paid = cur ? cur.paid : 0;
  const pending = Math.max(expected - paid, 0);
  const rows = months.map(m => `<tr class="m"><td>${esc(monthText(m.month))}</td><td class="r">${m.expected == null ? '—' : sym + fmt(m.expected)}</td><td class="r gc">${sym}${fmt(m.paid)}</td>
    <td class="r ${m.pending > 0.005 ? 'rc' : 'gc'}">${m.expected == null ? '—' : sym + fmt(m.pending)}</td>
    <td>${m.attendance ? `${m.attendance.present} present · ${m.attendance.notPresent} absent` : '—'}</td><td>${pillOf(employeeStatus(m, cycle))}</td></tr>` +
    m.pays.map((p, i) => `<tr class="s"><td>payment ${i + 1}</td><td></td><td class="r">${sym}${fmt(p.amount)}</td><td></td><td>${esc(dateText(p.date))} · ${esc(p.mode)}${p.note ? ' · ' + esc(p.note) : ''}</td><td></td></tr>`).join('')).join('');
  const body = hero('Employee records', e.name, [`${e.basis} · ${money(sym, e.rate)}`, e.phone, 'Since ' + dateText(e.start)]) +
    `<h2>Current cycle · ${esc(monthText(cycle))}</h2>` + stats([['Expected', money(sym, expected)], ['Paid', money(sym, paid), 'good'], ['Pending', money(sym, pending), pending > 0.005 ? 'bad' : 'good'], ['Paid, all time', money(sym, allPaid), 'blue']]) +
    '<h2>Details</h2>' + kv([['Salary basis', e.basis], ['Rate', money(sym, e.rate)], ['Working days', e.basis === 'Monthly' ? String(e.workingDays) : ''], ['Started', dateText(e.start)], ['Phone', e.phone], ['Email', e.email], ['Address', e.address], ['Notes', e.notes]]) +
    '<h2>Month by month</h2>' + `<table><thead><tr><th>Month</th><th class="r">Expected</th><th class="r">Paid</th><th class="r">Pending</th><th>Attendance / date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` +
    footer(`${e.name} · since ${dateText(e.start)}`);
  printHTML(`${e.name} - employee records`, body);
}

/* ---------------- invoice ---------------- */

export function invoiceHTML(inv, shop, sym, paper) {
  const calc = calcInvoice(inv.items, inv.discount, inv.inclusive, true);
  const due = invoiceDue(inv);
  const hasTax = calc.tax > 0.004;
  const half = fmt(calc.tax / 2);
  const wide = paper !== 'receipt';
  if (!wide) {
    return `<div class="rc-doc"><div class="c b big">${esc(shop.name)}</div>${shop.address ? `<div class="c">${esc(shop.address)}</div>` : ''}${shop.phone ? `<div class="c">Ph: ${esc(shop.phone)}</div>` : ''}${shop.gstin ? `<div class="c">GSTIN: ${esc(shop.gstin)}</div>` : ''}
      <hr><div class="row"><span>${esc(inv.no)}</span><span>${esc(dateText(inv.date))}${inv.time ? ' ' + esc(inv.time) : ''}</span></div>${inv.customerName ? `<div>To: ${esc(inv.customerName)}${inv.customerPhone ? ' · ' + esc(inv.customerPhone) : ''}</div>` : ''}<hr>
      ${inv.items.map((it, i) => `<div>${esc(it.name)}</div><div class="row"><span>${fmt(it.qty)} ${esc(it.unit || '')} x ${fmt(it.rate)}${it.discPct ? ` (-${fmt(it.discPct)}%)` : ''}</span><span>${fmt(calc.lines[i].amount)}</span></div>`).join('')}
      <hr><div class="row"><span>Subtotal</span><span>${fmt(calc.subtotal)}</span></div>
      ${calc.discount > 0 ? `<div class="row"><span>Discount</span><span>-${fmt(calc.discount)}</span></div>` : ''}
      ${hasTax ? (inv.inclusive ? `<div class="row"><span>GST included</span><span>${fmt(calc.tax)}</span></div>` : `<div class="row"><span>GST</span><span>${fmt(calc.tax)}</span></div>`) : ''}
      ${Math.abs(calc.roundOff) > 0.004 ? `<div class="row"><span>Round off</span><span>${fmt(calc.roundOff)}</span></div>` : ''}
      <div class="row b big"><span>TOTAL</span><span>${sym}${fmt(calc.total)}</span></div>
      <div class="row"><span>Paid (${esc(inv.mode)})</span><span>${sym}${fmt(inv.paid || 0)}</span></div>
      ${due > 0 ? `<div class="row b"><span>BALANCE DUE</span><span>${sym}${fmt(due)}</span></div>` : ''}
      <hr><div class="c">${esc(shop.footer || '')}</div></div>`;
  }
  return `<div class="inv"><div class="inv-head"><div><h1>${esc(shop.name)}</h1>${shop.address ? `<div>${esc(shop.address)}</div>` : ''}${shop.phone ? `<div>Phone: ${esc(shop.phone)}</div>` : ''}${shop.gstin ? `<div>GSTIN: ${esc(shop.gstin)}</div>` : ''}</div>
      <div class="inv-meta"><div class="ttl">${hasTax ? 'TAX INVOICE' : 'INVOICE'}</div><div><b>${esc(inv.no)}</b></div><div>${esc(dateText(inv.date))}${inv.time ? ' · ' + esc(inv.time) : ''}</div></div></div>
    <div class="bill-to"><span>Bill to</span><b>${esc(inv.customerName || 'Walk-in customer')}</b>${inv.customerPhone ? `<div>${esc(inv.customerPhone)}</div>` : ''}</div>
    <table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th>${hasTax ? '<th class="r">GST</th>' : ''}<th class="r">Amount</th></tr></thead><tbody>
    ${inv.items.map((it, i) => `<tr class="m"><td>${i + 1}</td><td>${esc(it.name)}${it.discPct ? `<div class="mut" style="font-weight:400;font-size:11px">Discount ${fmt(it.discPct)}%</div>` : ''}</td><td class="r">${fmt(it.qty)} ${esc(it.unit || '')}</td><td class="r">${sym}${fmt(it.rate)}</td>${hasTax ? `<td class="r">${fmt(it.taxPct || 0)}%</td>` : ''}<td class="r">${sym}${fmt(calc.lines[i].amount)}</td></tr>`).join('')}
    </tbody></table>
    <div class="inv-tot"><div class="note">${esc(inv.note || '')}</div><table>
      <tr><td>Subtotal</td><td class="r">${sym}${fmt(calc.subtotal)}</td></tr>
      ${calc.discount > 0 ? `<tr><td>Discount</td><td class="r">-${sym}${fmt(calc.discount)}</td></tr>` : ''}
      ${hasTax ? (inv.inclusive ? `<tr><td class="mut">CGST included</td><td class="r mut">${sym}${half}</td></tr><tr><td class="mut">SGST included</td><td class="r mut">${sym}${half}</td></tr>` : `<tr><td>CGST</td><td class="r">${sym}${half}</td></tr><tr><td>SGST</td><td class="r">${sym}${half}</td></tr>`) : ''}
      ${Math.abs(calc.roundOff) > 0.004 ? `<tr><td>Round off</td><td class="r">${sym}${fmt(calc.roundOff)}</td></tr>` : ''}
      <tr class="tot"><td>Total</td><td class="r">${sym}${fmt(calc.total)}</td></tr>
      <tr><td>Paid (${esc(inv.mode)})</td><td class="r gc">${sym}${fmt(inv.paid || 0)}</td></tr>
      ${due > 0 ? `<tr><td><b>Balance due</b></td><td class="r rc"><b>${sym}${fmt(due)}</b></td></tr>` : ''}
    </table></div>
    <div class="inv-foot">${esc(shop.footer || '')}</div></div>`;
}

const INV_CSS = `
.inv h1{margin:0 0 4px;font-size:24px}.inv-head{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #0B5FFF;padding-bottom:14px;margin-bottom:14px}
.inv-meta{text-align:right}.inv-meta .ttl{font-size:11px;letter-spacing:.14em;color:#0B5FFF;font-weight:700}
.bill-to{margin-bottom:14px}.bill-to span{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#5B6B7F}
.inv-tot{display:flex;justify-content:space-between;gap:30px;margin-top:14px}.inv-tot .note{flex:1;color:#5B6B7F;font-size:12px}.inv-tot table{width:280px}
.inv-tot td{padding:4px 8px}.inv-foot{margin-top:28px;text-align:center;color:#5B6B7F;border-top:1px dashed #DFE7F1;padding-top:12px}
.rc-doc{font:12px/1.35 "Courier New",monospace;width:72mm;margin:0 auto}.rc-doc .c{text-align:center}.rc-doc .b{font-weight:700}.rc-doc .big{font-size:15px}
.rc-doc hr{border:0;border-top:1px dashed #000;margin:5px 0}.rc-doc .row{display:flex;justify-content:space-between;gap:8px}
`;

export function printInvoice(inv, shop, sym, paper) {
  const receipt = paper === 'receipt';
  const brand = receipt
    ? `<div class="rc-brand">${BRAND}</div>`
    : `<div class="foot"><div class="brand">${BRAND}</div></div>`;
  printHTML(`${inv.no}`, invoiceHTML(inv, shop, sym, paper) + brand,
    INV_CSS + '.rc-brand{font:10px "Courier New",monospace;text-align:center;margin-top:8px;color:#444}' + (receipt ? '@page{size:80mm auto;margin:3mm}' : ''));
}
