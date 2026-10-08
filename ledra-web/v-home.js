// Ledra web · Dashboard, People and person detail.
import {
  money, fmt, dateText, monthText, todayStr, cycleMonthOf, isActive, summarize, rowStatus, monthlyDue, firstMonth, lastMonth,
  ymStr, ymFromStr, ymOfDate, uid, num, round2, PAYMENT_MODES, KIND_COLLECT, KIND_PAY, monthlyExpected, sum
} from './core.js';
import { all, get, put, removePerson, remove, settings, putSettings } from './store.js';
import {
  esc, $, ACT, INPUT, icon, pill, avatar, stat, empty, progress, sectionTitle, iconBtn, backLink, field, chips, select, switchRow,
  modal, confirmBox, toast, logo, vs, rerender, go
} from './ui.js';
import { printPerson } from './print.js';

/* ---------------- shared data helpers ---------------- */

export function peopleData() {
  const s = settings();
  const pays = all('payment');
  return all('person').map(p => ({ p, sum: summarize(p, pays.filter(x => x.personId === p.id), s) }));
}

export function employeeCycleStats() {
  const s = settings();
  const cycle = cycleMonthOf(todayStr(), s.billingDay);
  const att = all('employeeAttendance');
  const pays = all('employeePayment');
  const expected = sum(all('employee'), e => monthlyExpected(e, att.find(a => a.employeeId === e.id && ymFromStr(a.month) === cycle) || null));
  const paid = sum(pays.filter(p => p.month && ymFromStr(p.month) === cycle), p => p.amount);
  return { cycle, expected, paid, left: Math.max(expected - paid, 0) };
}

const personRow = ({ p, sum: sm }, sym) => {
  const left = sm.left;
  const right = left > 0.005
    ? `<b class="bad">${money(sym, left)}</b><small>${p.kind === KIND_PAY ? 'to pay' : 'left'}</small>`
    : left < -0.005 ? `<b class="good">${money(sym, -left)}</b><small>advance</small>` : pill('Paid up', 'good');
  return `<a class="row" href="#/people/${p.id}">${avatar(p.name)}<div class="grow"><b>${esc(p.name)}</b><small>${esc((p.phone || 'Since ' + dateText(p.start)) + (isActive(p) ? '' : ' · Ended'))}</small></div><div class="end">${right}</div></a>`;
};

/* ---------------- dashboard ---------------- */

