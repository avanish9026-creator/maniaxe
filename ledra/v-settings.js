// Ledra web · Settings.
import { money, uid, num, round2, PAYMENT_MODES } from './core.js';
import { all, settings, putSettings, shop, putShop, sync, signOutUser, exportAll } from './store.js';
import {
  esc, ACT, CHANGE, icon, pill, avatar, sectionTitle, field, chips, switchRow,
  modal, confirmBox, toast, themeMode, setTheme, rerender, download
} from './ui.js';

const STATUS = { live: ['Live', 'good'], connecting: ['Connecting…', 'neutral'], offline: ['Offline · will sync', 'warn'], error: ['Problem', 'bad'] };

export function settingsView() {
  const s = settings(), sh = shop(), sym = s.currency;
  const [stText, stTone] = STATUS[sync.status] || STATUS.connecting;
  const u = sync.user;
  const num2 = (k, v, min, max, store = 's') => `<input type="number" min="${min}" max="${max}" value="${esc(v)}" data-change="set" data-s="${store}" data-k="${k}" data-t="int">`;
  const text = (k, v, store = 's', ph = '') => `<input value="${esc(v)}" placeholder="${esc(ph)}" data-change="set" data-s="${store}" data-k="${k}" data-t="text">`;
  const sw = (label, sub, k, on, store = 's') => `<label class="switch-row"><span><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><input type="checkbox" class="sw" ${on ? 'checked' : ''} data-change="set" data-s="${store}" data-k="${k}" data-t="bool"></label>`;
  const opt = (label, ctl) => `<label class="opt"><span>${esc(label)}</span>${ctl}</label>`;
  return `
  <div class="page-head"><div><h1>Settings</h1></div></div>
  <div class="two-col">
  <div>
    ${sectionTitle('Account and sync')}
    <div class="card">
      <div class="rowline">${u ? avatar(u.email || '?') : ''}<div class="grow"><b>${esc(u ? u.email : '')}</b><small>Same Google account as the phone app</small></div>${pill(stText, stTone)}</div>
      ${sync.error ? `<p class="notice bad">${esc(sync.error)}</p>` : '<p class="muted small">Changes made here show on your phone in about a second, and the other way round.</p>'}
      <div class="btn-row wrap"><button class="btn soft" data-act="download-all">${icon('cloud', 18)} Download all data</button><button class="btn ghost" data-act="sign-out">Sign out</button></div>
    </div>
    ${sectionTitle('Appearance')}
    <div class="card"><div class="chips inline">${['system', 'light', 'dark'].map(m => `<button class="chip-b ${themeMode() === m ? 'on' : ''}" data-act="theme" data-v="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div></div>
    ${sectionTitle('Billing')}
    <div class="card opts">
      ${opt('Billing day (a new month starts)', num2('billingDay', s.billingDay, 1, 28))}
      ${opt('Payment day (payments are due)', num2('dueDay', s.dueDay, 1, 28))}
      ${opt('Currency symbol', text('currency', s.currency))}
    </div>
    ${sectionTitle('Fixed charges', `<button class="btn soft sm" data-act="add-charge">${icon('plus', 16)} Add</button>`)}
    <div class="card list-card">${s.charges.length ? s.charges.map(c => `<div class="row"><div class="grow"><b>${esc(c.name)}</b><small>${esc(money(sym, c.amount))} per month</small></div>
      <button class="icon-btn sm" data-act="edit-charge" data-id="${c.id}" aria-label="Edit">${icon('edit', 16)}</button><button class="icon-btn sm" data-act="del-charge" data-id="${c.id}" aria-label="Delete">${icon('trash', 16)}</button></div>`).join('')
      : '<div class="row"><span class="muted">Add charges like rent or water once, then tick them on each person.</span></div>'}</div>
  </div>
  <div>
    ${sectionTitle('Shop and invoices')}
    <div class="card opts">
      ${opt('Shop name', text('name', sh.name, 'h'))}${opt('Address', text('address', sh.address, 'h'))}${opt('Phone', text('phone', sh.phone, 'h'))}${opt('GSTIN (optional)', text('gstin', sh.gstin, 'h'))}
      ${opt('Bill number prefix', text('prefix', sh.prefix, 'h'))}${opt('Footer line on bills', text('footer', sh.footer, 'h'))}
      ${opt('Units (comma separated)', `<input value="${esc(sh.units.join(', '))}" data-change="set" data-s="h" data-k="units" data-t="list">`)}
      ${opt('Default print', `<select data-change="set" data-s="h" data-k="paper" data-t="text"><option value="a4" ${sh.paper !== 'receipt' ? 'selected' : ''}>A4 invoice</option><option value="receipt" ${sh.paper === 'receipt' ? 'selected' : ''}>80 mm receipt</option></select>`)}
      ${sw('Prices include GST', 'Normal for shop MRP. Turn off to add GST on top.', 'taxInclusive', sh.taxInclusive, 'h')}
    </div>
    ${sectionTitle('Defaults for new records')}
    <div class="card opts">
      ${opt('New fund type', `<select data-change="set" data-s="s" data-k="fundDefaultDirection" data-t="text"><option value="collect" ${s.fundDefaultDirection === 'collect' ? 'selected' : ''}>Collect</option><option value="give" ${s.fundDefaultDirection === 'give' ? 'selected' : ''}>Give</option></select>`)}
      ${opt('New fund method', `<select data-change="set" data-s="s" data-k="fundDefaultMode" data-t="text">${PAYMENT_MODES.filter(m => m !== 'Other').map(m => `<option ${s.fundDefaultMode === m ? 'selected' : ''}>${m}</option>`).join('')}</select>`)}
      ${opt('New employee basis', `<select data-change="set" data-s="s" data-k="employeeDefaultBasis" data-t="text">${['Monthly', 'Daily', 'Yearly', 'Work / Project'].map(m => `<option ${s.employeeDefaultBasis === m ? 'selected' : ''}>${m}</option>`).join('')}</select>`)}
      ${opt('Working days per month', num2('employeeDefaultWorkingDays', s.employeeDefaultWorkingDays, 1, 31))}
    </div>
    ${sectionTitle('Fields on the person form')}
    <div class="card opts">${sw('Email', '', 'showEmail', s.showEmail)}${sw('Address', '', 'showAddress', s.showAddress)}${sw('ID note', '', 'showIdNote', s.showIdNote)}${sw('Notes', '', 'showNotes', s.showNotes)}</div>
  </div></div>`;
}

CHANGE.set = el => {
  const { s, k, t } = el.dataset;
  let v = t === 'bool' ? el.checked : t === 'int' ? Math.round(num(el.value)) : t === 'list' ? el.value.split(',').map(x => x.trim()).filter(Boolean) : el.value.trim();
  if (t === 'int') {
    const lim = { billingDay: [1, 28], dueDay: [1, 28], employeeDefaultWorkingDays: [1, 31] }[k];
    if (lim) v = Math.min(Math.max(v, lim[0]), lim[1]);
  }
  if (k === 'currency' && !v) return;
  if (t === 'list' && !v.length) return;
  (s === 'h' ? putShop : putSettings)({ [k]: v });
  toast('Saved');
};

function chargeForm(id) {
  const s = settings();
  const ex = id ? s.charges.find(c => c.id === id) : null;
  modal({
    title: ex ? 'Edit charge' : 'New charge',
    body: `${field('Name', 'name', ex?.name, { required: true, autofocus: true })}${field('Monthly amount (' + s.currency + ')', 'amount', ex ? ex.amount : '', { type: 'number', step: '0.01', min: 0, required: true })}`,
    buttons: [{ label: 'Cancel', kind: 'ghost', onClick: () => true }, {
      label: 'Save', kind: 'primary', onClick: async fd => {
        const rec = { id: ex ? ex.id : uid(), name: String(fd.get('name')).trim(), amount: round2(num(fd.get('amount'))) };
        if (rec.amount <= 0) { toast('Enter an amount'); return false; }
        await putSettings({ charges: ex ? s.charges.map(c => (c.id === ex.id ? rec : c)) : [...s.charges, rec] });
      }
    }]
  });
}

Object.assign(ACT, {
  theme: el => { setTheme(el.dataset.v); rerender(); },
  'add-charge': () => chargeForm(null),
  'edit-charge': el => chargeForm(el.dataset.id),
  'del-charge': el => {
    const s = settings(), c = s.charges.find(x => x.id === el.dataset.id);
    if (c) confirmBox('Delete ' + c.name + '?', 'People who already have this charge keep their own copy.', 'Delete', () => putSettings({ charges: s.charges.filter(x => x.id !== c.id) }));
  },
  'sign-out': () => signOutUser(),
  'download-all': () => download('ledra-data-' + new Date().toISOString().slice(0, 10) + '.json', exportAll(), 'application/json')
});
