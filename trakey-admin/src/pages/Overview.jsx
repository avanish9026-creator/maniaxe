import { useMemo } from "react";
import { Avatar, Badge, Button, Card, Empty, Icon, PageHead, ProBadge } from "../lib/ui";
import { useStore } from "../lib/store";
import { daysLeft, firstName, fmtDateTime, monthKeyIst, rupee, timeAgo, tsMs } from "../lib/format";
import { go, href } from "../lib/router";

function Stat({ icon, label, value, note, to, tone }) {
  const inner = (
    <>
      <div className="stat-top"><span>{label}</span><span className={"stat-ic " + (tone ? "tone-" + tone + "-ic" : "")}><Icon name={icon} size={17} /></span></div>
      <b>{value}</b>
      {note && <small>{note}</small>}
    </>
  );
  return to ? <a className="stat" href={href(to)}>{inner}</a> : <div className="stat">{inner}</div>;
}

function IncomeChart({ payments }) {
  const months = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
      const key = monthKeyIst(d.getTime());
      out.push({ key, label: d.toLocaleDateString("en-IN", { month: "short" }), total: 0 });
    }
    payments.forEach((p) => {
      if (p.status !== "approved" || p.test || p.gift || (p.currency || "INR").toUpperCase() !== "INR") return;
      const ms = tsMs(p.createdAt);
      const m = ms && out.find((x) => x.key === monthKeyIst(ms));
      if (m) m.total += Number(p.amount) || 0;
    });
    return out;
  }, [payments]);
  const max = Math.max(...months.map((m) => m.total), 1);
  return (
    <div className="bars" role="img" aria-label="Income for the last six months">
      {months.map((m) => (
        <div className="bar" key={m.key}>
          <div className="bar-col" style={{ height: Math.max(3, (m.total / max) * 100) + "%" }} title={rupee(m.total)} />
          <b>{m.total ? rupee(m.total) : "–"}</b>
          <span>{m.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const { isOwner, user, people, payments, feedback, contacts, loaded } = useStore();
  const name = firstName(user?.displayName, "") === "there" ? "Admin" : firstName(user?.displayName, "");
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const stats = useMemo(() => {
    const real = payments.filter((p) => p.status === "approved" && !p.test && !p.gift && (p.currency || "INR").toUpperCase() === "INR");
    const sum = (l) => l.reduce((t, p) => t + (Number(p.amount) || 0), 0);
    const mk = monthKeyIst(Date.now());
    return {
      online: people.filter((p) => p.online).length,
      pro: people.filter((p) => p.pro.hasPaid).length,
      trial: people.filter((p) => p.pro.key === "trial" || p.pro.key === "reward").length,
      month: sum(real.filter((p) => { const ms = tsMs(p.createdAt); return ms && monthKeyIst(ms) === mk; })),
      total: sum(real),
      pending: payments.filter((p) => (p.status || "pending") === "pending"),
      expiring: people.filter((p) => p.pro.hasAccess && p.pro.key !== "lifetime" && p.pro.endMs && daysLeft(p.pro.endMs) <= 7)
        .sort((a, b) => a.pro.endMs - b.pro.endMs),
    };
  }, [people, payments]);

  const newFeedback = feedback.filter((f) => !f.handled);
  const newContacts = contacts.filter((c) => (c.status || "new") === "new");
  const attention = [
    isOwner && stats.pending.length > 0 && { to: "payments", icon: "card", tone: "warn", title: stats.pending.length + (stats.pending.length === 1 ? " payment" : " payments") + " waiting", text: "Check your bank app, then approve or reject." },
    newContacts.length > 0 && { to: "inbox", icon: "chat", tone: "accent", title: newContacts.length + " new support " + (newContacts.length === 1 ? "message" : "messages"), text: "People are waiting for a reply." },
    newFeedback.length > 0 && { to: "inbox", icon: "star", tone: "accent", title: newFeedback.length + " new " + (newFeedback.length === 1 ? "review" : "reviews"), text: "Ratings and survey answers to look through." },
  ].filter(Boolean);

  return (
    <>
      <PageHead title={greet + ", " + name} subtitle="Here is what is happening in Trakey right now.">
        <Button variant="primary" icon="bell" onClick={() => go("broadcast")}>Notify everyone</Button>
        <Button icon="megaphone" onClick={() => go("broadcast")}>New announcement</Button>
      </PageHead>

      {isOwner ? (
        <div className="stats">
          <Stat icon="users" label="Total users" value={people.length.toLocaleString("en-IN")} to="users" />
          <Stat icon="bolt" label="Online now" value={stats.online} note="active in the last 5 min" to="users" tone="ok" />
          <Stat icon="crown" label="Pro members" value={stats.pro} note="paid or gifted" to="users" tone="gold" />
          <Stat icon="gift" label="On free trial" value={stats.trial} to="users" />
          <Stat icon="card" label="Income this month" value={rupee(stats.month)} to="payments" tone="ok" />
          <Stat icon="card" label="Income, all time" value={rupee(stats.total)} to="payments" />
        </div>
      ) : (
        <div className="stats">
          <Stat icon="star" label="Reviews" value={feedback.length} to="inbox" />
          <Stat icon="chat" label="Support messages" value={contacts.length} to="inbox" />
          <Stat icon="inbox" label="Need a reply" value={newContacts.length + newFeedback.length} to="inbox" tone="warn" />
        </div>
      )}

      <div className="cols-main">
        <div className="stack">
          <Card title="Needs your attention">
            {attention.length === 0 ? (
              <Empty icon="check" title="All caught up">No payments, messages or reviews are waiting.</Empty>
            ) : (
              <div className="stack-sm">
                {attention.map((a) => (
                  <a key={a.title} className="attn" href={href(a.to)}>
                    <span className={"tl-ic " + a.tone}><Icon name={a.icon} size={17} /></span>
                    <span><b>{a.title}</b><span>{a.text}</span></span>
                    <Icon name="right" className="chev" size={17} />
                  </a>
                ))}
              </div>
            )}
          </Card>

          {isOwner && (
            <Card title="Pro ending soon" subtitle="Nudge them before it ends. One tap opens their page with a ready message." pad={false}>
              {stats.expiring.length === 0 ? (
                <Empty icon="crown" title="Nobody is expiring this week" />
              ) : (
                <div className="list" style={{ marginTop: 14 }}>
                  {stats.expiring.slice(0, 6).map((p) => (
                    <a key={p.uid} className="list-row link" href={href("users", p.uid)}>
                      <Avatar name={p.name} email={p.email} size={36} />
                      <div className="list-main"><b>{p.name || "Trakey User"}</b><span>{p.email || p.uid}</span></div>
                      <div className="list-end"><Badge tone="warn">{daysLeft(p.pro.endMs) <= 0 ? "Ends today" : daysLeft(p.pro.endMs) + (daysLeft(p.pro.endMs) === 1 ? " day left" : " days left")}</Badge><span>{p.pro.label}</span></div>
                    </a>
                  ))}
                </div>
              )}
            </Card>
          )}

          {isOwner && (
            <Card title="Income, last 6 months" subtitle="Approved payments in rupees. Gifts and test orders are not counted.">
              <IncomeChart payments={payments} />
            </Card>
          )}
        </div>

        {isOwner && (
          <div className="stack">
            <Card title="Latest users" action={<Button size="sm" variant="quiet" onClick={() => go("users")}>View all</Button>} pad={false}>
              <div className="list" style={{ marginTop: 14 }}>
                {people.slice(0, 6).map((p) => (
                  <a key={p.uid} className="list-row link" href={href("users", p.uid)}>
                    <Avatar name={p.name} email={p.email} size={36} online={p.online} />
                    <div className="list-main"><b>{p.name || "Trakey User"}</b><span>{p.email || "profile not synced yet"} · {p.online ? "active now" : timeAgo(p.lastSeenMs)}</span></div>
                    <ProBadge pro={p.pro} />
                  </a>
                ))}
                {people.length === 0 && <Empty icon="users" title={loaded.users ? "No users yet" : "Loading users…"} />}
              </div>
            </Card>

            <Card title="Latest payments" action={<Button size="sm" variant="quiet" onClick={() => go("payments")}>View all</Button>} pad={false}>
              <div className="list" style={{ marginTop: 14 }}>
                {payments.slice(0, 6).map((p) => (
                  <a key={p.id} className="list-row link" href={p.uid ? href("users", p.uid) : href("payments")}>
                    <span className={"tl-ic " + (p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn")}><Icon name="card" size={16} /></span>
                    <div className="list-main"><b>{p.name || p.email || "Unknown"}</b><span>{p.plan || ""}{p.gift ? " · gift" : ""} · {fmtDateTime(tsMs(p.createdAt))}</span></div>
                    <div className="list-end"><b>{rupee(p.amount)}</b><span>{p.status || "pending"}</span></div>
                  </a>
                ))}
                {payments.length === 0 && <Empty icon="card" title="No payments yet" />}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