export function dashboardView() {
  const s = settings(), sym = s.currency, today = todayStr();
  const cycle = cycleMonthOf(today, s.billingDay);
  const data = peopleData();
  const active = data.filter(d => isActive(d.p));
  const collectList = active.filter(d => d.p.kind === KIND_COLLECT);
  const collect = sum(collectList, d => Math.max(d.sum.left, 0));
  const pay = sum(active.filter(d => d.p.kind === KIND_PAY), d => Math.max(d.sum.left, 0));
  let cDue = 0, cPaid = 0;
  for (const d of collectList) {
    const r = d.sum.rows.find(x => x.month === cycle);
    if (r) { cDue += r.due; cPaid += Math.min(r.paid, r.due); }
  }
  const emp = employeeCycleStats();
  const fundTotal = sum(all('fundContribution'), c => c.amount);
  const attention = active.filter(d => d.sum.left > 0.005).sort((a, b) => b.sum.left - a.sum.left);
  const owing = collectList.filter(d => d.sum.left > 0.005).length;
  const inv = all('invoice');
  const todayInv = inv.filter(i => i.date === today);
  const salesToday = sum(todayInv, i => i.total);
  const invDue = sum(inv, i => Math.max((i.total || 0) - (i.paid || 0), 0));

  return `
  <div class="page-head"><div><h1>Dashboard</h1><p class="muted">${esc(dateText(today))}</p></div></div>
  <div class="hero-card">
    <div class="eyebrow">TO COLLECT</div>
    <div class="big">${esc(money(sym, collect))}</div>
    <div class="soft">${collect <= 0.005 ? 'Everyone is paid up' : 'from ' + owing + (owing === 1 ? ' person' : ' people')}</div>
    <div class="hero-bar"><i style="width:${cDue > 0.005 ? Math.round(Math.min(cPaid / cDue, 1) * 100) : 0}%"></i></div>
    <div class="hero-line"><span>This cycle · ${esc(monthText(cycle))}</span><b>${esc(money(sym, cPaid))} of ${esc(money(sym, cDue))}</b></div>
    <div class="hero-sep"></div>
    <div class="hero-trio">
      <div><span>To pay</span><b>${esc(money(sym, pay))}</b></div>
      <div><span>Employee due</span><b>${esc(money(sym, emp.left))}</b></div>
      <div><span>Sales today</span><b>${esc(money(sym, salesToday))}</b></div>
    </div>
  </div>

  ${sectionTitle('Quick add')}
  <div class="quick">
    <button class="tile" data-act="new-invoice">${icon('receipt', 22)}<span>New bill</span></button>
    <button class="tile" data-act="add-person">${icon('people', 22)}<span>Person</span></button>
    <button class="tile" data-act="add-fund">${icon('wallet', 22)}<span>Fund</span></button>
    <button class="tile" data-act="add-employee">${icon('work', 22)}<span>Employee</span></button>
  </div>

  <div class="two-col">
    <div>
      ${sectionTitle('Needs attention', attention.length > 4 ? '<a class="link" href="#/people">See all</a>' : '')}
      ${attention.length ? `<div class="stack">${attention.slice(0, 5).map(d => personRow(d, sym)).join('')}</div>`
        : `<div class="card flat"><span class="pill good">${data.length ? 'All clear' : 'Start'}</span> <span class="muted">${data.length ? 'Nobody has a pending balance' : 'Add your first person to begin'}</span></div>`}
    </div>
    <div>
      ${sectionTitle('Your records')}
      <div class="card list-card">
        <a class="row" href="#/people">${`<span class="badge sm">${icon('people', 20)}</span>`}<div class="grow"><b>People &amp; Payees</b><small>${data.length} records${owing ? ' · ' + owing + ' pending' : ''}</small></div><b>${esc(money(sym, collect))}</b>${icon('chevron', 16)}</a>
        <a class="row" href="#/funds"><span class="badge sm">${icon('wallet', 20)}</span><div class="grow"><b>Funds</b><small>${all('fund').length} funds</small></div><b>${esc(money(sym, fundTotal))}</b>${icon('chevron', 16)}</a>
        <a class="row" href="#/employees"><span class="badge sm">${icon('work', 20)}</span><div class="grow"><b>Employees</b><small>${all('employee').length} employees · ${esc(monthText(cycle))}</small></div><b class="${emp.left > 0.005 ? 'bad' : 'good'}">${esc(money(sym, emp.left))}</b>${icon('chevron', 16)}</a>
        <a class="row" href="#/invoices"><span class="badge sm">${icon('receipt', 20)}</span><div class="grow"><b>Invoices</b><small>${todayInv.length} today · ${esc(money(sym, invDue))} due from customers</small></div><b>${esc(money(sym, salesToday))}</b>${icon('chevron', 16)}</a>
      </div>
    </div>
  </div>`;
}

/* ---------------- people list ---------------- */

