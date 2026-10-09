// Ledra web · Funds.
import { money, dateText, monthText, todayStr, uid, num, round2, PAYMENT_MODES, fundMonths, ymStr, ymOfDate, sum } from './core.js';
import { all, get, put, remove, removeFund, removeContributor, settings } from './store.js';
import {
  esc, $, ACT, INPUT, icon, pill, avatar, stat, empty, progress, sectionTitle, iconBtn, backLink, field, chips, select,
  modal, confirmBox, toast, vs, rerender, go
} from './ui.js';
import { printFund } from './print.js';

const fundTotal = f => sum(all('fundContribution').filter(c => c.fundId === f.id), c => c.amount);

function fundsListHTML() {
  const sym = settings().currency, q = vs.fq.trim().toLowerCase();
  const funds = all('fund');
  if (!funds.length) return empty('wallet', 'No funds yet', 'Track money collected for a goal, a loan or an event');
  const list = funds.filter(f => {
    if (!q) return true;
    const entries = all('fundContribution').filter(c => c.fundId === f.id);
    const names = all('fundContributor').filter(c => c.fundId === f.id).map(c => c.name).join(' ').toLowerCase();
    return f.name.toLowerCase().includes(q) || names.includes(q) || money(sym, fundTotal(f)).toLowerCase().includes(q) ||
      entries.some(e => dateText(e.date).toLowerCase().includes(q) || money(sym, e.amount).toLowerCase().includes(q));
  }).sort((a, b) => b.created - a.created);
  if (!list.length) return empty('search', 'No matching funds');
  return `<div class="stack">${list.map(f => {
    const total = fundTotal(f), n = all('fundContribution').filter(c => c.fundId === f.id).length;
    const left = f.target ? Math.max(f.target - total, 0) : null;
    return `<a class="row col" href="#/funds/${f.id}"><div class="rowline"><span class="badge sm">${icon('wallet', 20)}</span><div class="grow"><b>${esc(f.name)}</b>
      <small>${pill(f.direction === 'collect' ? 'Collect' : 'Give', 'info')} ${n} ${n === 1 ? 'payment' : 'payments'}</small></div>
      <div class="end"><b>${esc(money(sym, total))}</b>${left != null ? `<small class="${left > 0.005 ? '' : 'good'}">${left > 0.005 ? esc(money(sym, left)) + ' left' : 'Target reached'}</small>` : ''}</div></div>
      ${f.target ? progress(total / f.target, total >= f.target ? 'good' : '') : ''}</a>`;
  }).join('')}</div>`;
}

export function fundsView() {
  return `<div class="page-head"><div><h1>Funds</h1></div><button class="btn primary" data-act="add-fund-form">${icon('plus', 18)} Add</button></div>
  ${all('fund').length ? `<div class="toolbar"><div class="search">${icon('search', 18)}<input data-input="funds-q" placeholder="Search name, source, amount or date" value="${esc(vs.fq)}"></div></div>` : ''}
  <div id="list">${fundsListHTML()}</div>`;
}

