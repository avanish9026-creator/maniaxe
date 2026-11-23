// Data explorer: look at, edit, add and delete Firestore documents from the admin (owner only).
// Same power as the Firebase Console, in plain language. Timestamps are shown as {"__timestamp": "2026-01-31T10:00:00.000Z"}.
import { useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { db, useStore } from "../lib/store";
import { Badge, Button, Card, Field, Notice, PageHead, useUI } from "../lib/ui";

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

export default function Explorer() {
  const { isOwner } = useStore();
  const { confirm } = useUI();
  const [path, setPath] = useState("");
  const [loaded, setLoaded] = useState("");
  const [docs, setDocs] = useState([]);
  const [max, setMax] = useState(50);
  const [find, setFind] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState(null);
  const [text, setText] = useState("");
  const [newId, setNewId] = useState("");

  if (!isOwner) return <Notice tone="warn">Only the owner can use the Data explorer.</Notice>;
  const clean = (p) => p.trim().replace(/^\/+|\/+$/g, "");

  const load = async (p) => {
    const target = clean(p === undefined ? path : p);
    const parts = target.split("/").filter(Boolean);
    setError(""); setMsg("");
    if (!parts.length || parts.length % 2 === 0) { setError("A collection path has an odd number of parts, for example users or users/SOME_UID/backup."); return; }
    setLoading(true); setSel(null);
    try {
      const snap = await getDocs(query(collection(db, target), limit(max)));
      setDocs(snap.docs.map((d) => ({ id: d.id, data: d.data() })));
      setLoaded(target); setPath(target);
    } catch (err) { setDocs([]); setLoaded(""); setError(err.message || "Could not load this collection."); }
    finally { setLoading(false); }
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
    } catch (err) { setError(err.message || "This is not valid JSON."); return; }
    setBusy(true);
    try {
      const ref = sel.isNew ? (newId.trim() ? doc(db, loaded, newId.trim()) : doc(collection(db, loaded))) : doc(db, loaded, sel.id);
      await setDoc(ref, data);
      setMsg(sel.isNew ? "Document added." : "Saved.");
      await load(loaded);
    } catch (err) { setError(err.message || "Could not save."); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!sel || sel.isNew) return;
    if (!(await confirm({ title: "Delete " + loaded + "/" + sel.id + "?", body: "This cannot be undone.", confirmLabel: "Delete", danger: true }))) return;
    setBusy(true); setError(""); setMsg("");
    try { await deleteDoc(doc(db, loaded, sel.id)); setMsg("Deleted."); await load(loaded); }
    catch (err) { setError(err.message || "Could not delete."); } finally { setBusy(false); }
  };

  const f = find.trim().toLowerCase();
  const shown = docs.filter((d) => !f || d.id.toLowerCase().includes(f) || JSON.stringify(encode(d.data)).toLowerCase().includes(f));

  return (
    <>
      <PageHead title="Data explorer" subtitle="Read and edit any Firestore collection. Changes are live for every user, the same as in the Firebase Console." />
      <Card>
        <div className="templates" style={{ marginBottom: 14 }}>
          {PRESETS.map(([label, p]) => <button key={p} type="button" className={"chip" + (loaded === p ? " on" : "")} onClick={() => { setPath(p); load(p); }}>{label}</button>)}
        </div>
        <div className="row">
          <div className="grow"><input value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Any collection path, e.g. users/UID/backup" /></div>
          <select style={{ width: "auto" }} value={max} onChange={(e) => setMax(Number(e.target.value))}>{[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} items</option>)}</select>
          <Button variant="primary" disabled={loading} onClick={() => load()}>{loading ? "Loading…" : "Open"}</Button>
        </div>
      </Card>
      <div style={{ height: 16 }} />
      {error && <div style={{ marginBottom: 16 }}><Notice tone="bad">{error}</Notice></div>}
      {msg && <div style={{ marginBottom: 16 }}><Notice tone="ok">{msg}</Notice></div>}
      {loaded && (
        <div className="split" style={{ gridTemplateColumns: "minmax(300px, 440px) minmax(0, 1fr)" }}>
          <Card pad={false}>
            <div className="row" style={{ padding: 14, flexWrap: "nowrap" }}>
              <div className="grow"><input value={find} onChange={(e) => setFind(e.target.value)} placeholder={"Filter " + docs.length + " loaded items"} /></div>
              <Button size="sm" icon="plus" onClick={startNew}>New</Button>
            </div>
            <p className="small muted" style={{ padding: "0 16px 10px" }}>{loaded} · showing {shown.length} of {docs.length}{docs.length === max ? " (more may exist, raise the limit)" : ""}</p>
            <div className="doc-list">
              {shown.map((d) => (
                <button key={d.id} type="button" className={"doc-item" + (sel && !sel.isNew && sel.id === d.id ? " on" : "")} onClick={() => open(d)}>
                  <b>{d.id}</b><span>{Object.entries(d.data).slice(0, 3).map(([k, v]) => k + ": " + short(v)).join("  ·  ")}</span>
                </button>
              ))}
              {shown.length === 0 && <p className="muted" style={{ padding: 16 }}>Nothing here.</p>}
            </div>
          </Card>
          <Card>
            {!sel && <p className="muted">Choose a document on the left, or press New.</p>}
            {sel && (
              <div className="stack-sm">
                <h3 style={{ fontSize: 15 }} className="mono">{sel.isNew ? "New document in " + loaded : loaded + "/" + sel.id}</h3>
                {sel.isNew && <Field label="Document ID"><input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="Leave empty for an automatic one" /></Field>}
                <textarea className="json" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
                <p className="small muted">Saving replaces the whole document. A field you remove here is deleted. Dates: {`{"__timestamp": "2026-01-31T10:00:00.000Z"}`}, or {`{"__serverTimestamp": true}`} for "now".</p>
                <div className="row">
                  <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Working…" : sel.isNew ? "Add document" : "Save changes"}</Button>
                  {!sel.isNew && <Button variant="danger" icon="trash" disabled={busy} onClick={remove}>Delete</Button>}
                  <Button variant="quiet" onClick={() => setSel(null)}>Close</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
