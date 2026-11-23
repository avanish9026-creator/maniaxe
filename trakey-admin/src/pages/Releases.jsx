import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Badge, Button, Card, Empty, Field, Icon, IconButton, Loading, Notice, PageHead, Tabs, useBusy, useUI } from "../lib/ui";
import { db, useStore } from "../lib/store";
import { useCollection } from "../lib/useCollection";
import { fmtDateTime, tsMs } from "../lib/format";
import { leftover } from "../lib/templates";
import TemplatePicker from "../components/TemplatePicker";

const VERSION_RE = /^\d+(\.\d+){0,3}$/;

function Updates() {
  const { actions } = useStore();
  const { confirm } = useUI();
  const [busy, run] = useBusy();
  const { items, loading, error } = useCollection("appUpdates");
  const [f, setF] = useState({ version: "", title: "", description: "", releaseNotes: "", downloadUrl: "" });
  const [err, setErr] = useState("");
  const [showTpl, setShowTpl] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const u = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]));
    if (!u.version || !u.title || !u.description) return setErr("Version, title and description are required.");
    const left = leftover(u.title, u.description, u.releaseNotes);
    if (left) return setErr("Fill in " + left + " before publishing.");
    if (u.downloadUrl && !/^https?:\/\//i.test(u.downloadUrl)) return setErr("Download URL must start with http:// or https://");
    const ok = await run("pub", async () => { await actions.publishUpdate(u); return true; }, "Update published.");
    if (ok) setF({ version: "", title: "", description: "", releaseNotes: "", downloadUrl: "" });
  };

  const remove = async (u) => {
    if (await confirm({ title: "Delete this update?", body: "It disappears from the app. This cannot be undone.", confirmLabel: "Delete", danger: true }))
      run("del" + u.id, () => actions.deleteUpdate(u.id), "Update deleted.");
  };

  return (
    <div className="cols-2" style={{ gridTemplateColumns: "minmax(0, 520px) minmax(0, 1fr)" }}>
      <Card title="Publish an update" subtitle="Shows as a “What's new” card in the app.">
        <form className="stack-sm" onSubmit={submit}>
          <div className="row"><Button size="sm" variant={showTpl ? "soft" : "default"} icon="file" onClick={() => setShowTpl((v) => !v)}>{showTpl ? "Hide ready-made updates" : "Ready-made updates"}</Button></div>
          {showTpl && <TemplatePicker kind="update" onUse={(x) => { setF((p) => ({ ...p, version: x.version || p.version, title: x.t, description: x.d, releaseNotes: x.n })); setShowTpl(false); }} />}
          <div className="form-grid" style={{ gridTemplateColumns: "130px 1fr" }}>
            <Field label="Version"><input value={f.version} maxLength={30} onChange={(e) => set("version", e.target.value)} placeholder="5.2.0" /></Field>
            <Field label="Title"><input value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="Trakey 5.2 is here" /></Field>
          </div>
          <Field label="Short description"><textarea rows={3} value={f.description} maxLength={500} onChange={(e) => set("description", e.target.value)} placeholder="Briefly describe what this update brings." /></Field>
          <Field label="What's new (release notes)"><textarea rows={6} value={f.releaseNotes} maxLength={3000} onChange={(e) => set("releaseNotes", e.target.value)} placeholder={"• New Goals improvements\n• Faster Notes loading\n• Bug fixes"} /></Field>
          <Field label="Download link (optional)"><input type="url" value={f.downloadUrl} onChange={(e) => set("downloadUrl", e.target.value)} placeholder="https://…" /></Field>
          {err && <Notice tone="bad">{err}</Notice>}
          <div><Button type="submit" variant="primary" icon="rocket" disabled={busy === "pub"}>{busy === "pub" ? "Publishing…" : "Publish update"}</Button></div>
        </form>
      </Card>

      <Card title="Published updates" pad={false}>
        {loading ? <Loading /> : error ? <div style={{ padding: 20 }}><Notice tone="bad">{error}</Notice></div> : items.length === 0 ? <Empty icon="rocket" title="No updates published yet" /> : (
          <div className="list" style={{ marginTop: 14 }}>
            {items.map((u) => (
              <div className="list-row" key={u.id} style={{ alignItems: "flex-start" }}>
                <span className="tl-ic accent"><Icon name="rocket" size={16} /></span>
                <div className="list-main">
                  <b style={{ whiteSpace: "normal" }}>{u.title}</b>
                  <span style={{ whiteSpace: "pre-wrap" }}>{u.description}</span>
                  {u.releaseNotes && <details style={{ marginTop: 6 }}><summary className="small" style={{ cursor: "pointer", color: "var(--accent)" }}>What's new</summary><p className="small muted" style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{u.releaseNotes}</p></details>}
                  {u.downloadUrl && <span className="small" style={{ overflowWrap: "anywhere", whiteSpace: "normal" }}>{u.downloadUrl}</span>}
                </div>
                <div className="list-end"><Badge tone="accent">v{u.version || "—"}</Badge><span>{fmtDateTime(tsMs(u.publishedAt || u.createdAt))}</span></div>
                <IconButton icon="trash" label="Delete" disabled={busy === "del" + u.id} onClick={() => remove(u)} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const EMPTY_GATE = { enabled: true, minVersion: "", recommendedVersion: "", downloadUrl: "", message: "" };

function Gate() {
  const { user } = useStore();
  const { confirm } = useUI();
  const [form, setForm] = useState(EMPTY_GATE);
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, run] = useBusy();
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    getDoc(doc(db, "appConfig", "versionGate"))
      .then((snap) => { if (!live) return; setExists(snap.exists()); if (snap.exists()) { const d = snap.data(); setForm({ ...EMPTY_GATE, ...d, enabled: d.enabled !== false }); } })
      .catch((e) => live && setErr(e.message || "Could not load the update gate."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const min = form.minVersion.trim();
  const blocking = form.enabled && min;

  const save = async () => {
    setErr("");
    const rec = form.recommendedVersion.trim();
    const url = form.downloadUrl.trim();
    if (min && !VERSION_RE.test(min)) return setErr("Required version looks wrong. Use numbers like 5.1.2.");
    if (rec && !VERSION_RE.test(rec)) return setErr("Recommended version looks wrong. Use numbers like 5.1.2.");
    if (url && !/^https:\/\//i.test(url)) return setErr("The download link must start with https://");
    if (blocking && !(await confirm({ title: "Block old versions?", body: "Everyone on a version below " + min + " will be blocked until they update.", confirmLabel: "Save and block", danger: true }))) return;
    await run("save", async () => {
      await setDoc(doc(db, "appConfig", "versionGate"), {
        enabled: !!form.enabled, minVersion: min, recommendedVersion: rec, downloadUrl: url, message: form.message.trim(),
        updatedAt: serverTimestamp(), updatedBy: user?.email || "",
      }, { merge: true });
      setExists(true);
    }, "Saved. Phones pick it up within about 30 minutes.");
  };

  if (loading) return <Loading />;
  return (
    <div className="cols-2" style={{ gridTemplateColumns: "minmax(0, 560px) minmax(0, 1fr)" }}>
      <Card title="Update gate" subtitle="Ask people to update the app, or block versions that are too old.">
        <div className="stack-sm">
          {!exists && <Notice>Nothing saved yet, so no one is asked to update.</Notice>}
          <label className="check"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Gate is on <span className="muted small">(turn off to stop all update prompts)</span></label>
          <Field label="Required version" hint="Older versions are blocked until they update. Leave empty to block nobody."><input value={form.minVersion} onChange={(e) => set("minVersion", e.target.value)} placeholder="e.g. 5.1.0" /></Field>
          <Field label="Recommended version" hint="Older versions get a gentle reminder once a day."><input value={form.recommendedVersion} onChange={(e) => set("recommendedVersion", e.target.value)} placeholder="e.g. 5.1.2" /></Field>
          <Field label="Download link" hint="https link to the new APK. If empty, the app uses its default link."><input value={form.downloadUrl} onChange={(e) => set("downloadUrl", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Message" hint="Optional text shown on the update screen."><input value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="A short note for users" /></Field>
          {err && <Notice tone="bad">{err}</Notice>}
          <div><Button variant="primary" icon="shield" disabled={busy === "save"} onClick={save}>{busy === "save" ? "Saving…" : "Save gate"}</Button></div>
        </div>
      </Card>
      <Card title="What happens">
        <Notice tone={blocking ? "warn" : "info"}>
          {blocking ? "People on a version below " + min + " cannot use the app until they update." : "No one is blocked. The app can still show a gentle reminder if a recommended version is set."}
        </Notice>
        <p className="small muted" style={{ marginTop: 14 }}>The answer is cached on the phone, so a blocked version stays blocked offline. Version numbers are compared part by part (5.1.2 is older than 5.1.10).</p>
      </Card>
    </div>
  );
}

export default function Releases() {
  const [tab, setTab] = useState("updates");
  return (
    <>
      <PageHead title="Releases" subtitle="Tell people about new versions, and make sure nobody stays on a broken one." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "updates", label: "App updates", icon: "rocket" }, { value: "gate", label: "Update gate", icon: "shield" }]} />
      {tab === "updates" ? <Updates /> : <Gate />}
    </>
  );
}
