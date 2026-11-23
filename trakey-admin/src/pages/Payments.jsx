import { useMemo, useState } from "react";
import { useAdmin } from "../store";
import { Badge, Drawer, Empty, Field, Seg } from "../ui";
import { PLANS, fmtDay, fmtTime, inr, ms } from "../lib/util";
import { buildCsv, buildPdf, downloadBlob, financialYear, selectRecords } from "../paymentExport";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const blank = () => ({ status: "approved", plan: "yearly", amount: "", currency: "INR", date: today(), name: "", email: "", uid: "", ref: "", method: "PayPal", country: "", note: "", grantPro: false, gift: false });
const tone = (s) => (s === "approved" ? "ok" : s === "rejected" ? "bad" : "warn");

export default function Payments({ go }) {
  const A = useAdmin();
  const [f, setF] = useState("pending");
  const [open, setOpen] = useState("");
  const [manual, setManual] = useState(false);
  const list = useMemo(() => A.payments.filter((p) => f === "all" || (p.status || "pending") === f), [A.payments, f]);
  const n = (s) => A.payments.filter((p) => (p.status || "pending") === s).length;
  return (
    <>
      <div className="row spread">
        <Seg value={f} onChange={setF} options={[["pending", "Pending", n("pending")], ["approved", "Approved", n("approved")], ["rejected", "Rejected", n("rejected")], ["all", "All", A.payments.length]]} />
        <button className="primary" onClick={() => setManual(true)}>Add record</button>
      </div>
      <section className="panel flush">
        {list.length === 0 ? <Empty title={f === "pending" ? "Nothing waiting for approval" : "No payments here"} hint="Manual UPI orders from the app appear as soon as a user submits them." /> : (
          <table>
            <thead><tr><th>Customer</th><th>Plan</th><th>Amount</th><th>UTR / method</th><th>Date</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((p) => (
                <Row key={p.id} p={p} expanded={open === p.id} toggle={() => setOpen(open === p.id ? "" : p.id)} go={go} />
              ))}
            </tbody>
          </table>
        )}
      </section>
      <Export />
      {manual && <Manual onClose={() => setManual(false)} />}
    </>
  );
}

function Row({ p, expanded, toggle, go }) {
  const A = useAdmin();
  const [amount, setAmount] = useState(String(p.amount ?? ""));
  const [reason, setReason] = useState("");
  const [shot, setShot] = useState(null);
  const pending = (p.status || "pending") === "pending";
  const showShot = async () => { if (shot === null) setShot(await A.loadShot(p.id).catch(() => "")); };
  return (
    <>
      <tr className="click" onClick={() => { toggle(); if (!expanded) showShot(); }}>
        <td><b>{p.name || "—"}</b><br /><span className="faint small">{p.email}</span></td>
        <td>{PLANS[p.plan]?.label || p.plan}</td>
        <td>{p.currency && p.currency !== "INR" ? p.currency + " " : "₹"}{Number(p.amount) || 0}{p.amountAdjusted && <span className="faint small"> (list ₹{p.listAmount})</span>}</td>
        <td className="mono">{p.utr || p.method || "—"}</td>
        <td className="faint">{fmtDay(ms(p.createdAt))}</td>
        <td><Badge tone={tone(p.status)}>{p.gift ? "gift" : p.status || "pending"}</Badge></td>
        <td className="faint">{expanded ? "▴" : "▾"}</td>
      </tr>
      {expanded && (
        <tr><td colSpan={7} style={{ background: "var(--side)" }}>
          <div className="grid cols-2">
            <div className="stack">
              <span className="muted small">Order {p.id} · created {fmtTime(ms(p.createdAt))}{p.reviewedAt ? " · reviewed " + fmtTime(ms(p.reviewedAt)) : ""}{p.country ? " · " + p.country : ""}</span>
              {p.note && <div className="note">{p.note}</div>}
              {Array.isArray(p.amountHistory) && p.amountHistory.map((h, i) => <span key={i} className="faint small">₹{h.from} → ₹{h.to} by {h.by}: {h.why}</span>)}
              {p.uid && <div><button className="sm" onClick={() => go("users", p.uid)}>Open user</button></div>}
              {shot ? <img className="shot" src={shot} alt="Payment screenshot" /> : shot === "" ? <span className="faint small">No screenshot attached.</span> : null}
            </div>
            <div className="stack">
              {pending ? (
                <>
                  <Field label="Amount you actually received (₹, 0 for a free gift)"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
                  <div className="row">
                    <button className="primary" onClick={() => A.approvePayment(p, amount, "")}>Approve and activate Pro</button>
                    <button className="danger" onClick={() => { const r = window.prompt("Reason shown to the user:", "We could not find this payment. Check the UTR and amount, then try again."); if (r !== null) A.rejectPayment(p, r); }}>Reject</button>
                  </div>
                </>
              ) : p.status === "approved" ? (
                <>
                  <Field label="Change amount (Pro access is not changed)"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
                  <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Discount, free gift, correction…" /></Field>
                  <div className="row"><button onClick={() => A.changeAmount(p, amount, reason)}>Save amount</button></div>
                </>
              ) : null}
              {p.manual && <div><button className="danger sm" onClick={() => window.confirm("Delete manual record " + p.id + "? It does not change Pro access.") && A.deleteManual(p)}>Delete record</button></div>}
            </div>
          </div>
        </td></tr>
      )}
    </>
  );
}

