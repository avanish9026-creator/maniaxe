// Data explorer: look at, edit, add and delete Firestore documents from the admin (owner only).
// Same power as the Firebase Console, in plain language. Timestamps are shown as {"__timestamp": "2026-01-31T10:00:00.000Z"}.
import { useState } from "react";
import { collection, deleteDoc, doc, getDocs, getFirestore, limit, query, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import app from "../firebase";

const db = getFirestore(app);

const PRESETS = [
  ["Users", "users"], ["Pro status", "proStatus"], ["Payments", "payments"], ["Payment locks", "paymentLocks"], ["UTR locks", "paymentUtrs"],
  ["Announcements", "adminAnnouncements"], ["Notifications", "adminNotifications"], ["App updates", "appUpdates"], ["App config", "appConfig"],
  ["Feedback", "feedbackSubmissions"], ["Contact", "contactMessages"], ["Message history", "messageHistory"],
  ["Profiles", "profiles"], ["Usernames", "usernames"], ["Friend requests", "friendRequests"], ["Friendships", "friendships"],
  ["Stats cards", "statsCards"], ["Challenges", "challenges"], ["Web usage", "webUsage"], ["Team", "adminStaff"],
];

const encode = (v) => {
  if (v instanceof Timestamp) return { __timestamp: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === "object") {
    if (typeof v.path === "string" && typeof v.id === "string" && v.firestore) return { __unsupported: "reference " + v.path };
    if (typeof v.latitude === "number" && typeof v.longitude === "number") return { __unsupported: "location" };
    if (typeof v.toUint8Array === "function") return { __unsupported: "bytes" };
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]));
  }
  return v;
};

const decode = (v) => {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === "__timestamp") {
      const d = new Date(v.__timestamp);
      if (Number.isNaN(d.getTime())) throw new Error("Not a valid date: " + v.__timestamp);
      return Timestamp.fromDate(d);
    }
    if (keys.length === 1 && keys[0] === "__serverTimestamp") return serverTimestamp();
    if (keys.includes("__unsupported")) throw new Error("This document has a value (reference, location or bytes) that this editor cannot write back. Edit it in the Firebase Console.");
    return Object.fromEntries(keys.map((k) => [k, decode(v[k])]));
  }
  return v;
};

const short = (v) => {
  const e = encode(v);
  const s = typeof e === "string" ? e : JSON.stringify(e);
  return s.length > 70 ? s.slice(0, 70) + "…" : s;
};