function peopleListHTML() {
  const s = settings(), sym = s.currency, q = vs.q.trim().toLowerCase();
  const pays = all('payment');
  const data = peopleData().filter(d => d.p.kind === vs.mode);
  const list = data.filter(d => vs.filter === 'Active' ? isActive(d.p) : vs.filter === 'Left' ? !isActive(d.p) : true)
    .filter(d => !q || d.p.name.toLowerCase().includes(q) || (d.p.phone || '').toLowerCase().includes(q) ||
      money(sym, d.sum.left).toLowerCase().includes(q) ||
      pays.filter(x => x.personId === d.p.id).some(x => dateText(x.paidOn).toLowerCase().includes(q) || money(sym, x.amount).toLowerCase().includes(q)))
    .sort((a, b) => ((b.sum.left > 0.005) - (a.sum.left > 0.005)) || a.p.name.localeCompare(b.p.name));
  if (!data.length) return empty('people', vs.mode === KIND_PAY ? 'No payees yet' : 'No people yet', 'Use “Add” to create the first one');
  if (!list.length) return empty('search', 'Nothing here', 'Try another filter or search');
  return `<div class="stack">${list.map(d => personRow(d, sym)).join('')}</div>`;
}

export function peopleView() {
  const s = settings(), sym = s.currency;
  const data = peopleData().filter(d => d.p.kind === vs.mode);
  const act = data.filter(d => isActive(d.p));
  const pending = sum(act, d => Math.max(d.sum.left, 0));
  const owing = act.filter(d => d.sum.left > 0.005).length;
  return `
  <div class="page-head"><div><h1>${vs.mode === KIND_PAY ? 'Payees' : 'People'}</h1></div><button class="btn primary" data-act="add-person">${icon('plus', 18)} Add</button></div>
  <div class="chips inline">
    <button class="chip-b ${vs.mode === KIND_COLLECT ? 'on' : ''}" data-act="people-mode" data-v="collect">Collect</button>
    <button class="chip-b ${vs.mode === KIND_PAY ? 'on' : ''}" data-act="people-mode" data-v="pay">Pay</button>
  </div>
  ${data.length ? `<div class="card"><div class="eyebrow dark">${vs.mode === KIND_PAY ? 'STILL TO PAY' : 'STILL TO COLLECT'}</div><div class="big dark ${pending > 0.005 ? '' : 'good'}">${esc(money(sym, pending))}</div>
    <div class="muted">${owing === 0 ? 'Everyone is paid up' : owing === 1 ? '1 person has a balance' : owing + ' people have a balance'}</div></div>
  <div class="toolbar"><div class="search">${icon('search', 18)}<input data-input="people-q" placeholder="Search name, amount, phone or date" value="${esc(vs.q)}"></div>
    <div class="chips inline">${['Active', 'Left', 'All'].map(f => `<button class="chip-b ${vs.filter === f ? 'on' : ''}" data-act="people-filter" data-v="${f}">${f}</button>`).join('')}</div></div>` : ''}
  <div id="list">${peopleListHTML()}</div>`;
}

Object.assign(INPUT, { 'people-q': el => { vs.q = el.value; $('#list').innerHTML = peopleListHTML(); } });
Object.assign(ACT, {
  'people-mode': el => { vs.mode = el.dataset.v; localStorage.setItem('ledra-mode', vs.mode); rerender(); },
  'people-filter': el => { vs.filter = el.dataset.v; rerender(); },
  'add-person': () => personForm(null),
  'new-invoice': () => go('#/invoices/new'),
  'add-fund': () => document.dispatchEvent(new CustomEvent('ledra:add', { detail: 'fund' })),
  'add-employee': () => document.dispatchEvent(new CustomEvent('ledra:add', { detail: 'employee' }))
});

/* ---------------- person form ---------------- */

