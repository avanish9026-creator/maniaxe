import { useMemo } from "react";
import { useAdmin } from "../store";
import { Avatar, Badge, Empty, Stat } from "../ui";
import { PRO_TONE, ago, fmtDay, inr, ms } from "../lib/util";

const monthKey = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

export default function Overview({ go, counts }) {
  const { people, payments, feedback, contacts, isOwner } = useAdmin();
  const s = useMemo(() => {
    const real = payments.filter((p) => p.status === "approved" && !p.test && !p.gift && (p.currency || "INR").toUpperCase() === "INR");
    const sum = (l) => l.reduce((t, p) => t + (Number(p.amount) || 0), 0);
    const now = monthKey(Date.now());
    return {
      online: people.filter((u) => u.online).length,
      paid: people.filter((u) => u.pro.hasPaid).length,
      trial: people.filter((u) => ["trial", "reward"].includes(u.pro.key)).length,
      month: sum(real.filter((p) => ms(p.createdAt) && monthKey(ms(p.createdAt)) === now)),
      total: sum(real),
    };
  }, [people, payments]);
  const todo = [
    isOwner && counts.payments > 0 && ["payments", counts.payments + " payment" + (counts.payments > 1 ? "s" : "") + " waiting for approval", "Match the amount and UTR in your bank app first."],
    feedback.some((f) => !f.handled) && ["inbox", feedback.filter((f) => !f.handled).length + " feedback not handled", "Read and mark as handled."],
    contacts.some((c) => (c.status || "new") === "new") && ["inbox", contacts.filter((c) => (c.status || "new") === "new").length + " new contact messages", "People are waiting for a reply."],
  ].filter(Boolean);

  return (
    <>
      <div className="grid cols-4">
        {isOwner && <Stat label="Users" value={people.length} hint={s.online + " online now"} onClick={() => go("users")} />}
        {isOwner && <Stat label="Paid Pro" value={s.paid} hint={s.trial + " on trial or reward"} onClick={() => go("users")} />}
        {isOwner && <Stat label="Revenue this month" value={inr(s.month)} hint={"All time " + inr(s.total)} onClick={() => go("payments")} />}
        <Stat label="Inbox" value={counts.inbox} hint="Feedback and messages to handle" onClick={() => go("inbox")} />
      </div>
      <div className="grid cols-2">
        <section className="panel flush">
          <div className="panel-head"><h2>Needs your attention</h2></div>
          {todo.length === 0 ? <Empty title="All caught up" hint="No payments or messages are waiting." /> : todo.map(([page, t, h]) => (
            <button key={t} className="quiet" style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 18px", borderRadius: 0, borderBottom: "1px solid var(--line)" }} onClick={() => go(page)}>
              <b style={{ color: "var(--text)" }}>{t}</b><br /><span className="muted small">{h}</span>
            </button>
          ))}
        </section>
        {isOwner && (
          <section className="panel flush">
            <div className="panel-head"><h2>Recently active</h2><button className="sm quiet" onClick={() => go("users")}>All users</button></div>
            {people.slice(0, 6).map((u) => (
              <button key={u.uid} className="quiet" style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", textAlign: "left", padding: "10px 18px", borderRadius: 0 }} onClick={() => go("users", u.uid)}>
                <Avatar u={u} size="sm" />
                <span className="grow ellip"><b style={{ color: "var(--text)" }}>{u.name || "Trakey User"}</b> <span className="faint">{u.email}</span></span>
                <Badge tone={PRO_TONE[u.pro.key]}>{u.pro.label}</Badge>
                <span className="faint small" style={{ width: 80, textAlign: "right" }}>{ago(ms(u.lastSeenAt))}</span>
              </button>
            ))}
            {people.length === 0 && <Empty title="No users yet" />}
          </section>
        )}
      </div>
      {isOwner && (
        <section className="panel flush">
          <div className="panel-head"><h2>Latest payments</h2><button className="sm quiet" onClick={() => go("payments")}>All payments</button></div>
          <table><tbody>
            {payments.slice(0, 5).map((p) => (
              <tr key={p.id} className="click" onClick={() => go("payments")}>
                <td>{p.name || p.email || p.uid}</td><td className="muted">{p.plan}</td><td>{inr(p.amount)}</td>
                <td><Badge tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}>{p.status}</Badge></td>
                <td className="faint">{fmtDay(ms(p.createdAt))}</td>
              </tr>
            ))}
          </tbody></table>
          {payments.length === 0 && <Empty title="No payments yet" />}
        </section>
      )}
    </>
  );
}
