import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CopyEmail, Empty, Icon, KeyValue, Loading, Notice, ProBadge, Tabs, useCopy, useUI } from "../lib/ui";
import { belongsTo, useStore } from "../lib/store";
import { daysLeft, fmtDateTime, fmtDay, money, plain, pretty, timeAgo, tsMs } from "../lib/format";
import { go, href } from "../lib/router";
import Composer from "../components/Composer";
import PaymentsList from "../components/PaymentsList";
import { ContactDetail, FeedbackDetail } from "../components/InboxParts";
import { GiftPlans, RemovePro } from "../components/ProControls";
import { downloadBlob } from "../paymentExport";

// Turns one Firestore value into short readable text for the Data tab.
const show = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v?.toMillis === "function") return fmtDateTime(v.toMillis()) + " IST";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number" && v > 1e12 && v < 5e12) return fmtDateTime(v) + " IST";
  if (typeof v === "object") { const s = JSON.stringify(plain(v)); return s.length > 140 ? s.slice(0, 140) + "…" : s; }
  return String(v);
};
const rowsOf = (obj, skip = []) =>
  Object.entries(obj || {}).filter(([k]) => !skip.includes(k)).map(([k, v]) => [pretty(k), show(v), typeof v === "string" && v.length > 24]);

export default function UserDetail({ uid }) {
  const { people, payments, feedback, contacts, messages, loaded, isOwner } = useStore();
  const copy = useCopy();
  const { toast } = useUI();
  const [tab, setTab] = useState("overview");
  const person = people.find((p) => p.uid === uid);

  const mine = useMemo(() => {
    if (!person) return { pay: [], fb: [], ct: [], msg: [] };
    return {
      pay: payments.filter((p) => belongsTo(p, person)),
      fb: feedback.filter((f) => belongsTo(f, person)),
      ct: contacts.filter((c) => belongsTo(c, person)),
      msg: messages.filter((m) => m.uid === person.uid),
    };
  }, [person, payments, feedback, contacts, messages]);

  const timeline = useMemo(() => {
    if (!person) return [];
    const ev = [];
    mine.pay.forEach((p) => ev.push({ at: tsMs(p.createdAt), icon: p.gift ? "gift" : "card", tone: p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn",
      title: (p.gift ? "Free gift · " : "Payment · ") + money(p.amount, p.currency) + " (" + (p.plan || "plan") + ")", text: "Status: " + (p.status || "pending") + (p.utr ? " · " + p.utr : "") }));
    mine.fb.forEach((f) => ev.push({ at: tsMs(f.submittedAt), icon: "star", tone: "accent", title: "Left a " + (f.rating || 0) + "★ review", text: f.additionalFeedback || f.type || "" }));
    mine.ct.forEach((c) => ev.push({ at: tsMs(c.submittedAt), icon: "chat", tone: "accent", title: "Contacted support · " + (c.topic || "Support"), text: c.message }));
    mine.msg.forEach((m) => ev.push({ at: tsMs(m.createdAt), icon: m.kind?.startsWith("email") ? "mail" : "bell", tone: "", title: "You sent a " + (m.kind?.startsWith("email") ? "email" : "notification") + (m.title ? " · " + m.title : ""), text: m.message || "" }));
    const raw = person.pro.raw;
    if (tsMs(raw.trialStartedAt) && person.pro.trialStart > Date.parse("2021-01-01")) ev.push({ at: tsMs(raw.trialStartedAt), icon: "gift", tone: "ok", title: "Started free trial", text: "30 days of Pro" });
    if (tsMs(raw.starRewardAt) && person.pro.rewardStart > Date.parse("2021-01-01")) ev.push({ at: tsMs(raw.starRewardAt), icon: "star", tone: "ok", title: "Earned the star reward", text: "30 extra days" });
    if (tsMs(raw.proRemovedAt)) ev.push({ at: tsMs(raw.proRemovedAt), icon: "trash", tone: "bad", title: "Pro removed", text: raw.proRemovedBy ? "By " + raw.proRemovedBy : "" });
    return ev.filter((e) => e.at).sort((a, b) => b.at - a.at);
  }, [person, mine]);

  if (!isOwner) return <Notice tone="warn">Only the owner can see user pages.</Notice>;
  if (!person) {
    return (
      <>
        <a className="back-link" href={href("users")}><Icon name="back" size={15} /> All users</a>
        {loaded.users ? <Card><Empty icon="user" title="User not found">There is no one with account ID {uid}. They may have deleted their data.</Empty></Card> : <Loading text="Loading user…" />}
      </>
    );
  }

  const pro = person.pro;
  const paidTotal = mine.pay.filter((p) => p.status === "approved" && !p.gift && (p.currency || "INR").toUpperCase() === "INR").reduce((t, p) => t + (Number(p.amount) || 0), 0);
  const pendingPay = mine.pay.filter((p) => (p.status || "pending") === "pending").length;
  const openFb = mine.fb.filter((f) => !f.handled).length + mine.ct.filter((c) => (c.status || "new") === "new").length;
  const expiringIn = pro.hasAccess && pro.key !== "lifetime" && pro.endMs ? daysLeft(pro.endMs) : null;

  const download = () => {
    const payload = plain({ user: { ...person, pro: undefined, backup: undefined }, proStatus: pro.raw, backupInfo: person.backup, payments: mine.pay, feedback: mine.fb, contactMessages: mine.ct, messagesSent: mine.msg });
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "trakey-user-" + person.uid + ".json");
    toast("Download started.");
  };

  return (
    <>
      <a className="back-link" href={href("users")}><Icon name="back" size={15} /> All users</a>

      <div className="detail">
        <aside className="detail-side">
          <Card>
            <div className="profile-hero">
              <Avatar name={person.name} email={person.email} size={76} online={person.online} />
              <h2>{person.name || "Trakey User"}</h2>
              <p>{person.email || (person.notIndexed ? "Signed in · profile not synced yet" : "No email saved")}</p>
              {person.email && <CopyEmail email={person.email} label="Copy email address" />}
              <div className="ucard-badges">
                <ProBadge pro={pro} />
                <Badge tone={person.online ? "ok" : "muted"} dot>{person.online ? "Online" : "Offline"}</Badge>
              </div>
            </div>
            <div className="quick-actions">
              <Button variant="primary" icon="bell" onClick={() => setTab("messages")}>Notify</Button>
              <Button icon="mail" onClick={() => setTab("messages")} disabled={!person.email}>Email</Button>
              <Button className="wide" variant="soft" icon="gift" onClick={() => setTab("pro")}>Gift or manage Pro</Button>
            </div>
          </Card>

          <Card title="Details">
            <KeyValue rows={[
              ["Last active", person.online ? "Right now" : person.lastSeenMs ? timeAgo(person.lastSeenMs) : "—"],
              ["Last seen at", person.lastSeenMs ? fmtDateTime(person.lastSeenMs) + " IST" : ""],
              person.location && ["Location", person.location + (person.locationSource === "payment" ? " (from payment)" : "")],
              person.email && ["Email", <span key="em" className="row" style={{ justifyContent: "flex-end", gap: 2 }}><span style={{ wordBreak: "break-all" }}>{person.email}</span><CopyEmail email={person.email} compact /></span>],
              person.createdMs && ["First signed in", fmtDay(person.createdMs)],
              ["Pro until", pro.key === "lifetime" ? "Forever" : pro.endMs ? fmtDay(pro.endMs) : "—"],
              ["Account ID", <button key="uid" type="button" className="btn btn-quiet btn-sm mono" onClick={() => copy(person.uid, "Account ID copied")}>{person.uid.slice(0, 10)}… <Icon name="copy" size={13} /></button>],
            ]} />
          </Card>
        </aside>

        <div>
          <div className="mini-stats" style={{ marginBottom: 18 }}>
            <div className="mini-stat"><b>{money(paidTotal)}</b><span>Paid so far</span></div>
            <div className="mini-stat"><b>{mine.fb.length + mine.ct.length}</b><span>Messages from them</span></div>
            <div className="mini-stat"><b>{mine.msg.length}</b><span>Sent by you</span></div>
          </div>

          <Tabs value={tab} onChange={setTab} tabs={[
            { value: "overview", label: "Overview", icon: "clock" },
            { value: "pro", label: "Pro & payments", icon: "crown", count: pendingPay },
            { value: "messages", label: "Send message", icon: "send" },
            { value: "support", label: "Reviews & support", icon: "chat", count: openFb },
            { value: "data", label: "All data", icon: "database" },
          ]} />

          {tab === "overview" && (
            <div className="stack">
              {expiringIn !== null && expiringIn <= 7 && (
                <Notice tone="warn"><b>{person.name || "This person"}'s Pro ends {expiringIn <= 0 ? "today" : "in " + expiringIn + (expiringIn === 1 ? " day" : " days")}.</b>{" "}
                  <a href="#send" onClick={(e) => { e.preventDefault(); setTab("messages"); }}>Send a reminder</a>.</Notice>
              )}
              {pendingPay > 0 && <Notice tone="warn"><b>{pendingPay} payment{pendingPay > 1 ? "s" : ""} waiting.</b> <a href="#pay" onClick={(e) => { e.preventDefault(); setTab("pro"); }}>Review now</a>.</Notice>}
              <Card title="Activity" subtitle="Everything we know about this person, newest first.">
                {timeline.length === 0 ? <Empty icon="clock" title="No activity yet" /> : (
                  <div className="timeline">
                    {timeline.slice(0, 40).map((e, i) => (
                      <div className="tl-item" key={i}>
                        <span className={"tl-ic " + e.tone}><Icon name={e.icon} size={16} /></span>
                        <div><b>{e.title}</b>{e.text && <p>{String(e.text).slice(0, 180)}</p>}</div>
                        <time>{fmtDateTime(e.at)}</time>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "pro" && (
            <div className="stack">
              <Card title="Trakey Pro">
                <div className="pro-box">
                  <span className={"pro-tile" + (pro.hasAccess ? "" : " off")}><Icon name="crown" size={22} /></span>
                  <div>
                    <b>{pro.label}</b>
                    <span>{pro.key === "lifetime" ? "Has Pro forever." : pro.endMs ? (pro.hasAccess ? "Ends " : "Ended ") + fmtDay(pro.endMs) + (pro.hasAccess ? " (" + daysLeft(pro.endMs) + " days left)" : "") : "No Pro, no trial."}
                      {pro.raw.paidVia ? " · via " + pro.raw.paidVia : ""}</span>
                  </div>
                </div>
              </Card>
              <Card title="Gift Pro" subtitle="Added after any Pro time they already have. Recorded as a free gift.">
                <GiftPlans person={person} />
              </Card>
              <RemovePro person={person} />
              <div>
                <h3 className="sec-title" style={{ marginTop: 6 }}>Payments ({mine.pay.length})</h3>
                <PaymentsList items={mine.pay} showUser={false} emptyTitle="No payments from this person" />
              </div>
            </div>
          )}

          {tab === "messages" && (
            <div className="stack">
              <Card title={"Message " + (person.name || "this person")} subtitle="Send a push notification to their phone, or write an email.">
                <Composer recipients={[person]} />
              </Card>
              <Card title="Sent to this person" pad={false}>
                {mine.msg.length === 0 ? <Empty icon="send" title="Nothing sent yet" /> : (
                  <div className="list" style={{ marginTop: 14 }}>
                    {mine.msg.map((m) => (
                      <div className="list-row" key={m.id} style={{ alignItems: "flex-start" }}>
                        <span className="tl-ic"><Icon name={m.kind?.startsWith("email") ? "mail" : "bell"} size={16} /></span>
                        <div className="list-main"><b style={{ whiteSpace: "normal" }}>{m.title || "(no title)"}</b><span style={{ whiteSpace: "pre-wrap" }}>{m.message}</span></div>
                        <div className="list-end"><Badge tone="muted">{m.kind?.startsWith("email") ? "Email" : "Push"}</Badge><span>{fmtDateTime(tsMs(m.createdAt))}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "support" && (
            <div className="stack">
              {mine.fb.length + mine.ct.length === 0 && <Card><Empty icon="chat" title="Nothing from this person">Their reviews and support messages show up here.</Empty></Card>}
              {mine.ct.map((c) => <Card key={c.id}><ContactDetail item={c} showUser={false} /></Card>)}
              {mine.fb.map((f) => <Card key={f.id}><FeedbackDetail item={f} showUser={false} /></Card>)}
            </div>
          )}

          {tab === "data" && (
            <div className="stack">
              <div className="row">
                <Button icon="download" onClick={download}>Download this person's data (JSON)</Button>
                <Button variant="quiet" icon="copy" onClick={() => copy(person.uid, "Account ID copied")}>Copy account ID</Button>
              </div>
              <div className="cols-2">
                <Card title="Profile" subtitle={"users/" + person.uid}>
                  <KeyValue rows={[["Account ID", person.uid, true], ...rowsOf(person, ["id", "uid", "pro", "backup", "lastSeenMs", "online", "hasProDoc", "notIndexed"])]} />
                </Card>
                <Card title="Pro record" subtitle={"proStatus/" + person.uid}>
                  {Object.keys(pro.raw).length ? <KeyValue rows={rowsOf(pro.raw, ["id"])} /> : <p className="muted">No Pro record yet.</p>}
                </Card>
              </div>
              <Card title="Cloud backup info" subtitle={"users/" + person.uid + "/backup/main"}>
                {person.backup ? <KeyValue rows={rowsOf(person.backup)} /> : <p className="muted">This person has not backed up yet.</p>}
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