export function personForm(id) {
  const s = settings(), sym = s.currency;
  const ex = id ? get('person', id) : null;
  const lines = ex ? ex.charges || [] : [];
  const defs = s.charges;
  const kind = ex ? ex.kind : vs.mode;
  const body = `
    <div class="chips inline">${chips('kind', [['collect', 'I collect'], ['pay', 'I pay']], kind)}</div>
    <div class="grid2">
      ${field('Name', 'name', ex?.name, { required: true, autofocus: true })}
      ${field('Phone', 'phone', ex?.phone, { type: 'tel' })}
      ${s.showEmail ? field('Email', 'email', ex?.email, { type: 'email' }) : ''}
      ${s.showIdNote ? field('ID note', 'idNote', ex?.idNote) : ''}
    </div>
    ${s.showAddress ? field('Address', 'address', ex?.address, { type: 'textarea' }) : ''}
    ${s.showNotes ? field('Notes', 'notes', ex?.notes, { type: 'textarea' }) : ''}
    <div class="sec"><span>Dates</span></div>
    <div class="grid2">
      ${field('Start date', 'start', ex?.start || todayStr(), { type: 'date', required: true })}
      ${field('Billing from (blank = same as start)', 'billingStart', ex?.billingStart, { type: 'date' })}
      ${field('End date (blank = active)', 'end', ex?.end, { type: 'date' })}
    </div>
    ${switchRow('Bill after month ends', 'January is billed in February', 'arrears', ex?.arrears)}
    <div class="sec"><span>Fixed charges</span></div>
    ${defs.length ? defs.map(d => {
      const l = lines.find(x => x.id === d.id);
      return `<div class="charge"><label class="chk"><input type="checkbox" name="ch_${d.id}" ${l ? 'checked' : ''}><span>${esc(d.name)}</span></label>
        <label class="amt"><span>${esc(sym)}</span><input type="number" step="0.01" min="0" name="amt_${d.id}" value="${l ? l.amount : d.amount}"></label></div>`;
    }).join('') : '<p class="muted">No charges yet. Add one below, or in Settings.</p>'}
    <div class="grid2 new-charge">${field('New charge name', 'newName', '', { placeholder: 'e.g. Rent' })}${field('Monthly amount', 'newAmount', '', { type: 'number', step: '0.01', min: 0 })}</div>`;
  modal({
    title: ex ? 'Edit person' : 'New person', body, wide: true,
    buttons: [
      ...(ex ? [{ label: 'Delete', kind: 'danger-ghost', onClick: () => { confirmBox('Delete ' + ex.name + '?', 'All its payments are deleted too.', 'Delete', async () => { await removePerson(ex.id); go('#/people'); toast('Deleted'); }); return true; } }] : []),
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          const charges = [];
          const defsNow = [...s.charges];
          const newName = String(fd.get('newName') || '').trim(), newAmt = round2(num(fd.get('newAmount')));
          for (const d of defsNow) if (fd.get('ch_' + d.id)) charges.push({ id: d.id, name: d.name, amount: round2(num(fd.get('amt_' + d.id))) });
          if (newName && newAmt > 0) {
            const def = { id: uid(), name: newName, amount: newAmt };
            await putSettings({ charges: [...defsNow, def] });
            charges.push({ ...def });
          }
          const rec = {
            id: ex ? ex.id : uid(), name: String(fd.get('name')).trim(), kind: fd.get('kind') || 'collect',
            phone: String(fd.get('phone') || '').trim(), email: String(fd.get('email') ?? ex?.email ?? '').trim(),
            address: String(fd.get('address') ?? ex?.address ?? '').trim(), idNote: String(fd.get('idNote') ?? ex?.idNote ?? '').trim(),
            notes: String(fd.get('notes') ?? ex?.notes ?? '').trim(), start: fd.get('start'), end: fd.get('end') || '',
            billingStart: fd.get('billingStart') || '', arrears: !!fd.get('arrears'), created: ex ? ex.created : Date.now(), charges
          };
          await put('person', rec);
          toast('Saved');
          if (!ex) go('#/people/' + rec.id);
        }
      }
    ]
  });
}

/* ---------------- person detail ---------------- */

