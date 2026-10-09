// Ledra web · Employees.
import {
  money, dateText, monthText, todayStr, uid, num, round2, PAYMENT_MODES, cycleMonthOf, employeeMonths, employeeStatus, monthlyExpected,
  ymStr, ymFromStr, sum
} from './core.js';
import { all, get, put, remove, removeEmployee, settings } from './store.js';
import {
  esc, $, ACT, INPUT, icon, pill, avatar, stat, empty, sectionTitle, iconBtn, backLink, field, chips, select,
  modal, confirmBox, toast, vs, go
} from './ui.js';
import { printEmployee } from './print.js';

const BASES = ['Monthly', 'Daily', 'Yearly', 'Work / Project'];
const cycleOf = () => cycleMonthOf(todayStr(), settings().billingDay);
const attOf = (e, m) => all('employeeAttendance').find(a => a.employeeId === e.id && ymFromStr(a.month) === m) || null;
const paidIn = (e, m) => sum(all('employeePayment').filter(p => p.employeeId === e.id && (p.month ? ymFromStr(p.month) : -1) === m), p => p.amount);

function employeesListHTML() {
  const sym = settings().currency, q = vs.eq.trim().toLowerCase(), cycle = cycleOf();
  const emps = all('employee');
  if (!emps.length) return empty('work', 'No employees yet', 'Add staff to track attendance and salary payments');
  const list = emps.filter(e => !q || e.name.toLowerCase().includes(q) || (e.phone || '').toLowerCase().includes(q) || money(sym, e.rate).toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return empty('search', 'No matching employees');
  return `<div class="stack">${list.map(e => {
    const left = Math.max(monthlyExpected(e, attOf(e, cycle)) - paidIn(e, cycle), 0);
    return `<a class="row" href="#/employees/${e.id}">${avatar(e.name)}<div class="grow"><b>${esc(e.name)}</b><small>${esc(e.basis)} · ${esc(money(sym, e.rate))}</small></div><div class="end">${left > 0.005 ? `<b class="bad">${esc(money(sym, left))} left</b>` : pill('Paid', 'good')}</div></a>`;
  }).join('')}</div>`;
}

export function employeesView() {
  const sym = settings().currency, cycle = cycleOf();
  const emps = all('employee');
  const left = sum(emps, e => Math.max(monthlyExpected(e, attOf(e, cycle)) - paidIn(e, cycle), 0));
  return `<div class="page-head"><div><h1>Employees</h1></div><button class="btn primary" data-act="add-employee-form">${icon('plus', 18)} Add</button></div>
  ${emps.length ? `<div class="card"><div class="eyebrow dark">PENDING · ${esc(monthText(cycle).toUpperCase())}</div><div class="big dark ${left > 0.005 ? '' : 'good'}">${esc(money(sym, left))}</div><div class="muted">${left > 0.005 ? 'still to pay this cycle' : 'Everyone is paid for this cycle'}</div></div>
  <div class="toolbar"><div class="search">${icon('search', 18)}<input data-input="emp-q" placeholder="Search name, phone or rate" value="${esc(vs.eq)}"></div></div>` : ''}
  <div id="list">${employeesListHTML()}</div>`;
}

export function employeeView({ id }) {
  const e = get('employee', id);
  if (!e) return empty('work', 'Not found', 'This employee may have been deleted on another device');
  const sym = settings().currency, cycle = cycleOf();
  const months = employeeMonths(e, all('employeeAttendance'), all('employeePayment'), cycle);
  const cur = months.find(m => m.month === cycle);
  const expected = monthlyExpected(e, cur.attendance), paid = cur.paid, pending = Math.max(expected - paid, 0);
  const mine = all('employeePayment').filter(p => p.employeeId === id);
  return `
  <div class="page-head"><div class="with-back">${backLink('#/employees')}<div><h1>${esc(e.name)}</h1><p class="muted">${esc(e.basis)} · ${esc(money(sym, e.rate))}${e.phone ? ' · ' + esc(e.phone) : ''}</p></div></div>
    <div class="actions">${iconBtn('print', 'Print / PDF', 'print-employee', id)}${iconBtn('edit', 'Edit', 'edit-employee', id)}<button class="btn primary" data-act="add-emp-pay" data-id="${id}">${icon('plus', 18)} Payment</button></div></div>
  <div class="stats-grid">${stat('Expected · ' + monthText(cycle), money(sym, expected))}${stat('Paid', money(sym, paid), 'good')}${stat('Pending', money(sym, pending), pending > 0.005 ? 'bad' : 'good')}</div>
  <div class="card flat att"><div><small class="muted">Attendance · ${esc(monthText(cycle))}</small><div><b>${cur.attendance ? `${cur.attendance.present} present · ${cur.attendance.notPresent} absent` : 'Not recorded'}</b></div></div>
    <button class="btn soft" data-act="edit-att" data-id="${id}">${icon('edit', 16)} ${cur.attendance ? 'Edit' : 'Add'}</button></div>
  <div class="two-col"><div>${sectionTitle('Month by month')}<div class="stack">${months.map(m => {
    const [label, tone] = employeeStatus(m, cycle);
    return `<div class="mrow"><div class="mhead"><b>${esc(monthText(m.month))}</b>${m.attendance ? `<span class="muted">${m.attendance.present} present · ${m.attendance.notPresent} absent</span>` : '<span></span>'}${pill(label, tone)}</div>
      <div class="mnums"><div><small>Expected</small><b>${m.expected == null ? '—' : esc(money(sym, m.expected))}</b></div><div><small>Paid</small><b class="good">${esc(money(sym, m.paid))}</b></div><div><small>Pending</small><b class="${m.pending > 0.005 ? 'bad' : 'good'}">${m.expected == null ? '—' : esc(money(sym, m.pending))}</b></div></div>
      ${m.pays.map(p => `<div class="slice"><span class="dot"></span><span class="grow">${esc(dateText(p.date))} · ${esc(p.mode)}${p.note ? ' · ' + esc(p.note) : ''}</span><b>${esc(money(sym, p.amount))}</b><span class="mini">${iconBtn('edit', 'Edit', 'edit-emp-pay', p.id, 'sm')}${iconBtn('trash', 'Delete', 'del-emp-pay', p.id, 'sm')}</span></div>`).join('')}</div>`;
  }).join('')}</div></div>
  <div>${sectionTitle('Details')}<div class="card kvs">${[['Salary basis', e.basis], ['Rate', money(sym, e.rate)], ['Working days', e.basis === 'Monthly' ? String(e.workingDays) : ''], ['Started', dateText(e.start)], ['Phone', e.phone], ['Email', e.email], ['Address', e.address], ['Notes', e.notes]].filter(x => x[1]).map(([k, v]) => `<div><small>${esc(k)}</small><span>${esc(v)}</span></div>`).join('')}
    <div><small>Paid, all time</small><b>${esc(money(sym, sum(mine, p => p.amount)))}</b></div></div></div></div>`;
}

export function employeeForm(id) {
  const s = settings();
  const ex = id ? get('employee', id) : null;
  modal({
    title: ex ? 'Edit employee' : 'New employee', wide: true,
    body: `<div class="grid2">${field('Name', 'name', ex?.name, { required: true, autofocus: true })}${field('Phone', 'phone', ex?.phone, { type: 'tel' })}
      ${s.showEmail ? field('Email', 'email', ex?.email, { type: 'email' }) : ''}${s.showIdNote ? field('ID note', 'idNote', ex?.idNote) : ''}</div>
      ${s.showAddress ? field('Address', 'address', ex?.address) : ''}${s.showNotes ? field('Notes', 'notes', ex?.notes, { type: 'textarea' }) : ''}
      <div class="f"><span>Salary basis</span>${chips('basis', BASES, ex ? ex.basis : s.employeeDefaultBasis)}</div>
      <div class="grid2">${field('Rate (' + s.currency + ')', 'rate', ex ? ex.rate : '', { type: 'number', step: '0.01', min: 0, required: true })}${field('Working days per month', 'workingDays', ex ? ex.workingDays : s.employeeDefaultWorkingDays, { type: 'number', min: 1, max: 31 })}
      ${field('Start date', 'start', ex?.start || todayStr(), { type: 'date', required: true })}${field('End date (blank = active)', 'end', ex?.end, { type: 'date' })}</div>`,
    buttons: [
      ...(ex ? [{ label: 'Delete', kind: 'danger-ghost', onClick: () => { confirmBox('Delete ' + ex.name + '?', 'Attendance and payments are deleted too.', 'Delete', async () => { await removeEmployee(ex.id); go('#/employees'); }); return true; } }] : []),
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          const rec = {
            id: ex ? ex.id : uid(), name: String(fd.get('name')).trim(), phone: String(fd.get('phone') || '').trim(), email: String(fd.get('email') ?? ex?.email ?? '').trim(),
            address: String(fd.get('address') ?? ex?.address ?? '').trim(), idNote: String(fd.get('idNote') ?? ex?.idNote ?? '').trim(), notes: String(fd.get('notes') ?? ex?.notes ?? '').trim(),
            basis: fd.get('basis'), rate: round2(num(fd.get('rate'))), workingDays: Math.min(Math.max(Math.round(num(fd.get('workingDays'))) || 30, 1), 31),
            start: fd.get('start'), end: fd.get('end') || '', created: ex ? ex.created : Date.now()
          };
          await put('employee', rec);
          toast('Saved');
          if (!ex) go('#/employees/' + rec.id);
        }
      }
    ]
  });
}

