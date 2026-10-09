// Ledra web · Invoices (grocery billing): item catalog, fast billing screen, invoice list, printing.
import {
  money, fmt, dateText, todayStr, addDays, uid, num, round2, calcInvoice, nextInvoiceNo, invoiceDue, sum
} from './core.js';
import { all, get, put, remove, settings, shop } from './store.js';
import {
  esc, $, ACT, INPUT, icon, pill, stat, empty, sectionTitle, iconBtn, backLink, field, chips, select,
  modal, confirmBox, toast, vs, rerender, go
} from './ui.js';
import { printInvoice, invoiceHTML } from './print.js';

const PAY_MODES = ['Cash', 'UPI', 'Card', 'Credit'];
const GST = [0, 5, 12, 18, 28];

/* ======================= item catalog ======================= */

function itemsListHTML() {
  const sym = settings().currency, q = vs.itemq.trim().toLowerCase();
  const items = all('product');
  if (!items.length) return empty('box', 'No items yet', 'Add the things you sell, with price and unit');
  const list = items.filter(p => !q || p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return empty('search', 'No matching items');
  return `<div class="card list-card">${list.map(p => `<div class="row"><span class="badge sm">${icon('box', 18)}</span><div class="grow"><b>${esc(p.name)}</b><small>${esc(money(sym, p.price))} / ${esc(p.unit)}${p.taxPct ? ' · GST ' + p.taxPct + '%' : ''}${p.barcode ? ' · ' + esc(p.barcode) : ''}</small></div>
    <span class="mini">${iconBtn('edit', 'Edit', 'edit-item', p.id, 'sm')}${iconBtn('trash', 'Delete', 'del-item', p.id, 'sm')}</span></div>`).join('')}</div>`;
}

export function itemsView() {
  return `<div class="page-head"><div class="with-back">${backLink('#/invoices')}<div><h1>Items</h1><p class="muted">Your price list</p></div></div><button class="btn primary" data-act="add-item">${icon('plus', 18)} Add item</button></div>
  <div class="toolbar"><div class="search">${icon('search', 18)}<input data-input="item-q" placeholder="Search item or barcode" value="${esc(vs.itemq)}"></div></div>
  <div id="list">${itemsListHTML()}</div>`;
}

export function itemForm(id, presetName = '', after) {
  const ex = id ? get('product', id) : null;
  const units = shop().units;
  modal({
    title: ex ? 'Edit item' : 'New item',
    body: `${field('Item name', 'name', ex ? ex.name : presetName, { required: true, autofocus: true })}
      <div class="grid2">${field('Price (' + settings().currency + ')', 'price', ex ? ex.price : '', { type: 'number', step: '0.01', min: 0, required: true, inputmode: 'decimal' })}
      ${select('Sold per', 'unit', [...new Set([...units, ex ? ex.unit : 'pcs'])], ex ? ex.unit : units[0])}
      ${select('GST %', 'taxPct', GST.map(g => [g, g + '%']), ex ? ex.taxPct || 0 : 0)}${field('Barcode / code (optional)', 'barcode', ex?.barcode)}</div>`,
    buttons: [
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          const rec = { id: ex ? ex.id : uid(), name: String(fd.get('name')).trim(), price: round2(num(fd.get('price'))), unit: fd.get('unit'), taxPct: num(fd.get('taxPct')), barcode: String(fd.get('barcode') || '').trim(), created: ex ? ex.created : Date.now() };
          await put('product', rec);
          toast('Saved');
          if (after) after(rec);
        }
      }
    ]
  });
}

/* ======================= billing screen ======================= */

let draft = null;
let pq = '';
let invoiceBase = null; // invoice being edited, if any

const blankDraft = () => ({ id: uid(), no: '', date: todayStr(), customerName: '', customerPhone: '', items: [], discount: '', paidInput: '', mode: 'Cash', note: '' });

