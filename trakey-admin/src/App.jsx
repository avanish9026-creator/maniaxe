import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, browserLocalPersistence, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "./firebase";
import { ADMIN_EMAIL } from "./lib/actions";
import { DataProvider, db, useStore } from "./lib/store";
import { useRoute, href } from "./lib/router";
import { Avatar, Icon, IconButton, Spinner, UIProvider } from "./lib/ui";
import { useTheme } from "./lib/theme";
import CommandPalette from "./components/CommandPalette";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Payments from "./pages/Payments";
import Inbox from "./pages/Inbox";
import Broadcast from "./pages/Broadcast";
import Releases from "./pages/Releases";
import History from "./pages/History";
import Legal from "./pages/Legal";
import Explorer from "./pages/Explorer";
import Team from "./pages/Team";

// key, label, icon, hint, owner-only
const NAV = [
  ["", [["overview", "Overview", "home", "Today at a glance"]]],
  ["People", [["users", "Users", "users", "Every user and their controls", true], ["inbox", "Inbox", "inbox", "Support messages and reviews"]]],
  ["Money", [["payments", "Payments", "card", "Approve orders, gifts and tax downloads", true]]],
  ["Engage", [["broadcast", "Broadcast", "megaphone", "Message everyone"], ["releases", "Releases", "rocket", "App updates and update gate"], ["history", "History", "clock", "Everything sent so far"]]],
  ["System", [["legal", "Legal documents", "file", "Terms and Privacy Policy PDFs"], ["explorer", "Data explorer", "database", "Browse and edit Firestore", true], ["team", "Team access", "shield", "Add editors", true]]],
];

function Shell({ user, role, onLogout }) {
  const route = useRoute();
  const { people, feedback, contacts, payments, isOwner } = useStore();
  const [navOpen, setNavOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [dark, toggleTheme] = useTheme();

  const page = route[0] || "overview";
  useEffect(() => { setNavOpen(false); window.scrollTo(0, 0); }, [route.join("/")]);

  useEffect(() => {
    const on = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const badge = {
    payments: payments.filter((p) => (p.status || "pending") === "pending").length,
    inbox: feedback.filter((f) => !f.handled).length + contacts.filter((c) => (c.status || "new") === "new").length,
  };
  const groups = NAV.map(([g, items]) => [g, items.filter((i) => !i[4] || isOwner)]).filter(([, items]) => items.length);
  const pages = useMemo(() => groups.flatMap(([, items]) => items.map(([key, label, icon, hint]) => ({ key, label, icon, hint }))), [isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = pages.find((p) => p.key === page);
  const ownerOnly = NAV.flatMap(([, i]) => i).find((i) => i[0] === page && i[4]);
  const person = page === "users" && route[1] ? people.find((p) => p.uid === route[1]) : null;

  let content;
  if (ownerOnly && !isOwner) content = <div className="card">This page is for the owner only.</div>;
  else if (page === "overview") content = <Overview />;
  else if (page === "users") content = route[1] ? <UserDetail uid={route[1]} key={route[1]} /> : <Users />;
  else if (page === "payments") content = <Payments />;
  else if (page === "inbox") content = <Inbox />;
  else if (page === "broadcast") content = <Broadcast />;
  else if (page === "releases") content = <Releases />;
  else if (page === "history") content = <History />;
  else if (page === "legal") content = <Legal />;
  else if (page === "explorer") content = <Explorer />;
  else if (page === "team") content = <Team />;
  else content = <Overview />;

  return (
    <div className="app">
      <aside className={"sidebar" + (navOpen ? " open" : "")}>
        <div className="brand"><img src={import.meta.env.BASE_URL + "trakey-logo.png"} alt="" /><div><b>Trakey Admin</b><small>{isOwner ? "Owner" : "Editor"}</small></div></div>
        <nav className="nav">
          {groups.map(([g, items]) => (
            <div key={g || "top"}>
              {g && <div className="nav-label">{g}</div>}
              {items.map(([key, label, icon]) => (
                <a key={key} href={href(key)} className={page === key || (key === "overview" && !route[0]) ? "on" : ""}>
                  <Icon name={icon} size={19} />{label}
                  {badge[key] > 0 && <span className="count">{badge[key]}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <Avatar name="" email={user.email} size={34} />
          <div className="who"><b>{user.displayName || user.email}</b><small>{isOwner ? "Owner" : "Editor"}</small></div>
          <IconButton icon="logout" label="Sign out" onClick={onLogout} />
        </div>
      </aside>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <IconButton className="menu-btn" icon="menu" label="Menu" onClick={() => setNavOpen(true)} />
          <div className="crumbs">
            {page === "users" && route[1] ? (<><a href={href("users")}>Users</a><Icon name="right" size={14} /><b>{person?.name || person?.email || "User"}</b></>) : <b>{current?.label || "Overview"}</b>}
          </div>
          <div className="top-spacer" />
          <button type="button" className="search-trigger" onClick={() => setPalette(true)}>
            <Icon name="search" size={17} /><span>{isOwner ? "Search people or pages" : "Jump to…"}</span><kbd>Ctrl K</kbd>
          </button>
          <IconButton className="bordered" icon={dark ? "sun" : "moon"} label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme} />
        </header>
        <main className="page">{content}</main>
      </div>
      {palette && <CommandPalette pages={pages} onClose={() => setPalette(false)} />}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const checkAdmin = useCallback(async (u) => {
    if (String(u.email || "").toLowerCase() === ADMIN_EMAIL) { setRole("owner"); setUser(u); return true; }
    try {
      const snap = await getDoc(doc(db, "adminStaff", u.uid));
      const d = snap.exists() ? snap.data() : null;
      if (d && d.role === "editor" && d.active !== false) { setRole("editor"); setUser(u); return true; }
    } catch (err) { console.warn("Team access check failed:", err); }
    setError("This account is not authorized yet. To get access, send this Account ID to the Trakey owner: " + u.uid);
    signOut(auth);
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      if (u) await checkAdmin(u); else { setUser(null); setRole(""); }
      if (!cancelled) setReady(true);
    });
    setPersistence(auth, browserLocalPersistence).catch((e) => console.warn("Auth persistence warning:", e));
    const t = setTimeout(() => !cancelled && setReady(true), 8000); // never get stuck on the loading screen
    return () => { cancelled = true; unsub(); clearTimeout(t); };
  }, [checkAdmin]);

  const google = async () => {
    setError(""); setLoading(true);
    try { const r = await signInWithPopup(auth, new GoogleAuthProvider()); await checkAdmin(r.user); }
    catch (err) { setError(err.message || "Google sign-in failed."); } finally { setLoading(false); }
  };
  const emailLogin = async (email, password) => {
    setError(""); setLoading(true);
    try { const r = await signInWithEmailAndPassword(auth, email, password); await checkAdmin(r.user); }
    catch { setError("Invalid email or password."); } finally { setLoading(false); }
  };
  const logout = async () => { await signOut(auth); setUser(null); setRole(""); window.location.hash = ""; };

  return (
    <UIProvider>
      {!ready ? (
        <div className="centered"><div><Spinner /><p style={{ marginTop: 12 }}>Restoring your admin session…</p></div></div>
      ) : user ? (
        <DataProvider user={user} role={role}><Shell user={user} role={role} onLogout={logout} /></DataProvider>
      ) : (
        <Login onGoogle={google} onEmail={emailLogin} loading={loading} error={error} />
      )}
    </UIProvider>
  );
}