function attendanceForm(id) {
  const e = get('employee', id), cycle = cycleOf();
  const a = attOf(e, cycle);
  modal({
    title: 'Attendance · ' + monthText(cycle),
    body: `<div class="grid2">${field('Days present', 'present', a ? a.present : '', { type: 'number', min: 0, max: 31 })}${field('Days not present', 'notPresent', a ? a.notPresent : '', { type: 'number', min: 0, max: 31 })}</div>
      <p class="muted">Monthly salary uses days not present. Daily wages use days present.</p>${field('Note', 'note', a?.note)}`,
    buttons: [
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          await put('employeeAttendance', { id: a ? a.id : uid(), employeeId: id, month: ymStr(cycle), present: Math.max(Math.round(num(fd.get('present'))), 0), notPresent: Math.max(Math.round(num(fd.get('notPresent'))), 0), note: String(fd.get('note') || '').trim() });
          toast('Saved');
        }
      }
    ]
  });
}

function empPayForm(employeeId, id) {
  const e = get('employee', employeeId), cycle = cycleOf();
  const ex = id ? get('employeePayment', id) : null;
  const known = PAYMENT_MODES.filter(m => m !== 'Other');
  const months = []; for (let m = cycle; m > cycle - 6; m--) months.push([ymStr(m), monthText(m)]);
  if (ex && ex.month && !months.some(m => m[0] === ex.month)) months.push([ex.month, monthText(ymFromStr(ex.month))]);
  const pending = Math.max(monthlyExpected(e, attOf(e, cycle)) - paidIn(e, cycle), 0);
  modal({
    title: ex ? 'Edit payment' : 'Pay ' + e.name,
    body: `${field('Amount (' + settings().currency + ')', 'amount', ex ? ex.amount : (pending > 0 ? round2(pending) : ''), { type: 'number', step: '0.01', min: 0, required: true, inputmode: 'decimal', autofocus: true })}
      <div class="grid2">${select('For month', 'month', months, ex && ex.month ? ex.month : ymStr(cycle))}${field('Date', 'date', ex?.date || todayStr(), { type: 'date', required: true })}</div>
      <div class="f"><span>Mode</span>${chips('mode', PAYMENT_MODES, ex ? (known.includes(ex.mode) ? ex.mode : 'Other') : 'Cash')}</div>
      ${field('Other mode', 'other', ex && !known.includes(ex.mode) ? ex.mode : '', { cls: 'other-pick' })}${field('Note', 'note', ex?.note)}`,
    onMount: form => { const sync = () => { form.querySelector('.other-pick').style.display = form.querySelector('input[name=mode]:checked')?.value === 'Other' ? '' : 'none'; }; sync(); form.addEventListener('change', sync); },
    buttons: [
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          const amount = round2(num(fd.get('amount')));
          if (amount <= 0) { toast('Enter an amount'); return false; }
          await put('employeePayment', { id: ex ? ex.id : uid(), employeeId, amount, date: fd.get('date'), month: fd.get('month'), mode: fd.get('mode') === 'Other' ? (String(fd.get('other')).trim() || 'Other') : fd.get('mode'), note: String(fd.get('note') || '').trim(), created: ex ? ex.created : Date.now() });
          toast('Saved');
        }
      }
    ]
  });
}

Object.assign(INPUT, { 'emp-q': el => { vs.eq = el.value; $('#list').innerHTML = employeesListHTML(); } });
Object.assign(ACT, {
  'add-employee-form': () => employeeForm(null),
  'edit-employee': el => employeeForm(el.dataset.id),
  'edit-att': el => attendanceForm(el.dataset.id),
  'add-emp-pay': el => empPayForm(el.dataset.id, null),
  'edit-emp-pay': el => { const p = get('employeePayment', el.dataset.id); if (p) empPayForm(p.employeeId, p.id); },
  'del-emp-pay': el => { const p = get('employeePayment', el.dataset.id); if (p) confirmBox('Delete this payment?', `${money(settings().currency, p.amount)} on ${dateText(p.date)}`, 'Delete', () => remove('employeePayment', p.id)); },
  'print-employee': el => {
    const e = get('employee', el.dataset.id), cycle = cycleOf();
    const mine = all('employeePayment').filter(p => p.employeeId === e.id);
    printEmployee(e, employeeMonths(e, all('employeeAttendance'), all('employeePayment'), cycle), cycle, sum(mine, p => p.amount), settings());
  }
});
document.addEventListener('ledra:add', ev => { if (ev.detail === 'employee') employeeForm(null); });
