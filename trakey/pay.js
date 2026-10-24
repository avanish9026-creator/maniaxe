// Trakey Web: Trakey Pro page + manual UPI payment. A port of TrakeyProScreen.kt + TrakeyPayment.kt, so web and the app
// use the SAME flow and the SAME Firestore documents (you approve both in Trakey Admin):
//   1. Pick a plan, Continue.
//   2. QR + UPI ID, exact amount. The user pays in any UPI app, then enters the 12-digit UTR and adds a screenshot.
//   3. ONE batch writes:  payments/{orderId}  paymentShots/{orderId}  paymentUtrs/{utr}   (same fields as the app)
//      The UTR is the document id of paymentUtrs, so the same UTR can never be used twice.
//   4. The page shows "under review" until you Approve / Reject in Trakey Admin. Approve writes proStatus/{uid}.proUntil,
//      which index.html already watches, so Pro unlocks on the open page without a refresh.
//
// This file owns its own <dialog> and CSS. index.html only calls initPay(ctx), openPro() and refreshPro().
// To switch to a real gateway later, replace startPay() and keep proStatus/{uid}.proUntil as it is.

import { collection, doc, query, where, limit as qlimit, onSnapshot, writeBatch, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ---------------------------------------------------------------- settings (same values as TrakeyPayments in the app)

export const UPI_ID = "trakeypro@naviaxis";       // must match trakey_pay_qr.png
export const PAYEE_NAME = "ROHAN YADAV";
export const SUPPORT_EMAIL = "support.trakey@gmail.com";
export const APPROVAL_TEXT = "Usually approved within 24 hours";
export const WEB_VERSION = "web";                 // goes into payments/{id}.appVersion (the app sends its version name)
export const QR_URL = "./trakey_pay_qr.png";      // next to index.html

const MAX_SHOT_BYTES = 450_000;                    // JPEG size after compressing (base64 is ~4/3 of this, under Firestore's 1 MB document limit)
const MAX_SHOT_EDGE = 1600;
const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O/1/I
const SUBMIT_TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------- pure helpers (no DOM, testable)

export function newOrderId(rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }) {
  let s = "TKP-";
  for (let i = 0; i < 6; i++) s += ID_CHARS[rand(ID_CHARS.length)];
  return s;
}

/** Digits only, at most 12 (what the UTR box accepts). */
export const cleanUtr = (s) => String(s || "").replace(/\D/g, "").slice(0, 12);

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** payments/{id} -> plain order (same shape as PayOrder in the app). */
export function parseOrder(id, d) {
  const t = d && d.createdAt;
  const at = t && typeof t.toMillis === "function" ? t.toMillis() : Date.now();   // pending server timestamp = now
  return {
    id, plan: String(d?.plan || ""), amount: Math.floor(Number(d?.amount) || 0), utr: String(d?.utr || ""),
    status: String(d?.status || "pending"), createdAt: at, note: String(d?.note || ""),
  };
}

/** Which of the four views to show, from the newest order (same rules as TrakeyPaymentScreen). */
export function viewFor(orders, acked) {
  if (orders == null) return "loading";
  const latest = orders[0];
  if (!latest) return "form";
  if (latest.status === "pending") return "pending";
  if (!acked && latest.status === "approved") return "approved";
  if (!acked && latest.status === "rejected") return "rejected";
  return "form";
}

export function upiLink(plan, orderId, amount) {
  const q = new URLSearchParams({ pa: UPI_ID, pn: PAYEE_NAME, am: String(amount), cu: "INR", tn: "Trakey Pro " + orderId });
  return "upi://pay?" + q.toString().replace(/\+/g, "%20");
}

