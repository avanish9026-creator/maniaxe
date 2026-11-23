import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider, browserLocalPersistence, onAuthStateChanged, setPersistence,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from "firebase/auth";
import {
  Timestamp, addDoc, arrayUnion, collection, collectionGroup, deleteDoc, deleteField, doc, getDoc,
  getFirestore, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import app, { auth, functions } from "./firebase";
import { ADMIN_EMAIL, ENDED_AT, PLANS, isOnline, ms, orderId, parseMoney, proInfo, proPatchFor } from "./lib/util";

export const db = getFirestore(app);
const Ctx = createContext(null);
export const useAdmin = () => useContext(Ctx);

const live = (ref, set, onErr, sort) =>
  onSnapshot(ref, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (sort) items.sort(sort);
    set(items);
  }, onErr);
const byTime = (f) => (a, b) => ms(b[f]) - ms(a[f]);

export function AdminProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState(null);

  const [users, setUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [pro, setPro] = useState([]);
  const [payments, setPayments] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loadError, setLoadError] = useState("");

  const notify = useCallback((text, tone = "ok") => {
    setToast({ text, tone, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.tone === "bad" ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- auth ----------
  const checkAdmin = useCallback(async (u) => {
    if (String(u.email || "").toLowerCase() === ADMIN_EMAIL) { setRole("owner"); setUser(u); return true; }
    try {
      const snap = await getDoc(doc(db, "adminStaff", u.uid));
      const d = snap.exists() ? snap.data() : null;
      if (d && d.role === "editor" && d.active !== false) { setRole("editor"); setUser(u); return true; }
    } catch (err) { console.warn("Team access check failed:", err); }
    setAuthError("This account is not authorized yet. To get access, send this Account ID to the Trakey owner: " + u.uid);
    signOut(auth);
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      if (u) await checkAdmin(u); else { setUser(null); setRole(""); }
      if (!cancelled) setAuthReady(true);
    });
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const t = setTimeout(() => !cancelled && setAuthReady(true), 8000);
    return () => { cancelled = true; unsub(); clearTimeout(t); };
  }, [checkAdmin]);

  const loginGoogle = async () => {
    setAuthError("");
    try { const r = await signInWithPopup(auth, new GoogleAuthProvider()); await checkAdmin(r.user); }
    catch (e) { setAuthError(e.message || "Google sign-in failed."); }
  };
  const loginEmail = async (email, password) => {
    setAuthError("");
    try { const r = await signInWithEmailAndPassword(auth, email, password); await checkAdmin(r.user); }
    catch { setAuthError("Invalid email or password."); }
  };
  const logout = () => signOut(auth);

  // ---------- live data ----------
  useEffect(() => {
    if (!user) { [setUsers, setBackups, setPro, setPayments, setFeedback, setContacts].forEach((s) => s([])); return undefined; }
    const owner = role === "owner";
    const err = (m) => (e) => setLoadError(e.message || m);
    const subs = [
      live(collection(db, "feedbackSubmissions"), setFeedback, err("Unable to load feedback."), byTime("submittedAt")),
      live(collection(db, "contactMessages"), setContacts, err("Unable to load contact messages."), byTime("submittedAt")),
    ];
    if (owner) {
      subs.push(
        live(collection(db, "users"), setUsers, err("Unable to load users.")),
        onSnapshot(collectionGroup(db, "backup"), (s) => setBackups(s.docs.filter((d) => d.id === "main")), err("Unable to load backups.")),
        live(collection(db, "payments"), setPayments, err("Unable to load payments."), byTime("createdAt")),
        live(collection(db, "proStatus"), setPro, () => setPro([]))
      );
    }
    return () => subs.forEach((u) => u());
  }, [user, role]);

  // One list of people, merged from users + backups + Pro records + payments.
  const people = useMemo(() => {
    const m = new Map();
    users.forEach((u) => m.set(u.id, { ...u, uid: u.id }));
    backups.forEach((b) => {
      const uid = b.ref?.parent?.parent?.id; if (!uid) return;
      const d = b.data(); const cur = m.get(uid) || {};
      m.set(uid, { ...cur, id: uid, uid, name: cur.name || d.displayName || "Trakey User", email: cur.email || d.email || "", lastSeenAt: cur.lastSeenAt || d.updatedAt || null });
    });
    pro.forEach((p) => { if (!m.has(p.id)) m.set(p.id, { id: p.id, uid: p.id, name: "", email: "", lastSeenAt: p.trialStartedAt || p.updatedAt || null, notIndexed: true }); });
    payments.forEach((p) => {
      const c = p.uid ? m.get(p.uid) : null; if (!c) return;
      if (!c.email && p.email) c.email = p.email;
      if ((!c.name || c.name === "Trakey User") && p.name) c.name = p.name;
    });
    const proBy = new Map(pro.map((p) => [p.id, p]));
    return [...m.values()]
      .map((u) => ({ ...u, pro: proInfo(proBy.get(u.uid) || {}), online: isOnline(u) }))
      .sort((a, b) => ms(b.lastSeenAt) - ms(a.lastSeenAt));
  }, [users, backups, pro, payments]);

  const forUser = useCallback((u) => {
    const same = (x) => (x.uid && x.uid === u.uid) || (!!u.email && String(x.email || "").toLowerCase() === u.email.toLowerCase());
    return { payments: payments.filter(same), feedback: feedback.filter(same), contacts: contacts.filter(same) };
  }, [payments, feedback, contacts]);

  // ---------- actions ----------
  const run = useCallback(async (fn, okText) => {
    try { await fn(); if (okText) notify(okText); return true; }
    catch (e) { notify(e.message || "Something went wrong.", "bad"); return false; }
  }, [notify]);
  const who = user?.email || ADMIN_EMAIL;

  const giftPro = (u, planKey) => run(async () => {
    const plan = PLANS[planKey]; const id = orderId();
    await runTransaction(db, async (tx) => {
      const proRef = doc(db, "proStatus", u.uid);
      const snap = await tx.get(proRef);
      tx.set(proRef, { ...proPatchFor(snap.exists() ? snap.data() : {}, planKey), paidVia: "gift", updatedAt: serverTimestamp() }, { merge: true });
      tx.set(doc(db, "payments", id), {
        uid: u.uid, email: u.email || "", name: u.name || "", plan: planKey, amount: 0, listAmount: plan.price, amountAdjusted: false,
        gift: true, currency: "INR", utr: "", method: "Gift", country: "", status: "approved", note: "Gifted from the Users page",
        manual: true, addedBy: who, createdAt: Timestamp.fromDate(new Date()), reviewedAt: serverTimestamp(),
      });
    });
  }, `${PLANS[planKey].label} Pro gifted to ${u.name || u.email || u.uid}.`);

  // Sets proUntil to 0. "Also end trial" moves the trial/reward start to 2020 (never deletes it).
  const removePro = (u, alsoTrial) => run(async () => {
    const patch = { proUntil: 0, plan: deleteField(), paidVia: deleteField(), proRemovedAt: serverTimestamp(), proRemovedBy: who, updatedAt: serverTimestamp() };
    if (alsoTrial) { patch.trialStartedAt = ENDED_AT; if (u.pro.raw.starRewardAt) patch.starRewardAt = ENDED_AT; }
    await setDoc(doc(db, "proStatus", u.uid), patch, { merge: true });
  }, "Pro removed.");

  const approvePayment = (order, received, note) => {
    const amount = parseMoney(received);
    if (Number.isNaN(amount)) { notify("Enter the amount you actually received (0 if it was free).", "bad"); return false; }
    return run(async () => {
      await runTransaction(db, async (tx) => {
        const payRef = doc(db, "payments", order.id), proRef = doc(db, "proStatus", order.uid);
        const paySnap = await tx.get(payRef), proSnap = await tx.get(proRef);
        if (!paySnap.exists() || paySnap.data().status !== "pending") throw new Error("This payment is no longer pending.");
        const pay = paySnap.data();
        const listAmount = Number(pay.listAmount ?? pay.amount) || 0;
        const upd = { status: "approved", reviewedAt: serverTimestamp(), amount, listAmount, amountAdjusted: amount !== listAmount, gift: amount === 0 };
        if (amount !== (Number(pay.amount) || 0)) upd.amountHistory = arrayUnion({ from: Number(pay.amount) || 0, to: amount, at: Timestamp.now(), by: who, why: "Set at approval" });
        if ((note || "").trim()) upd.note = note.trim();
        tx.set(proRef, { ...proPatchFor(proSnap.exists() ? proSnap.data() : {}, order.plan), paidVia: amount === 0 ? "gift" : "upi", updatedAt: serverTimestamp() }, { merge: true });
        tx.update(payRef, upd);
      });
    }, "Payment approved. Pro is active.");
  };

  // Rejecting also frees the UTR so the user can send the corrected number.
  const rejectPayment = (order, reason) => run(async () => {
    const b = writeBatch(db);
    b.update(doc(db, "payments", order.id), { status: "rejected", note: reason.trim(), reviewedAt: serverTimestamp() });
    if (order.utr) b.delete(doc(db, "paymentUtrs", order.utr));
    await b.commit();
  }, "Payment rejected.");

  const changeAmount = (order, value, reason) => {
    const amount = parseMoney(value);
    if (Number.isNaN(amount)) { notify("Enter a valid amount (0 if it was free).", "bad"); return false; }
    if (!reason.trim()) { notify("Write a short reason for the change.", "bad"); return false; }
    return run(async () => {
      const listAmount = Number(order.listAmount ?? order.amount) || 0;
      await updateDoc(doc(db, "payments", order.id), {
        amount, listAmount, amountAdjusted: amount !== listAmount, gift: amount === 0, adjustReason: reason.trim(),
        amountHistory: arrayUnion({ from: Number(order.amount) || 0, to: amount, at: Timestamp.now(), by: who, why: reason.trim() }),
      });
    }, "Amount updated.");
  };

  const deleteManual = (order) => order.manual && run(() => deleteDoc(doc(db, "payments", order.id)), "Record deleted.");

  const addManual = (f) => {
    const amount = parseMoney(f.amount);
    if (Number.isNaN(amount)) { notify("Enter the amount received (0 for a free gift).", "bad"); return false; }
    if (!f.name.trim() && !f.email.trim()) { notify("Enter the customer name or email.", "bad"); return false; }
    const typed = f.email.trim().toLowerCase();
    const uid = f.uid.trim() || (typed ? (people.find((u) => (u.email || "").toLowerCase() === typed) || {}).uid || "" : "");
    const isGift = f.status === "approved" && (f.gift || amount === 0);
    const grant = f.grantPro && f.status === "approved";
    if (grant && !uid) { notify("Could not find this person's account. Paste their Account ID or use their sign-in email.", "bad"); return false; }
    const cur = (f.currency.trim() || "INR").toUpperCase();
    const id = orderId();
    const data = {
      uid, email: f.email.trim(), name: f.name.trim(), plan: f.plan, amount,
      listAmount: isGift && cur === "INR" ? PLANS[f.plan].price : amount, amountAdjusted: false, gift: isGift, currency: cur,
      utr: f.ref.trim(), method: f.method.trim(), country: f.country.trim(), status: f.status, note: f.note.trim(), manual: true,
      addedBy: who, createdAt: Timestamp.fromDate(new Date(f.date + "T12:00:00+05:30")), reviewedAt: serverTimestamp(),
    };
    return run(async () => {
      if (grant) {
        await runTransaction(db, async (tx) => {
          const proRef = doc(db, "proStatus", uid); const snap = await tx.get(proRef);
          tx.set(proRef, { ...proPatchFor(snap.exists() ? snap.data() : {}, f.plan), paidVia: isGift ? "gift" : "manual", updatedAt: serverTimestamp() }, { merge: true });
          tx.set(doc(db, "payments", id), data);
        });
      } else await setDoc(doc(db, "payments", id), data);
    }, "Record saved.");
  };

  const loadShot = async (id) => { const s = await getDoc(doc(db, "paymentShots", id)); return s.exists() ? s.data().data || "" : ""; };
  const setFeedbackHandled = (id, handled) => run(() => updateDoc(doc(db, "feedbackSubmissions", id), { handled }));
  const setContactStatus = (id, status) => run(() => updateDoc(doc(db, "contactMessages", id), { status }));

  // Notification to everyone (topic) or one person (their saved device token). Both run on Cloud Functions.
  const pushAll = (title, message) => run(async () => { await httpsCallable(functions, "sendTrakeyNotification")({ title, message }); }, "Notification sent to everyone.");
  const pushOne = (uid, title, message) => run(async () => { await httpsCallable(functions, "sendUserNotification")({ uid, title, message }); }, "Notification sent.");

  const value = {
    user, role, isOwner: role === "owner", authReady, authError, loginGoogle, loginEmail, logout,
    toast, notify, people, forUser, payments, feedback, contacts, pro, loadError,
    giftPro, removePro, approvePayment, rejectPayment, changeAmount, deleteManual, addManual, loadShot,
    setFeedbackHandled, setContactStatus, pushAll, pushOne, run, who,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc };
