// Overview: what needs attention, key numbers, quick actions. Shows only what the signed-in role may use.
const rupee = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Overview({ role, email, stats, recentPayments, recentUsers, go }) {
  const owner = role === "owner";
  const attention = [
    owner && stats.pendingPayments > 0 && ["payments", stats.pendingPayments + " payment" + (stats.pendingPayments > 1 ? "s" : "") + " to review"],
    stats.unreadFeedback > 0 && ["feedback", stats.unreadFeedback + " new feedback"],
    stats.newContacts > 0 && ["contact", stats.newContacts + " new contact message" + (stats.newContacts > 1 ? "s" : "")],
  ].filter(Boolean);

  const tiles = owner
    ? [["Users", stats.users, "users"], ["Online now", stats.online, "users"], ["Pro members", stats.pro, "users"], ["On free trial", stats.trial, "users"],
       ["Income this month", rupee(stats.monthRevenue), "payments"], ["Income all time", rupee(stats.totalRevenue), "payments"]]
    : [["Feedback", stats.feedback, "feedback"], ["Contact messages", stats.contacts, "contact"]];

  const actions = [
    ["announcements", "Post an announcement"],
    ["notifications", "Send a notification"],
    ["updates", "Add an app update"],
    ["gate", "Update gate"],
    owner && ["users", "Manage users and Pro"],
    owner && ["payments", "Review payments"],
  ].filter(Boolean);

  return (
    <>
      <div className="page-head"><div><h2>Overview</h2><p>Signed in as {email} · {owner ? "Owner" : "Editor"}</p></div></div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Needs attention</h4>
        {attention.length === 0 ? <p className="muted" style={{ margin: 0 }}>All caught up.</p> : (
          <div className="chips">{attention.map(([to, text]) => <button key={to} type="button" className="chip warn" onClick={() => go(to)}>{text}</button>)}</div>
        )}
      </div>

      <div className="tiles">
        {tiles.map(([label, value, to]) => (
          <button key={label} type="button" className="tile" onClick={() => go(to)}><span>{label}</span><b>{value}</b></button>
        ))}
      </div>

      <h4 className="section-title">Quick actions</h4>
      <div className="tiles actions">
        {actions.map(([to, label]) => <button key={to} type="button" className="tile action" onClick={() => go(to)}>{label}</button>)}
      </div>

      {owner && (
        <div className="two-col">
          <div className="card">
            <h4 style={{ marginTop: 0 }}>Latest payments</h4>
            {recentPayments.length === 0 && <p className="muted">No payments yet.</p>}
            {recentPayments.map((p) => (
              <div key={p.id} className="mini-row">
                <span>{p.name || p.email || "Unknown"}<small>{p.plan || ""}{p.test ? " · test" : ""}{p.gift ? " · gift" : ""}</small></span>
                <span><b>{rupee(Number(p.amount) || 0)}</b><small>{p.status || "pending"}</small></span>
              </div>
            ))}
          </div>
          <div className="card">
            <h4 style={{ marginTop: 0 }}>Latest users</h4>
            {recentUsers.length === 0 && <p className="muted">No users yet.</p>}
            {recentUsers.map((u) => (
              <div key={u.id} className="mini-row">
                <span>{u.name || "Trakey User"}<small>{u.email || "profile not synced yet"}</small></span>
                <span><small>{u.proLabel}</small></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