export function outsideIndiaMail(plan, amount, user, now = new Date()) {
  const planText = plan === "monthly" ? "Monthly (1 month)" : plan === "lifetime" ? "Lifetime (one-time payment)" : "Yearly (1 year)";
  const subject = `Trakey Pro payment from outside India - ${planText}`;
  const body = [
    "Hello Trakey Support,", "",
    "I want to pay for Trakey Pro from outside India.", "",
    `Subscription: ${planText}`,
    `Listed price (INR): Rs ${amount}`,
    "My country: ",
    "Preferred payment method (PayPal / card / bank transfer / other): ",
    "Amount and currency I will pay: ",
    "Transaction ID / reference (after paying): ",
    "Payment date: ", "",
    `Account name: ${user?.displayName || ""}`,
    `Account email: ${user?.email || ""}`,
    `Account ID: ${user?.uid || ""}`,
    `App version: ${WEB_VERSION}`,
    `Browser: ${(typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 120)}`, "",
    "Other details / message:", "",
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const payDate = (ms) => new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const rupee = (v) => (v % 1 === 0 ? "₹" + v : "₹" + v.toFixed(2));

// ---------------------------------------------------------------- Firestore (the only place that touches payment collections)

class PayUtrUsed extends Error {
  constructor() { super("This UTR can't be used. It may already be submitted. Check the number, or contact us."); this.name = "PayUtrUsed"; }
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "timeout" })), ms))]);

