import { useMemo, useState } from "react";
import { Button, Field, Icon, Modal, Notice, PageHead, Segmented, useBusy, useUI } from "../lib/ui";
import { useStore } from "../lib/store";
import { money, rupee, monthKeyIst, todayIst, tsMs } from "../lib/format";
import { PLANS } from "../lib/pro";
import PaymentsList from "../components/PaymentsList";
import { buildCsv, buildPdf, downloadBlob, financialYear, selectRecords } from "../paymentExport";

const emptyManual = () => ({
  status: "approved", plan: "yearly", amount: "", currency: "INR", date: todayIst(), name: "", email: "", uid: "",
  ref: "", method: "PayPal", country: "", note: "", grantPro: false, gift: false,
});

function ExportModal({ payments, onClose }) {
  const { toast } = useUI();
  const [status, setStatus] = useState("both");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const count = selectRecords(payments, { status, from, to }).length;

  const download = (format) => {
    const rows = selectRecords(payments, { status, from, to });
    if (!rows.length) return toast("No approved or rejected payments in this selection.", "bad");
    const part = status === "both" ? "approved-rejected" : status;
    const stamp = todayIst();
    if (format === "csv") downloadBlob(buildCsv(rows), "trakey-payment-records-" + part + "-" + stamp + ".csv");
    else downloadBlob(buildPdf(rows, {
      period: from || to ? (from || "start") + " to " + (to || "today") : "All dates",
      statusLabel: status === "both" ? "Approved and Rejected" : status === "approved" ? "Approved" : "Rejected",
    }), "trakey-payment-records-" + part + "-" + stamp + ".pdf");
    toast("Download started.");
  };
  const fy = (n) => { const f = financialYear(n); setFrom(f.from); setTo(f.to); };

  return (
    <Modal title="Download payment records" subtitle="For tax. Approved and rejected payments with customer, plan, amount, UTR, country and dates (IST). Pending orders are never included." onClose={onClose} width={620}
      footer={<><Button variant="quiet" onClick={onClose}>Close</Button><Button icon="file" onClick={() => download("pdf")}>Download PDF</Button><Button variant="primary" icon="download" onClick={() => download("csv")}>Download CSV</Button></>}>
      <div className="form-grid">
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="both">Approved + Rejected</option><option value="approved">Approved only</option><option value="rejected">Rejected only</option>
          </select>
        </Field>
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <div className="row">
        <button type="button" className="chip" onClick={() => fy(0)}>{financialYear(0).label}</button>
        <button type="button" className="chip" onClick={() => fy(1)}>{financialYear(1).label}</button>
        <button type="button" className="chip" onClick={() => { setFrom(""); setTo(""); }}>All dates</button>
        <span className="small muted" style={{ marginLeft: "auto" }}>{count} records selected</span>
      </div>
    </Modal>
  );
}

function ManualModal({ preset, onClose }) {
  const { actions, people } = useStore();
  const [f, setF] = useState(preset || emptyManual());
  const [busy, run] = useBusy();
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    const ok = await run("save", async () => { await actions.addManualPayment(f, people); return true; }, "Record saved.");
    if (ok) onClose();
  };
  return (
    <Modal title={f.gift ? "Give Pro free (gift)" : "Add manual record"} width={760} onClose={onClose}
      subtitle="For payments outside India, discounts, or free gifts. The amount you type is what the tax downloads add up, so type what you really received (0 for a free gift)."
      footer={<><Button variant="quiet" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy === "save"} onClick={save}>{busy === "save" ? "Saving…" : "Save record"}</Button></>}>
      <div className="form-grid">
        <Field label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="approved">Approved</option><option value="rejected">Rejected</option></select></Field>
        <Field label="Subscription">
          <select value={f.plan} onChange={(e) => { const v = e.target.value; setF((p) => ({ ...p, plan: v, amount: p.amount === "" || p.amount === String(PLANS[p.plan]?.price) ? String(PLANS[v].price) : p.amount })); }}>
            <option value="monthly">Monthly · ₹{PLANS.monthly.price}</option><option value="yearly">Yearly · ₹{PLANS.yearly.price}</option><option value="lifetime">Lifetime · ₹{PLANS.lifetime.price}</option>
          </select>
        </Field>
        <Field label="Amount received (0 = free)"><input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="Currency"><input value={f.currency} maxLength={5} onChange={(e) => set("currency", e.target.value)} /></Field>
        <Field label="Payment date"><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Customer name"><input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Customer email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Account ID" hint="Optional if the email is in Users"><input value={f.uid} onChange={(e) => set("uid", e.target.value)} placeholder="from their user page" /></Field>
        <Field label="Transaction ID / reference"><input value={f.ref} onChange={(e) => set("ref", e.target.value)} /></Field>
        <Field label="Payment method"><input value={f.method} placeholder="PayPal, bank, card…" onChange={(e) => set("method", e.target.value)} /></Field>
        <Field label="Country"><input value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
        <Field label="Note / reason" className="full"><textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
      </div>
      {f.status === "approved" && (
        <label className="check"><input type="checkbox" checked={f.grantPro} onChange={(e) => set("grantPro", e.target.checked)} /> Also activate Pro for this Account ID (same days as Approve)</label>
      )}
    </Modal>
  );
}