function draftTotals() {
  const sh = shop();
  const inclusive = invoiceBase ? invoiceBase.inclusive : sh.taxInclusive;
  const calc = calcInvoice(draft.items, draft.discount, inclusive, true);
  let paid;
  if (draft.paidInput === '') paid = draft.mode === 'Credit' ? 0 : calc.total;
  else paid = Math.min(Math.max(num(draft.paidInput), 0), calc.total);
  const change = draft.paidInput !== '' ? Math.max(num(draft.paidInput) - calc.total, 0) : 0;
  return { calc, paid, due: Math.max(round2(calc.total - paid), 0), change, inclusive };
}

function gridHTML() {
  const sym = settings().currency, q = pq.trim().toLowerCase();
  const items = all('product');
  if (!items.length) return `<div class="card flat muted">No items yet. Add your price list in <a href="#/items" class="link">Items</a>, or use “Custom item”.</div>`;
  const list = items.filter(p => !q || p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase() === q).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
  if (!list.length) return `<div class="card flat"><span class="muted">No item matches “${esc(pq)}”.</span> <button class="btn soft sm" data-act="pos-new-item">${icon('plus', 16)} Add “${esc(pq)}”</button></div>`;
  return `<div class="pgrid">${list.map(p => `<button class="ptile" data-act="pos-add" data-id="${p.id}"><b>${esc(p.name)}</b><small>${esc(money(sym, p.price))} / ${esc(p.unit)}</small></button>`).join('')}</div>`;
}

function linesHTML() {
  const sym = settings().currency;
  if (!draft.items.length) return `<div class="empty small"><span>Tap an item to add it to the bill</span></div>`;
  const { calc } = draftTotals();
  return draft.items.map((it, i) => `<div class="line" data-i="${i}">
    <div class="l-top"><b>${esc(it.name)}</b><button class="icon-btn sm" data-act="pos-del" data-i="${i}" aria-label="Remove">${icon('x', 16)}</button></div>
    <div class="l-row">
      <div class="qty"><button class="icon-btn sm" data-act="pos-qty" data-i="${i}" data-d="-1" aria-label="Less">${icon('minus', 14)}</button>
        <input type="number" step="any" min="0" inputmode="decimal" value="${it.qty}" data-input="pos-line" data-i="${i}" data-k="qty" aria-label="Quantity">
        <button class="icon-btn sm" data-act="pos-qty" data-i="${i}" data-d="1" aria-label="More">${icon('plus', 14)}</button><span class="unit">${esc(it.unit)}</span></div>
      <label class="mini-f"><small>Rate</small><input type="number" step="any" min="0" inputmode="decimal" value="${it.rate}" data-input="pos-line" data-i="${i}" data-k="rate"></label>
      <label class="mini-f"><small>Disc %</small><input type="number" step="any" min="0" max="100" inputmode="decimal" value="${it.discPct || ''}" placeholder="0" data-input="pos-line" data-i="${i}" data-k="discPct"></label>
      <b class="amt" id="amt-${i}">${esc(money(sym, calc.lines[i].amount))}</b></div></div>`).join('');
}

function totalsHTML() {
  const sym = settings().currency;
  const t = draftTotals(), c = t.calc;
  const count = sum(draft.items, i => num(i.qty));
  return `<div class="trow"><span>${draft.items.length} ${draft.items.length === 1 ? 'item' : 'items'} · qty ${fmt(count)}</span><span>${esc(money(sym, c.subtotal))}</span></div>
    ${c.discount > 0 ? `<div class="trow"><span>Discount</span><span>-${esc(money(sym, c.discount))}</span></div>` : ''}
    ${c.tax > 0.004 ? `<div class="trow muted"><span>GST ${t.inclusive ? 'included' : 'added'}</span><span>${esc(money(sym, c.tax))}</span></div>` : ''}
    ${Math.abs(c.roundOff) > 0.004 ? `<div class="trow muted"><span>Round off</span><span>${esc(money(sym, c.roundOff))}</span></div>` : ''}
    <div class="trow grand"><span>Total</span><span>${esc(money(sym, c.total))}</span></div>
    ${t.due > 0.004 ? `<div class="trow bad"><span>Balance due (udhaar)</span><span>${esc(money(sym, t.due))}</span></div>` : ''}
    ${t.change > 0.004 ? `<div class="trow good"><span>Change to return</span><span>${esc(money(sym, t.change))}</span></div>` : ''}`;
}

