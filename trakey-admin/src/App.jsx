import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "./store";
import { Icon } from "./ui";
import Overview from "./pages/Overview";
import Users from "./pages/Users";
import Payments from "./pages/Payments";
import Inbox from "./pages/Inbox";
import Broadcast from "./pages/Broadcast";
import Legal from "./pages/Legal";
import DataExplorer from "./panels/DataExplorer";
import TeamPanel from "./panels/TeamPanel";
import UpdateGatePanel from "./panels/UpdateGatePanel";
import { ADMIN_EMAIL } from "./lib/util";

// [id, label, icon, ownerOnly]
const NAV = [
  ["", [["overview", "Overview", "home"]]],
  ["People", [["users", "Users", "users", true], ["inbox", "Inbox", "inbox"]]],
  ["Money", [["payments", "Payments", "money", true]]],
  ["Content", [["broadcast", "Broadcast", "send"], ["gate", "Update gate", "gate"], ["legal", "Legal documents", "file"]]],
  ["Advanced", [["explorer", "Data explorer", "db", true], ["team", "Team access", "team", true]]],
];
const TITLES = Object.fromEntries(NAV.flatMap(([, items]) => items.map(([id, label]) => [id, label])));
const readHash = () => {
  const [page, id] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { page: TITLES[page] ? page : "overview", id: id ? decodeURIComponent(id) : "" };
};

function Login() {
  const { loginGoogle, loginEmail, authError } = useAdmin();
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); await loginEmail(email, pw); setBusy(false); };
  return (
    <div className="login">
      <div className="card login-box">
        <div className="brand"><img className="logo" src={import.meta.env.BASE_URL + "favicon.svg"} alt="" /><div><b>Trakey Admin</b><span>Sign in to continue</span></div></div>
        {authError && <div className="notice">{authError}</div>}
        <button className="primary" onClick={async () => { setBusy(true); await loginGoogle(); setBusy(false); }} disabled={busy}>Continue with Google</button>
        <form className="stack" onSubmit={submit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          <button disabled={busy || !email || !pw}>Sign in</button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const A = useAdmin();
  const [route, setRoute] = useState(readHash);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const on = () => { setRoute(readHash()); setMenu(false); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.getElementById("gsearch")?.focus(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const go = (page, id) => { window.location.hash = "/" + page + (id ? "/" + encodeURIComponent(id) : ""); };
  const counts = useMemo(() => ({
    inbox: A.feedback.filter((f) => !f.handled).length + A.contacts.filter((c) => (c.status || "new") === "new").length,
    payments: A.payments.filter((p) => (p.status || "pending") === "pending").length,
  }), [A.feedback, A.contacts, A.payments]);

  // Global search: jump to a person.
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !A.isOwner) return [];
    return A.people.filter((u) => [u.name, u.email, u.uid].some((v) => String(v || "").toLowerCase().includes(s))).slice(0, 6);
  }, [q, A.people, A.isOwner]);

  if (!A.authReady) return <div className="login"><span className="muted">Restoring your session…</span></div>;
  if (!A.user) return <Login />;

  const { page, id } = route;
  const owner = A.isOwner;
  const common = { go, id };
  const view = {
    overview: <Overview {...common} counts={counts} />,
    users: <Users {...common} />,
    inbox: <Inbox {...common} />,
    payments: <Payments {...common} />,
    broadcast: <Broadcast />,
    gate: <div className="card"><UpdateGatePanel userEmail={A.user.email} /></div>,
    legal: <Legal />,
    explorer: <div className="card"><DataExplorer /></div>,
    team: <div className="card"><TeamPanel ownerEmail={ADMIN_EMAIL} /></div>,
  }[page];
  const ownerOnly = NAV.flatMap(([, i]) => i).find(([k]) => k === page)?.[3];

  return (
    <div className="app">
      <nav className={"side" + (menu ? " open" : "")}>
        <div className="brand"><img className="logo" src={import.meta.env.BASE_URL + "favicon.svg"} alt="" /><div><b>Trakey</b><span>Admin</span></div></div>
        {NAV.map(([group, items]) => {
          const shown = items.filter((i) => !i[3] || owner);
          return shown.length > 0 && (
            <div key={group}>
              {group && <div className="nav-group">{group}</div>}
              {shown.map(([k, label, icon]) => (
                <button key={k} className={"nav" + (page === k ? " on" : "")} onClick={() => go(k)}>
                  <Icon n={icon} />{label}
                  {counts[k] > 0 && <span className="count">{counts[k]}</span>}
                </button>
              ))}
            </div>
          );
        })}
        <div className="side-foot">
          <div className="me"><div><b>{A.user.displayName || "Admin"}</b><span>{owner ? "Owner" : "Editor"} · {A.user.email}</span></div></div>
          <button className="quiet" onClick={A.logout}><Icon n="out" /> Sign out</button>
        </div>
      </nav>
      <div className="main">
        <header className="top">
          <button className="quiet menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu"><Icon n="menu" /></button>
          <h1>{TITLES[page]}</h1>
          {owner && (
            <div className="search">
              <Icon n="search" />
              <input id="gsearch" placeholder="Find a user by name, email or ID" value={q} onChange={(e) => setQ(e.target.value)} />
              <kbd>Ctrl K</kbd>
              {hits.length > 0 && (
                <div className="card" style={{ position: "absolute", top: 44, left: 0, right: 0, padding: 6, zIndex: 30 }}>
                  {hits.map((u) => (
                    <button key={u.uid} className="quiet" style={{ width: "100%", textAlign: "left" }} onClick={() => { setQ(""); go("users", u.uid); }}>
                      {u.name || "Trakey User"} <span className="faint">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>
        <main className="page">
          {A.loadError && <div className="notice">{A.loadError}</div>}
          {ownerOnly && !owner ? <div className="notice">This page is for the owner only.</div> : view}
        </main>
      </div>
      {A.toast && <div className={"toast " + (A.toast.tone === "bad" ? "bad" : "")} role="status">{A.toast.text}</div>}
    </div>
  );
}