export function fundView({ id }) {
  const f = get('fund', id);
  if (!f) return empty('wallet', 'Not found', 'This fund may have been deleted on another device');
  const s = settings(), sym = s.currency;
  const entries = all('fundContribution').filter(c => c.fundId === id);
  const sources = all('fundContributor').filter(c => c.fundId === id);
  const total = sum(entries, c => c.amount);
  const left = f.target ? Math.max(f.target - total, 0) : 0;
  const months = fundMonths(entries, sources);
  const accent = f.direction === 'collect' ? 'good' : '';
  return `
  <div class="page-head"><div class="with-back">${backLink('#/funds')}<div><h1>${esc(f.name)}</h1><p class="muted">${f.direction === 'collect' ? 'Collection fund' : 'Payment fund'} · started ${esc(dateText(f.start))}</p></div></div>
    <div class="actions">${iconBtn('print', 'Print / PDF', 'print-fund', id)}${iconBtn('edit', 'Edit', 'edit-fund', id)}</div></div>
  <div class="card"><div class="eyebrow dark">${f.direction === 'collect' ? 'COLLECTED' : 'RECORDED'}</div><div class="big dark ${accent}">${esc(money(sym, total))}</div>
    ${f.target ? `<div class="muted">Target ${esc(money(sym, f.target))} · ${left > 0.005 ? esc(money(sym, left)) + ' left' : 'reached'}</div>${progress(total / f.target, left > 0.005 ? '' : 'good')}` : ''}
    <div class="stats-grid tight">${stat('Payments', String(entries.length))}${stat('Sources', String(sources.length))}</div></div>
  ${f.notes ? `<div class="card flat muted">${esc(f.notes)}</div>` : ''}
  <div class="btn-row"><button class="btn soft" data-act="add-source" data-id="${id}">${icon('people', 18)} Add source</button><button class="btn primary" data-act="add-entry" data-id="${id}">${icon('plus', 18)} Add payment</button></div>
  <div class="two-col">
    <div>${sectionTitle('History by month')}${months.length ? months.map(mg => `
      <div class="mgroup"><div class="mg-head"><b>${esc(monthText(mg.month))}</b><span class="muted">${mg.count} ${mg.count === 1 ? 'payment' : 'payments'} · ${mg.rows.length} ${mg.rows.length === 1 ? 'source' : 'sources'}</span><b class="${accent}">${esc(money(sym, mg.total))}</b></div>
      ${mg.rows.map(g => `<div class="card flat gcard"><div class="gline"><b>${esc(g.name)}</b>${g.pays.length > 1 ? `<span class="muted">${g.pays.length} payments</span>` : ''}<b>${esc(money(sym, g.total))}</b></div>
        ${g.pays.map(e => `<div class="slice"><span class="dot"></span><span class="grow">${esc(dateText(e.date))} · ${esc(e.mode)}${e.note ? ' · ' + esc(e.note) : ''}</span>${g.pays.length > 1 ? `<b>${esc(money(sym, e.amount))}</b>` : ''}
          <span class="mini">${iconBtn('edit', 'Edit', 'edit-entry', e.id, 'sm')}${iconBtn('trash', 'Delete', 'del-entry', e.id, 'sm')}</span></div>`).join('')}</div>`).join('')}</div>`).join('') : empty('receipt', 'No payments yet')}</div>
    <div>${sectionTitle('Sources')}${sources.length ? `<div class="stack">${sources.map(c => {
      const mine = entries.filter(e => e.contributorId === c.id);
      return `<div class="row">${avatar(c.name)}<div class="grow"><b>${esc(c.name)}</b><small>${esc(c.type)}${c.phone ? ' · ' + esc(c.phone) : ''} · ${mine.length} ${mine.length === 1 ? 'payment' : 'payments'}</small></div><b>${esc(money(sym, sum(mine, e => e.amount)))}</b>
        <span class="mini">${iconBtn('edit', 'Edit', 'edit-source', c.id, 'sm')}${iconBtn('trash', 'Delete', 'del-source', c.id, 'sm')}</span></div>`;
    }).join('')}</div>` : '<div class="card flat muted">Add the people or places the money comes from, then record payments against them.</div>'}</div>
  </div>`;
}

export function fundForm(id) {
  const s = settings();
  const ex = id ? get('fund', id) : null;
  modal({
    title: ex ? 'Edit fund' : 'New fund',
    body: `${field('Name', 'name', ex?.name, { required: true, autofocus: true })}
      <div class="f"><span>Type</span>${chips('direction', [['collect', 'Collect'], ['give', 'Give']], ex ? ex.direction : s.fundDefaultDirection)}</div>
      <div class="grid2">${field('Target amount (optional)', 'target', ex && ex.target ? ex.target : '', { type: 'number', step: '0.01', min: 0 })}${field('Start date', 'start', ex?.start || todayStr(), { type: 'date', required: true })}</div>
      <div class="f"><span>Default method for new payments</span>${chips('defaultMode', PAYMENT_MODES.filter(m => m !== 'Other'), ex ? ex.defaultMode : s.fundDefaultMode)}</div>
      ${field('Notes', 'notes', ex?.notes, { type: 'textarea' })}`,
    buttons: [
      ...(ex ? [{ label: 'Delete', kind: 'danger-ghost', onClick: () => { confirmBox('Delete ' + ex.name + '?', 'Its sources and payments are deleted too.', 'Delete', async () => { await removeFund(ex.id); go('#/funds'); }); return true; } }] : []),
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          const t = num(fd.get('target'));
          const rec = { id: ex ? ex.id : uid(), name: String(fd.get('name')).trim(), direction: fd.get('direction'), target: t > 0 ? round2(t) : null, start: fd.get('start'), end: ex ? ex.end || '' : '', defaultMode: fd.get('defaultMode'), notes: String(fd.get('notes') || '').trim(), created: ex ? ex.created : Date.now() };
          await put('fund', rec);
          toast('Saved');
          if (!ex) go('#/funds/' + rec.id);
        }
      }
    ]
  });
}

