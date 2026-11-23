import { useMemo, useState } from "react";
import { Avatar, Badge, Card, Empty, Icon, PageHead, Segmented, Tabs, Notice } from "../lib/ui";
import { useStore } from "../lib/store";
import { fmtDateTime, timeAgo, tsMs } from "../lib/format";
import { CONTACT_STATUS, ContactDetail, FeedbackDetail, stars } from "../components/InboxParts";

export default function Inbox() {
  const { feedback, contacts, errors } = useStore();
  const [tab, setTab] = useState("contact");
  const [fbFilter, setFbFilter] = useState("new");
  const [ctFilter, setCtFilter] = useState("new");
  const [picked, setPicked] = useState({ contact: "", feedback: "" });

  const newFb = feedback.filter((f) => !f.handled).length;
  const newCt = contacts.filter((c) => (c.status || "new") === "new").length;

  const list = useMemo(() => {
    if (tab === "feedback") return feedback.filter((f) => fbFilter === "all" || (fbFilter === "handled" ? f.handled : !f.handled));
    return contacts.filter((c) => ctFilter === "all" || (c.status || "new") === ctFilter);
  }, [tab, feedback, contacts, fbFilter, ctFilter]);

  const selected = list.find((x) => x.id === picked[tab]) || list[0];

  return (
    <>
      <PageHead title="Inbox" subtitle="Support messages and reviews from the app, live." />
      {(errors.feedback || errors.contacts) && <div style={{ marginBottom: 16 }}><Notice tone="bad">{errors.feedback || errors.contacts}</Notice></div>}

      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "contact", label: "Support messages", icon: "chat", count: newCt },
        { value: "feedback", label: "Reviews & feedback", icon: "star", count: newFb },
      ]} />

      <div className="split">
        <Card pad={false}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
            {tab === "contact" ? (
              <Segmented value={ctFilter} onChange={setCtFilter} options={[
                { value: "new", label: "New", count: newCt },
                { value: "in_progress", label: "In progress" },
                { value: "resolved", label: "Resolved" },
                { value: "all", label: "All" },
              ]} />
            ) : (
              <Segmented value={fbFilter} onChange={setFbFilter} options={[
                { value: "new", label: "Needs attention", count: newFb },
                { value: "handled", label: "Handled" },
                { value: "all", label: "All" },
              ]} />
            )}
          </div>
          <div className="msg-list">
            {list.length === 0 && <Empty icon="inbox" title="Nothing here">Messages that match this filter appear here.</Empty>}
            {list.map((item) => {
              const when = tsMs(item.submittedAt);
              return (
                <button key={item.id} type="button" className={"msg-item" + (selected?.id === item.id ? " on" : "")} onClick={() => setPicked({ ...picked, [tab]: item.id })}>
                  <div className="mi-top">
                    <div className="row" style={{ gap: 10, flexWrap: "nowrap", minWidth: 0 }}>
                      <Avatar name={item.name} email={item.email} size={30} />
                      <b>{item.name || "Trakey User"}</b>
                    </div>
                    <time title={fmtDateTime(when)}>{timeAgo(when)}</time>
                  </div>
                  {tab === "feedback" ? <span className="stars" style={{ fontSize: 13 }}>{stars(item.rating)}</span> : <Badge tone={CONTACT_STATUS[item.status || "new"]?.[1]}>{item.topic || "Support"}</Badge>}
                  <p>{tab === "feedback" ? item.additionalFeedback || item.type || "Rating only" : item.message}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          {selected ? (tab === "feedback" ? <FeedbackDetail item={selected} /> : <ContactDetail item={selected} />) : <Empty icon="inbox" title="Pick a message" />}
        </Card>
      </div>
    </>
  );
}