export function personView({ id }) {
  const p = get('person', id);
  if (!p) return empty('people', 'Not found', 'This record may have been deleted on another device');
  const s = settings(), sym = s.currency, today = todayStr();
  const pays = all('payment').filter(x => x.personId === id);
  const sm = summarize(p, pays, s);
  const left = sm.left;
  const frac = sm.totalDue > 0.005 ? sm.totalPaid / sm.totalDue : 0;
  const rows = sm.rows.slice().reverse().map(r => {
    const [label, tone] = rowStatus(r, today);
    const bal = r.balance;
    return `<div class="mrow"><div class="mhead"><b>${esc(monthText(r.month))}</b><span class="muted">due ${esc(dateText(r.dueDate))}</span>${pill(label, tone)}</div>
      <div class="mnums"><div><small>Due</small><b>${esc(money(sym, r.due))}</b></div><div><small>Paid</small><b>${esc(money(sym, r.paid))}</b></div>
      <div><small>Balance</small><b class="${bal > 0.005 ? 'bad' : 'good'}">${bal > 0.005 ? esc(money(sym, bal)) : bal < -0.005 ? '+' + esc(money(sym, -bal)) : esc(money(sym, 0))}</b></div></div>
      ${r.slices.map(sl => `<div class="slice"><span class="dot"></span><span class="grow">${esc(dateText(sl.payment.paidOn))} · ${esc(sl.payment.mode)}${sl.payment.note ? ' · ' + esc(sl.payment.note) : ''}${sl.payment.month ? '' : ' <em>(any amount)</em>'}</span><b>${esc(money(sym, sl.amount))}</b>
        <span class="mini">${iconBtn('edit', 'Edit payment', 'edit-payment', sl.payment.id, 'sm')}${iconBtn('trash', 'Delete payment', 'del-payment', sl.payment.id, 'sm')}</span></div>`).join('')}</div>`;
  }).join('');
  return `
  <div class="page-head"><div class="with-back">${backLink('#/people')}<div><h1>${esc(p.name)}</h1><p class="muted">${p.kind === KIND_PAY ? 'I pay' : 'I collect'} · ${isActive(p) ? 'Active' : 'Ended ' + esc(dateText(p.end))}</p></div></div>
    <div class="actions">${iconBtn('print', 'Print / PDF', 'print-person', id)}${iconBtn('edit', 'Edit', 'edit-person', id)}<button class="btn primary" data-act="add-payment" data-id="${id}">${icon('plus', 18)} Payment</button></div></div>
  <div class="stats-grid">${stat('Total due', money(sym, sm.totalDue))}${stat('Total paid', money(sym, sm.totalPaid), 'good')}${stat(left < -0.005 ? 'Advance' : 'Left to pay', money(sym, Math.abs(left)), left > 0.005 ? 'bad' : 'good')}</div>
  ${sm.totalDue > 0.005 ? `<div class="card flat">${progress(frac, 'good')}<small class="muted">Paid ${Math.round(Math.min(frac, 1) * 100)}% of the amount due</small></div>` : ''}
  <div class="two-col">
    <div>${sectionTitle('Month by month')}${rows ? `<div class="stack">${rows}</div>` : empty('receipt', 'No billing months yet', 'Months appear once billing starts')}</div>
    <div>${sectionTitle('Details')}<div class="card kvs">
      ${[['Phone', p.phone], ['Email', p.email], ['Start date', dateText(p.start)], ['Billing from', p.billingStart ? dateText(p.billingStart) : 'Same as start'],
        ['Billed', p.arrears ? 'After the month ends' : 'At the start of the month'], ['Billing day', 'Day ' + s.billingDay], ['Payment day', 'Day ' + s.dueDay],
        ['Address', p.address], ['ID note', p.idNote], ['Notes', p.notes]].filter(x => x[1]).map(([k, v]) => `<div><small>${esc(k)}</small><span>${esc(v)}</span></div>`).join('')}</div>
      ${(p.charges || []).length ? `${sectionTitle('Fixed charges')}<div class="card kvs">${p.charges.map(c => `<div><small>${esc(c.name)}</small><span>${esc(money(sym, c.amount))} / month</span></div>`).join('')}<div><small>Monthly total</small><b>${esc(money(sym, monthlyDue(p)))}</b></div></div>` : ''}
    </div>
  </div>`;
}

