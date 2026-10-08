// Ledra web · small UI toolkit (no framework).

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Click and input handlers are registered here by name: <button data-act="name">. */
export const ACT = {};
export const INPUT = {};
export const CHANGE = {};

/* ---------------- icons ---------------- */

const I = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2c2.6.2 4.5 2 4.5 5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.2"/><path d="M6 6l9-3v3"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5h6v2M3 13h18"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 01-.5-9A6 6 0 0118 10.5 3.8 3.8 0 0117.5 18z"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  minus: '<path d="M5 12h14"/>',
  cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.6 12h11l2-8H6"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/>'
};
export const icon = (name, size = 20) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || ''}</svg>`;

export const logo = (size = 40) => `<svg width="${size}" height="${size}" viewBox="0 0 108 108" aria-hidden="true"><rect width="108" height="108" rx="30" fill="#0B5FFF"/><path d="M42 34v36h26" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M53 46l6 6 11-14" fill="none" stroke="#9CD3FF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------------- small components ---------------- */

export const pill = (text, tone = 'neutral') => `<span class="pill ${tone}">${esc(text)}</span>`;
export const avatar = (name, cls = '') => `<span class="avatar ${cls}">${esc((String(name || '?').trim()[0] || '?').toUpperCase())}</span>`;
export const stat = (label, value, tone = '') => `<div class="stat"><div class="lbl">${esc(label)}</div><div class="val ${tone}">${esc(value)}</div></div>`;
export const empty = (ic, title, sub = '') => `<div class="empty"><div class="badge">${icon(ic, 26)}</div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
export const progress = (fraction, tone = '') => `<div class="progress ${tone}"><i style="width:${Math.round(Math.min(Math.max(fraction, 0), 1) * 1000) / 10}%"></i></div>`;
export const sectionTitle = (text, right = '') => `<div class="sec"><span>${esc(text)}</span>${right}</div>`;
export const iconBtn = (ic, label, act, id = '', extra = '') => `<button class="icon-btn ${extra}" title="${esc(label)}" aria-label="${esc(label)}" data-act="${act}" ${id ? `data-id="${esc(id)}"` : ''}>${icon(ic, 18)}</button>`;
export const backLink = href => `<a class="icon-btn" href="${href}" title="Back" aria-label="Back">${icon('back', 18)}</a>`;

export function field(label, name, value = '', o = {}) {
  const type = o.type || 'text';
  const attrs = [`name="${name}"`, `type="${type}"`, `value="${esc(value)}"`];
  if (o.step) attrs.push(`step="${o.step}"`);
  if (o.min != null) attrs.push(`min="${o.min}"`);
  if (o.max != null) attrs.push(`max="${o.max}"`);
  if (o.placeholder) attrs.push(`placeholder="${esc(o.placeholder)}"`);
  if (o.required) attrs.push('required');
  if (o.list) attrs.push(`list="${o.list}"`);
  if (o.inputmode) attrs.push(`inputmode="${o.inputmode}"`);
  if (o.autofocus) attrs.push('autofocus');
  if (type === 'textarea') return `<label class="f ${o.cls || ''}"><span>${esc(label)}</span><textarea name="${name}" rows="${o.rows || 2}">${esc(value)}</textarea></label>`;
  return `<label class="f ${o.cls || ''}"><span>${esc(label)}</span><input ${attrs.join(' ')}></label>`;
}

/** Radio buttons that look like chips. Read the value with FormData. */
export function chips(name, options, selected) {
  return `<div class="chips">${options.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<label class="chip"><input type="radio" name="${name}" value="${esc(v)}" ${String(v) === String(selected) ? 'checked' : ''}><span>${esc(l)}</span></label>`;
  }).join('')}</div>`;
}

export function select(label, name, options, selected, cls = '') {
  return `<label class="f ${cls}"><span>${esc(label)}</span><select name="${name}">${options.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('')}</select></label>`;
}

export function switchRow(label, sub, name, on) {
  return `<label class="switch-row"><span><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><input type="checkbox" class="sw" name="${name}" ${on ? 'checked' : ''}></label>`;
}

/* ---------------- toast, modal, confirm ---------------- */

let toastTimer = 0;
export function toast(msg, tone = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show ' + tone;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2600);
}

/**
 * modal({ title, body, wide, buttons: [{ label, kind, onClick(fd, close) }] })
 * fd is the FormData of the form inside the body (if any). Return false from onClick to keep the dialog open.
 */
export function modal({ title, body, buttons = [], wide = false, onMount }) {
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `<div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="dlg-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${icon('x', 18)}</button></div>
    <form class="dlg-body" autocomplete="off">${body}</form>
    <div class="dlg-foot">${buttons.map((b, i) => `<button type="button" class="btn ${b.kind || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
  </div>`;
  root.appendChild(wrap);
  const form = $('form', wrap);
  const close = () => { wrap.remove(); };
  const run = async i => {
    const b = buttons[i];
    if (!b) return;
    if (b.kind !== 'ghost' && !form.reportValidity()) return;
    const res = await b.onClick(new FormData(form), close, form);
    if (res !== false) close();
  };
  wrap.addEventListener('click', e => {
    if (e.target === wrap || e.target.closest('[data-close]')) { close(); return; }
    const btn = e.target.closest('button[data-i]');
    if (btn) run(Number(btn.dataset.i));
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const primary = buttons.findIndex(b => !b.kind || b.kind === 'primary');
    if (primary >= 0) run(primary);
  });
  wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  if (onMount) onMount(form, close);
  const first = $('[autofocus]', form) || $('input:not([type=radio]):not([type=checkbox]), select, textarea', form);
  if (first) setTimeout(() => first.focus(), 30);
  return { close, form };
}

export function confirmBox(title, text, okLabel, onOk, danger = true) {
  modal({
    title, body: `<p class="muted">${esc(text)}</p>`,
    buttons: [
      { label: 'Cancel', kind: 'ghost', onClick: () => true },
      { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: async (fd, close) => { await onOk(); return true; } }
    ]
  });
}

/* ---------------- theme ---------------- */

export function applyTheme(mode = localStorage.getItem('ledra-theme') || 'system') {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0A0E14' : '#F3F6FB');
}
export const themeMode = () => localStorage.getItem('ledra-theme') || 'system';
export function setTheme(mode) { localStorage.setItem('ledra-theme', mode); applyTheme(mode); }

/** Download text as a file. */
export function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------------- shared screen state ---------------- */

export const vs = {
  mode: localStorage.getItem('ledra-mode') || 'collect',
  filter: 'Active', q: '', fq: '', eq: '', iq: '', ifilter: 'Today', itemq: ''
};
export const rerender = () => document.dispatchEvent(new Event('ledra:render'));
export const go = hash => { location.hash = hash; };