const refreshBill = () => { $('#lines').innerHTML = linesHTML(); $('#totals').innerHTML = totalsHTML(); };

export function invoiceNewView({ id } = {}) {
  const sh = shop();
  if (id) {
    const inv = get('invoice', id);
    if (!inv) return empty('receipt', 'Not found');
    if (!draft || draft.id !== id) {
      invoiceBase = inv;
      draft = { id: inv.id, no: inv.no, date: inv.date, customerName: inv.customerName || '', customerPhone: inv.customerPhone || '', items: inv.items.map(i => ({ ...i })), discount: inv.discount || '', paidInput: String(inv.paid ?? ''), mode: inv.mode, note: inv.note || '' };
    }
  } else if (!draft || invoiceBase) {
    invoiceBase = null;
    draft = blankDraft();
  }
  if (!draft.no) draft.no = nextInvoiceNo(all('invoice'), sh.prefix);
  const names = [...new Set(all('invoice').map(i => i.customerName).filter(Boolean))].slice(0, 100);
  const html = `
  <div class="page-head"><div class="with-back">${backLink(id ? '#/invoices/' + id : '#/invoices')}<div><h1>${id ? 'Edit bill' : 'New bill'}</h1><p class="muted">${esc(draft.no)} · ${esc(dateText(draft.date))}</p></div></div>
    <div class="actions"><a class="btn soft" href="#/items">${icon('box', 18)} Items</a>${id ? '' : `<button class="btn ghost" data-act="pos-clear">Clear</button>`}</div></div>
  <div class="pos">
    <section class="pos-left">
      <div class="search big">${icon('search', 20)}<input id="psearch" data-input="pos-q" placeholder="Search item or scan barcode · Enter adds the first match" value="${esc(pq)}" autocomplete="off"></div>
      <div id="pgrid">${gridHTML()}</div>
      <button class="btn soft" data-act="pos-custom">${icon('plus', 18)} Custom item</button>
    </section>
    <section class="pos-right card">
      <div class="grid2"><label class="f"><span>Customer (optional)</span><input list="custs" data-input="pos-field" data-k="customerName" value="${esc(draft.customerName)}" placeholder="Walk-in"></label>
        <label class="f"><span>Phone</span><input type="tel" data-input="pos-field" data-k="customerPhone" value="${esc(draft.customerPhone)}"></label></div>
      <datalist id="custs">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div id="lines" class="lines">${linesHTML()}</div>
      <div class="grid2"><label class="f"><span>Bill discount (${esc(settings().currency)})</span><input type="number" step="any" min="0" inputmode="decimal" data-input="pos-field" data-k="discount" value="${esc(draft.discount)}"></label>
        <label class="f"><span>Amount received</span><input type="number" step="any" min="0" inputmode="decimal" data-input="pos-field" data-k="paidInput" value="${esc(draft.paidInput)}" placeholder="Full amount"></label></div>
      <div class="chips inline" id="pmodes">${PAY_MODES.map(m => `<button class="chip-b ${draft.mode === m ? 'on' : ''}" data-act="pos-mode" data-v="${m}">${m}</button>`).join('')}</div>
      <div id="totals" class="totals">${totalsHTML()}</div>
      <label class="f"><span>Note on bill (optional)</span><input data-input="pos-field" data-k="note" value="${esc(draft.note)}"></label>
      <div class="btn-row"><button class="btn soft" data-act="pos-save">Save</button><button class="btn primary" data-act="pos-save-print">${icon('print', 18)} Save &amp; print</button></div>
    </section>
  </div>`;
  return {
    html,
    mount: () => {
      const input = $('#psearch');
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const q = input.value.trim().toLowerCase();
        if (!q) return;
        const items = all('product');
        const hit = items.find(p => (p.barcode || '').toLowerCase() === q) || items.filter(p => p.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name))[0];
        if (hit) { addItem(hit); input.value = ''; pq = ''; $('#pgrid').innerHTML = gridHTML(); }
        else { itemForm(null, input.value.trim(), addItem); }
      });
    }
  };
}

