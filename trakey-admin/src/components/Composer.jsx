// Send a push notification or an email to one person, or to a group of selected people.
import { useMemo, useState } from "react";
import { Badge, Button, Field, Notice, Segmented, useBusy, useCopy, useUI } from "../lib/ui";
import { useStore } from "../lib/store";
import { firstName } from "../lib/format";
import { gmailLink, mailtoLink } from "../lib/mail";
import { leftover } from "../lib/templates";
import TemplatePicker from "./TemplatePicker";
import { go } from "../lib/router";

const TITLE_MAX = 100;
const BODY_MAX = 500;

function PushPreview({ title, message }) {
  const now = new Date();
  return (
    <div className="phone" aria-label="Notification preview">
      <div className="phone-time">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })}</div>
      <div className="phone-date">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</div>
      <div className="push">
        <img src={import.meta.env.BASE_URL + "trakey-logo.png"} alt="" />
        <div>
          <small>Trakey · now</small>
          <b>{title || "Notification title"}</b>
          <p>{message || "Your message appears here."}</p>
        </div>
      </div>
    </div>
  );
}

export default function Composer({ recipients, defaultMode = "push", onDone, compact = false }) {
  const { actions, isOwner } = useStore();
  const { toast } = useUI();
  const copy = useCopy();
  const [busy, run] = useBusy();
  const [mode, setMode] = useState(defaultMode);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [logIt, setLogIt] = useState(true);
  const [report, setReport] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [showTpl, setShowTpl] = useState(false);

  const single = recipients.length === 1 ? recipients[0] : null;
  const name = single ? firstName(single.name, single.email) : "there";
  const emails = useMemo(() => [...new Set(recipients.map((r) => r.email).filter(Boolean))], [recipients]);

  // Ready-made messages: push uses the notification set, email uses the reply set ({name} is filled in for you).
  const useTemplate = (x) => {
    if (mode === "push") { setTitle(x.t); setMessage(x.m); }
    else { setSubject(x.t); setBody(x.m); }
    setShowTpl(false);
  };

  const sendPush = () => {
    const t = title.trim();
    const m = message.trim();
    if (!t || !m) return toast("Write a title and a message first.", "bad");
    const left = leftover(t, m);
    if (left) return toast("Fill in " + left + " before sending.", "bad");
    const img = imageUrl.trim();
    if (img && !/^https:\/\//i.test(img)) return toast("The image link must start with https://", "bad");
    setReport(null);
    run("push", async () => {
      const res = await actions.sendUserPush(recipients.map((r) => r.uid), t, m, img);
      setReport(res);
      if (res.sent === 0) throw new Error("Nobody received it" + (res.results?.[0]?.reason ? ": " + res.results[0].reason : "."));
      if (res.sent > 0) {
        setTitle(""); setMessage("");
        onDone?.();
      }
      return res;
    }, (res) => "Notification sent to " + res.sent + (res.sent === 1 ? " person." : " people."));
  };

  const openMail = (kind) => {
    if (!subject.trim() && !body.trim()) return toast("Write a subject or a message first.", "bad");
    const left = leftover(subject, body);
    if (left) return toast("Fill in " + left + " before sending.", "bad");
    if (emails.length === 0) return toast("None of the selected people has an email address saved.", "bad");
    const fields = single
      ? { to: emails[0], subject, body }
      : { bcc: emails.join(","), subject, body };
    const link = kind === "gmail" ? gmailLink(fields) : mailtoLink(fields);
    if (link.length > 7000) {
      copy(emails.join(", "), "Too many people for a link. Their email addresses are copied, paste them into BCC.");
      return;
    }
    if (kind === "gmail") window.open(link, "_blank", "noopener"); else window.location.href = link;
    if (logIt && isOwner) {
      actions.logMessage(single
        ? { kind: "email", uid: single.uid, name: single.name || "", email: single.email || "", title: subject, message: body }
        : { kind: "email-bulk", recipients: emails.length, title: subject, message: body }
      ).catch(() => {});
    }
  };

  const noEmail = emails.length === 0;

  return (
    <div className="stack-sm">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Segmented value={mode} onChange={(v) => { setMode(v); setReport(null); }}
          options={[{ value: "push", label: "Push notification", icon: "bell" }, { value: "email", label: "Email", icon: "mail" }]} />
        {!single && <Badge tone="accent" icon="users">{recipients.length} selected</Badge>}
      </div>

      <div className="row">
        <Button size="sm" variant={showTpl ? "soft" : "default"} icon="file" onClick={() => setShowTpl((v) => !v)}>
          {showTpl ? "Hide ready-made messages" : mode === "push" ? "Ready-made notifications" : "Ready-made email answers"}
        </Button>
      </div>
      {showTpl && <TemplatePicker key={mode} kind={mode === "push" ? "push" : "reply"} defaults={{ name }} onUse={useTemplate} />}

      {mode === "push" ? (
        <div className={compact ? "stack-sm" : "cols-main"} style={compact ? undefined : { gridTemplateColumns: "minmax(0,1fr) minmax(260px, 320px)" }}>
          <div className="stack-sm">
            <Field label="Title">
              <input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Short and clear" />
            </Field>
            <Field label="Message">
              <textarea rows={5} value={message} maxLength={BODY_MAX} onChange={(e) => setMessage(e.target.value)} placeholder={single ? "Only " + name + " will see this on their phone." : "Each selected person gets this on their phone."} />
              <span className="counter">{message.length}/{BODY_MAX}</span>
            </Field>
            <Field label="Picture (optional)" hint="A link starting with https:// to an image shown in the notification.">
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </Field>
            <div className="row">
              <Button variant="primary" icon="send" disabled={busy === "push"} onClick={sendPush}>
                {busy === "push" ? "Sending…" : single ? "Send to " + name : "Send to " + recipients.length + " people"}
              </Button>
              <span className="small muted">Delivered through the Trakey app. The person needs to have opened the app on their phone at least once.</span>
            </div>
            {report && (
              <Notice tone={report.sent > 0 && report.failed === 0 ? "ok" : report.sent > 0 ? "warn" : "bad"}>
                <b>{report.sent} sent, {report.failed} not delivered.</b>
                {report.results?.filter((r) => !r.ok).slice(0, 6).map((r) => (
                  <div key={r.uid} className="small">{recipients.find((p) => p.uid === r.uid)?.name || r.uid}: {r.reason}</div>
                ))}
              </Notice>
            )}
          </div>
          {!compact && <PushPreview title={title} message={message} />}
        </div>
      ) : (
        <div className="stack-sm">
          {single ? (
            <Field label="To"><input value={single.email || ""} readOnly placeholder="No email saved for this person" /></Field>
          ) : (
            <Field label="Bcc" hint="Everyone is hidden from each other. We open your mail app with all addresses filled in.">
              <input value={emails.join(", ")} readOnly />
            </Field>
          )}
          <Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" /></Field>
          <Field label="Message"><textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder={"Hi " + name + ",\n\n"} /></Field>
          {noEmail && <Notice tone="warn">{single ? "This person has no email saved yet, so there is nobody to write to." : "None of the selected people has an email address saved."}</Notice>}
          <div className="row">
            <Button variant="primary" icon="mail" disabled={noEmail} onClick={() => openMail("gmail")}>Open in Gmail</Button>
            <Button icon="send" disabled={noEmail} onClick={() => openMail("mailto")}>Open in mail app</Button>
            <Button variant="quiet" icon="copy" disabled={noEmail} onClick={() => copy(emails.join(", "), emails.length > 1 ? "Email addresses copied." : "Email address copied.")}>Copy {emails.length > 1 ? "addresses" : "address"}</Button>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            {isOwner && (
              <label className="check"><input type="checkbox" checked={logIt} onChange={(e) => setLogIt(e.target.checked)} /> Keep a note of this email in message history</label>
            )}
            {single && <Button variant="quiet" size="sm" icon="user" onClick={() => go("users", single.uid)}>Open profile</Button>}
          </div>
          <p className="small muted">Emails are sent from your own mail account, so replies come straight to your inbox.</p>
        </div>
      )}
    </div>
  );
}

