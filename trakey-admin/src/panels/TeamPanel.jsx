// Team access (owner only): give other people access to the content tools without sharing the owner account.
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getFirestore, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import app from "../firebase";

const db = getFirestore(app);

export default function TeamPanel({ ownerEmail }) {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ uid: "", name: "", email: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => onSnapshot(collection(db, "adminStaff"),
    (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => setError(err.message || "Could not load the team.")), []);

  const add = async () => {
    setError(""); setMsg("");
    const uid = form.uid.trim();
    if (!/^[A-Za-z0-9]{20,40}$/.test(uid)) return setError("Paste the person's Account ID exactly (letters and numbers, about 28 characters).");
    if (!form.name.trim()) return setError("Add their name so you remember who this is.");
    setBusy("add");
    try {
      await setDoc(doc(db, "adminStaff", uid), { role: "editor", active: true, name: form.name.trim(), email: form.email.trim(), addedBy: ownerEmail || "", addedAt: serverTimestamp() });
      setForm({ uid: "", name: "", email: "" });
      setMsg("Added. They can sign in to Trakey Admin now.");
    } catch (err) { setError(err.message || "Could not add."); } finally { setBusy(""); }
  };

  const toggle = async (m) => {
    setBusy(m.id); setError(""); setMsg("");
    try { await updateDoc(doc(db, "adminStaff", m.id), { active: m.active === false }); }
    catch (err) { setError(err.message || "Could not update."); } finally { setBusy(""); }
  };

  const remove = async (m) => {
    if (!window.confirm("Remove " + (m.name || m.id) + "? They lose access immediately.")) return;
    setBusy(m.id); setError(""); setMsg("");
    try { await deleteDoc(doc(db, "adminStaff", m.id)); }
    catch (err) { setError(err.message || "Could not remove."); } finally { setBusy(""); }
  };

  return (
    <>
      <div className="page-head"><div><h2>Team access</h2><p>Let helpers manage announcements, notifications and updates without your owner login.</p></div></div>
      {error && <div className="error-message">{error}</div>}
      {msg && <div className="ok-message">{msg}</div>}

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Add an editor</h4>
        <ol className="steps">
          <li>Ask them to open Trakey Admin and sign in with their Google account. It will say they are not authorized and show an <b>Account ID</b>.</li>
          <li>They send you that ID. Paste it here with their name.</li>
          <li>They sign in again and see the editor tools.</li>
        </ol>
        <div className="row-form">
          <input value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} placeholder="Account ID" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (optional)" />
          <button type="button" className="primary" disabled={busy === "add"} onClick={add}>Add editor</button>
        </div>
        <p className="muted small">Editors can: post announcements, send notifications, manage app updates and the update gate, read the message history, and read and mark feedback and contact messages. They cannot see users, payments or Pro, and cannot use the Data explorer or this page.</p>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Team ({members.length})</h4>
        {members.length === 0 && <p className="muted">No editors yet. Only you can sign in.</p>}
        {members.map((m) => (
          <div key={m.id} className="u-row" style={{ marginBottom: 8 }}>
            <div className="u-main">
              <div className="u-avatar">{String(m.name || "?").charAt(0).toUpperCase()}</div>
              <div className="u-id"><h4>{m.name || "Unnamed"}</h4><p>{m.email || "No email saved"} · ID {m.id}</p></div>
              <div className="u-badges"><span className={"badge " + (m.active === false ? "b-expired" : "b-online")}>{m.active === false ? "Paused" : "Active"}</span><span className="badge">Editor</span></div>
            </div>
            <div className="u-actions">
              <button type="button" className="quiet" disabled={busy === m.id} onClick={() => toggle(m)}>{m.active === false ? "Resume" : "Pause"}</button>
              <button type="button" className="danger" disabled={busy === m.id} onClick={() => remove(m)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
