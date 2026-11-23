import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { Avatar, Badge, Button, Card, Empty, Field, Notice, PageHead, useBusy, useUI } from "../lib/ui";
import { db, useStore } from "../lib/store";

export default function Team() {
  const { user, isOwner } = useStore();
  const { confirm } = useUI();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ uid: "", name: "", email: "" });
  const [busy, run] = useBusy();
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(collection(db, "adminStaff"),
    (s) => setMembers(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => setError(e.message || "Could not load the team.")), []);

  if (!isOwner) return <Notice tone="warn">Only the owner can manage the team.</Notice>;

  const add = async () => {
    setError("");
    const uid = form.uid.trim();
    if (!/^[A-Za-z0-9]{20,40}$/.test(uid)) return setError("Paste the person's Account ID exactly (letters and numbers, about 28 characters).");
    if (!form.name.trim()) return setError("Add their name so you remember who this is.");
    const ok = await run("add", async () => {
      await setDoc(doc(db, "adminStaff", uid), { role: "editor", active: true, name: form.name.trim(), email: form.email.trim(), addedBy: user?.email || "", addedAt: serverTimestamp() });
      return true;
    }, "Added. They can sign in to Trakey Admin now.");
    if (ok) setForm({ uid: "", name: "", email: "" });
  };

  const toggle = (m) => run(m.id, () => updateDoc(doc(db, "adminStaff", m.id), { active: m.active === false }));
  const remove = async (m) => {
    if (await confirm({ title: "Remove " + (m.name || m.id) + "?", body: "They lose access immediately.", confirmLabel: "Remove", danger: true }))
      run(m.id, () => deleteDoc(doc(db, "adminStaff", m.id)), "Removed.");
  };

  return (
    <>
      <PageHead title="Team access" subtitle="Let helpers manage announcements, notifications and updates without your owner login." />
      {error && <div style={{ marginBottom: 16 }}><Notice tone="bad">{error}</Notice></div>}
      <div className="cols-2">
        <Card title="Add an editor">
          <ol className="steps">
            <li>Ask them to open Trakey Admin and sign in with Google. It says they are not authorized and shows an <b>Account ID</b>.</li>
            <li>They send you that ID. Paste it here with their name.</li>
            <li>They sign in again and see the editor tools.</li>
          </ol>
          <div className="stack-sm">
            <Field label="Account ID"><input value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} /></Field>
            <div className="form-grid">
              <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email (optional)"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            <div><Button variant="primary" icon="plus" disabled={busy === "add"} onClick={add}>Add editor</Button></div>
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>Editors can post announcements, send notifications, manage updates and the update gate, read history, and handle the inbox. They cannot see users, payments or Pro, and cannot use the Data explorer or this page.</p>
        </Card>
        <Card title={"Team (" + members.length + ")"} pad={false}>
          {members.length === 0 ? <Empty icon="users" title="No editors yet">Only you can sign in.</Empty> : (
            <div className="list" style={{ marginTop: 14 }}>
              {members.map((m) => (
                <div className="list-row" key={m.id}>
                  <Avatar name={m.name} size={38} />
                  <div className="list-main"><b>{m.name || "Unnamed"}</b><span>{m.email || "No email"} · {m.id}</span></div>
                  <Badge tone={m.active === false ? "warn" : "ok"} dot>{m.active === false ? "Paused" : "Active"}</Badge>
                  <Button size="sm" variant="quiet" disabled={busy === m.id} onClick={() => toggle(m)}>{m.active === false ? "Resume" : "Pause"}</Button>
                  <Button size="sm" variant="danger" disabled={busy === m.id} onClick={() => remove(m)}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