function addItem(p) {
  const ex = draft.items.find(i => i.pid === p.id);
  if (ex) ex.qty = round2(num(ex.qty) + 1);
  else draft.items.push({ pid: p.id, name: p.name, unit: p.unit, qty: 1, rate: p.price, discPct: 0, taxPct: p.taxPct || 0 });
  refreshBill();
}

function buildInvoice() {
  if (!draft.items.length) { toast('Add at least one item'); return null; }
  if (draft.items.some(i => num(i.qty) <= 0)) { toast('Check the quantities'); return null; }
  const t = draftTotals();
  const old = invoiceBase;
  return {
    id: draft.id, no: draft.no, date: draft.date, time: old ? old.time || '' : new Date().toTimeString().slice(0, 5),
    customerName: draft.customerName.trim(), customerPhone: draft.customerPhone.trim(),
    items: draft.items.map(i => ({ pid: i.pid || '', name: i.name, unit: i.unit, qty: num(i.qty), rate: num(i.rate), discPct: num(i.discPct), taxPct: num(i.taxPct) })),
    discount: t.calc.discount, inclusive: t.inclusive, subtotal: t.calc.subtotal, taxable: t.calc.taxable, tax: t.calc.tax, roundOff: t.calc.roundOff, total: t.calc.total,
    paid: t.paid, mode: draft.mode, note: draft.note.trim(), receipts: old ? old.receipts || [] : [], created: old ? old.created : Date.now()
  };
}

async function saveDraft(printAfter) {
  const inv = buildInvoice();
  if (!inv) return;
  await put('invoice', inv);
  draft = null; invoiceBase = null; pq = '';
  toast('Bill saved');
  go('#/invoices/' + inv.id);
  if (printAfter) setTimeout(() => printInvoice(inv, shop(), settings().currency, shop().paper === 'receipt' ? 'receipt' : 'a4'), 500);
}

Object.assign(INPUT, {
  'item-q': el => { vs.itemq = el.value; $('#list').innerHTML = itemsListHTML(); },
  'pos-q': el => { pq = el.value; $('#pgrid').innerHTML = gridHTML(); },
  'pos-field': el => { draft[el.dataset.k] = el.value; $('#totals').innerHTML = totalsHTML(); },
  'pos-line': el => {
    const it = draft.items[Number(el.dataset.i)];
    if (!it) return;
    it[el.dataset.k] = el.value === '' ? 0 : num(el.value);
    const calc = draftTotals().calc;
    draft.items.forEach((_, i) => { const a = $('#amt-' + i); if (a) a.textContent = money(settings().currency, calc.lines[i].amount); });
    $('#totals').innerHTML = totalsHTML();
  },
  'inv-q': el => { vs.iq = el.value; $('#list').innerHTML = invoiceListHTML(); }
});

Object.assign(ACT, {
  'add-item': () => itemForm(null),
  'edit-item': el => itemForm(el.dataset.id),
  'del-item': el => { const p = get('product', el.dataset.id); if (p) confirmBox('Delete ' + p.name + '?', 'Old bills keep their own copy of this item.', 'Delete', () => remove('product', p.id)); },
  'pos-add': el => { const p = get('product', el.dataset.id); if (p) addItem(p); },
  'pos-new-item': () => itemForm(null, pq.trim(), addItem),
  'pos-qty': el => {
    const it = draft.items[Number(el.dataset.i)];
    if (!it) return;
    it.qty = Math.max(round2(num(it.qty) + Number(el.dataset.d)), 0);
    if (it.qty <= 0) draft.items.splice(Number(el.dataset.i), 1);
    refreshBill();
  },
  'pos-del': el => { draft.items.splice(Number(el.dataset.i), 1); refreshBill(); },
  'pos-mode': el => { draft.mode = el.dataset.v; $('#pmodes').querySelectorAll('.chip-b').forEach(b => b.classList.toggle('on', b.dataset.v === draft.mode)); $('#totals').innerHTML = totalsHTML(); },
  'pos-clear': () => { draft = null; pq = ''; rerender(); },
  'pos-custom': () => modal({
    title: 'Custom item',
    body: `${field('Item name', 'name', '', { required: true, autofocus: true })}<div class="grid2">${field('Qty', 'qty', 1, { type: 'number', step: 'any', min: 0, required: true })}${select('Unit', 'unit', shop().units, shop().units[0])}
      ${field('Rate', 'rate', '', { type: 'number', step: 'any', min: 0, required: true })}${select('GST %', 'taxPct', GST.map(g => [g, g + '%']), 0)}</div>`,
    buttons: [{ label: 'Cancel', kind: 'ghost', onClick: () => true }, {
      label: 'Add to bill', kind: 'primary', onClick: fd => {
        draft.items.push({ pid: '', name: String(fd.get('name')).trim(), unit: fd.get('unit'), qty: num(fd.get('qty')), rate: num(fd.get('rate')), discPct: 0, taxPct: num(fd.get('taxPct')) });
        refreshBill();
      }
    }]
  }),
  'pos-save': () => saveDraft(false),
  'pos-save-print': () => saveDraft(true)
});

