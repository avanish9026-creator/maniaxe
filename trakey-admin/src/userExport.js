// Whole Trakey user data export (CSV + PDF). Uses the same dependency-free writers as paymentExport.js.
import { buildTablePdf, csvFile, fmtAmount, fmtDateTime, tsMs } from "./paymentExport";

const PRO_LIFETIME_MS = 4102444800000; // 1 Jan 2100, how the app marks Lifetime
const PLAN = { monthly: "Monthly", yearly: "Yearly", lifetime: "Lifetime" };

// Fields already shown in fixed columns; everything else on the user document goes into extra CSV columns.
const KNOWN_KEYS = new Set(["id", "uid", "name", "email", "displayName", "lastSeenAt", "location"]);

const scalar = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v.toMillis === "function") return fmtDateTime(v.toMillis()) + " IST";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return null; // nested objects / arrays are skipped (see the JSON download for the raw data)
};

const totals = (obj) => {
  const k = Object.keys(obj);
  return k.length ? k.map((c) => c + " " + fmtAmount(obj[c])).join(" | ") : "";
};

/**
 * One row per user, combined from: users + backups (mergedUsers), proStatus, payments, feedback, contact messages.
 * Returns { rows, extraKeys }.
 */
export function buildUserRows({ users, proItems, paymentItems, feedbackItems, contactItems, isOnline }) {
  const proBy = new Map(proItems.map((p) => [p.id, p]));
  const lc = (v) => String(v || "").toLowerCase();
  const matches = (item, u) => (item.uid && item.uid === u.uid) || (!!u.email && lc(item.email) === lc(u.email));

  const extraKeys = [];
  const rows = users.map((u) => {
    const uid = u.uid || u.id;
    const pro = proBy.get(uid) || {};
    const proUntil = Number(pro.proUntil) || 0;
    const now = Date.now();
    let proStatus = "Free";
    if (proUntil >= PRO_LIFETIME_MS) proStatus = "Lifetime";
    else if (proUntil > now) proStatus = "Active";
    else if (proUntil > 0) proStatus = "Expired";
    else if (pro.trialStartedAt) proStatus = "Trial";

    const approved = {};
    const rejected = {};
    let approvedCount = 0;
    let rejectedCount = 0;
    paymentItems.forEach((p) => {
      if (!matches(p, { uid, email: u.email })) return;
      const cur = (p.currency || "INR").toUpperCase();
      if (p.status === "approved") { approvedCount++; approved[cur] = (approved[cur] || 0) + (Number(p.amount) || 0); }
      if (p.status === "rejected") { rejectedCount++; rejected[cur] = (rejected[cur] || 0) + (Number(p.amount) || 0); }
    });

    const fb = feedbackItems.filter((f) => matches(f, { uid, email: u.email }));
    const latestFb = fb.slice().sort((a, b) => tsMs(b.submittedAt || b.createdAt) - tsMs(a.submittedAt || a.createdAt))[0];
    const msgs = contactItems.filter((m) => matches(m, { uid, email: u.email }));

    const extra = {};
    Object.keys(u).forEach((k) => {
      if (KNOWN_KEYS.has(k)) return;
      const v = scalar(u[k]);
      if (v === null) return;
      extra[k] = v;
      if (!extraKeys.includes(k)) extraKeys.push(k);
    });

    return {
      name: u.name || "Trakey User",
      email: u.email || "",
      uid,
      online: isOnline(u),
      lastSeenMs: tsMs(u.lastSeenAt),
      location: u.location || "",
      proStatus,
      proPlan: PLAN[pro.plan] || pro.plan || "",
      proUntilMs: proUntil > 0 && proUntil < PRO_LIFETIME_MS ? proUntil : 0,
      trialMs: tsMs(pro.trialStartedAt),
      starMs: tsMs(pro.starRewardAt),
      approvedCount,
      approvedText: totals(approved),
      rejectedCount,
      rejectedText: totals(rejected),
      feedbackCount: fb.length,
      latestRating: latestFb && latestFb.rating ? latestFb.rating : "",
      messageCount: msgs.length,
      extra,
    };
  });
  return { rows, extraKeys: extraKeys.sort() };
}

