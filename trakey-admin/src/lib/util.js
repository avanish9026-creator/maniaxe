import { Timestamp } from "firebase/firestore";

export const ADMIN_EMAIL = "support.trakey@gmail.com";
// Keep these prices the same as the app (TrakeyPro.kt) and the website (pro.js).
export const PLANS = {
  monthly: { label: "Monthly", price: 19 },
  yearly: { label: "Yearly", price: 149 },
  lifetime: { label: "Lifetime", price: 699 },
};
export const TRIAL_DAYS = 30;
export const REWARD_DAYS = 30;
export const DAY = 24 * 60 * 60 * 1000;
export const LIFETIME_MS = 4102444800000; // 1 Jan 2100
// Ends a trial/reward without deleting the field (the app would start a new trial if it was missing).
export const ENDED_AT = Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));

export const ms = (v) => v?.toMillis?.() ?? (typeof v === "number" ? v : 0);
export const fmtDay = (t) =>
  t ? new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
export const fmtTime = (t) =>
  t ? new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—";
export const ago = (t) => {
  if (!t) return "never";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  if (s < 86400 * 30) return Math.round(s / 86400) + " d ago";
  return fmtDay(t);
};
export const inr = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
export const isOnline = (u) => { const t = ms(u.lastSeenAt); return t > 0 && Date.now() - t <= 5 * 60 * 1000; };

export const parseMoney = (v) => {
  const s = String(v ?? "").trim();
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : NaN;
};
export const orderId = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "TKM-" + Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

// Extends Pro from the later of now / current end. Never downgrades an existing Lifetime.
export const proPatchFor = (cur, plan) => {
  const base = Math.max(Number(cur.proUntil) || 0, Date.now());
  const proUntil = plan === "lifetime" ? LIFETIME_MS : base + (plan === "monthly" ? 30 : 365) * DAY;
  return cur.plan === "lifetime" ? {} : { proUntil, plan };
};

export function proInfo(raw = {}) {
  const now = Date.now();
  const until = Number(raw.proUntil) || 0;
  const trialStart = ms(raw.trialStartedAt);
  const rewardStart = ms(raw.starRewardAt);
  const trialEnd = trialStart ? trialStart + TRIAL_DAYS * DAY : 0;
  const rewardEnd = rewardStart ? rewardStart + REWARD_DAYS * DAY : 0;
  const planLabel = PLANS[raw.plan]?.label || raw.plan || "";
  let key = "free", label = "Free", endMs = 0;
  if (until >= LIFETIME_MS) { key = "lifetime"; label = "Lifetime"; }
  else if (until > now) { key = "pro"; label = "Pro" + (planLabel ? " · " + planLabel : ""); endMs = until; }
  else if (trialEnd > now) { key = "trial"; label = "Free trial"; endMs = trialEnd; }
  else if (rewardEnd > now) { key = "reward"; label = "Star reward"; endMs = rewardEnd; }
  else if (until > 0) { key = "expired"; label = "Pro expired"; endMs = until; }
  else if (trialStart) { key = "ended"; label = "Trial ended"; endMs = trialEnd; }
  return { key, label, endMs, raw, hasPaid: key === "lifetime" || key === "pro", hasAccess: ["lifetime", "pro", "trial", "reward"].includes(key) };
}
export const PRO_TONE = { lifetime: "gold", pro: "gold", trial: "accent", reward: "accent", expired: "warn", ended: "muted", free: "muted" };