/* ======================= invoice list ======================= */

function invoiceListHTML() {
  const sym = settings().currency, q = vs.iq.trim().toLowerCase(), today = todayStr();
  const f = vs.ifilter;
  const from = f === 'Today' ? today : f === 'Week' ? addDays(today, -6) : f === 'Month' ? today.slice(0, 8) + '01' : '';
  let list = all('invoice').filter(i => (!from || i.date >= from) && (f !== 'Due' || invoiceDue(i) > 0.004))
    .filter(i => !q || (i.no || '').toLowerCase().includes(q) || (i.customerName || '').toLowerCase().includes(q) || (i.customerPhone || '').includes(q) || i.items.some(x => x.name.toLowerCase().includes(q)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0)));
  const total = sum(list, i => i.total), paid = sum(list, i => i.paid), due = sum(list, i => invoiceDue(i));
  const head = `<div class="stats-grid">${stat('Bills', String(list.length))}${stat('Sales', money(sym, total))}${stat('Received', money(sym, paid), 'good')}${stat('Due', money(sym, due), due > 0.004 ? 'bad' : 'good')}</div>`;
  if (!all('invoice').length) return empty('receipt', 'No bills yet', 'Create your first bill with “New bill”');
  if (!list.length) return head + empty('search', 'No bills here', 'Try another filter');
  return head + `<div class="stack">${list.map(i => `<a class="row" href="#/invoices/${i.id}"><span class="badge sm">${icon('receipt', 18)}</span><div class="grow"><b>${esc(i.customerName || 'Walk-in')}</b><small>${esc(i.no)} · ${esc(dateText(i.date))}${i.time ? ' ' + esc(i.time) : ''} · ${i.items.length} ${i.items.length === 1 ? 'item' : 'items'}</small></div>
    <div class="end"><b>${esc(money(sym, i.total))}</b>${invoiceDue(i) > 0.004 ? pill('Due ' + money(sym, invoiceDue(i)), 'bad') : pill('Paid', 'good')}</div></a>`).join('')}</div>`;
}

export function invoicesView() {
  return `<div class="page-head"><div><h1>Invoices</h1></div><div class="actions"><a class="btn soft" href="#/items">${icon('box', 18)} Items</a><button class="btn primary" data-act="new-invoice">${icon('plus', 18)} New bill</button></div></div>
  <div class="toolbar"><div class="search">${icon('search', 18)}<input data-input="inv-q" placeholder="Search bill no, customer, phone or item" value="${esc(vs.iq)}"></div>
    <div class="chips inline">${['Today', 'Week', 'Month', 'All', 'Due'].map(f => `<button class="chip-b ${vs.ifilter === f ? 'on' : ''}" data-act="inv-filter" data-v="${f}">${f}</button>`).join('')}</div></div>
  <div id="list">${invoiceListHTML()}</div>`;
}

/* ======================= invoice view ======================= */

