import { useState } from "react";
import { useAdmin } from "../store";
import { Badge, Empty, Seg } from "../ui";
import { fmtTime, ms } from "../lib/util";

export default function Inbox({ go }) {
  const A = useAdmin();
  const [tab, setTab] = useState("contact"); const [f, setF] = useState("open");
  const isContact = tab === "contact";
  const all = isContact ? A.contacts : A.feedback;
  const done = (x) => (isContact ? (x.status || "new") === "done" : !!x.handled);
  const list = all.filter((x) => f === "all" || (f === "open" ? !done(x) : done(x)));
  const toggle = (x) => (isContact ? A.setContactStatus(x.id, done(x) ? "new" : "done") : A.setFeedbackHandled(x.id, !done(x)));
  const userOf = (x) => A.people.find((u) => (x.uid && u.uid === x.uid) || (x.email && u.email?.toLowerCase() === x.email.toLowerCase()));
  return (
    <>
      <div className="row spread">
        <Seg value={tab} onChange={setTab} options={[["contact", "Contact messages", A.contacts.filter((x) => !done0(x)).length], ["feedback", "Feedback", A.feedback.filter((x) => !x.handled).length]]} />
        <Seg value={f} onChange={setF} options={[["open", "Open"], ["done", "Handled"], ["all", "All"]]} />
      </div>
      {list.length === 0 ? <div className="card"><Empty title="Nothing here" hint="New messages show up live." /></div> : (
        <div className="grid cols-2">
          {list.map((x) => {
            const u = userOf(x);
            return (
              <article key={x.id} className="card stack">
                <div className="row spread">
                  <div><b>{x.name || "Anonymous"}</b> <span className="muted small">{x.email}</span></div>
                  <span className="faint small">{fmtTime(ms(x.submittedAt))}</span>
                </div>
                <div className="row">
                  {isContact ? <Badge>{x.topic || "General"}</Badge> : <Badge tone="gold">{"★".repeat(x.rating || 0) || "No rating"}</Badge>}
                  {x.appVersion && <Badge>v{x.appVersion}</Badge>}{x.device && <Badge>{x.device}</Badge>}
                  <Badge tone={done(x) ? "ok" : "warn"}>{done(x) ? "Handled" : "Open"}</Badge>
                </div>
                <p style={{ whiteSpace: "pre-wrap" }}>{x.message || x.feedback || x.comment || "—"}</p>
                <div className="row">
                  <button className="sm" onClick={() => toggle(x)}>{done(x) ? "Reopen" : "Mark handled"}</button>
                  {x.email && <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(x.email)}&su=${encodeURIComponent("Re: Trakey " + (x.topic || "feedback"))}`} target="_blank" rel="noreferrer"><button className="sm">Reply by email</button></a>}
                  {u && A.isOwner && <button className="sm quiet" onClick={() => go("users", u.uid)}>Open user</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
const done0 = (x) => (x.status || "new") === "done";
