// Gift Pro / remove Pro. Used on the user page and from the quick actions on a user card.
import { useState } from "react";
import { Button, Icon, Modal, useBusy, useUI } from "../lib/ui";
import { useStore } from "../lib/store";
import { PLANS } from "../lib/pro";
import { firstName } from "../lib/format";

export function GiftPlans({ person, onDone }) {
  const { actions } = useStore();
  const { confirm } = useUI();
  const [busy, run] = useBusy();
  const who = person.name || person.email || person.uid;

  const gift = async (key) => {
    const plan = PLANS[key];
    const ok = await confirm({
      title: "Gift " + plan.label + " Pro to " + firstName(person.name, person.email) + "?",
      body: "It is added after any Pro time they already have, and recorded as a free gift in Payments (amount ₹0, never counted as income).",
      confirmLabel: "Gift " + plan.label,
    });
    if (!ok) return;
    const done = await run(key, async () => { await actions.giftPro(person, key); return true; }, plan.label + " Pro gifted to " + who + ".");
    if (done) onDone?.();
  };

  return (
    <div className="plan-grid">
      {Object.entries(PLANS).map(([key, plan]) => (
        <button key={key} type="button" className="plan-card" disabled={!!busy} onClick={() => gift(key)}>
          <b>{plan.label}</b>
          <span className="price">₹{plan.price}</span>
          <span>{plan.blurb}</span>
          <span style={{ color: "var(--accent)", fontWeight: 700, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="gift" size={14} /> {busy === key ? "Gifting…" : "Gift this plan"}
          </span>
        </button>
      ))}
    </div>
  );
}

export function RemovePro({ person }) {
  const { actions } = useStore();
  const { confirm } = useUI();
  const [alsoTrial, setAlsoTrial] = useState(false);
  const [busy, run] = useBusy();
  const pro = person.pro;
  if (!pro.hasAccess) return null;

  const remove = async () => {
    const ok = await confirm({
      title: "Remove Pro from " + firstName(person.name, person.email) + "?",
      body: "This ends their paid or gifted Pro now" + (alsoTrial ? ", and also their free trial and star reward" : "") + ". Payment records stay as they are, so refund separately if they paid.",
      confirmLabel: "Remove Pro", danger: true,
    });
    if (ok) {
      run("remove", async () => { await actions.removePro(person, alsoTrial, !!pro.raw.starRewardAt); setAlsoTrial(false); }, "Pro removed.");
    }
  };

  return (
    <div className="danger-zone">
      <div>
        <b>Remove Pro access</b>
        <p className="small muted">Ends their paid or gifted Pro right away. Their payment records are kept.</p>
      </div>
      <label className="check"><input type="checkbox" checked={alsoTrial} onChange={(e) => setAlsoTrial(e.target.checked)} /> Also end their free trial and star reward</label>
      <div><Button variant="danger" icon="trash" disabled={busy === "remove"} onClick={remove}>{busy === "remove" ? "Removing…" : "Remove Pro"}</Button></div>
    </div>
  );
}

export function GiftModal({ person, onClose }) {
  return (
    <Modal title={"Gift Pro to " + (person.name || person.email || "this person")} subtitle="Choose a plan. You will be asked to confirm." onClose={onClose} width={620}>
      <GiftPlans person={person} onDone={onClose} />
    </Modal>
  );
}
