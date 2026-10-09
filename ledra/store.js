// Ledra web · live data. Every record is one Firestore document at
//   ledra_backups/{uid}/records/{type}__{id}   ->  { t: type, j: "<record as JSON text>", u: time, by: device }
// The phone app reads and writes the very same documents, so a change on either side reaches the other in about a second.
// (This path sits under the Firestore rule you already published for backup, so no new rule is needed.)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInWithCredential, getRedirectResult, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, writeBatch, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { ssoSignIn, clearHandoff } from '../js/sso.js';
import { DEFAULT_SETTINGS, DEFAULT_SHOP } from './core.js';

export const configured = !String(firebaseConfig.apiKey).startsWith('PASTE');

const TYPES = [
  'person', 'payment', 'fund', 'fundContributor', 'fundContribution',
  'employee', 'employeeAttendance', 'employeePayment',
  'product', 'invoice', 'settings', 'shop'
];

export const db = {};
TYPES.forEach(t => { db[t] = new Map(); });

export const sync = { status: 'connecting', error: '', user: null, ready: false };

const DEVICE = (() => {
  let d = localStorage.getItem('ledra-device');
  if (!d) { d = 'web-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('ledra-device', d); }
  return d;
})();

const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
let queued = false;
function notify() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }, 30);
}

let app, auth, fs, col = null, unsub = null;

if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  try {
    fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    fs = initializeFirestore(app, {});
  }
}

/* ---------------- reading ---------------- */

export const all = type => [...db[type].values()];
export const get = (type, id) => db[type].get(id);
export const settings = () => ({ ...DEFAULT_SETTINGS, ...(db.settings.get('main') || {}) });
export const shop = () => ({ ...DEFAULT_SHOP, ...(db.shop.get('main') || {}) });

const idOfDoc = docId => docId.slice(docId.indexOf('__') + 2);

function apply(change) {
  const d = change.doc;
  const data = d.data();
  const type = data.t || d.id.slice(0, d.id.indexOf('__'));
  if (!db[type]) return;
  const id = idOfDoc(d.id);
  if (change.type === 'removed') { db[type].delete(id); return; }
  try {
    const rec = JSON.parse(data.j);
    if (type === 'settings' || type === 'shop') rec.id = 'main';
    else if (!rec.id) rec.id = id;
    db[type].set(id, rec);
  } catch (e) {
    console.warn('Skipped unreadable record', d.id, e);
  }
}

function listen(user) {
  stopListening();
  col = collection(fs, 'ledra_backups', user.uid, 'records');
  sync.status = 'connecting';
  unsub = onSnapshot(col, { includeMetadataChanges: true }, snap => {
    snap.docChanges().forEach(apply);
    sync.ready = true;
    sync.error = '';
    sync.status = snap.metadata.fromCache ? 'offline' : 'live';
    notify();
  }, err => {
    sync.status = 'error';
    sync.error = String(err && err.code === 'permission-denied'
      ? 'Firestore blocked access. Publish the Ledra rules (Settings in the phone app has a Copy rules button), then reload.'
      : (err && err.message) || err);
    notify();
  });
}

function stopListening() {
  if (unsub) { unsub(); unsub = null; }
  TYPES.forEach(t => db[t].clear());
  sync.ready = false;
  col = null;
}

/* ---------------- writing ---------------- */

function failed(e) {
  console.error(e);
  sync.status = 'error';
  sync.error = String((e && e.message) || e);
  notify();
}

export function put(type, rec) {
  if (!col) return Promise.resolve();
  const id = rec.id;
  return setDoc(doc(col, `${type}__${id}`), { t: type, j: JSON.stringify(rec), u: Date.now(), by: DEVICE }).catch(failed);
}

/** Delete several records in one go: [[type, id], ...] */
export function removeMany(pairs) {
  if (!col || !pairs.length) return Promise.resolve();
  const jobs = [];
  for (let i = 0; i < pairs.length; i += 400) {
    const b = writeBatch(fs);
    pairs.slice(i, i + 400).forEach(([t, id]) => b.delete(doc(col, `${t}__${id}`)));
    jobs.push(b.commit());
  }
  return Promise.all(jobs).catch(failed);
}

export const remove = (type, id) => removeMany([[type, id]]);

/* Deleting something also deletes what hangs under it, exactly like the phone app. */
export const removePerson = id => removeMany([['person', id], ...all('payment').filter(p => p.personId === id).map(p => ['payment', p.id])]);
export const removeFund = id => removeMany([
  ['fund', id],
  ...all('fundContributor').filter(c => c.fundId === id).map(c => ['fundContributor', c.id]),
  ...all('fundContribution').filter(c => c.fundId === id).map(c => ['fundContribution', c.id])
]);
export const removeContributor = id => removeMany([
  ['fundContributor', id],
  ...all('fundContribution').filter(c => c.contributorId === id).map(c => ['fundContribution', c.id])
]);
export const removeEmployee = id => removeMany([
  ['employee', id],
  ...all('employeeAttendance').filter(a => a.employeeId === id).map(a => ['employeeAttendance', a.id]),
  ...all('employeePayment').filter(p => p.employeeId === id).map(p => ['employeePayment', p.id])
]);

export const putSettings = patch => put('settings', { ...settings(), ...patch, id: 'main' });
export const putShop = patch => put('shop', { ...shop(), ...patch, id: 'main' });

/* ---------------- sign in ---------------- */

export function watchAuth(cb) {
  if (!configured) { cb(null); return; }
  getRedirectResult(auth).catch(() => {});
  let ssoTried = false;
  onAuthStateChanged(auth, async user => {
    if (!user && !ssoTried) {
      // Signed in to Maniaxe with Google a moment ago? Reuse that sign-in.
      ssoTried = true;
      if (await ssoSignIn(auth, GoogleAuthProvider, signInWithCredential)) return;   // fires again with the user
    }
    sync.user = user;
    if (user) listen(user); else stopListening();
    cb(user);
    notify();
  });
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      await signInWithRedirect(auth, provider);
    } else if (!(e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request'))) {
      throw e;
    }
  }
}

export const signOutUser = () => { clearHandoff(); return signOut(auth); };

/** Everything as one JSON text, for a manual download. */
export function exportAll() {
  const out = {};
  TYPES.forEach(t => { out[t] = all(t); });
  return JSON.stringify(out, null, 2);
}