function sourceForm(fundId, id) {
  const ex = id ? get('fundContributor', id) : null;
  modal({
    title: ex ? 'Edit source' : 'New source',
    body: `${field('Name', 'name', ex?.name, { required: true, autofocus: true })}
      <div class="f"><span>Type</span>${chips('type', ['Person', 'Organisation', 'Other'], ex ? ex.type : 'Person')}</div>
      <div class="grid2">${field('Phone', 'phone', ex?.phone, { type: 'tel' })}${field('Email', 'email', ex?.email, { type: 'email' })}</div>
      ${field('Address', 'address', ex?.address)}${field('Notes', 'notes', ex?.notes, { type: 'textarea' })}`,
    buttons: [
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          await put('fundContributor', {
            id: ex ? ex.id : uid(), fundId, name: String(fd.get('name')).trim(), type: fd.get('type'), phone: String(fd.get('phone') || '').trim(),
            email: String(fd.get('email') || '').trim(), address: String(fd.get('address') || '').trim(), idNote: ex ? ex.idNote || '' : '', notes: String(fd.get('notes') || '').trim(), created: ex ? ex.created : Date.now()
          });
        }
      }
    ]
  });
}

function entryForm(fundId, id) {
  const f = get('fund', fundId);
  const sources = all('fundContributor').filter(c => c.fundId === fundId);
  if (!sources.length) { toast('Add a source first'); return; }
  const ex = id ? get('fundContribution', id) : null;
  const known = PAYMENT_MODES.filter(m => m !== 'Other');
  modal({
    title: ex ? 'Edit payment' : 'New payment',
    body: `${select('Source', 'contributorId', sources.map(c => [c.id, c.name]), ex ? ex.contributorId : sources[0].id)}
      <div class="grid2">${field('Amount (' + settings().currency + ')', 'amount', ex?.amount, { type: 'number', step: '0.01', min: 0, required: true, inputmode: 'decimal', autofocus: true })}${field('Date', 'date', ex?.date || todayStr(), { type: 'date', required: true })}</div>
      <div class="f"><span>Method</span>${chips('mode', PAYMENT_MODES, ex ? (known.includes(ex.mode) ? ex.mode : 'Other') : f.defaultMode)}</div>
      ${field('Other method', 'other', ex && !known.includes(ex.mode) ? ex.mode : '', { cls: 'other-pick' })}${field('Note', 'note', ex?.note)}`,
    onMount: form => {
      const sync = () => { form.querySelector('.other-pick').style.display = form.querySelector('input[name=mode]:checked')?.value === 'Other' ? '' : 'none'; };
      sync(); form.addEventListener('change', sync);
    },
    buttons: [
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      {
        label: 'Save', kind: 'primary', onClick: async fd => {
          const amount = round2(num(fd.get('amount')));
          if (amount <= 0) { toast('Enter an amount'); return false; }
          const date = fd.get('date');
          await put('fundContribution', {
            id: ex ? ex.id : uid(), fundId, contributorId: fd.get('contributorId'), amount, date, month: ymStr(ymOfDate(date)),
            mode: fd.get('mode') === 'Other' ? (String(fd.get('other')).trim() || 'Other') : fd.get('mode'), note: String(fd.get('note') || '').trim(), created: ex ? ex.created : Date.now()
          });
          toast('Saved');
        }
      }
    ]
  });
}

Object.assign(INPUT, { 'funds-q': el => { vs.fq = el.value; $('#list').innerHTML = fundsListHTML(); } });
Object.assign(ACT, {
  'add-fund-form': () => fundForm(null),
  'edit-fund': el => fundForm(el.dataset.id),
  'add-source': el => sourceForm(el.dataset.id, null),
  'edit-source': el => { const c = get('fundContributor', el.dataset.id); if (c) sourceForm(c.fundId, c.id); },
  'del-source': el => { const c = get('fundContributor', el.dataset.id); if (c) confirmBox('Delete ' + c.name + '?', 'Its payments are deleted too.', 'Delete', () => removeContributor(c.id)); },
  'add-entry': el => entryForm(el.dataset.id, null),
  'edit-entry': el => { const e = get('fundContribution', el.dataset.id); if (e) entryForm(e.fundId, e.id); },
  'del-entry': el => { const e = get('fundContribution', el.dataset.id); if (e) confirmBox('Delete this payment?', `${money(settings().currency, e.amount)} on ${dateText(e.date)}`, 'Delete', () => remove('fundContribution', e.id)); },
  'print-fund': el => {
    const f = get('fund', el.dataset.id);
    printFund(f, all('fundContributor').filter(c => c.fundId === f.id), all('fundContribution').filter(c => c.fundId === f.id), settings());
  }
});
document.addEventListener('ledra:add', e => { if (e.detail === 'fund') fundForm(null); });
