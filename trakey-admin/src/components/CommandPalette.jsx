// Ctrl/Cmd + K: jump to any person or page.
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Icon } from "../lib/ui";
import { useStore } from "../lib/store";
import { go } from "../lib/router";

export default function CommandPalette({ pages, onClose }) {
  const { people, isOwner } = useStore();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pageHits = pages.filter((p) => !s || p.label.toLowerCase().includes(s)).map((p) => ({ type: "page", key: "p-" + p.key, ...p }));
    let peopleHits = [];
    if (isOwner && s.length >= 1) {
      peopleHits = people
        .filter((u) => [u.name, u.email, u.uid].some((v) => String(v || "").toLowerCase().includes(s)))
        .slice(0, 8)
        .map((u) => ({ type: "person", key: "u-" + u.uid, person: u }));
    }
    return [...peopleHits, ...pageHits];
  }, [q, people, pages, isOwner]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector(".on")?.scrollIntoView({ block: "nearest" }); }, [idx]);

  const choose = (r) => {
    if (!r) return;
    if (r.type === "person") go("users", r.person.uid); else go(r.key.slice(2));
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[idx]); }
    else if (e.key === "Escape") onClose();
  };

  let lastGroup = "";
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-in">
          <Icon name="search" size={19} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder={isOwner ? "Search people by name, email or ID, or jump to a page…" : "Jump to a page…"} />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <p className="muted" style={{ padding: "22px 14px" }}>Nothing found.</p>}
          {results.map((r, i) => {
            const group = r.type === "person" ? "People" : "Pages";
            const head = group !== lastGroup ? <div className="palette-group">{group}</div> : null;
            lastGroup = group;
            return (
              <div key={r.key}>
                {head}
                <button type="button" className={"palette-item" + (i === idx ? " on" : "")} onMouseEnter={() => setIdx(i)} onClick={() => choose(r)}>
                  {r.type === "person" ? <Avatar name={r.person.name} email={r.person.email} size={34} /> : <span className="tl-ic accent"><Icon name={r.icon} size={17} /></span>}
                  <span>
                    <b>{r.type === "person" ? r.person.name || "Trakey User" : r.label}</b>
                    <small>{r.type === "person" ? r.person.email || r.person.uid : r.hint}</small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span></div>
      </div>
    </div>
  );
}
