// Update gate: appConfig/versionGate. The app reads this document to block old versions or remind people to update.
import { useEffect, useState } from "react";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import app from "../firebase";

const db = getFirestore(app);
const VERSION_RE = /^\d+(\.\d+){0,3}$/;
const EMPTY = { enabled: true, minVersion: "", recommendedVersion: "", downloadUrl: "", message: "" };

export default function UpdateGatePanel({ userEmail }) {
  const [form, setForm] = useState(EMPTY);
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let live = true;
    getDoc(doc(db, "appConfig", "versionGate"))
      .then((snap) => {
        if (!live) return;
        setExists(snap.exists());
        if (snap.exists()) { const d = snap.data(); setForm({ ...EMPTY, ...d, enabled: d.enabled !== false }); }
      })
      .catch((err) => live && setError(err.message || "Could not load the update gate."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setError(""); setMsg("");
    const min = form.minVersion.trim();
    const rec = form.recommendedVersion.trim();
    const url = form.downloadUrl.trim();
    if (min && !VERSION_RE.test(min)) return setError("Required version looks wrong. Use numbers like 4.6.5.");
    if (rec && !VERSION_RE.test(rec)) return setError("Recommended version looks wrong. Use numbers like 4.6.5.");
    if (url && !/^https:\/\//i.test(url)) return setError("The download link must start with https://");
    if (form.enabled && min && !window.confirm("Everyone on a version below " + min + " will be blocked until they update. Continue?")) return;
    setBusy(true);
    try {
      await setDoc(doc(db, "appConfig", "versionGate"), {
        enabled: !!form.enabled, minVersion: min, recommendedVersion: rec, downloadUrl: url, message: form.message.trim(),
        updatedAt: serverTimestamp(), updatedBy: userEmail || "",
      }, { merge: true });
      setExists(true);
      setMsg("Saved. Phones pick it up within about 30 minutes.");
    } catch (err) { setError(err.message || "Could not save."); } finally { setBusy(false); }
  };

  if (loading) return <p className="muted">Loading...</p>;

  const blocking = form.enabled && form.minVersion.trim();
  return (
    <>
      <div className="page-head"><div><h2>Update gate</h2><p>Ask people to update the app, or block versions that are too old.</p></div></div>
      {error && <div className="error-message">{error}</div>}
      {msg && <div className="ok-message">{msg}</div>}
      {!exists && <div className="note">Nothing saved yet, so no one is asked to update.</div>}

      <div className="card form-grid">
        <label className="switch-row"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Gate is on <span className="muted small">(turn off to stop all update prompts)</span></label>
        <label>Required version <span className="muted small">older versions are blocked until they update. Leave empty to block nobody.</span>
          <input value={form.minVersion} onChange={(e) => set("minVersion", e.target.value)} placeholder="e.g. 4.6.0" /></label>
        <label>Recommended version <span className="muted small">older versions get a gentle reminder once a day.</span>
          <input value={form.recommendedVersion} onChange={(e) => set("recommendedVersion", e.target.value)} placeholder="e.g. 4.6.5" /></label>
        <label>Download link <span className="muted small">https link to the new APK. If empty, the app uses its default link.</span>
          <input value={form.downloadUrl} onChange={(e) => set("downloadUrl", e.target.value)} placeholder="https://..." /></label>
        <label>Message <span className="muted small">optional text shown on the update screen</span>
          <input value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="A short note for users" /></label>
        <div className={"note " + (blocking ? "warn" : "")}>{blocking ? "People on a version below " + form.minVersion.trim() + " cannot use the app until they update." : "No one is blocked. The app can still show a gentle reminder if a recommended version is set."}</div>
        <div><button type="button" className="primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save"}</button></div>
      </div>
    </>
  );
}