export default function DataExplorer() {
  const [path, setPath] = useState("");
  const [loaded, setLoaded] = useState("");
  const [docs, setDocs] = useState([]);
  const [max, setMax] = useState(50);
  const [find, setFind] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState(null); // { id, isNew }
  const [text, setText] = useState("");
  const [newId, setNewId] = useState("");

  const clean = (p) => p.trim().replace(/^\/+|\/+$/g, "");

  const load = async (p) => {
    const target = clean(p === undefined ? path : p);
    const parts = target.split("/").filter(Boolean);
    setError(""); setMsg("");
    if (!parts.length || parts.length % 2 === 0) {
      setError("A collection path has an odd number of parts, for example users or users/SOME_UID/backup.");
      return;
    }
    setLoading(true);
    setSel(null);
    try {
      const snap = await getDocs(query(collection(db, target), limit(max)));
      setDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() })));
      setLoaded(target);
      setPath(target);
    } catch (err) {
      setDocs([]);
      setLoaded("");
      setError(err.message || "Could not load this collection.");
    } finally {
      setLoading(false);
    }
  };

  const open = (d) => { setSel({ id: d.id, isNew: false }); setText(JSON.stringify(encode(d.data), null, 2)); setError(""); setMsg(""); };
  const startNew = () => { setSel({ id: "", isNew: true }); setText("{\n  \n}"); setNewId(""); setError(""); setMsg(""); };

  const save = async () => {
    setError(""); setMsg("");
    let data;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The document must be a JSON object { ... }.");
      data = decode(parsed);
    } catch (err) {
      setError(err.message || "This is not valid JSON.");
      return;
    }
    setBusy(true);
    try {
      const ref = sel.isNew ? (newId.trim() ? doc(db, loaded, newId.trim()) : doc(collection(db, loaded))) : doc(db, loaded, sel.id);
      await setDoc(ref, data);
      setMsg(sel.isNew ? "Document added." : "Saved.");
      await load(loaded);
    } catch (err) {
      setError(err.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!sel || sel.isNew) return;
    if (!window.confirm("Delete " + loaded + "/" + sel.id + "?\n\nThis cannot be undone.")) return;
    setBusy(true); setError(""); setMsg("");
    try {
      await deleteDoc(doc(db, loaded, sel.id));
      setMsg("Deleted.");
      await load(loaded);
    } catch (err) {
      setError(err.message || "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  const f = find.trim().toLowerCase();
  const shown = docs.filter((d) => !f || d.id.toLowerCase().includes(f) || JSON.stringify(encode(d.data)).toLowerCase().includes(f));

  return (
    <>
      <div className="page-head">
        <div><h2>Data explorer</h2><p>Read and edit any Firestore collection. Changes are live for every user, the same as in the Firebase Console.</p></div>
      </div>

      <div className="card">
        <div className="chips">
          {PRESETS.map(([label, p]) => (
            <button key={p} type="button" className={"chip" + (loaded === p ? " on" : "")} onClick={() => { setPath(p); load(p); }}>{label}</button>
          ))}
        </div>
        <div className="row-form">
          <input value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Any collection path, e.g. users/UID/backup" />
          <select value={max} onChange={(e) => setMax(Number(e.target.value))}>
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} items</option>)}
          </select>
          <button type="button" className="primary" disabled={loading} onClick={() => load()}>{loading ? "Loading..." : "Open"}</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {msg && <div className="ok-message">{msg}</div>}

      {loaded && (
        <div className="explorer">
          <div className="card list-col">
            <div className="row-form">
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={"Filter " + docs.length + " loaded items"} />
              <button type="button" onClick={startNew}>+ New</button>
            </div>
            <p className="muted small">{loaded} · showing {shown.length} of {docs.length}{docs.length === max ? " (more may exist, raise the limit)" : ""}</p>
            <div className="doc-list">
              {shown.map((d) => (
                <button key={d.id} type="button" className={"doc-item" + (sel && !sel.isNew && sel.id === d.id ? " on" : "")} onClick={() => open(d)}>
                  <b>{d.id}</b>
                  <span>{Object.entries(d.data).slice(0, 3).map(([k, v]) => k + ": " + short(v)).join("  ·  ")}</span>
                </button>
              ))}
              {shown.length === 0 && <p className="muted">Nothing here.</p>}
            </div>
          </div>

          <div className="card edit-col">
            {!sel && <p className="muted">Choose a document on the left, or press + New.</p>}
            {sel && (
              <>
                <h4 style={{ margin: "0 0 4px" }}>{sel.isNew ? "New document in " + loaded : loaded + "/" + sel.id}</h4>
                {sel.isNew && <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="Document ID (leave empty for an automatic one)" style={{ marginBottom: 8 }} />}
                <textarea className="json" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
                <p className="muted small">Saving replaces the whole document. A field you remove here is deleted. Dates: {`{"__timestamp": "2026-01-31T10:00:00.000Z"}`}, or {`{"__serverTimestamp": true}`} for "now".</p>
                <div className="row-form">
                  <button type="button" className="primary" disabled={busy} onClick={save}>{busy ? "Working..." : sel.isNew ? "Add document" : "Save changes"}</button>
                  {!sel.isNew && <button type="button" className="danger" disabled={busy} onClick={remove}>Delete</button>}
                  <button type="button" className="quiet" onClick={() => setSel(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
