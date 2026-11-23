import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Badge, Button, Card, Empty, Field, Icon, IconButton, Loading, Notice, PageHead, Tabs, useBusy, useUI } from "../lib/ui";
import { db, useStore } from "../lib/store";
import { useCollection } from "../lib/useCollection";
import { fmtDateTime, tsMs } from "../lib/format";
import { leftover } from "../lib/templates";
import TemplatePicker from "../components/TemplatePicker";

const VERSION_RE = /^\d+(\.\d+){0,3}$/;
const EMPTY_FORM = { version: "", title: "", description: "", releaseNotes: "", downloadUrl: "", pdfUrl: "", releaseDate: "", historyOnly: false };

// The 5.1.2 entry, filled from the changelog PDF that ships with this admin (public/releases).
const CHANGELOG_512 = {
  version: "5.1.2",
  title: "Trakey 5.1.2: the big stable release",
  description: "My Chat, Scan Hub, a built-in question library, Trakey AI Data, weekly reports, alarm-style alerts, Google Drive backup and a 30-day free Pro trial.",
  releaseNotes: [
    "• My Chat: a private, encrypted message-yourself space (never sent to Trakey servers)",
    "• Scan Hub: turn pages into Learn cards, Questions, text, a summary, a PDF or a My Chat note",
    "• Built-in Question Library (about 14,000 questions: NTPC, RRB Group D, SSC, paper sets)",
    "• Trakey AI Data: the AI can answer about your own tasks, notes and goals (on the phone, opt-in)",
    "• Weekly / Monthly report with a graph, share as PDF or image",
    "• Alarm-style alerts, Timer, floating calculator, Countdown widget",
    "• EXP levels and badges, Notebook Analysis",
    "• Quick add for tasks, rebuilt Calculator, expense PDF / CSV export",
    "• Google sign-in rewritten, Google Drive backup, faster settings sync",
    "• Free Pro trial is now 30 days; PayU checkout added",
    "",
    "Everything from 4.2.4 to 5.1.2 is in the changelog PDF.",
  ].join("\n"),
  downloadUrl: "",
  pdfUrl: "releases/Trakey-Changelog-4.2.4-to-5.1.2.pdf",
  releaseDate: "",
  historyOnly: false,
};

