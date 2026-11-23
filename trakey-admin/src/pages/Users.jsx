import { useMemo, useState } from "react";
import { Button, Card, Empty, Icon, Loading, Modal, PageHead, Segmented, Notice, useUI } from "../lib/ui";
import { useStore } from "../lib/store";
import { daysLeft, plain, todayIst } from "../lib/format";
import UserCard from "../components/UserCard";
import Composer from "../components/Composer";
import { GiftModal } from "../components/ProControls";
import { buildUserRows, buildUsersCsv, buildUsersPdf } from "../userExport";
import { downloadBlob } from "../paymentExport";

const PAGE = 60;

export default function Users() {
  const { people, payments, feedback, contacts, errors, loaded, anonymous, authListError, reloadAuthList } = useStore();
  const { toast } = useUI();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("seen");
  const [limit, setLimit] = useState(PAGE);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [composer, setComposer] = useState(null); // { people, mode }
  const [gift, setGift] = useState(null);
  const [menu, setMenu] = useState(false);

  const counts = useMemo(() => ({
    all: people.length,
    pro: people.filter((p) => p.pro.hasPaid).length,
    trial: people.filter((p) => p.pro.key === "trial" || p.pro.key === "reward").length,
    free: people.filter((p) => !p.pro.hasAccess).length,
    online: people.filter((p) => p.online).length,
    expiring: people.filter((p) => p.pro.hasAccess && p.pro.key !== "lifetime" && p.pro.endMs && daysLeft(p.pro.endMs) <= 7).length,
  }), [people]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = people.filter((p) => {
      if (filter === "pro" && !p.pro.hasPaid) return false;
      if (filter === "trial" && !(p.pro.key === "trial" || p.pro.key === "reward")) return false;
      if (filter === "free" && p.pro.hasAccess) return false;
      if (filter === "online" && !p.online) return false;
      if (filter === "expiring" && !(p.pro.hasAccess && p.pro.key !== "lifetime" && p.pro.endMs && daysLeft(p.pro.endMs) <= 7)) return false;
      return !s || [p.name, p.email, p.uid, p.location].some((v) => String(v || "").toLowerCase().includes(s));
    });
    if (sort === "name") list.sort((a, b) => String(a.name || a.email || "~").localeCompare(String(b.name || b.email || "~")));
    if (sort === "ending") list.sort((a, b) => (a.pro.endMs || Infinity) - (b.pro.endMs || Infinity));
    return list;
  }, [people, q, filter, sort]);

  const toggle = (uid) => setPicked((prev) => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const pickedPeople = people.filter((p) => picked.has(p.uid));
  const endSelect = () => { setSelecting(false); setPicked(new Set()); };

  const exportData = (format) => {
    setMenu(false);
    const onlineSet = new Set(people.filter((p) => p.online).map((p) => p.uid));
    const plainUsers = people.map(({ pro, backup, lastSeenMs, online, hasProDoc, notIndexed, ...rest }) => rest); // eslint-disable-line no-unused-vars
    const data = buildUserRows({ users: plainUsers, proItems: people.filter((p) => p.hasProDoc).map((p) => ({ id: p.uid, ...p.pro.raw })), paymentItems: payments, feedbackItems: feedback, contactItems: contacts, isOnline: (u) => onlineSet.has(u.uid) });
    const stamp = todayIst();
    if (format === "csv") downloadBlob(buildUsersCsv(data), "trakey-user-data-" + stamp + ".csv");
    else if (format === "pdf") downloadBlob(buildUsersPdf(data), "trakey-user-data-" + stamp + ".pdf");
    else {
      const payload = { exportedAt: new Date().toISOString(), users: people.map(({ pro, backup, ...u }) => plain({ ...u, proStatus: pro.raw, online: u.online })), feedback: plain(feedback), contactMessages: plain(contacts) };
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "trakey-admin-data-" + stamp + ".json");
    }
    toast("Download started.");
  };

  return (
    <>
      <PageHead title="Users" subtitle={people.length.toLocaleString("en-IN") + " people · live from Firestore. Open anyone to see everything about them and message them."}>
        <Button icon={selecting ? "x" : "check"} variant={selecting ? "soft" : "default"} onClick={() => (selecting ? endSelect() : setSelecting(true))}>{selecting ? "Cancel selecting" : "Select people"}</Button>
        <div style={{ position: "relative" }}>
          <Button icon="download" onClick={() => setMenu((m) => !m)}>Download</Button>
          {menu && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenu(false)} />
              <div className="card" style={{ position: "absolute", right: 0, top: 46, zIndex: 41, padding: 8, display: "grid", gap: 2, minWidth: 170 }}>
                {[["pdf", "PDF table"], ["csv", "CSV spreadsheet"], ["json", "JSON (everything)"]].map(([k, l]) => (
                  <button key={k} type="button" className="btn btn-quiet btn-sm" style={{ justifyContent: "flex-start" }} onClick={() => exportData(k)}>{l}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </PageHead>

      {errors.users && <div style={{ marginBottom: 16 }}><Notice tone="bad">{errors.users}</Notice></div>}
      {authListError && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="warn">
            Could not read the sign-in list ({authListError}). Check that the Trakey Admin API Worker is deployed.{" "}
            <button type="button" className="btn btn-soft btn-sm" onClick={reloadAuthList}>Try again</button>
          </Notice>
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={17} />
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search name, email or account ID" />
        </div>
        <Segmented value={filter} onChange={(v) => { setFilter(v); setLimit(PAGE); }} options={[
          { value: "all", label: "All", count: counts.all },
          { value: "pro", label: "Pro", count: counts.pro },
          { value: "trial", label: "Trial", count: counts.trial },
          { value: "free", label: "Free", count: counts.free },
          { value: "online", label: "Online", count: counts.online },
          { value: "expiring", label: "Ending soon", count: counts.expiring },
        ]} />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="seen">Recently active</option>
          <option value="name">Name A to Z</option>
          <option value="ending">Pro ending first</option>
        </select>
      </div>

      {anonymous > 0 && <p className="small muted" style={{ marginBottom: 12 }}>{anonymous} anonymous visitor{anonymous === 1 ? "" : "s"} not listed (they never signed in).</p>}
      {!loaded.users && people.length === 0 ? <Loading text="Loading users…" /> : shown.length === 0 ? (
        <Card><Empty icon="users" title={people.length === 0 ? "No users yet" : "Nobody matches"}>{people.length === 0 ? "People appear here after they sign in to the app." : "Try a different search or filter."}</Empty></Card>
      ) : (
        <>
          <div className="user-grid">
            {shown.slice(0, limit).map((p) => (
              <UserCard key={p.uid} person={p} selecting={selecting} selected={picked.has(p.uid)} onToggle={toggle}
                onNotify={(x) => setComposer({ people: [x], mode: "push" })}
                onEmail={(x) => setComposer({ people: [x], mode: "email" })}
                onGift={(x) => setGift(x)} />
            ))}
          </div>
          <div className="row" style={{ justifyContent: "center", marginTop: 22 }}>
            {shown.length > limit && <Button onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</Button>}
            <span className="small muted">Showing {Math.min(limit, shown.length)} of {shown.length}</span>
          </div>
        </>
      )}

      {selecting && (
        <div className="bulkbar">
          <b>{picked.size} selected</b>
          <Button size="sm" variant="quiet" onClick={() => setPicked(new Set(shown.map((p) => p.uid)))}>Select all {shown.length}</Button>
          <Button size="sm" variant="primary" icon="bell" disabled={!picked.size} onClick={() => setComposer({ people: pickedPeople, mode: "push" })}>Notify</Button>
          <Button size="sm" icon="mail" disabled={!picked.size} onClick={() => setComposer({ people: pickedPeople, mode: "email" })}>Email</Button>
          <Button size="sm" variant="quiet" icon="x" onClick={endSelect}>Done</Button>
        </div>
      )}

      {composer && (
        <Modal title={composer.people.length === 1 ? "Message " + (composer.people[0].name || composer.people[0].email || "user") : "Message " + composer.people.length + " people"} onClose={() => setComposer(null)} width={880}>
          <Composer recipients={composer.people} defaultMode={composer.mode} onDone={() => { if (composer.people.length > 1) endSelect(); }} />
        </Modal>
      )}
      {gift && <GiftModal person={gift} onClose={() => setGift(null)} />}
    </>
  );
}
