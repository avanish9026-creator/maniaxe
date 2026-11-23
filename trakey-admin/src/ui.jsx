import { useEffect } from "react";
import { initials } from "./lib/util";

const P = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  users: "M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1a4 4 0 00-3-3.9M16 4.1a3.5 3.5 0 010 6.8",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z",
  money: "M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  phone: "M7 2h10a1 1 0 011 1v18a1 1 0 01-1 1H7a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5",
  db: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  team: "M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  x: "M18 6L6 18M6 6l12 12",
  menu: "M3 6h18M3 12h18M3 18h18",
  out: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  mail: "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  gate: "M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5zM9 12l2 2 4-4",
};
export const Icon = ({ n }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={P[n]} /></svg>
);

export function Avatar({ u, size = "" }) {
  const photo = u.photoURL || u.photoUrl || u.avatarUrl;
  return (
    <span className={"avatar " + size}>
      {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : initials(u.name || u.email)}
    </span>
  );
}
export const Badge = ({ tone = "", children }) => <span className={"badge " + tone}>{children}</span>;

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([k, label, n]) => (
        <button key={k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {label}{n !== undefined && <span className="n">{n}</span>}
        </button>
      ))}
    </div>
  );
}

export const Empty = ({ title, hint }) => <div className="empty"><b>{title}</b>{hint && <span>{hint}</span>}</div>;
export const Stat = ({ label, value, hint, onClick }) => (
  <div className={"card stat" + (onClick ? " link" : "")} onClick={onClick}>
    <span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}
  </div>
);

export function Drawer({ onClose, head, children }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">{head}</div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}
export const Field = ({ label, children }) => <label>{label}{children}</label>;
export const KV = ({ rows }) => (
  <dl className="kv">{rows.filter(Boolean).map(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + "v"}>{v || "—"}</dd>])}</dl>
);
export const copy = async (text, notify) => {
  try { await navigator.clipboard.writeText(text); notify("Copied."); } catch { notify("Copy failed.", "bad"); }
};
