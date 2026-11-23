// Trakey Pro rules. Keep in step with the app (TrakeyPro.kt) and the website (pro.js).
import { tsMs } from "./format";

export const PLANS = {
  monthly: { label: "Monthly", price: 19, blurb: "30 days of Pro" },
  yearly: { label: "Yearly", price: 149, blurb: "365 days of Pro" },
  lifetime: { label: "Lifetime", price: 699, blurb: "Pro forever, one time" },
};
export const TRIAL_DAYS = 30;
export const REWARD_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const LIFETIME_MS = 4102444800000; // 1 Jan 2100, how the app marks Lifetime

/** Reads one proStatus document and says where the person stands. */
export function proInfo(raw = {}) {
  const now = Date.now();
  const until = Number(raw.proUntil) || 0;
  const trialStart = tsMs(raw.trialStartedAt);
  const rewardStart = tsMs(raw.starRewardAt);
  const trialEnd = trialStart ? trialStart + TRIAL_DAYS * DAY_MS : 0;
  const rewardEnd = rewardStart ? rewardStart + REWARD_DAYS * DAY_MS : 0;
  const planLabel = PLANS[raw.plan]?.label || raw.plan || "";

  let key = "free";
  let label = "Free";
  let endMs = 0;
  if (until >= LIFETIME_MS) { key = "lifetime"; label = "Lifetime"; }
  else if (until > now) { key = "pro"; label = "Pro" + (planLabel ? " · " + planLabel : ""); endMs = until; }
  else if (trialEnd > now) { key = "trial"; label = "Free trial"; endMs = trialEnd; }
  else if (rewardEnd > now) { key = "reward"; label = "Star reward"; endMs = rewardEnd; }
  else if (until > 0) { key = "expired"; label = "Pro expired"; endMs = until; }
  else if (trialStart) { key = "ended"; label = "Trial ended"; endMs = trialEnd; }

  return {
    key, label, endMs, raw,
    hasAccess: ["lifetime", "pro", "trial", "reward"].includes(key),
    hasPaid: key === "lifetime" || key === "pro",
    trialStart, rewardStart, trialEnd, rewardEnd,
  };
}

// Extends Pro from the later of now / current end. Never downgrades an existing Lifetime.
export function proPatchFor(cur, plan) {
  const base = Math.max(Number(cur.proUntil) || 0, Date.now());
  let proUntil;
  if (plan === "lifetime") proUntil = LIFETIME_MS;
  else if (plan === "monthly") proUntil = base + 30 * DAY_MS;
  else proUntil = base + 365 * DAY_MS;
  return cur.plan === "lifetime" ? {} : { proUntil, plan };
}