const isHttp = (u) => /^https?:\/\//i.test(u);
// A bare path like "releases/x.pdf" is a file inside this admin site.
const pdfHref = (u) => (isHttp(u) ? u : import.meta.env.BASE_URL + String(u).replace(/^\/+/, ""));
// github.com/user/repo/blob/main/x.pdf only shows a GitHub page; ?raw=true gives the real file.
const pdfFile = (u) => {
  const h = pdfHref(u);
  return /^https:\/\/github\.com\/[^?#]+\/blob\//i.test(h) ? h.replace(/[?#].*$/, "") + "?raw=true" : h;
};
const istDay = (ms) => (ms ? new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");

function PdfButtons({ url }) {
  const [busy, run] = useBusy();
  const download = () => run("pdf", async () => {
    const href = pdfFile(url);
    try {
      const r = await fetch(href);
      if (!r.ok) throw new Error("status " + r.status);
      const obj = URL.createObjectURL(new Blob([await r.blob()], { type: "application/pdf" }));
      const a = document.createElement("a");
      const name = decodeURIComponent(href.split("?")[0].split("/").pop() || "trakey-release.pdf");
      a.href = obj; a.download = /\.pdf$/i.test(name) ? name : "trakey-release.pdf"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 2000);
    } catch {
      window.open(href, "_blank", "noopener"); // the other site blocks reading the file here, so let the browser open it
    }
  });
  return (
    <div className="row" style={{ marginTop: 8 }}>
      <a className="btn btn-soft btn-sm" href={pdfHref(url)} target="_blank" rel="noopener noreferrer"><Icon name="file" size={15} /><span>View PDF</span></a>
      <Button size="sm" icon="download" disabled={busy === "pdf"} onClick={download}>{busy === "pdf" ? "Preparing…" : "Download PDF"}</Button>
    </div>
  );
}

function Updates() {
  const { actions } = useStore();
  const { confirm } = useUI();
  const [busy, run] = useBusy();
  const { items, loading, error } = useCollection("appUpdates");
  const [f, setF] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState("");
  const [err, setErr] = useState("");
  const [showTpl, setShowTpl] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const reset = () => { setF(EMPTY_FORM); setEditId(""); setErr(""); };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    const u = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    if (!u.version || !u.title || !u.description) return setErr("Version, title and description are required.");
    if (!VERSION_RE.test(u.version)) return setErr("Version looks wrong. Use numbers like 5.1.2.");
    const left = leftover(u.title, u.description, u.releaseNotes);
    if (left) return setErr("Fill in " + left + " before publishing.");
    if (u.downloadUrl && !isHttp(u.downloadUrl)) return setErr("Download URL must start with http:// or https://");
    if (u.pdfUrl && !isHttp(u.pdfUrl) && !/^[\w./-]+\.pdf$/i.test(u.pdfUrl)) return setErr("PDF link must start with https:// (or be a path like releases/file.pdf).");
    const ok = await run("pub", async () => { await (editId ? actions.editUpdate(editId, u) : actions.publishUpdate(u)); return true; }, editId ? "Changes saved." : u.historyOnly ? "Added to version history." : "Update published.");
    if (ok) reset();
  };

  const edit = (u) => {
    setEditId(u.id); setErr("");
    setF({
      version: u.version || "", title: u.title || "", description: u.description || "", releaseNotes: u.releaseNotes || "",
      downloadUrl: u.downloadUrl || "", pdfUrl: u.pdfUrl || "", releaseDate: u.releaseDate || istDay(tsMs(u.publishedAt)), historyOnly: u.active === false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (u) => {
    if (await confirm({ title: "Delete this update?", body: "It disappears from the app and from this history. This cannot be undone.", confirmLabel: "Delete", danger: true }))
      run("del" + u.id, async () => { await actions.deleteUpdate(u.id); if (editId === u.id) reset(); }, "Update deleted.");
  };

  return (
    <div className="cols-2" style={{ gridTemplateColumns: "minmax(0, 520px) minmax(0, 1fr)" }}>
      <Card title={editId ? "Edit this version" : "Publish or add a version"} subtitle={editId ? "Saving changes the entry in place." : "A new update shows as a “What's new” card in the app. You can also add older versions as history."}>
        <form className="stack-sm" onSubmit={submit}>
          <div className="row">
            <Button size="sm" variant={showTpl ? "soft" : "default"} icon="file" onClick={() => setShowTpl((v) => !v)}>{showTpl ? "Hide ready-made updates" : "Ready-made updates"}</Button>
            {!editId && <Button size="sm" icon="rocket" onClick={() => { setF(CHANGELOG_512); setShowTpl(false); }}>Fill 5.1.2 from changelog</Button>}
            {editId && <Button size="sm" variant="quiet" icon="x" onClick={reset}>Cancel edit</Button>}
          </div>
          {showTpl && <TemplatePicker kind="update" onUse={(x) => { setF((p) => ({ ...p, version: x.version || p.version, title: x.t, description: x.d, releaseNotes: x.n })); setShowTpl(false); }} />}
          <div className="form-grid" style={{ gridTemplateColumns: "130px 1fr" }}>
            <Field label="Version"><input value={f.version} maxLength={30} onChange={(e) => set("version", e.target.value)} placeholder="5.2.0" /></Field>
            <Field label="Title"><input value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="Trakey 5.2 is here" /></Field>
          </div>
          <Field label="Short description"><textarea rows={3} value={f.description} maxLength={500} onChange={(e) => set("description", e.target.value)} placeholder="Briefly describe what this update brings." /></Field>
          <Field label="What's new (release notes)"><textarea rows={6} value={f.releaseNotes} maxLength={3000} onChange={(e) => set("releaseNotes", e.target.value)} placeholder={"• New Goals improvements\n• Faster Notes loading\n• Bug fixes"} /></Field>
          <Field label="Download link (optional)" hint="Link to this version's APK."><input type="url" value={f.downloadUrl} onChange={(e) => set("downloadUrl", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Details PDF (optional)" hint="For big updates. Upload the PDF to GitHub and paste its link, or use a path inside this site like releases/file.pdf. People can then view or download it."><input value={f.pdfUrl} onChange={(e) => set("pdfUrl", e.target.value)} placeholder="https://…/changelog.pdf" /></Field>
          <div className="form-grid" style={{ gridTemplateColumns: "190px 1fr", alignItems: "end" }}>
            <Field label="Release date (optional)" hint="For older versions."><input type="date" value={f.releaseDate} onChange={(e) => set("releaseDate", e.target.value)} /></Field>
            <label className="check"><input type="checkbox" checked={f.historyOnly} onChange={(e) => set("historyOnly", e.target.checked)} /> <span>History only <span className="muted small">(an older version: keep it in this list, don't show it in the app)</span></span></label>
          </div>
          {err && <Notice tone="bad">{err}</Notice>}
          <div><Button type="submit" variant="primary" icon="rocket" disabled={busy === "pub"}>{busy === "pub" ? "Saving…" : editId ? "Save changes" : f.historyOnly ? "Add to history" : "Publish update"}</Button></div>
        </form>
      </Card>

      <Card title="Version history" subtitle="Newest first." pad={false}>
        {loading ? <Loading /> : error ? <div style={{ padding: 20 }}><Notice tone="bad">{error}</Notice></div> : items.length === 0 ? <Empty icon="rocket" title="No updates published yet" /> : (
          <div className="list" style={{ marginTop: 14 }}>
            {items.map((u) => (
              <div className="list-row" key={u.id} style={{ alignItems: "flex-start" }}>
                <span className="tl-ic accent"><Icon name="rocket" size={16} /></span>
                <div className="list-main">
                  <b style={{ whiteSpace: "normal" }}>{u.title}</b>
                  <span style={{ whiteSpace: "pre-wrap" }}>{u.description}</span>
                  {u.releaseNotes && <details style={{ marginTop: 6 }}><summary className="small" style={{ cursor: "pointer", color: "var(--accent)" }}>What's new</summary><p className="small muted" style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{u.releaseNotes}</p></details>}
                  {u.downloadUrl && <span className="row" style={{ marginTop: 6 }}><a className="btn btn-default btn-sm" href={u.downloadUrl} target="_blank" rel="noopener noreferrer"><Icon name="download" size={15} /><span>Download</span></a></span>}
                  {u.pdfUrl && <PdfButtons url={u.pdfUrl} />}
                </div>
                <div className="list-end"><Badge tone="accent">v{u.version || "—"}</Badge>{u.active === false && <Badge tone="muted">History only</Badge>}<span>{fmtDateTime(tsMs(u.publishedAt || u.createdAt))}</span></div>
                <IconButton icon="file" label="Edit (add PDF, link or details)" onClick={() => edit(u)} />
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
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "updates", label: "Versions & updates", icon: "rocket" }, { value: "gate", label: "Update gate", icon: "shield" }]} />
      {tab === "updates" ? <Updates /> : <Gate />}
    </>
  );
}