export function invoiceView({ id }) {
  const inv = get('invoice', id);
  if (!inv) return empty('receipt', 'Not found', 'This bill may have been deleted on another device');
  const sym = settings().currency, due = invoiceDue(inv);
  return `
  <div class="page-head"><div class="with-back">${backLink('#/invoices')}<div><h1>${esc(inv.no)}</h1><p class="muted">${esc(inv.customerName || 'Walk-in')} · ${due > 0.004 ? 'Due ' + esc(money(sym, due)) : 'Paid'}</p></div></div>
    <div class="actions"><button class="btn primary" data-act="inv-print" data-id="${id}" data-p="a4">${icon('print', 18)} Print A4</button><button class="btn soft" data-act="inv-print" data-id="${id}" data-p="receipt">Receipt</button></div></div>
  <div class="btn-row wrap">
    ${due > 0.004 ? `<button class="btn soft" data-act="inv-receive" data-id="${id}">${icon('money', 18)} Receive ${esc(money(sym, due))}</button>` : ''}
    <button class="btn soft" data-act="inv-whatsapp" data-id="${id}">${icon('share', 18)} WhatsApp</button>
    <a class="btn soft" href="#/invoices/edit/${id}">${icon('edit', 18)} Edit</a>
    <button class="btn soft" data-act="inv-copy" data-id="${id}">Copy as new</button>
    <button class="btn danger-ghost" data-act="inv-del" data-id="${id}">${icon('trash', 18)} Delete</button></div>
  <div class="paper">${invoiceHTML(inv, shop(), sym, 'a4')}</div>
  ${(inv.receipts || []).length ? `${sectionTitle('Payments received later')}<div class="card list-card">${inv.receipts.map(r => `<div class="row"><div class="grow"><b>${esc(money(sym, r.amount))}</b><small>${esc(dateText(r.date))} · ${esc(r.mode)}</small></div></div>`).join('')}</div>` : ''}`;
}

Object.assign(ACT, {
  'inv-filter': el => { vs.ifilter = el.dataset.v; rerender(); },
  'inv-print': el => { const inv = get('invoice', el.dataset.id); if (inv) printInvoice(inv, shop(), settings().currency, el.dataset.p); },
  'inv-del': el => { const inv = get('invoice', el.dataset.id); if (inv) confirmBox('Delete ' + inv.no + '?', 'This removes the bill on all devices.', 'Delete', async () => { await remove('invoice', inv.id); go('#/invoices'); }); },
  'inv-copy': el => {
    const inv = get('invoice', el.dataset.id);
    if (!inv) return;
    invoiceBase = null;
    draft = { ...blankDraft(), customerName: inv.customerName || '', customerPhone: inv.customerPhone || '', items: inv.items.map(i => ({ ...i })), mode: inv.mode === 'Credit' ? 'Cash' : inv.mode };
    go('#/invoices/new');
  },
  'inv-receive': el => {
    const inv = get('invoice', el.dataset.id);
    if (!inv) return;
    const due = invoiceDue(inv);
    modal({
      title: 'Receive payment · ' + inv.no,
      body: `${field('Amount', 'amount', due, { type: 'number', step: '0.01', min: 0, required: true, autofocus: true })}<div class="f"><span>Mode</span>${chips('mode', ['Cash', 'UPI', 'Card'], 'Cash')}</div>`,
      buttons: [{ label: 'Cancel', kind: 'ghost', onClick: () => true }, {
        label: 'Save', kind: 'primary', onClick: async fd => {
          const amt = Math.min(round2(num(fd.get('amount'))), due);
          if (amt <= 0) { toast('Enter an amount'); return false; }
          await put('invoice', { ...inv, paid: round2((inv.paid || 0) + amt), receipts: [...(inv.receipts || []), { date: todayStr(), amount: amt, mode: fd.get('mode') }] });
          toast('Payment recorded');
        }
      }]
    });
  },
  'inv-whatsapp': el => {
    const inv = get('invoice', el.dataset.id);
    if (!inv) return;
    const sym = settings().currency, sh = shop(), due = invoiceDue(inv);
    const text = [`*${sh.name}*`, `${inv.no} · ${dateText(inv.date)}`, '', ...inv.items.map(i => `${i.name}  ${fmt(i.qty)} ${i.unit} x ${fmt(i.rate)}`), '', `*Total: ${money(sym, inv.total)}*`, due > 0.004 ? `Balance due: ${money(sym, due)}` : 'Paid', '', sh.footer || ''].join('\n');
    let digits = String(inv.customerPhone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank');
  }
});