function Export() {
  const A = useAdmin();
  const [status, setStatus] = useState("both"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const rows = selectRecords(A.payments, { status, from, to });
  const fy = (o) => { const x = financialYear(o); setFrom(x.from); setTo(x.to); };
  const go = (kind) => {
    if (!rows.length) return A.notify("No approved or rejected payments in this selection.", "bad");
    const part = status === "both" ? "approved-rejected" : status;
    const label = status === "both" ? "Approved and Rejected" : status === "approved" ? "Approved" : "Rejected";
    downloadBlob(kind === "csv" ? buildCsv(rows) : buildPdf(rows, { period: from || to ? (from || "start") + " to " + (to || "today") : "All dates", statusLabel: label }), `trakey-payment-records-${part}-${today()}.${kind}`);
  };
  return (
    <section className="card stack">
      <div className="row spread"><h2>Download records for tax</h2><span className="muted small">{rows.length} records selected · pending orders are never included</span></div>
      <div className="row" style={{ alignItems: "end" }}>
        <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="both">Approved + Rejected</option><option value="approved">Approved only</option><option value="rejected">Rejected only</option></select></Field>
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <button onClick={() => fy(0)}>This FY</button><button onClick={() => fy(-1)}>Last FY</button><button className="quiet" onClick={() => { setFrom(""); setTo(""); }}>All dates</button>
        <button className="primary" onClick={() => go("pdf")}>PDF</button><button onClick={() => go("csv")}>CSV</button>
      </div>
    </section>
  );
}

function Manual({ onClose }) {
  const A = useAdmin();
  const [f, setF] = useState(blank()); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = async () => { setBusy(true); const ok = await A.addManual(f); setBusy(false); if (ok) onClose(); };
  return (
    <Drawer onClose={onClose} head={<div className="row spread"><h1>Add manual record</h1><button className="quiet" onClick={onClose}>✕</button></div>}>
      <p className="muted small">For payments outside India, discounts or free gifts. The amount you type is what tax downloads add up, so enter what you really received (0 for a free gift).</p>
      <div className="form-grid">
        <Field label="Status"><select value={f.status} onChange={set("status")}><option value="approved">Approved</option><option value="rejected">Rejected</option></select></Field>
        <Field label="Plan"><select value={f.plan} onChange={set("plan")}>{Object.entries(PLANS).map(([k, p]) => <option key={k} value={k}>{p.label} · ₹{p.price}</option>)}</select></Field>
        <Field label="Amount received"><input inputMode="decimal" value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Currency"><input value={f.currency} onChange={set("currency")} /></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="Method"><input value={f.method} onChange={set("method")} /></Field>
        <Field label="Customer name"><input value={f.name} onChange={set("name")} /></Field>
        <Field label="Customer email"><input value={f.email} onChange={set("email")} /></Field>
        <Field label="Account ID (optional)"><input value={f.uid} onChange={set("uid")} /></Field>
        <Field label="Reference"><input value={f.ref} onChange={set("ref")} /></Field>
        <Field label="Country"><input value={f.country} onChange={set("country")} /></Field>
      </div>
      <Field label="Note"><input value={f.note} onChange={set("note")} /></Field>
      <label className="row" style={{ color: "var(--text)" }}><input type="checkbox" style={{ width: "auto" }} checked={f.grantPro} onChange={set("grantPro")} /> Also activate Pro for this person</label>
      <label className="row" style={{ color: "var(--text)" }}><input type="checkbox" style={{ width: "auto" }} checked={f.gift} onChange={set("gift")} /> This is a free gift</label>
      <div><button className="primary" disabled={busy} onClick={save}>Save record</button></div>
    </Drawer>
  );
}
