// Ledra web · shell, routing and sign-in.
import { configured, watchAuth, signIn, onChange, sync, settings } from './store.js';
import { $, $$, esc, ACT, INPUT, CHANGE, icon, logo, applyTheme, toast, pill } from './ui.js';
import { dashboardView, peopleView, personView } from './v-home.js';
import { fundsView, fundView } from './v-funds.js';
import { employeesView, employeeView } from './v-employees.js';
import { invoicesView, invoiceNewView, invoiceView, itemsView } from './invoices.js';
import { settingsView } from './v-settings.js';

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());

const NAV = [
  ['dashboard', 'home', 'Home'], ['people', 'people', 'People'], ['funds', 'wallet', 'Funds'],
  ['employees', 'work', 'Team'], ['invoices', 'receipt', 'Bills'], ['settings', 'settings', 'Settings']
];

const ROUTES = [
  [/^\/(dashboard)?$/, 'dashboard', dashboardView],
  [/^\/people$/, 'people', peopleView],
  [/^\/people\/([^/]+)$/, 'people', personView],
  [/^\/funds$/, 'funds', fundsView],
  [/^\/funds\/([^/]+)$/, 'funds', fundView],
  [/^\/employees$/, 'employees', employeesView],
  [/^\/employees\/([^/]+)$/, 'employees', employeeView],
  [/^\/invoices$/, 'invoices', invoicesView],
  [/^\/invoices\/new$/, 'invoices', invoiceNewView],
  [/^\/invoices\/edit\/([^/]+)$/, 'invoices', invoiceNewView],
  [/^\/invoices\/([^/]+)$/, 'invoices', invoiceView],
  [/^\/items$/, 'invoices', itemsView],
  [/^\/settings$/, 'settings', settingsView]
];

let user = null;
let authKnown = false;
let lastRoute = '';
let pendingRender = false;

const route = () => location.hash.replace(/^#/, '') || '/dashboard';

/* ---------------- screens ---------------- */

function gateHTML() {
  if (!configured) {
    return `<div class="gate"><div class="gate-card">${logo(64)}<h1>Set up Ledra web</h1>
      <p class="muted">Open <b>firebase-config.js</b> and paste your Firebase web config. See README.md, step 1. Then reload this page.</p></div></div>`;
  }
  if (!authKnown) return `<div class="gate"><div class="gate-card">${logo(64)}<p class="muted">Loading…</p></div></div>`;
  return `<div class="gate"><div class="gate-card">${logo(72)}<h1>Ledra</h1><p class="muted">Your payment records, live on every device.</p>
    <button class="btn primary big" data-act="sign-in">Continue with Google</button><p class="muted small">Use the same Google account as the phone app.</p><p id="gate-err" class="notice bad" hidden></p><a class="mx-back" href="../ledra.html">← Back to Ledra app page</a></div></div>`;
}

function shellHTML() {
  const cur = ROUTES.find(r => r[0].test(route()));
  const active = cur ? cur[1] : 'dashboard';
  const links = NAV.map(([key, ic, label]) => `<a class="nav-i ${key === active ? 'on' : ''}" href="#/${key}">${icon(ic, 22)}<span>${label}</span></a>`).join('');
  return `<div class="shell"><aside class="side"><div class="brand">${logo(36)}<div><b>Ledra</b><small>Payment records</small></div></div><nav>${links}</nav>
      <div class="side-foot"><div id="syncdot" class="syncdot"></div><a class="mx-back" href="../ledra.html">← Ledra app &amp; downloads</a></div></aside>
    <div class="main"><header class="topbar"><div class="brand">${logo(30)}<b>Ledra</b></div><div id="syncdot2" class="syncdot"></div></header>
      <main id="view"></main></div>
    <nav class="bottom">${links}</nav></div>`;
}

function updateChrome() {
  const map = { live: ['Live', 'good'], connecting: ['Connecting', 'neutral'], offline: ['Offline', 'warn'], error: ['Sync problem', 'bad'] };
  const [t, tone] = map[sync.status] || map.connecting;
  $$('.syncdot').forEach(el => { el.className = 'syncdot ' + tone; el.innerHTML = `<i></i>${t}`; });
}

function render() {
  const app = $('#app');
  if (!user) { app.innerHTML = gateHTML(); return; }
  if (!$('#view')) app.innerHTML = shellHTML();
  const r = route();
  let hit = null, params = {};
  for (const [re, , fn] of ROUTES) {
    const m = r.match(re);
    if (m) { hit = fn; params = { id: m[1] && m[1] !== 'dashboard' ? decodeURIComponent(m[1]) : undefined }; break; }
  }
  const out = hit ? hit(params) : '<div class="empty"><b>Page not found</b></div>';
  const { html, mount } = typeof out === 'string' ? { html: out } : out;
  $('#view').innerHTML = html;
  $$('.nav-i').forEach((a, i) => a.classList.toggle('on', ROUTES.find(x => x[0].test(r))?.[1] === NAV[i % NAV.length][0]));
  if (mount) mount();
  if (r !== lastRoute) { window.scrollTo(0, 0); lastRoute = r; }
  updateChrome();
}

/* ---------------- events ---------------- */

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { if (el.tagName === 'A' && !el.getAttribute('href')) e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && INPUT[el.dataset.input]) INPUT[el.dataset.input](el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el, e);
});

ACT['sign-in'] = async () => {
  try { await signIn(); } catch (err) {
    const box = $('#gate-err');
    if (box) { box.hidden = false; box.textContent = err && err.code === 'auth/unauthorized-domain' ? 'This web address is not allowed yet. In Firebase console > Authentication > Settings > Authorised domains, add it.' : String((err && err.message) || err); }
  }
};

window.addEventListener('hashchange', render);
document.addEventListener('ledra:render', render);
document.addEventListener('focusout', () => {
  if (pendingRender) { pendingRender = false; setTimeout(render, 80); }
});

onChange(() => {
  if (!user) return;
  updateChrome();
  // Don't pull the page away while someone is typing or building a bill.
  if (/^\/invoices\/(new|edit)/.test(route())) return;
  const a = document.activeElement;
  if (a && a.closest && a.closest('#view') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { pendingRender = true; return; }
  render();
});

watchAuth(u => { user = u; authKnown = true; $('#app').innerHTML = ''; render(); });
render();