/** Live list of this user's orders, newest first. Calls back with null when the read is not allowed or failed. */
function listenOrders(db, uid, onChange) {
  return onSnapshot(query(collection(db, "payments"), where("uid", "==", uid), qlimit(50)),
    (snap) => onChange(snap.docs.map((d) => parseOrder(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)),
    (e) => { console.warn("payments not readable:", e.code || e.message); onChange(null); });
}

/** Saves the order, the screenshot and the UTR lock in ONE batch. A used UTR makes the rules reject the whole batch. */
async function submitOrder(db, user, { orderId, plan, utr, shotB64, amount }) {
  const batch = writeBatch(db);
  batch.set(doc(db, "paymentUtrs", utr), { uid: user.uid, orderId, createdAt: serverTimestamp() });
  batch.set(doc(db, "paymentShots", orderId), { uid: user.uid, data: shotB64, createdAt: serverTimestamp() });
  batch.set(doc(db, "payments", orderId), {
    uid: user.uid, email: user.email || "", name: user.displayName || "", plan, amount, utr,
    status: "pending", createdAt: serverTimestamp(), appVersion: WEB_VERSION,
  });
  try {
    await withTimeout(batch.commit(), SUBMIT_TIMEOUT_MS);
  } catch (e) {
    if (e && e.code === "permission-denied") throw new PayUtrUsed();
    throw e;
  }
}

/** Payment-only Contact us: same collection and fields as the app, so Trakey Admin already lists it. */
async function sendPaymentMessage(db, user, order, text) {
  const topic = "Payment" + (order ? ` · ${order.id}` : "");
  const body = text.trim() + (order ? `\n\nOrder ${order.id} · ${planNameOf(order.plan)} ₹${order.amount} · UTR ${order.utr} · ${order.status}` : "");
  await withTimeout(addDoc(collection(db, "contactMessages"), {
    uid: user?.uid || "", name: user?.displayName || "Trakey User", email: user?.email || "",
    topic, message: body, submittedAt: serverTimestamp(), appVersion: WEB_VERSION,
    device: (typeof navigator !== "undefined" ? navigator.userAgent : "web").slice(0, 120), status: "new",
  }), 20_000);
}

const planNameOf = (p) => (p === "monthly" ? "Monthly" : p === "lifetime" ? "Lifetime" : "Yearly");

// ---------------------------------------------------------------- screenshot -> JPEG base64 under ~450 KB

/** Returns the base64 string (no data: prefix) or null when the file cannot be read as an image. */
export async function compressShot(file) {
  if (!file || !/^image\//.test(file.type || "")) return null;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { return null; }
  try {
    let edge = Math.min(MAX_SHOT_EDGE, Math.max(bmp.width, bmp.height));
    for (let round = 0; round < 5; round++) {
      const s = edge / Math.max(bmp.width, bmp.height);
      const w = Math.max(1, Math.round(bmp.width * Math.min(1, s))), h = Math.max(1, Math.round(bmp.height * Math.min(1, s)));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);          // PNG screenshots with transparency would turn black in a JPEG
      g.drawImage(bmp, 0, 0, w, h);
      for (let q = 0.82; q >= 0.3; q -= 0.1) {
        const b64 = c.toDataURL("image/jpeg", q).split(",")[1] || "";
        if (b64 && Math.floor(b64.length * 3 / 4) <= MAX_SHOT_BYTES) return b64;
      }
      edge = Math.floor(edge * 0.75);                          // still too big: shrink and try again
    }
    return null;
  } finally { if (bmp.close) bmp.close(); }
}

// ---------------------------------------------------------------- the page

const CSS = `
#prodlg{width:min(480px,94vw);max-height:92vh;padding:0;overflow:hidden}
#prodlg[open]{display:flex;flex-direction:column}
#prodlg .ph{display:flex;align-items:center;gap:8px;padding:14px 16px 8px}
#prodlg .ph h3{margin:0;flex:1;font-size:18px}
#prodlg .pb{flex:1;overflow:auto;padding:4px 20px 12px}
#prodlg .pf{padding:12px 20px 16px;border-top:1px solid var(--line);background:var(--card)}
#prodlg .pgo{width:100%;padding:14px;display:block;text-align:center}
#prodlg .pgo[disabled]{opacity:.45;cursor:default}
#prodlg .plink{display:block;width:100%;background:none;border:0;color:var(--blue);font-weight:650;font-size:13px;padding:10px 0 0;text-align:center}
#prodlg .pmsg{color:#f2a93b;font-size:13px;text-align:center;margin:0 0 8px}
#prodlg .pcenter{text-align:center}
#prodlg .phero{padding:8px 0 4px;text-align:center}
#prodlg .plogo{width:76px;height:76px;border-radius:22px;margin:0 auto 12px;background:linear-gradient(135deg,#FF8A3D,#FFD166);display:flex;align-items:center;justify-content:center;font:800 22px system-ui,sans-serif;color:#3A2600;box-shadow:0 8px 28px rgba(255,160,60,.35)}
#prodlg .phero h2{margin:0;font-size:26px}
#prodlg .phero p{margin:4px 0 0;color:var(--sub);font-size:14px}
#prodlg .pstate{display:inline-block;margin-top:10px;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;background:var(--elev);color:var(--sub)}
#prodlg .pstate.pro{background:linear-gradient(90deg,#FFD166,#FFB347);color:#3A2600}
#prodlg .plans{display:flex;flex-direction:column;gap:10px;margin-top:16px}
#prodlg .plan{display:flex;align-items:center;gap:12px;text-align:left;width:100%;background:var(--card);color:var(--text);border:2px solid var(--line);border-radius:20px;padding:14px 16px}
#prodlg .plan.on{border-color:var(--blue);background:color-mix(in srgb,var(--blue) 10%,var(--card))}
#prodlg .plan .rad{width:20px;height:20px;border-radius:50%;border:2px solid var(--sub);flex:none}
#prodlg .plan.on .rad{border-color:var(--blue);background:radial-gradient(var(--blue) 45%,transparent 50%)}
#prodlg .plan .pt{flex:1;font-weight:700}
#prodlg .plan .pt small{display:block;font-weight:500;color:var(--sub);font-size:12px}
#prodlg .plan .pp{font-weight:800;font-size:18px;text-align:right}
#prodlg .plan .pp small{display:block;font-weight:500;color:var(--sub);font-size:11px}
#prodlg .plan .pbadge{font-size:10px;font-weight:800;border-radius:6px;padding:2px 6px;background:linear-gradient(90deg,#FFD166,#FFB347);color:#3A2600;margin-left:6px;vertical-align:middle}
#prodlg h4{margin:22px 0 8px;font-size:16px}
#prodlg ul.feat{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;font-size:14px}
#prodlg ul.feat li:before{content:"✓";color:var(--ok);font-weight:800;margin-right:9px}
#prodlg table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
#prodlg th,#prodlg td{padding:7px 4px;text-align:left;border-bottom:1px solid var(--line)}
#prodlg th{color:var(--sub);font-weight:600}#prodlg td:last-child,#prodlg th:last-child{text-align:right;font-weight:700}
#prodlg .pnote{font-size:12px;color:var(--sub);margin-top:10px}
#prodlg .pbanner{display:flex;gap:10px;align-items:center;background:var(--elev);border-radius:16px;padding:10px 14px;margin-top:14px;font-size:13px}
#prodlg .pbanner button{margin-left:auto;border:0;background:none;color:var(--blue);font-weight:700}
#prodlg .pamt{font-size:40px;font-weight:800;text-align:center;line-height:1.1;margin-top:6px}
#prodlg .psub{text-align:center;color:var(--sub);font-size:13px;margin-top:2px}
#prodlg .pqr{background:#fff;border-radius:24px;padding:12px;width:252px;margin:16px auto 0}
#prodlg .pqr img{display:block;width:100%;height:auto}
#prodlg .pupi{display:flex;align-items:center;gap:8px;background:var(--elev);border-radius:20px;padding:8px 8px 8px 16px;margin-top:14px}
#prodlg .pupi div{flex:1;min-width:0}#prodlg .pupi small{display:block;color:var(--sub);font-size:12px}#prodlg .pupi b{font-size:15px;overflow-wrap:anywhere}
#prodlg .pupi button{border:0;border-radius:999px;background:var(--card);color:var(--text);padding:8px 14px;font-weight:650;font-size:13px}
#prodlg .ptiny{text-align:center;color:var(--sub);font-size:12px;margin-top:8px}
#prodlg .pshot{display:flex;align-items:center;justify-content:center;gap:8px;min-height:64px;background:var(--elev);border-radius:20px;color:var(--blue);font-weight:650;cursor:pointer;overflow:hidden;margin-top:10px}
#prodlg .pshot img{max-width:100%;max-height:200px;object-fit:contain;display:block}
#prodlg input[type=text],#prodlg textarea{width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit}
#prodlg textarea{min-height:110px;resize:vertical}
#prodlg .pstatus{text-align:center;padding:18px 0 4px}
#prodlg .pstatus .ic{width:76px;height:76px;border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:34px;background:var(--elev)}
#prodlg .pstatus h2{margin:0;font-size:22px}#prodlg .pstatus p{margin:6px 0 0;color:var(--sub);font-size:14px}
#prodlg .pdet{background:var(--elev);border-radius:20px;padding:6px 16px;margin-top:20px}
#prodlg .pdet div{display:flex;gap:10px;justify-content:space-between;padding:9px 0;font-size:14px}
#prodlg .pdet div+div{border-top:1px solid var(--line)}#prodlg .pdet span{color:var(--sub)}#prodlg .pdet b{text-align:right;overflow-wrap:anywhere}
`;

const FEATURES = ["Unlimited Scan with AI", "Unlimited AI import", "Unlimited AI actions in the app", "Spaced review", "Mistakes notebook", "Full Today view", "Accent colours and pure black"];

let ctx = null;          // { db, auth, P, getRaw }
let dlg = null;
let S = null;            // dialog state, null while closed
let unsub = null;

/** Call once after sign-in. ctx = { db, auth, P (pro.js), getRaw: () => proStatus raw }. */
export function initPay(c) { ctx = c; }

/** Stops listening (sign-out). */
export function resetPay() {
  if (unsub) { unsub(); unsub = null; }
  if (dlg && dlg.open) dlg.close();
  S = null;
}

function ensureDialog() {
  if (dlg) return dlg;
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  dlg = document.createElement("dialog"); dlg.id = "prodlg";
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => { if (dlg.open) return; /* reopened before this event arrived */ if (unsub) { unsub(); unsub = null; } S = null; });
  dlg.addEventListener("click", onClick);
  dlg.addEventListener("input", onInput);
  dlg.addEventListener("change", onChange);
  return dlg;
}