const proText = (r) =>
  r.proStatus === "Lifetime" ? "Lifetime"
  : r.proStatus === "Active" || r.proStatus === "Expired"
    ? (r.proPlan ? r.proPlan + " " : "") + (r.proStatus === "Expired" ? "expired " : "till ") + fmtDateTime(r.proUntilMs).split(",")[0]
    : r.proStatus;

export function buildUsersCsv({ rows, extraKeys }) {
  const headers = [
    "Sr No", "Name", "Email", "User ID", "Online Now", "Last Seen (IST)", "Location", "Pro Status", "Pro Plan",
    "Pro Until (IST)", "Trial Started (IST)", "Star Reward (IST)", "Approved Payments", "Approved Total", "Rejected Payments",
    "Rejected Total", "Feedback Count", "Latest Rating", "Contact Messages", ...extraKeys,
  ];
  const matrix = rows.map((r, i) => [
    i + 1, r.name, r.email, r.uid, r.online ? "Yes" : "No", fmtDateTime(r.lastSeenMs), r.location, r.proStatus, r.proPlan,
    fmtDateTime(r.proUntilMs), fmtDateTime(r.trialMs), fmtDateTime(r.starMs), r.approvedCount, r.approvedText, r.rejectedCount,
    r.rejectedText, r.feedbackCount, r.latestRating, r.messageCount, ...extraKeys.map((k) => (r.extra[k] === undefined ? "" : r.extra[k])),
  ]);
  return csvFile(headers, matrix);
}

export function buildUsersPdf({ rows }) {
  const count = (pred) => rows.filter(pred).length;
  const cols = [
    { key: "sr", title: "Sr", w: 22 },
    { key: "name", title: "Name", w: 96 },
    { key: "email", title: "Email", w: 140 },
    { key: "uid", title: "User ID", w: 110 },
    { key: "last", title: "Last seen (IST)", w: 92 },
    { key: "online", title: "Online", w: 36 },
    { key: "location", title: "Location", w: 70 },
    { key: "pro", title: "Pro", w: 104 },
    { key: "paid", title: "Paid", w: 62 },
    { key: "fb", title: "Fdbk", w: 24 },
    { key: "msg", title: "Msgs", w: 26 },
  ];
  const tableRows = rows.map((r, i) => ({
    sr: String(i + 1),
    name: r.name,
    email: r.email || "-",
    uid: r.uid,
    last: r.lastSeenMs ? fmtDateTime(r.lastSeenMs) : "-",
    online: r.online ? "Yes" : "No",
    location: r.location || "-",
    pro: proText(r),
    paid: r.approvedCount ? String(r.approvedCount) + (r.approvedText ? " (" + r.approvedText.split(" | ")[0] + ")" : "") : "-",
    fb: String(r.feedbackCount),
    msg: String(r.messageCount),
    _pro: r.proStatus,
  }));
  return buildTablePdf({
    title: "Trakey - User Data",
    lines: [
      { text: "Generated: " + fmtDateTime(Date.now()) + " IST", gap: 11 },
      {
        text:
          "Total users: " + rows.length + "     Online now: " + count((r) => r.online) +
          "     Pro (active / lifetime): " + count((r) => r.proStatus === "Active" || r.proStatus === "Lifetime") +
          "     Trial: " + count((r) => r.proStatus === "Trial") + "     With approved payment: " + count((r) => r.approvedCount > 0),
        size: 9, color: "0 g", gap: 13,
      },
      { text: "Full columns (Pro dates, all payment totals, ratings, extra profile fields) are in the CSV download.", size: 7, color: "0.4 g", gap: 12 },
    ],
    cols,
    rows: tableRows,
    colorFor: (r, key) => (key === "pro" && (r._pro === "Active" || r._pro === "Lifetime") ? "0.1 0.45 0.2 rg" : key === "online" && r.online === "Yes" ? "0.1 0.45 0.2 rg" : undefined),
    emptyText: "No users yet.",
    footer: "Trakey user data - confidential",
  });
}
