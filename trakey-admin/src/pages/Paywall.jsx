import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Badge, Button, Card, Field, KeyValue, Loading, Notice, PageHead, Segmented, useBusy, useUI } from "../lib/ui";
import { db, useStore } from "../lib/store";
import { fmtDateTime, tsMs } from "../lib/format";

// Paywall settings: Firestore document appConfig/pro. The Trakey app reads it (TrakeyPro.refreshConfig), so no app update is needed.
//   purchasesOpen    boolean  false = no plans / prices / pay buttons ("Pro plans open soon"). Trial, star reward, gifts and existing Pro keep working.
//   paymentMethod    string   "qr" = QR / UPI screen is the main way to pay.  "payu" = PayU first, QR as the fallback.
//   trialDays        number   free trial length in days (1 to 365).
//   libraryQuestions string   text on the Pro page / Free vs Pro, e.g. "17,000+".
// Until this document exists, the app uses its built-in defaults: purchases CLOSED, QR, 30 days, "15,000+".
const DEFAULTS = { purchasesOpen: false, paymentMethod: "qr", trialDays: 30, libraryQuestions: "15,000+" };

export default function Paywall() {
  const { user } = useStore();
  const { confirm } = useUI();
  const [form, setForm] = useState({ ...DEFAULTS, trialDays: String(DEFAULTS.trialDays) });
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, run] = useBusy();
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    getDoc(doc(db, "appConfig", "pro"))
      .then((snap) => {
        if (!live || !snap.exists()) return;
        const d = snap.data();
        setSaved(d);
        setForm({
          purchasesOpen: d.purchasesOpen === true,
          // Older versions stored payuFirst (true/false) instead of paymentMethod.
          paymentMethod: d.paymentMethod === "payu" || (d.paymentMethod == null && d.payuFirst === true) ? "payu" : "qr",
          trialDays: String(Number.isFinite(Number(d.trialDays)) && d.trialDays != null ? d.trialDays : DEFAULTS.trialDays),
          libraryQuestions: typeof d.libraryQuestions === "string" && d.libraryQuestions.trim() ? d.libraryQuestions : DEFAULTS.libraryQuestions,
        });
      })
      .catch((e) => live && setErr(e.message || "Could not load the paywall settings."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setErr("");
    const days = Number(form.trialDays);
    const lib = form.libraryQuestions.trim();
    if (!Number.isInteger(days) || days < 1 || days > 365) return setErr("Free trial must be a whole number of days from 1 to 365.");
    if (!lib) return setErr("Enter the question count text, for example 17,000+.");
    if (lib.length > 20) return setErr("Question count text is too long. Keep it short, like 17,000+.");
    const wasOpen = saved ? saved.purchasesOpen === true : false;
    if (wasOpen && !form.purchasesOpen && !(await confirm({
      title: "Turn off Pro purchases?",
      body: "People will see “Pro plans open soon” instead of plans and payment buttons. Trial, star reward, gifts and people who already have Pro are not affected.",
      confirmLabel: "Turn off purchases", danger: true,
    }))) return;
    await run("save", async () => {
      const data = { purchasesOpen: !!form.purchasesOpen, paymentMethod: form.paymentMethod, trialDays: days, libraryQuestions: lib, updatedAt: serverTimestamp(), updatedBy: user?.email || "" };
      await setDoc(doc(db, "appConfig", "pro"), data, { merge: true });
      setSaved({ ...(saved || {}), ...data, updatedAt: new Date() });
      setForm((p) => ({ ...p, trialDays: String(days), libraryQuestions: lib }));
    }, "Saved. Phones pick it up the next time the app refreshes (usually within a few minutes of opening it).");
  };

  if (loading) return <Loading />;
  const days = Number(form.trialDays);
  return (
    <>
      <PageHead title="Paywall" subtitle="Control Pro in the app without an app update: free trial, how people pay, the question count, and whether Pro can be bought." />
      <div className="cols-2" style={{ gridTemplateColumns: "minmax(0, 560px) minmax(0, 1fr)" }}>
        <Card title="Pro settings" subtitle="Saved to appConfig/pro. The app reads it every time it refreshes.">
          <div className="stack-sm">
            {!saved && <Notice>Nothing saved yet, so the app uses its built-in defaults: Pro purchases are <b>closed</b>, QR / UPI payment, a 30 day trial and “15,000+” questions.</Notice>}

            <label className="check">
              <input type="checkbox" checked={form.purchasesOpen} onChange={(e) => set("purchasesOpen", e.target.checked)} />
              <span>Pro purchases are open <span className="muted small">(turn off to hide plans, prices and payment buttons; the app shows “Pro plans open soon”)</span></span>
            </label>

            <Field label="Payment method" hint="QR / UPI is the manual flow you approve in Payments. “PayU first” shows PayU before the QR screen and only works if PayU is set up in the app.">
              <Segmented value={form.paymentMethod} onChange={(v) => set("paymentMethod", v)} options={[
                { value: "qr", label: "QR / UPI", icon: "card" },
                { value: "payu", label: "PayU first", icon: "bolt" },
              ]} />
            </Field>

            <Field label="Free trial (days)" hint="How long a new free trial lasts. 1 to 365. People already on a trial get the new length too.">
              <input type="number" inputMode="numeric" min={1} max={365} step={1} value={form.trialDays} onChange={(e) => set("trialDays", e.target.value)} />
            </Field>

            <Field label="Question count shown" hint="Text on the Pro page and in Free vs Pro, for example 17,000+.">
              <input value={form.libraryQuestions} maxLength={20} onChange={(e) => set("libraryQuestions", e.target.value)} placeholder="e.g. 17,000+" />
            </Field>

            {err && <Notice tone="bad">{err}</Notice>}
            <div><Button variant="primary" icon="check" disabled={busy === "save"} onClick={save}>{busy === "save" ? "Saving…" : "Save paywall settings"}</Button></div>
          </div>
        </Card>

        <Card title="What people will see" subtitle="Based on the values in the form.">
          <div className="stack-sm">
            <div className="row">
              <Badge tone={form.purchasesOpen ? "ok" : "warn"} dot>{form.purchasesOpen ? "Pro is for sale" : "Pro plans open soon"}</Badge>
              <Badge tone="accent">{form.paymentMethod === "payu" ? "PayU first, QR as backup" : "QR / UPI"}</Badge>
            </div>
            <KeyValue rows={[
              ["Free trial", Number.isInteger(days) && days >= 1 && days <= 365 ? days + (days === 1 ? " day" : " days") : "Check the number of days"],
              ["Question count", form.libraryQuestions.trim() || "—"],
              ["Last saved", saved?.updatedAt ? fmtDateTime(tsMs(saved.updatedAt)) + (saved.updatedBy ? " by " + saved.updatedBy : "") : "Never"],
            ]} />
            <p className="small muted">Turning purchases off does not take Pro away from anyone. Trials, star rewards, gifts from this admin and existing Pro plans keep working.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