/* ---------------- payment form ---------------- */

function paymentForm(personId, existing) {
  const p = get('person', personId);
  const s = settings(), sym = s.currency, today = todayStr();
  const sm = summarize(p, all('payment').filter(x => x.personId === personId && (!existing || x.id !== existing.id)), s);
  const cycle = cycleMonthOf(today, s.billingDay);
  const first = Math.min(firstMonth(p, s), cycle);
  const last = Math.max(lastMonth(p, s, today), cycle) + 6;
  const months = [];
  for (let m = last; m >= first; m--) months.push([ymStr(m), monthText(m)]);
  const oldest = sm.rows.find(r => r.balance > 0.005);
  const known = PAYMENT_MODES.filter(m => m !== 'Other');
  const mode = existing ? (known.includes(existing.mode) ? existing.mode : 'Other') : 'Cash';
  const target = existing ? (existing.month ? 'month' : 'any') : 'any';
  const defMonth = existing && existing.month ? existing.month : ymStr(oldest ? oldest.month : cycle);
  const body = `
    ${field('Amount (' + sym + ')', 'amount', existing ? existing.amount : (oldest ? round2(oldest.balance) : ''), { type: 'number', step: '0.01', min: 0, required: true, autofocus: true, inputmode: 'decimal' })}
    <div class="f"><span>Applies to</span>${chips('target', [['any', 'Any amount (oldest first)'], ['month', 'A month']], target)}</div>
    ${select('Month', 'month', months, defMonth, 'month-pick')}
    <div class="grid2">${field('Date paid', 'paidOn', existing ? existing.paidOn : today, { type: 'date', required: true })}</div>
    <div class="f"><span>Mode</span>${chips('mode', PAYMENT_MODES, mode)}</div>
    ${field('Other mode', 'other', existing && !known.includes(existing.mode) ? existing.mode : '', { cls: 'other-pick', placeholder: 'e.g. Wallet' })}
    ${field('Note', 'note', existing ? existing.note : '')}`;
  const sync = form => {
    const t = form.querySelector('input[name=target]:checked')?.value;
    const m = form.querySelector('input[name=mode]:checked')?.value;
    form.querySelector('.month-pick').style.display = t === 'month' ? '' : 'none';
    form.querySelector('.other-pick').style.display = m === 'Other' ? '' : 'none';
  };
  modal({
    title: existing ? 'Edit payment' : 'New payment · ' + p.name, body,
    onMount: form => { sync(form); form.addEventListener('change', () => sync(form)); },
    buttons: [
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          const amount = round2(num(fd.get('amount')));
          if (amount <= 0) { toast('Enter an amount'); return false; }
          const m = fd.get('mode') === 'Other' ? (String(fd.get('other')).trim() || 'Other') : fd.get('mode');
          await put('payment', {
            id: existing ? existing.id : uid(), personId, month: fd.get('target') === 'month' ? fd.get('month') : '',
            amount, paidOn: fd.get('paidOn'), mode: m, note: String(fd.get('note') || '').trim(), created: existing ? existing.created : Date.now()
          });
          toast('Payment saved');
        }
      }
    ]
  });
}

Object.assign(ACT, {
  'add-payment': el => paymentForm(el.dataset.id, null),
  'edit-payment': el => { const x = get('payment', el.dataset.id); if (x) paymentForm(x.personId, x); },
  'del-payment': el => {
    const x = get('payment', el.dataset.id);
    if (x) confirmBox('Delete this payment?', `${money(settings().currency, x.amount)} on ${dateText(x.paidOn)}`, 'Delete', () => remove('payment', x.id));
  },
  'edit-person': el => personForm(el.dataset.id),
  'print-person': el => {
    const p = get('person', el.dataset.id), s = settings();
    printPerson(p, summarize(p, all('payment').filter(x => x.personId === p.id), s), s);
  }
});