/** Opens the Trakey Pro page. startAtPay = true jumps straight to the payment step for the chosen plan. */
export function openPro(opts = {}) {
  if (!ctx) return;
  ensureDialog();
  const user = ctx.auth.currentUser;
  if (!user) return;
  S = { step: "plans", reason: opts.reason || "", plan: opts.plan || "yearly", orders: null, readFailed: false, orderId: newOrderId(), utr: "", shot: null, shotUrl: "", shotBusy: false, busy: false, msg: "", contact: false, contactText: "", contactErr: "", contactBusy: false };
  if (unsub) unsub();
  unsub = listenOrders(ctx.db, user.uid, (list) => {
    if (!S) return;
    if (list == null) { S.readFailed = true; if (S.orders == null) S.orders = []; }
    else { S.readFailed = false; S.orders = list; }
    draw();
  });
  draw();
  if (!dlg.open) dlg.showModal();
}

/** Pro status changed (the proStatus snapshot arrived): redraw if the page is open. */
export function refreshPro() { if (S && dlg && dlg.open) draw(); }

const ackKey = (id) => "trakey_web_pay_ack_" + id;
const isAcked = (o) => { try { return !!o && localStorage.getItem(ackKey(o.id)) === "1"; } catch { return false; } };
const setAck = (o) => { try { if (o) localStorage.setItem(ackKey(o.id), "1"); } catch { /* private mode */ } };

