// One live connection to Firestore for the whole admin. Every page reads from here, so numbers always agree.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { collection, collectionGroup, getFirestore, onSnapshot } from "firebase/firestore";
import app from "../firebase";
import { makeActions } from "./actions";
import { adminApi } from "./adminApi";
import { proInfo } from "./pro";
import { tsMs } from "./format";

export const db = getFirestore(app);
const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

const ONLINE_MS = 5 * 60 * 1000;
const byNewest = (field) => (a, b) => tsMs(b[field]) - tsMs(a[field]);

export function DataProvider({ user, role, children }) {
  const isOwner = role === "owner";
  const [users, setUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [proDocs, setProDocs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState({});
  // Real sign-in accounts from Firebase Authentication, through the Trakey Admin API (Worker). Anonymous visitors are only counted.
  const [authPeople, setAuthPeople] = useState([]);
  const [anonymous, setAnonymous] = useState(0);
  const [authListError, setAuthListError] = useState("");
  const [tick, setTick] = useState(0); // re-checks "online" and "Pro ending" once a minute

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const reloadAuthList = useCallback(async () => {
    if (!isOwner) return;
    try {
      const r = await adminApi("/users");
      setAuthPeople(r.people || []);
      setAnonymous(r.anonymous || 0);
      setAuthListError("");
    } catch (e) {
      setAuthListError((e.code ? e.code + ": " : "") + (e.message || "unknown error"));
    }
  }, [isOwner]);

  // Load once, then refresh every 2 minutes so new sign-ins appear without reloading the page.
  useEffect(() => {
    reloadAuthList();
    const t = setInterval(reloadAuthList, 120000);
    return () => clearInterval(t);
  }, [reloadAuthList]);

  useEffect(() => {
    const unsubs = [];
    const fail = (key, label) => (err) => setErrors((e) => ({ ...e, [key]: err?.message || "Unable to load " + label + "." }));
    const watch = (key, ref, onData, label) => {
      unsubs.push(onSnapshot(ref, (snap) => {
        onData(snap);
        setLoaded((l) => (l[key] ? l : { ...l, [key]: true }));
        setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
      }, fail(key, label)));
    };
    const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (isOwner) {
      watch("users", collection(db, "users"), (s) => setUsers(rows(s)), "users");
      watch("backups", collectionGroup(db, "backup"), (s) => setBackups(s.docs.filter((d) => d.id === "main")
        .map((d) => ({ uid: d.ref.parent?.parent?.id, data: d.data() }))), "backup info");
      watch("pro", collection(db, "proStatus"), (s) => setProDocs(rows(s)), "Pro status");
      watch("payments", collection(db, "payments"), (s) => setPayments(rows(s).sort(byNewest("createdAt"))), "payments");
      watch("messages", collection(db, "messageHistory"), (s) => setMessages(rows(s).sort(byNewest("createdAt"))), "message history");
    }
    watch("feedback", collection(db, "feedbackSubmissions"), (s) => setFeedback(rows(s).sort(byNewest("submittedAt"))), "feedback");
    watch("contacts", collection(db, "contactMessages"), (s) => setContacts(rows(s).sort(byNewest("submittedAt"))), "contact messages");

    return () => unsubs.forEach((u) => u());
  }, [isOwner]);

  // Everyone who has ever signed in: user profile + backup record + Pro record + payments, merged into one person.
  const people = useMemo(() => {
    const byId = new Map();
    users.forEach((u) => byId.set(u.id, { ...u }));
    backups.forEach(({ uid, data }) => {
      if (!uid) return;
      const cur = byId.get(uid) || {};
      byId.set(uid, {
        ...cur, id: uid, uid,
        name: cur.name || data.displayName || "Trakey User",
        email: cur.email || data.email || "",
        lastSeenAt: cur.lastSeenAt || data.updatedAt || null,
      });
    });
    // Anyone with a Pro record has really signed in, even if their profile was never indexed.
    proDocs.forEach((p) => {
      if (!byId.has(p.id)) byId.set(p.id, { id: p.id, uid: p.id, name: "", email: "", lastSeenAt: p.trialStartedAt || p.updatedAt || null, notIndexed: true });
    });
    // Accounts known to Firebase Authentication, even if the app never wrote a profile for them yet.
    authPeople.forEach((a) => {
      const seen = a.lastSignInAt || a.lastSignInTime || a.createdAt || null;
      const cur = byId.get(a.uid);
      if (cur) {
        if (!cur.email && a.email) cur.email = a.email;
        if ((!cur.name || cur.name === "Trakey User") && a.name) cur.name = a.name;
        if (!cur.lastSeenAt && seen) cur.lastSeenAt = seen;
        if (a.createdAt) cur.createdAt = cur.createdAt || a.createdAt;
      } else {
        byId.set(a.uid, { id: a.uid, uid: a.uid, name: a.name || "", email: a.email || "", lastSeenAt: seen, createdAt: a.createdAt || null, notIndexed: true });
      }
    });
    payments.forEach((pay) => {
      const cur = pay.uid ? byId.get(pay.uid) : null;
      if (!cur) return;
      if (!cur.email && pay.email) cur.email = pay.email;
      if (!cur.payCountry && pay.country) cur.payCountry = pay.country;
      if ((!cur.name || cur.name === "Trakey User") && pay.name) cur.name = pay.name;
    });
    const proBy = new Map(proDocs.map((p) => [p.id, p]));
    const backupBy = new Map(backups.map((b) => [b.uid, b.data]));
    const now = Date.now();
    return [...byId.values()]
      .map((u) => {
        const uid = u.uid || u.id;
        const lastSeenMs = tsMs(u.lastSeenAt);
        return {
          ...u, uid, id: uid,
          lastSeenMs,
          createdMs: tsMs(u.createdAt),
          // City, region, country when the app reported them; otherwise what the user typed; otherwise the country on a payment.
          location: [u.city, u.region, u.country].filter(Boolean).join(", ") || u.location || u.payCountry || "",
          locationSource: u.city || u.country ? "app" : u.location ? "profile" : u.payCountry ? "payment" : "",
          online: lastSeenMs > 0 && now - lastSeenMs <= ONLINE_MS,
          pro: proInfo(proBy.get(uid) || {}),
          backup: backupBy.get(uid) || null,
          hasProDoc: proBy.has(uid),
        };
      })
      .sort((a, b) => b.lastSeenMs - a.lastSeenMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, backups, proDocs, payments, authPeople, tick]);

  const actions = useMemo(() => makeActions(db, user?.email), [user?.email]);

  const value = {
    db, user, role, isOwner, actions,
    people, payments, feedback, contacts, messages, errors, loaded,
    anonymous, authListError, reloadAuthList,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/** Items (payments, feedback, contact messages...) that belong to one person, matched by Account ID or email. */
export const belongsTo = (item, person) =>
  (!!item.uid && item.uid === person.uid) ||
  (!!person.email && String(item.email || "").toLowerCase() === person.email.toLowerCase());
