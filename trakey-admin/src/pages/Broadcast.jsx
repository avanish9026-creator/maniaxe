import { useMemo, useState } from "react";
import { Badge, Button, Card, Empty, Field, Icon, IconButton, Loading, Notice, PageHead, Segmented, useBusy, useUI } from "../lib/ui";
import { useStore } from "../lib/store";
import { useCollection } from "../lib/useCollection";
import { fmtDateTime, tsMs } from "../lib/format";
import { leftover } from "../lib/templates";
import TemplatePicker from "../components/TemplatePicker";

const TYPES = ["General", "Update", "Feature", "Maintenance", "Important"];
const TYPE_TONE = { General: "muted", Update: "accent", Feature: "ok", Maintenance: "warn", Important: "bad" };

function PushPreview({ title, message }) {
  const now = new Date();
  return (
    <div className="phone">
      <div className="phone-time">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })}</div>
      <div className="phone-date">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</div>
      <div className="push">
        <img src={import.meta.env.BASE_URL + "trakey-logo.png"} alt="" />
        <div><small>Trakey · now</small><b>{title || "Notification title"}</b><p>{message || "Your message appears here."}</p></div>
      </div>
    </div>
  );
}

export default function Broadcast() {
  const { actions } = useStore();
  const { confirm } = useUI();
  const [busy, run] = useBusy();
  const [kind, setKind] = useState("push");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("General");
  const [actionText, setActionText] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showTpl, setShowTpl] = useState(false);
  const [error, setError] = useState("");

  const notes = useCollection("adminNotifications", ["createdAt"]);
  const anns = useCollection("adminAnnouncements", ["createdAt"]);

  const sent = useMemo(() => [
    ...notes.items.map((n) => ({ ...n, _kind: "push", _at: tsMs(n.createdAt) })),
    ...anns.items.map((a) => ({ ...a, _kind: "announcement", _at: tsMs(a.createdAt) })),
  ].sort((a, b) => b._at - a._at), [notes.items, anns.items]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const t = title.trim();
    const m = message.trim();
    if (!t || !m) return setError("Title and message are required.");
    const left = leftover(t, m, actionText);
    if (left) return setError("Fill in " + left + " before sending.");
    if (kind === "push" && imageUrl.trim() && !/^https:\/\//i.test(imageUrl.trim())) return setError("The picture link must start with https://");
    if (kind === "announcement" && actionText.trim() && !actionUrl.trim()) return setError("Enter an action URL when an action button is provided.");
    if (kind === "announcement" && actionUrl.trim() && !/^https?:\/\//i.test(actionUrl.trim())) return setError("The action URL must start with http:// or https://");

    const ok = await confirm({
      title: kind === "push" ? "Send to every Trakey user?" : "Publish this announcement?",
      body: kind === "push" ? "Everyone with the app gets this push notification on their phone right away. It cannot be taken back." : "It appears inside the app for all users.",
      confirmLabel: kind === "push" ? "Send to everyone" : "Publish",
    });
    if (!ok) return;

    const done = await run("send", async () => {
      if (kind === "push") await actions.sendBroadcast(t, m, imageUrl.trim());
      else await actions.publishAnnouncement({ title: t, message: m, type, actionText: actionText.trim(), actionUrl: actionUrl.trim() });
      return true;
    }, kind === "push" ? "Notification sent to everyone." : "Announcement published.");
    if (done) { setTitle(""); setMessage(""); setActionText(""); setActionUrl(""); setImageUrl(""); }
  };

  const remove = async (item) => {
    const ok = await confirm({ title: "Delete this " + (item._kind === "push" ? "notification record" : "announcement") + "?",
      body: item._kind === "push" ? "This only removes it from the history. Phones that already received it keep it." : "It disappears from the app for everyone.", confirmLabel: "Delete", danger: true });
    if (ok) run("del" + item.id, () => (item._kind === "push" ? actions.deleteNotification(item.id) : actions.deleteAnnouncement(item.id)), "Deleted.");
  };

  return (
    <>
      <PageHead title="Broadcast" subtitle="Message every Trakey user at once. To message one person, open them from Users." />

      <div className="cols-main">
        <Card>
          <form className="stack-sm" onSubmit={submit}>
            <Segmented value={kind} onChange={setKind} options={[
              { value: "push", label: "Push notification", icon: "bell" },
              { value: "announcement", label: "In-app announcement", icon: "megaphone" },
            ]} />
            <p className="small muted">{kind === "push" ? "Shows on every phone, even when the app is closed." : "Shows inside the app, with an optional button."}</p>
            <div className="row">
              <Button size="sm" variant={showTpl ? "soft" : "default"} icon="file" onClick={() => setShowTpl((v) => !v)}>{showTpl ? "Hide ready-made messages" : "Ready-made messages"}</Button>
            </div>
            {showTpl && <TemplatePicker key={kind} kind={kind === "push" ? "push" : "announce"} onUse={(x) => {
              setTitle(x.t); setMessage(x.m);
              if (kind === "announcement") { if (x.type) setType(x.type); setActionText(x.btn || ""); setActionUrl(x.btn ? x.link : ""); }
              setShowTpl(false);
            }} />}
            <Field label="Title"><input value={title} maxLength={kind === "push" ? 100 : 120} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "push" ? "Example: Trakey 5.2 is here" : "Announcement title"} /></Field>
            <Field label="Message">
              <textarea rows={kind === "push" ? 5 : 7} value={message} maxLength={kind === "push" ? 500 : 2000} onChange={(e) => setMessage(e.target.value)} placeholder="Write the message" />
              <span className="counter">{message.length}/{kind === "push" ? 500 : 2000}</span>
            </Field>
            {kind === "push" && (
              <Field label="Picture (optional)" hint="A link starting with https:// to an image shown in the notification."><input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /></Field>
            )}
            {kind === "announcement" && (
              <div className="form-grid">
                <Field label="Type"><select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                <Field label="Button text (optional)"><input value={actionText} maxLength={60} onChange={(e) => setActionText(e.target.value)} placeholder="Example: View update" /></Field>
                <Field label="Button link (optional)" className="full"><input type="url" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="https://…" /></Field>
              </div>
            )}
            {error && <Notice tone="bad">{error}</Notice>}
            <div><Button type="submit" variant="primary" size="lg" icon="send" disabled={busy === "send"}>{busy === "send" ? "Sending…" : kind === "push" ? "Send to everyone" : "Publish announcement"}</Button></div>
          </form>
        </Card>

        <div className="stack">
          <h3 className="sec-title" style={{ margin: "0 0 -6px" }}>Preview</h3>
          {kind === "push" ? <PushPreview title={title} message={message} /> : (
            <Card>
              <div className="row" style={{ marginBottom: 8 }}><Badge tone={TYPE_TONE[type]}>{type}</Badge></div>
              <h3 style={{ fontSize: 17, overflowWrap: "anywhere" }}>{title || "Announcement title"}</h3>
              <p className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message || "Your message appears here."}</p>
              {actionText.trim() && <div style={{ marginTop: 14 }}><Button variant="primary" size="sm">{actionText.trim()}</Button></div>}
            </Card>
          )}
        </div>
      </div>

      <h3 className="sec-title">Recently sent</h3>
      <Card pad={false}>
        {notes.loading || anns.loading ? <Loading /> : sent.length === 0 ? <Empty icon="send" title="Nothing sent yet" /> : (
          <div className="list">
            {sent.map((item) => (
              <div className="list-row" key={item._kind + item.id} style={{ alignItems: "flex-start" }}>
                <span className="tl-ic accent"><Icon name={item._kind === "push" ? "bell" : "megaphone"} size={16} /></span>
                <div className="list-main">
                  <b style={{ whiteSpace: "normal" }}>{item.title}</b>
                  <span style={{ whiteSpace: "pre-wrap" }}>{item.message}</span>
                </div>
                <div className="list-end"><Badge tone={item._kind === "push" ? "accent" : TYPE_TONE[item.type] || "muted"}>{item._kind === "push" ? "Push" : item.type || "Announcement"}</Badge><span>{fmtDateTime(item._at)}</span></div>
                <IconButton icon="trash" label="Delete" disabled={busy === "del" + item.id} onClick={() => remove(item)} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