function draw() {
  if (!S || !dlg) return;
  const keep = dlg.querySelector(".pb");
  const scroll = keep ? keep.scrollTop : 0;
  const P = ctx.P, raw = ctx.getRaw();
  const tier = P.tierOf(raw);
  const latest = S.orders && S.orders[0];
  const view = viewFor(S.orders, isAcked(latest));
  let title, body, foot = "";

  if (S.step === "plans") {
    title = "Trakey Pro";
    const pro = tier === "PRO";
    const sub = pro ? (raw.plan === "lifetime" ? "Pro for life. Thank you!" : "Active until " + new Date(raw.proUntil).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })) : "No limits. Just focus.";
    const stateTxt = pro ? "Pro · Active" : tier === "TRIAL" ? P.label(raw) : "Free plan";
    const cmp = [
      ["Scan with AI", `${P.FREE_LIMITS.scan} a day`, "Unlimited"],
      ["AI import", `${P.FREE_LIMITS.import} a day`, "Unlimited"],
      ["AI actions (app)", `${P.APP_LIMITS.ai_action} a day`, "Unlimited"],
      ["Spaced review (app)", "Locked", "Included"],
      ["Mistakes notebook (app)", "Locked", "Included"],
      ["Today view (app)", "Limited", "Full"],
      ["Accent colours, pure black (app)", "Locked", "Included"],
    ];
    const planCard = (id, t, price, per, subtxt, badge) => `<button type="button" class="plan ${S.plan === id ? "on" : ""}" data-p="plan" data-id="${id}"><span class="rad"></span><span class="pt">${t}${badge ? `<span class="pbadge">${badge}</span>` : ""}${subtxt ? `<small>${subtxt}</small>` : ""}</span><span class="pp">₹${price}<small>${per}</small></span></button>`;
    body = (S.reason ? `<div class="pbanner" style="margin:6px 0 4px">${esc(S.reason)}</div>` : "") + `<div class="phero"><div class="plogo">PRO</div><h2>Trakey Pro</h2><p>${esc(sub)}</p><span class="pstate ${pro ? "pro" : ""}">${esc(stateTxt)}</span></div>`
      + (pro ? "" : `<div class="plans">
          ${planCard("monthly", "Monthly", P.PRICE_MONTHLY, "/ month", "", "")}
          ${planCard("yearly", "Yearly", P.PRICE_YEARLY, "/ year", rupee(Math.round(P.yearlyPerMonth() * 100) / 100) + " a month", `SAVE ${P.yearlySavePct()}%`)}
          ${planCard("lifetime", "Lifetime", P.PRICE_LIFETIME, "one time", "Pay once", "BEST VALUE")}
        </div>`)
      + (!pro && latest && latest.status === "pending" ? `<div class="pbanner">⏳ Payment under review <button type="button" data-p="status">View status</button></div>` : "")
      + `<h4>${pro ? "What you have" : "What you get"}</h4><ul class="feat">${FEATURES.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`
      + `<h4>Free vs Pro</h4><table><tr><th></th><th>Free</th><th>Pro</th></tr>${cmp.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</table>`
      + `<p class="pnote">One Trakey Pro works on the website and in the Trakey app, on the same Google account.</p>`;
    const amount = P.amountFor(S.plan);
    const priceTxt = S.plan === "monthly" ? `₹${amount} / month` : S.plan === "lifetime" ? `₹${amount} once` : `₹${amount} / year`;
    foot = pro ? `<button type="button" class="btn ghost pgo" data-p="close">Close</button>`
      : `<button type="button" class="btn pgo" data-p="continue">${tier === "TRIAL" ? "Upgrade" : "Continue"} · ${priceTxt}</button>`;
  } else {
    // ---- payment step (same four views as the app) ----
    const amount = P.amountFor(S.plan);
    title = { pending: "Payment status", approved: "Payment approved", rejected: "Payment not approved" }[view] || "Pay for Pro";
    const details = (o) => `<div class="pdet"><div><span>Order</span><b>${esc(o.id)}</b></div><div><span>Plan</span><b>${esc(planNameOf(o.plan))} · ₹${o.amount}</b></div><div><span>UTR</span><b>${esc(o.utr)}</b></div><div><span>Submitted</span><b>${esc(payDate(o.createdAt))}</b></div></div>`;
    const status = (ic, h, p) => `<div class="pstatus"><div class="ic">${ic}</div><h2>${esc(h)}</h2><p>${esc(p)}</p></div>`;

    if (view === "loading") body = `<div class="pcenter" style="padding:90px 0;color:var(--sub)">Loading…</div>`;
    else if (view === "pending") {
      body = status("⏳", "Payment under review", APPROVAL_TEXT) + details(latest);
      foot = `<button type="button" class="btn ghost pgo" data-p="contact">Contact us about this payment</button>`;
    } else if (view === "approved") {
      body = status("✅", "Payment approved", "Trakey Pro is active on your account.") + details(latest);
      foot = `<button type="button" class="btn pgo" data-p="done">Done</button>`;
    } else if (view === "rejected") {
      body = status("⚠️", "Payment not approved", latest.note || "We could not find this payment. If you paid, contact us with your UTR.") + details(latest);
      foot = `<button type="button" class="btn pgo" data-p="retry">Try again</button><button type="button" class="btn ghost pgo" style="margin-top:10px" data-p="contact">Contact us</button>`;
    } else {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      body = `<div class="pamt">₹${amount}</div><div class="psub">${esc(planNameOf(S.plan))} · Order ${esc(S.orderId)}</div>
        <div class="pqr"><img src="${QR_URL}" alt="UPI QR code" width="228" height="228"></div>
        <div class="ptiny">Scan with any UPI app${mobile ? ", or tap the button below" : ""}</div>
        <div class="pupi"><div><small>UPI ID</small><b>${esc(UPI_ID)}</b></div><button type="button" data-p="copy">Copy</button></div>
        ${mobile ? `<a class="btn pgo" style="margin-top:12px;text-decoration:none" href="${esc(upiLink(S.plan, S.orderId, amount))}">Pay ₹${amount} in your UPI app</a>` : ""}
        <div class="ptiny">Pay exactly ₹${amount}. Name shown: ${esc(PAYEE_NAME)}</div>
        <button type="button" class="plink" data-p="outside">For payment outside India, tap here</button>
        <h4 style="margin-top:22px;font-size:18px">After paying</h4>
        <input type="text" inputmode="numeric" autocomplete="off" id="payutr" placeholder="UTR / transaction ID (12 digits)" value="${esc(S.utr)}">
        <label class="pshot" for="payfile">${S.shotUrl ? `<img src="${esc(S.shotUrl)}" alt="Payment screenshot">` : (S.shotBusy ? "Preparing…" : "🖼 Add payment screenshot")}</label>
        <input type="file" id="payfile" accept="image/*" hidden>
        ${S.shotUrl ? `<div class="ptiny">Click the screenshot to change it</div>` : ""}
        ${S.readFailed ? `<div class="ptiny" style="color:#f2a93b">Could not check your earlier payments. Check your connection.</div>` : ""}`;
      const ready = !S.busy && !S.shotBusy && S.utr.length === 12 && !!S.shot;
      foot = `<button type="button" class="btn pgo" data-p="submit" id="paysubmit" ${ready ? "" : "disabled"}>${S.busy ? "Submitting…" : "Submit for approval"}</button>`;
    }
  }

  const back = S.step === "pay" ? `<button type="button" class="chip" data-p="back">← Back</button>` : "";
  dlg.innerHTML = `<div class="ph">${back}<h3>${esc(title)}</h3><button type="button" class="chip" data-p="close" title="Close">✕</button></div>
    <div class="pb">${body}</div>
    <div class="pf">${S.msg ? `<p class="pmsg">${esc(S.msg)}</p>` : ""}${foot}</div>${S.contact ? contactHtml(latest) : ""}`;
  const pb = dlg.querySelector(".pb"); if (pb) pb.scrollTop = scroll;
}

