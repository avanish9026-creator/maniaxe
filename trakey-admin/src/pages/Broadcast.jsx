import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp } from "firebase/firestore";
import { db, useAdmin } from "../store";
import { Badge, Empty, Field, Seg } from "../ui";
import { fmtTime, ms } from "../lib/util";

function useList(name) {
  const [items, setItems] = useState([]);
  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, name));
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt)));
  }, [name]);
  useEffect(() => { load().catch(() => {}); }, [load]);
  return [items, load];
}

export default function Broadcast() {
  const [tab, setTab] = useState("push");
  return (
    <>
      <Seg value={tab} onChange={setTab} options={[["push", "Notification to everyone"], ["announce", "Announcements"], ["updates", "App updates"]]} />
      {tab === "push" && <Push />}
      {tab === "announce" && <Announce />}
      {tab === "updates" && <Updates />}
    </>
  );
}

function Remove({ coll, id, reload }) {
  const A = useAdmin();
  return <button className="sm danger" onClick={() => window.confirm("Delete this? This cannot be undone.") && A.run(() => deleteDoc(doc(db, coll, id)), "Deleted.").then(reload)}>Delete</button>;
}

function Push() {
  const A = useAdmin();
  const [items, load] = useList("adminNotifications");
  const [t, setT] = useState(""); const [m, setM] = useState(""); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!window.confirm("Send this to every Trakey user?")) return;
    setBusy(true);
    if (await A.pushAll(t.trim(), m.trim())) { setT(""); setM(""); load(); }
    setBusy(false);
  };
  return (
    <div className="grid cols-2">
      <section className="card stack">
        <h2>New notification</h2>
        <p className="muted small">Goes to every phone with Trakey. To message one person, open them in Users.</p>
        <Field label="Title"><input maxLength={100} value={t} onChange={(e) => setT(e.target.value)} /></Field>
        <Field label={`Message (${m.length}/1000)`}><textarea maxLength={1000} value={m} onChange={(e) => setM(e.target.value)} rows={5} /></Field>
        <div><button className="primary" disabled={busy || !t.trim() || !m.trim()} onClick={send}>Send to everyone</button></div>
      </section>
      <section className="panel flush">
        <div className="panel-head"><h2>Sent</h2></div>
        {items.length === 0 ? <Empty title="Nothing sent yet" /> : items.map((n) => (
          <div key={n.id} className="item" style={{ border: 0, borderBottom: "1px solid var(--line)", borderRadius: 0 }}>
            <div className="row spread"><b>{n.title}</b><span className="faint small">{fmtTime(ms(n.createdAt))}</span></div>
            <span className="muted">{n.message}</span>
            <div><Remove coll="adminNotifications" id={n.id} reload={load} /></div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Announce() {
  const A = useAdmin();
  const [items, load] = useList("adminAnnouncements");
  const [f, setF] = useState({ title: "", message: "", type: "General", actionText: "", actionUrl: "" });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const publish = async () => {
    const title = f.title.trim(), message = f.message.trim(), at = f.actionText.trim(), au = f.actionUrl.trim();
    if (!title || !message) return A.notify("Title and message are required.", "bad");
    if (at && !au) return A.notify("Enter an action URL when an action button is provided.", "bad");
    const ok = await A.run(() => addDoc(collection(db, "adminAnnouncements"), {
      title, message, type: f.type, actionText: at || null, actionUrl: au || null, active: true, published: true,
      createdAt: serverTimestamp(), publishedAt: serverTimestamp(), publishedBy: A.who,
    }), "Announcement published.");
    if (ok) { setF({ title: "", message: "", type: "General", actionText: "", actionUrl: "" }); load(); }
  };
  return (
    <div className="grid cols-2">
      <section className="card stack">
        <h2>New announcement</h2><p className="muted small">Shown inside the app until you delete it.</p>
        <Field label="Title"><input value={f.title} onChange={set("title")} /></Field>
        <Field label="Message"><textarea value={f.message} onChange={set("message")} rows={4} /></Field>
        <Field label="Type"><select value={f.type} onChange={set("type")}>{["General", "Update", "Feature", "Maintenance"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <div className="form-grid"><Field label="Button text (optional)"><input value={f.actionText} onChange={set("actionText")} /></Field><Field label="Button link"><input value={f.actionUrl} onChange={set("actionUrl")} placeholder="https://" /></Field></div>
        <div><button className="primary" onClick={publish}>Publish</button></div>
      </section>
      <section className="panel flush">
        <div className="panel-head"><h2>Published</h2></div>
        {items.length === 0 ? <Empty title="No announcements" /> : items.map((a) => (
          <div key={a.id} className="item" style={{ border: 0, borderBottom: "1px solid var(--line)", borderRadius: 0 }}>
            <div className="row spread"><b>{a.title}</b><Badge>{a.type}</Badge></div>
            <span className="muted">{a.message}</span><span className="faint small">{fmtTime(ms(a.createdAt))}</span>
            <div><Remove coll="adminAnnouncements" id={a.id} reload={load} /></div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Updates() {
  const A = useAdmin();
  const [items, load] = useList("appUpdates");
  const E = { version: "", title: "", description: "", releaseNotes: "", downloadUrl: "" };
  const [f, setF] = useState(E);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const publish = async () => {
    const v = f.version.trim(), t = f.title.trim(), d = f.description.trim(), url = f.downloadUrl.trim();
    if (!v || !t || !d) return A.notify("Version, title and description are required.", "bad");
    if (url && !/^https?:\/\//i.test(url)) return A.notify("Download URL must start with http:// or https://.", "bad");
    const ok = await A.run(() => addDoc(collection(db, "appUpdates"), {
      version: v, title: t, description: d, releaseNotes: f.releaseNotes.trim(), downloadUrl: url || null, active: true,
      createdAt: serverTimestamp(), publishedAt: serverTimestamp(), publishedBy: A.who,
    }), "Update published.");
    if (ok) { setF(E); load(); }
  };
  return (
    <div className="grid cols-2">
      <section className="card stack">
        <h2>Publish an app update</h2>
        <div className="form-grid"><Field label="Version"><input value={f.version} onChange={set("version")} placeholder="5.1.3" /></Field><Field label="Title"><input value={f.title} onChange={set("title")} /></Field></div>
        <Field label="Short description"><textarea value={f.description} onChange={set("description")} rows={3} /></Field>
        <Field label="Release notes"><textarea value={f.releaseNotes} onChange={set("releaseNotes")} rows={4} /></Field>
        <Field label="Download link (optional)"><input value={f.downloadUrl} onChange={set("downloadUrl")} placeholder="https://" /></Field>
        <div><button className="primary" onClick={publish}>Publish update</button></div>
      </section>
      <section className="panel flush">
        <div className="panel-head"><h2>Published updates</h2></div>
        {items.length === 0 ? <Empty title="No updates yet" /> : items.map((u) => (
          <div key={u.id} className="item" style={{ border: 0, borderBottom: "1px solid var(--line)", borderRadius: 0 }}>
            <div className="row spread"><b>{u.title}</b><Badge tone="accent">v{u.version}</Badge></div>
            <span className="muted">{u.description}</span><span className="faint small">{fmtTime(ms(u.createdAt))}</span>
            <div><Remove coll="appUpdates" id={u.id} reload={load} /></div>
          </div>
        ))}
      </section>
    </div>
  );
}
