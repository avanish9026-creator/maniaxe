import { useMemo, useState } from "react";
import { useAdmin } from "../store";
import { Avatar, Badge, Drawer, Empty, Field, KV, Seg, copy } from "../ui";
import { PLANS, PRO_TONE, ago, fmtDay, fmtTime, inr, ms } from "../lib/util";
import { buildUserRows, buildUsersCsv, buildUsersPdf } from "../userExport";
import { downloadBlob } from "../paymentExport";

const FILTERS = [["all", "All"], ["online", "Online"], ["paid", "Paid"], ["trial", "Trial"], ["free", "Free"], ["expired", "Expired"]];
const match = (u, f) => ({
  all: true, online: u.online, paid: u.pro.hasPaid, trial: ["trial", "reward"].includes(u.pro.key),
  free: ["free", "ended"].includes(u.pro.key), expired: u.pro.key === "expired",
}[f]);

export default function Users({ id, go }) {
  const A = useAdmin();
  const [q, setQ] = useState(""); const [f, setF] = useState("all");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return A.people.filter((u) => match(u, f) && (!s || [u.name, u.email, u.uid, u.location].some((v) => String(v || "").toLowerCase().includes(s))));
  }, [A.people, q, f]);
  const counts = (k) => A.people.filter((u) => match(u, k)).length;
  const selected = id && A.people.find((u) => u.uid === id);

  const download = (kind) => {
    const data = buildUserRows({ users: A.people, proItems: A.pro, paymentItems: A.payments, feedbackItems: A.feedback, contactItems: A.contacts, isOnline: (u) => u.online });
    const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    downloadBlob(kind === "csv" ? buildUsersCsv(data) : buildUsersPdf(data), `trakey-user-data-${stamp}.${kind}`);
  };

  return (
    <>
      <div className="row spread">
        <Seg value={f} onChange={setF} options={FILTERS.map(([k, l]) => [k, l, counts(k)])} />
        <div className="row">
          <input style={{ width: 280 }} placeholder="Search name, email, ID, location" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={() => download("csv")}>Export CSV</button>
          <button onClick={() => download("pdf")}>Export PDF</button>
        </div>
      </div>
      {list.length === 0 ? <div className="card"><Empty title="No users match" hint="Try another filter or search." /></div> : (
        <div className="user-grid">
          {list.map((u) => (
            <button key={u.uid} className={"ucard" + (id === u.uid ? " sel" : "")} onClick={() => go("users", u.uid)}>
              <span className="id">
                <Avatar u={u} />
                <span><b className="ellip">{u.name || "Trakey User"}</b><span className="muted small ellip" style={{ display: "block" }}>{u.email || "No email"}</span></span>
                <span className={"dot grow-0" + (u.online ? " on" : "")} style={{ marginLeft: "auto" }} title={u.online ? "Online" : "Offline"} />
              </span>
              <span className="row"><Badge tone={PRO_TONE[u.pro.key]}>{u.pro.label}</Badge>{u.pro.endMs > 0 && u.pro.key !== "lifetime" && <span className="faint small">till {fmtDay(u.pro.endMs)}</span>}</span>
              <span className="meta"><span className="ellip">{u.location || "Location unknown"}</span><span>{u.online ? "Online" : ago(ms(u.lastSeenAt))}</span></span>
            </button>
          ))}
        </div>
      )}
      {selected && <UserDrawer u={selected} onClose={() => go("users")} />}
      {id && !selected && A.people.length > 0 && <UserMissing id={id} onClose={() => go("users")} />}
    </>
  );
}
const UserMissing = ({ id, onClose }) => <Drawer onClose={onClose} head={<h1>User not found</h1>}><p className="muted">No user with ID <span className="mono">{id}</span>.</p></Drawer>;

