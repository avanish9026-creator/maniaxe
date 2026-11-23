import { Avatar, CopyEmail, Icon, IconButton, ProBadge, Badge } from "../lib/ui";
import { fmtDay, timeAgo } from "../lib/format";
import { href } from "../lib/router";

export default function UserCard({ person, selecting, selected, onToggle, onNotify, onEmail, onGift }) {
  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn?.(person); };
  const p = person.pro;
  const Tag = selecting ? "button" : "a";
  const props = selecting
    ? { type: "button", onClick: () => onToggle(person.uid) }
    : { href: href("users", person.uid) };
  return (
    <Tag className={"ucard" + (selected ? " selected" : "")} {...props}>
      {selecting && <span className="ucard-check">{selected && <Icon name="check" size={14} stroke={3} />}</span>}
      <div className="ucard-top">
        <Avatar name={person.name} email={person.email} size={44} online={person.online} />
        <div className="ucard-id">
          <h4>{person.name || "Trakey User"}</h4>
          <p>{person.email || (person.notIndexed ? "Signed in · profile not synced yet" : "No email")}</p>
        </div>
      </div>
      <div className="ucard-badges">
        <ProBadge pro={p} />
        {person.online ? <Badge tone="ok" dot>Online</Badge> : null}
        {p.endMs > 0 && p.key !== "lifetime" && <Badge tone="muted">{p.hasAccess ? "Until " : "Ended "}{fmtDay(p.endMs)}</Badge>}
      </div>
      <div className="ucard-foot">
        <small><Icon name="clock" size={13} /> {person.online ? "Active now" : "Seen " + timeAgo(person.lastSeenMs)}{person.location ? " · " + person.location : ""}</small>
        {!selecting && (
          <div className="ucard-actions">
            <CopyEmail email={person.email} label="Copy email address" compact />
            <IconButton icon="bell" label="Send notification" size={16} onClick={stop(onNotify)} />
            <IconButton icon="mail" label="Send email" size={16} onClick={stop(onEmail)} />
            <IconButton icon="gift" label="Gift Pro" size={16} onClick={stop(onGift)} />
          </div>
        )}
      </div>
    </Tag>
  );
}