export default function Payments() {
  const { payments, errors, isOwner } = useStore();
  const [filter, setFilter] = useState("pending");
  const [q, setQ] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [manual, setManual] = useState(null);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: payments.length };
    payments.forEach((p) => { c[p.status || "pending"] = (c[p.status || "pending"] || 0) + 1; });
    return c;
  }, [payments]);

  const sums = useMemo(() => {
    const real = payments.filter((p) => p.status === "approved" && !p.test && !p.gift && (p.currency || "INR").toUpperCase() === "INR");
    const mk = monthKeyIst(Date.now());
    const total = real.reduce((t, p) => t + (Number(p.amount) || 0), 0);
    const month = real.filter((p) => { const ms = tsMs(p.createdAt); return ms && monthKeyIst(ms) === mk; }).reduce((t, p) => t + (Number(p.amount) || 0), 0);
    return { total, month, gifts: payments.filter((p) => p.gift && p.status === "approved").length };
  }, [payments]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return payments.filter((p) => (filter === "all" || (p.status || "pending") === filter) &&
      (!s || [p.id, p.name, p.email, p.utr, p.uid, p.plan].some((v) => String(v || "").toLowerCase().includes(s))));
  }, [payments, filter, q]);

  if (!isOwner) return <Notice tone="warn">Only the owner can see payments.</Notice>;

  return (
    <>
      <PageHead title="Payments" subtitle="Manual UPI orders from the app. Match amount, UTR and time in your bank app before approving.">
        <Button icon="download" onClick={() => setShowExport(true)}>Download records</Button>
        <Button icon="gift" onClick={() => setManual({ ...emptyManual(), amount: "0", method: "Gift", country: "India", grantPro: true, gift: true, note: "Free gift" })}>Give Pro free</Button>
        <Button variant="primary" icon="plus" onClick={() => setManual(emptyManual())}>Add record</Button>
      </PageHead>

      {errors.payments && <div style={{ marginBottom: 16 }}><Notice tone="bad">{errors.payments}</Notice></div>}

      <div className="stats">
        <div className="stat"><div className="stat-top"><span>Waiting for review</span><span className="stat-ic tone-warn-ic"><Icon name="clock" size={17} /></span></div><b>{counts.pending}</b></div>
        <div className="stat"><div className="stat-top"><span>Income this month</span><span className="stat-ic tone-ok-ic"><Icon name="card" size={17} /></span></div><b>{rupee(sums.month)}</b></div>
        <div className="stat"><div className="stat-top"><span>Income, all time</span><span className="stat-ic"><Icon name="card" size={17} /></span></div><b>{rupee(sums.total)}</b></div>
        <div className="stat"><div className="stat-top"><span>Free gifts given</span><span className="stat-ic tone-gold-ic"><Icon name="gift" size={17} /></span></div><b>{sums.gifts}</b><small>not counted as income</small></div>
      </div>

      <div className="toolbar">
        <Segmented value={filter} onChange={setFilter} options={["pending", "approved", "rejected", "all"].map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1), count: counts[k] || 0 }))} />
        <div className="search-box"><Icon name="search" size={17} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, UTR or order ID" /></div>
      </div>

      <PaymentsList items={shown} emptyTitle={filter === "pending" ? "Nothing waiting" : "No payments here"} emptyText={filter === "pending" ? "New orders from the app show up here the moment they are placed." : "Try another filter or search."} />

      {showExport && <ExportModal payments={payments} onClose={() => setShowExport(false)} />}
      {manual && <ManualModal preset={manual} onClose={() => setManual(null)} />}
    </>
  );
}
