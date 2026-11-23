import { useMemo, useState } from "react";
import { Badge, Card, Empty, Icon, Loading, PageHead, Segmented } from "../lib/ui";
import { useStore } from "../lib/store";
import { useCollection } from "../lib/useCollection";
import { fmtDateTime, tsMs } from "../lib/format";

const ICON = { Announcement: "megaphone", Notification: "bell", Update: "rocket", Email: "mail", "Push to user": "bell" };

export default function History() {
  const { messages, isOwner } = useStore();
  const [cat, setCat] = useState("all");
  const anns = useCollection("adminAnnouncements", ["createdAt"]);
  const notes = useCollection("adminNotifications", ["createdAt"]);
  const ups = useCollection("appUpdates", ["createdAt"]);

  const all = useMemo(() => [
    ...anns.items.map((d) => ({ id: "a" + d.id, cat: "Announcement", title: d.title, text: d.message, at: tsMs(d.createdAt) })),
    ...notes.items.map((d) => ({ id: "n" + d.id, cat: "Notification", title: d.title, text: d.message, at: tsMs(d.createdAt) })),
    ...ups.items.map((d) => ({ id: "u" + d.id, cat: "Update", title: d.title || "Version " + (d.version || ""), text: d.description, at: tsMs(d.createdAt), extra: d.version && "v" + d.version })),
    ...(isOwner ? messages.map((m) => ({
      id: "m" + m.id, cat: m.kind?.startsWith("email") ? "Email" : "Push to user", title: m.title, text: m.message, at: tsMs(m.createdAt),
      extra: m.name || m.email || (m.recipients ? m.recipients + " people" : ""),
    })) : []),
  ].sort((a, b) => b.at - a.at), [anns.items, notes.items, ups.items, messages, isOwner]);

  const cats = ["all", "Announcement", "Notification", "Update", ...(isOwner ? ["Email", "Push to user"] : [])];
  const shown = all.filter((x) => cat === "all" || x.cat === cat);
  const loading = anns.loading || notes.loading || ups.loading;

  return (
    <>
      <PageHead title="Message history" subtitle="Everything published or sent from Trakey Admin, in one place." />
      <div className="toolbar"><Segmented value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: c === "all" ? "All" : c }))} /></div>
      <Card pad={false}>
        {loading ? <Loading /> : shown.length === 0 ? <Empty icon="clock" title="No history yet" /> : (
          <div className="list">
            {shown.map((x) => (
              <div className="list-row" key={x.id} style={{ alignItems: "flex-start" }}>
                <span className="tl-ic accent"><Icon name={ICON[x.cat]} size={16} /></span>
                <div className="list-main"><b style={{ whiteSpace: "normal" }}>{x.title || "(no title)"}</b><span style={{ whiteSpace: "pre-wrap" }}>{x.text}</span></div>
                <div className="list-end"><Badge tone="muted">{x.cat}</Badge><span>{[x.extra, fmtDateTime(x.at)].filter(Boolean).join(" · ")}</span></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