function contactHtml(order) {
  return `<div id="paycontact" style="position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px">
    <div style="background:var(--card);border-radius:24px;padding:18px;width:100%;max-height:90%;overflow:auto">
      <h3 style="margin:0">Payment help</h3>
      <p class="m" style="margin:4px 0 12px">${order ? "About order " + esc(order.id) : "Only for payment problems"}</p>
      <textarea id="paytext" maxlength="600" placeholder="Tell us what went wrong">${esc(S.contactText)}</textarea>
      ${S.contactErr ? `<p class="pmsg" style="text-align:left;margin-top:8px">${esc(S.contactErr)}</p>` : ""}
      <div style="display:flex;gap:8px;margin-top:14px"><button type="button" class="btn ghost" style="flex:1" data-p="contact-close">Cancel</button>
      <button type="button" class="btn" style="flex:1" data-p="contact-send" id="paysend" ${S.contactBusy || S.contactText.trim().length < 5 ? "disabled" : ""}>${S.contactBusy ? "Sending…" : "Send"}</button></div>
    </div></div>`;
}

function onInput(e) {
  if (!S) return;
  const t = e.target;
  if (t.id === "payutr") {
    S.utr = cleanUtr(t.value);
    if (t.value !== S.utr) t.value = S.utr;
    const b = $id("paysubmit"); if (b) b.disabled = !(!S.busy && !S.shotBusy && S.utr.length === 12 && S.shot);
  } else if (t.id === "paytext") {
    S.contactText = t.value;
    const b = $id("paysend"); if (b) b.disabled = S.contactBusy || S.contactText.trim().length < 5;
  }
}
const $id = (id) => dlg.querySelector("#" + id);