function UserDrawer({ u, onClose }) {
  const A = useAdmin();
  const [tab, setTab] = useState("overview");
  const rel = A.forUser(u);
  return (
    <Drawer onClose={onClose} head={
      <>
        <div className="row spread" style={{ alignItems: "flex-start" }}>
          <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
            <Avatar u={u} size="lg" />
            <div style={{ minWidth: 0 }}>
              <h1 className="ellip">{u.name || "Trakey User"}</h1>
              <div className="muted ellip">{u.email || "No email on record"}</div>
              <div className="row" style={{ marginTop: 6 }}>
                <Badge tone={PRO_TONE[u.pro.key]}>{u.pro.label}</Badge>
                <Badge tone={u.online ? "ok" : ""}>{u.online ? "Online now" : "Seen " + ago(ms(u.lastSeenAt))}</Badge>
              </div>
            </div>
          </div>
          <button className="quiet" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="tabs">
          {[["overview", "Overview"], ["pro", "Pro"], ["payments", "Payments " + rel.payments.length], ["contact", "Message"], ["history", "History " + (rel.feedback.length + rel.contacts.length)], ["data", "Raw data"]].map(([k, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </>
    }>
      {tab === "overview" && <Overview u={u} rel={rel} />}
      {tab === "pro" && <ProTab u={u} />}
      {tab === "payments" && <PaymentsTab rel={rel} />}
      {tab === "contact" && <MessageTab u={u} />}
      {tab === "history" && <HistoryTab rel={rel} />}
      {tab === "data" && <pre className="card mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>{JSON.stringify({ user: clean(u), proStatus: clean(u.pro.raw) }, null, 2)}</pre>}
    </Drawer>
  );
}
const clean = (v) => {
  if (v?.toMillis) return new Date(v.toMillis()).toISOString();
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "pro").map(([k, x]) => [k, clean(x)]));
  return v;
};

function Overview({ u, rel }) {
  const { notify } = useAdmin();
  const paid = rel.payments.filter((p) => p.status === "approved" && !p.gift).reduce((t, p) => t + (Number(p.amount) || 0), 0);
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="card stat"><span>Paid so far</span><b>{inr(paid)}</b></div>
        <div className="card stat"><span>Feedback</span><b>{rel.feedback.length}</b></div>
        <div className="card stat"><span>Messages</span><b>{rel.contacts.length}</b></div>
      </div>
      <div className="card">
        <KV rows={[
          ["Account ID", <span className="row"><span className="mono">{u.uid}</span><button className="sm quiet" onClick={() => copy(u.uid, notify)}>Copy</button></span>],
          ["Joined", u.createdAt || u.joinedAt ? fmtDay(ms(u.createdAt || u.joinedAt)) : ""],
          ["Last active", fmtTime(ms(u.lastSeenAt))],
          ["Location", u.location && <span>{u.location} <span className="faint small">({{ auto: "detected by the app", profile: "typed by the user", payment: "from a payment" }[u.locationSource]})</span></span>],
          ["Bio", u.bio],
          ["App version", u.appVersion],
          u.notIndexed && ["Note", "Profile not indexed yet. Details fill in after the user's next backup."],
        ]} />
      </div>
    </>
  );
}

function ProTab({ u }) {
  const A = useAdmin();
  const [plan, setPlan] = useState("monthly"); const [both, setBoth] = useState(false); const [busy, setBusy] = useState(false);
  const raw = u.pro.raw;
  const act = async (fn) => { setBusy(true); await fn(); setBusy(false); };
  return (
    <>
      <div className="card"><KV rows={[
        ["Status", <Badge tone={PRO_TONE[u.pro.key]}>{u.pro.label}</Badge>],
        ["Plan", PLANS[raw.plan]?.label],
        ["Access ends", u.pro.key === "lifetime" ? "Never (lifetime)" : u.pro.endMs ? fmtDay(u.pro.endMs) : ""],
        ["Trial started", ms(raw.trialStartedAt) ? fmtDay(ms(raw.trialStartedAt)) : ""],
        ["Star reward", ms(raw.starRewardAt) ? fmtDay(ms(raw.starRewardAt)) : ""],
        ["Paid via", raw.paidVia],
      ]} /></div>
      <div className="card stack">
        <h2>Gift Pro</h2>
        <p className="muted small">Adds time from today (or the current end date) and saves a free record in Payments.</p>
        <div className="row">
          <select style={{ width: 220 }} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {Object.entries(PLANS).map(([k, p]) => <option key={k} value={k}>{p.label} · worth ₹{p.price}</option>)}
          </select>
          <button className="primary" disabled={busy} onClick={() => act(() => A.giftPro(u, plan))}>Gift {PLANS[plan].label}</button>
        </div>
      </div>
      <div className="card stack">
        <h2>Remove Pro</h2>
        <p className="muted small">Payment records stay as your audit trail. Refund separately if money was taken.</p>
        <label className="row" style={{ flexDirection: "row", color: "var(--text)" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={both} onChange={(e) => setBoth(e.target.checked)} /> Also end the free trial and star reward
        </label>
        <div><button className="danger" disabled={busy || (!u.pro.hasPaid && !both)} onClick={() => window.confirm("Remove Pro for " + (u.name || u.email) + "?") && act(() => A.removePro(u, both))}>Remove Pro</button></div>
      </div>
    </>
  );
}

function PaymentsTab({ rel }) {
  if (!rel.payments.length) return <Empty title="No payments from this user" />;
  return rel.payments.map((p) => (
    <div key={p.id} className="item">
      <div className="row spread"><b>{PLANS[p.plan]?.label || p.plan} · {inr(p.amount)}</b><Badge tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}>{p.gift ? "gift" : p.status}</Badge></div>
      <span className="muted small">{p.id} · {fmtDay(ms(p.createdAt))}{p.utr ? " · UTR " + p.utr : ""}{p.method ? " · " + p.method : ""}</span>
      {p.note && <span className="small">{p.note}</span>}
    </div>
  ));
}

function HistoryTab({ rel }) {
  const items = [...rel.feedback.map((x) => ({ ...x, kind: "Feedback", t: ms(x.submittedAt) })), ...rel.contacts.map((x) => ({ ...x, kind: "Contact", t: ms(x.submittedAt) }))].sort((a, b) => b.t - a.t);
  if (!items.length) return <Empty title="No feedback or messages yet" />;
  return items.map((x) => (
    <div key={x.id} className="item">
      <div className="row spread"><b>{x.kind}{x.rating ? " · " + "★".repeat(x.rating) : ""}{x.topic ? " · " + x.topic : ""}</b><span className="faint small">{fmtTime(x.t)}</span></div>
      <span>{x.message || x.feedback || x.comment || "—"}</span>
    </div>
  ));
}

const TEMPLATES = {
  blank: ["", ""],
  thanks: ["Thank you for using Trakey", "Hi {name},\n\nThank you for using Trakey and for your support. If you have any question or idea, just reply to this email.\n\nTeam Trakey"],
  payment: ["Your Trakey Pro payment", "Hi {name},\n\nWe checked your payment. Please send us your UTR and a screenshot from your payment app so we can finish activating Pro.\n\nTeam Trakey"],
  pro: ["Trakey Pro is active", "Hi {name},\n\nYour Trakey Pro is now active. Open the app and pull to refresh if you do not see it yet.\n\nTeam Trakey"],
};
function MessageTab({ u }) {
  const A = useAdmin();
  const [mode, setMode] = useState("mail"); const [tpl, setTpl] = useState("blank");
  const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  const first = (u.name || "there").split(" ")[0];
  const pick = (k) => { setTpl(k); setSubject(TEMPLATES[k][0]); setBody(TEMPLATES[k][1].replace("{name}", first)); };
  const mailto = `mailto:${u.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(u.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const ready = subject.trim() && body.trim();
  return (
    <>
      <Seg value={mode} onChange={setMode} options={[["mail", "Email"], ["push", "Notification"]]} />
      {mode === "mail" && !u.email && <div className="notice">This user has no email on record.</div>}
      <Field label="Start from">
        <select value={tpl} onChange={(e) => pick(e.target.value)}>
          <option value="blank">Blank</option><option value="thanks">Thank you</option><option value="payment">Payment follow-up</option><option value="pro">Pro activated</option>
        </select>
      </Field>
      <Field label={mode === "mail" ? "Subject" : "Title"}><input value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Message"><textarea value={body} maxLength={mode === "push" ? 1000 : 5000} onChange={(e) => setBody(e.target.value)} rows={8} /></Field>
      {mode === "mail" ? (
        <div className="row">
          <a href={ready && u.email ? gmail : undefined} target="_blank" rel="noreferrer"><button className="primary" disabled={!ready || !u.email}>Open in Gmail</button></a>
          <a href={ready && u.email ? mailto : undefined}><button disabled={!ready || !u.email}>Use default mail app</button></a>
        </div>
      ) : (
        <div className="stack">
          <p className="muted small">Goes only to {u.name || "this user"}'s phone. They must have opened Trakey on a device with notifications on.</p>
          <div><button className="primary" disabled={!ready || busy} onClick={async () => { setBusy(true); await A.pushOne(u.uid, subject.trim(), body.trim()); setBusy(false); }}>Send notification</button></div>
        </div>
      )}
    </>
  );
}
