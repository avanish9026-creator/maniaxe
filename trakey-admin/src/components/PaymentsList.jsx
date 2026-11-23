// Payment cards with every action (approve, reject, edit amount, screenshot, delete). Used on the Payments page and on each user's page.
import { useState } from "react";
import { Badge, Button, CopyEmail, Empty, Field, Modal, useBusy, useCopy, useUI } from "../lib/ui";
import { useStore } from "../lib/store";
import { fmtDateTime, money, tsMs } from "../lib/format";
import { PLANS } from "../lib/pro";
import { href } from "../lib/router";

const STATUS_TONE = { approved: "ok", rejected: "bad", pending: "warn" };

export function PaymentCard({ item, showUser = true, onShot, onApprove, onEdit, busy }) {
  const { actions } = useStore();
  const { confirm, prompt, toast } = useUI();
  const copy = useCopy();
  const [b, run] = useBusy();
  const status = item.status || "pending";
  const cur = item.currency && item.currency !== "INR" ? item.currency : "INR";
  const adjusted = item.listAmount != null && Number(item.listAmount) !== Number(item.amount);
  const working = busy || b;

  const reject = async () => {
    const reason = await prompt({
      title: "Reject this payment?", body: "The person sees this reason in the app, and can send the corrected UTR.",
      label: "Reason shown to the user", defaultValue: "We could not find this payment. Check the UTR and amount, then try again.",
      confirmLabel: "Reject payment", danger: true,
    });
    if (reason === null) return;
    run("reject", () => actions.rejectPayment(item, reason), "Payment rejected.");
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Delete manual record " + item.id + "?",
      body: "This cannot be undone. It does not change the person's Pro access.", confirmLabel: "Delete record", danger: true,
    });
    if (ok) run("delete", () => actions.deleteManualPayment(item), "Record deleted.");
  };

  return (
    <article className={"pay-card " + status}>
      <div className="pay-top">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Badge tone={STATUS_TONE[status] || "muted"} dot>{status}</Badge>
            <Badge tone="muted">{PLANS[item.plan]?.label || item.plan || "Plan"}</Badge>
            {item.manual && <Badge tone="accent">Manual</Badge>}
            {item.gift && <Badge tone="gold" icon="gift">Free gift</Badge>}
            {item.test && <Badge tone="muted">Test</Badge>}
          </div>
          <div className="pay-amt">{money(item.amount, cur)}</div>
          {adjusted && (
            <p className="small" style={{ color: "var(--warn)", marginTop: 4 }}>
              Plan price was {money(item.listAmount, cur)}; received {money(item.amount, cur)}{item.adjustReason ? " · " + item.adjustReason : ""}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <button type="button" className="btn btn-quiet btn-sm mono" onClick={() => copy(item.id, "Order ID copied")}>{item.id}</button>
          <p className="small muted">{fmtDateTime(tsMs(item.createdAt))} IST</p>
        </div>
      </div>

      <div className="pay-meta">
        {showUser && (
          <div><span>Customer</span>
            <b>{item.uid ? <a href={href("users", item.uid)}>{item.name || "Trakey User"}</a> : item.name || "Trakey User"}</b>
            <div className="small muted row" style={{ gap: 4, flexWrap: "nowrap" }}><span style={{ wordBreak: "break-all" }}>{item.email || "No email"}</span><CopyEmail email={item.email} compact /></div>
          </div>
        )}
        <div><span>{item.manual ? "Reference" : "UTR"}</span><b>{item.utr || "—"}</b></div>
        {item.manual && (item.method || item.country) && <div><span>Method</span><b>{[item.method, item.country].filter(Boolean).join(" · ")}</b></div>}
        <div><span>App version</span><b>{item.appVersion ? "v" + item.appVersion : "—"}</b></div>
      </div>
      {item.note && <p className="small" style={{ whiteSpace: "pre-wrap" }}><span className="muted">Note: </span>{item.note}</p>}

      <div className="pay-actions">
        {status === "pending" && (
          <>
            <Button variant="ok" size="sm" icon="check" disabled={working} onClick={() => onApprove(item)}>Approve</Button>
            <Button variant="danger" size="sm" icon="x" disabled={working} onClick={reject}>Reject</Button>
          </>
        )}
        {!item.manual && <Button size="sm" icon="image" onClick={() => onShot(item)}>Screenshot</Button>}
        {status === "approved" && <Button size="sm" icon="edit" disabled={working} onClick={() => onEdit(item)}>Edit amount</Button>}
        {item.manual && <Button variant="quiet" size="sm" icon="trash" disabled={working} onClick={remove}>Delete</Button>}
      </div>
    </article>
  );
}

export default function PaymentsList({ items, showUser = true, emptyTitle = "No payments", emptyText }) {
  const { actions } = useStore();
  const [shot, setShot] = useState(null);       // { id, data|undefined|"" }
  const [approve, setApprove] = useState(null); // { item, amount, note }
  const [edit, setEdit] = useState(null);       // { item, amount, reason }
  const [busy, run] = useBusy();

  const openShot = async (item) => {
    setShot({ id: item.id, data: undefined });
    try { setShot({ id: item.id, data: await actions.paymentShot(item.id) }); }
    catch (err) { setShot({ id: item.id, data: "", error: err.message }); }
  };

  return (
    <>
      <div className="stack-sm">
        {items.map((item) => (
          <PaymentCard key={item.id} item={item} showUser={showUser} onShot={openShot}
            onApprove={(i) => setApprove({ item: i, amount: String(i.amount ?? ""), note: "" })}
            onEdit={(i) => setEdit({ item: i, amount: String(i.amount ?? ""), reason: "" })} />
        ))}
        {items.length === 0 && <div className="card"><Empty icon="card" title={emptyTitle}>{emptyText}</Empty></div>}
      </div>

      {shot && (
        <Modal title={"Payment screenshot · " + shot.id} onClose={() => setShot(null)} width={760}>
          {shot.data === undefined && <p className="muted">Loading screenshot…</p>}
          {shot.data === "" && <p style={{ color: "var(--bad)" }}>{shot.error || "No screenshot was found for this order."}</p>}
          {shot.data && <img className="shot" alt={"Payment screenshot " + shot.id} src={"data:image/jpeg;base64," + shot.data} />}
        </Modal>
      )}

      {approve && (
        <Modal title="Approve and activate Pro" width={480} onClose={() => setApprove(null)}
          subtitle={"Check the screenshot and your bank app. Type the amount that actually reached you. Plan price is " + money(approve.item.amount, approve.item.currency) + ". Type 0 if you are giving it free. Tax downloads add up this amount."}
          footer={
            <>
              <Button variant="quiet" onClick={() => setApprove(null)}>Cancel</Button>
              <Button variant="ok" icon="check" disabled={busy === "approve"}
                onClick={async () => { const ok = await run("approve", async () => { await actions.approvePayment(approve.item, approve.amount, approve.note); return true; }, "Approved. Pro is active."); if (ok) setApprove(null); }}>
                {busy === "approve" ? "Saving…" : "Approve and activate Pro"}
              </Button>
            </>
          }>
          <Field label="Amount received (₹)"><input type="number" min="0" step="0.01" autoFocus value={approve.amount} onChange={(e) => setApprove({ ...approve, amount: e.target.value })} /></Field>
          <Field label="Note (optional, only you see it)"><input value={approve.note} onChange={(e) => setApprove({ ...approve, note: e.target.value })} placeholder="e.g. friend, paid ₹100 only" /></Field>
        </Modal>
      )}

      {edit && (
        <Modal title="Edit amount received" width={480} onClose={() => setEdit(null)}
          subtitle="Pro access does not change. The old amount, new amount, date and reason are kept in the record."
          footer={
            <>
              <Button variant="quiet" onClick={() => setEdit(null)}>Cancel</Button>
              <Button variant="primary" disabled={busy === "edit"}
                onClick={async () => { const ok = await run("edit", async () => { await actions.saveAmount(edit.item, edit.amount, edit.reason); return true; }, "Amount saved."); if (ok) setEdit(null); }}>
                {busy === "edit" ? "Saving…" : "Save amount"}
              </Button>
            </>
          }>
          <Field label="Amount received"><input type="number" min="0" step="0.01" autoFocus value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
          <Field label="Reason"><input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="e.g. gave a discount, matches screenshot" /></Field>
        </Modal>
      )}
    </>
  );
}