async function onChange(e) {
  if (!S || e.target.id !== "payfile") return;
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!f) return;
  S.shotBusy = true; S.msg = ""; draw();
  const b64 = await compressShot(f);
  if (!S) return;
  S.shotBusy = false;
  if (!b64) S.msg = "Could not read that image. Pick the payment screenshot again.";
  else { S.shot = b64; S.shotUrl = "data:image/jpeg;base64," + b64; }
  draw();
}

async function onClick(e) {
  const el = e.target.closest("[data-p]");
  if (!el || !S) return;
  const a = el.dataset.p, P = ctx.P, user = ctx.auth.currentUser;
  const latest = S.orders && S.orders[0];
  switch (a) {
    case "close": case "done":
      if (a === "done") setAck(latest);
      dlg.close(); return;
    case "plan": S.plan = el.dataset.id; draw(); return;
    case "continue": S.step = "pay"; S.msg = ""; draw(); return;
    case "status": S.step = "pay"; draw(); return;
    case "back": S.step = "plans"; S.msg = ""; draw(); return;
    case "retry":
      setAck(latest); S.utr = ""; S.shot = null; S.shotUrl = ""; S.msg = ""; S.orderId = newOrderId(); draw(); return;
    case "copy":
      try { await navigator.clipboard.writeText(UPI_ID); el.textContent = "Copied"; setTimeout(() => { if (el.isConnected) el.textContent = "Copy"; }, 1500); }
      catch { const i = document.createElement("textarea"); i.value = UPI_ID; document.body.appendChild(i); i.select(); try { document.execCommand("copy"); el.textContent = "Copied"; } catch { /* ignore */ } i.remove(); }
      return;
    case "outside":
      location.href = outsideIndiaMail(S.plan, P.amountFor(S.plan), user); return;
    case "contact": S.contact = true; S.contactText = ""; S.contactErr = ""; draw(); return;
    case "contact-close": S.contact = false; draw(); return;
    case "contact-send": {
      if (S.contactBusy || S.contactText.trim().length < 5) return;
      S.contactBusy = true; S.contactErr = ""; draw();
      try {
        await sendPaymentMessage(ctx.db, user, latest, S.contactText);
        if (!S) return;
        S.contact = false; S.contactBusy = false; S.msg = "Sent. We will reply to your account email."; draw();
      } catch (err) {
        if (!S) return;
        S.contactBusy = false; S.contactErr = "Could not send. Check your connection."; draw();
      }
      return;
    }
    case "submit": {
      if (S.busy || S.shotBusy || S.utr.length !== 12 || !S.shot || !user) return;
      S.busy = true; S.msg = ""; draw();
      try {
        await submitOrder(ctx.db, user, { orderId: S.orderId, plan: S.plan, utr: S.utr, shotB64: S.shot, amount: P.amountFor(S.plan) });
        if (!S) return;
        S.msg = "";   // the live list now shows "pending"
      } catch (err) {
        if (!S) return;
        console.warn("payment submit failed:", err.code || err.message);
        S.msg = err instanceof PayUtrUsed ? err.message
          : err.code === "timeout" || err.code === "unavailable" ? "No connection. Check the internet and try again."
          : "Could not submit. Please try again.";
      }
      S.busy = false; draw();
      return;
    }
  }
}
