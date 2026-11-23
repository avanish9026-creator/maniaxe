// Feedback and contact messages: the content and the actions, shared by the Inbox page and each user's page.
import { Badge, Button, CopyEmail, KeyValue, useBusy } from "../lib/ui";
import { TEMPLATES, fillTemplate } from "../lib/templates";
import { useStore } from "../lib/store";
import { fmtDateTime, tsMs } from "../lib/format";
import { gmailLink } from "../lib/mail";
import { href } from "../lib/router";

export const CONTACT_STATUS = { new: ["New", "warn"], in_progress: ["In progress", "accent"], resolved: ["Resolved", "ok"] };
export const stars = (n) => "★".repeat(Math.max(0, Math.min(5, n || 0))) + "☆".repeat(5 - Math.max(0, Math.min(5, n || 0)));

function ReplyButton({ to, subject, body, name }) {
  if (!to) return null;
  const first = String(name || "").trim().split(/\s+/)[0] || "there";
  const all = TEMPLATES.reply.flatMap((g) => g.items);
  const open = (i) => {
    if (i === "") return;
    const text = fillTemplate(all[Number(i)], { name: first }).m;
    window.open(gmailLink({ to, subject, body: text }), "_blank", "noopener");
  };
  let n = -1;
  return (
    <>
      <Button size="sm" icon="mail" onClick={() => window.open(gmailLink({ to, subject, body }), "_blank", "noopener")}>Reply by email</Button>
      <select className="quick-reply" value="" aria-label="Quick reply" onChange={(e) => open(e.target.value)}>
        <option value="">Quick reply (17 ready answers)…</option>
        {TEMPLATES.reply.map((g) => (
          <optgroup key={g.name} label={g.name}>
            {g.items.map((it) => { n += 1; return <option key={n} value={n}>{it.t}</option>; })}
          </optgroup>
        ))}
      </select>
      <CopyEmail email={to} />
    </>
  );
}

export function FeedbackDetail({ item, showUser = true }) {
  const { actions, isOwner } = useStore();
  const [busy, run] = useBusy();
  return (
    <div className="stack-sm">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3 style={{ fontSize: 17 }}>{item.name || "Trakey User"}</h3>
          <p className="muted small">{item.email || "No email"} · {item.type || "Rating"}</p>
        </div>
        <span className="stars" title={(item.rating || 0) + " out of 5"}>{stars(item.rating)}</span>
      </div>
      <p className="small muted">{fmtDateTime(tsMs(item.submittedAt))} IST · app v{item.appVersion || "—"}</p>
      {item.additionalFeedback && <div className="msg-body">{item.additionalFeedback}</div>}
      {item.answers && Object.keys(item.answers).length > 0 && (
        <div>
          <p className="field-label" style={{ marginBottom: 6 }}>Survey answers</p>
          <KeyValue rows={Object.entries(item.answers).map(([k, v]) => [k, String(v)])} />
        </div>
      )}
      <div className="row">
        <Button size="sm" variant={item.handled ? "default" : "ok"} icon={item.handled ? "refresh" : "check"} disabled={busy === "h"}
          onClick={() => run("h", () => actions.setFeedbackHandled(item.id, !item.handled), item.handled ? "Marked as new." : "Marked as handled.")}>
          {item.handled ? "Mark as new" : "Mark handled"}
        </Button>
        <ReplyButton name={item.name} to={item.email} subject="Thanks for your Trakey feedback" body={"Hi " + ((item.name || "").split(" ")[0] || "there") + ",\n\nThank you for your feedback.\n\n"} />
        {showUser && isOwner && item.uid && <Button size="sm" variant="quiet" icon="user" onClick={() => (window.location.hash = href("users", item.uid))}>Open user</Button>}
      </div>
    </div>
  );
}

export function ContactDetail({ item, showUser = true }) {
  const { actions, isOwner } = useStore();
  const [busy, run] = useBusy();
  const status = item.status || "new";
  return (
    <div className="stack-sm">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3 style={{ fontSize: 17 }}>{item.topic || "Support"}</h3>
          <p className="muted small">{item.name || "Trakey User"} · {item.email || "No email"}</p>
        </div>
        <Badge tone={CONTACT_STATUS[status]?.[1] || "muted"} dot>{CONTACT_STATUS[status]?.[0] || status}</Badge>
      </div>
      <p className="small muted">{fmtDateTime(tsMs(item.submittedAt))} IST · app v{item.appVersion || "—"}</p>
      <div className="msg-body">{item.message}</div>
      <div className="row">
        {Object.entries(CONTACT_STATUS).map(([key, [label]]) => (
          <Button key={key} size="sm" variant={status === key ? "soft" : "default"} disabled={busy === key || status === key}
            onClick={() => run(key, () => actions.setContactStatus(item.id, key), "Marked as " + label.toLowerCase() + ".")}>{label}</Button>
        ))}
      </div>
      <div className="row">
        <ReplyButton name={item.name} to={item.email} subject={"Re: " + (item.topic || "Your message to Trakey")}
          body={"Hi " + ((item.name || "").split(" ")[0] || "there") + ",\n\nThanks for contacting Trakey.\n\n"} />
        {showUser && isOwner && item.uid && <Button size="sm" variant="quiet" icon="user" onClick={() => (window.location.hash = href("users", item.uid))}>Open user</Button>}
      </div>
    </div>
  );
}
