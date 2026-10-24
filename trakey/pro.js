// Trakey Web: Trakey Pro status and the free daily limits for Scan with AI and AI import.
// A port of TrakeyPro.kt in the app, so web and phone follow the same rules:
//   - Pro = proStatus/{uid}.proUntil is in the future  -> no limit
//   - 7-day trial (trialStartedAt) and the 30-day 3-star reward (starRewardAt) count as Pro too
//   - everyone else is Free: WEB limits below (the app keeps its own, lower limits because the app uses Trakey's AI server)
// Payment on the web is in pay.js (same manual UPI flow as the app). You approve it in Trakey Admin, which writes proStatus/{uid}.
// No DOM or Firebase in here, so it can be tested on its own. The page (index.html) reads/writes Firestore.

export const TRIAL_DAYS = 7;
export const REWARD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const F_SCAN = "scan";       // Learn > Scan with AI
export const F_IMPORT = "import";   // Questions > Import, from images (AI)
// WEB free limits. The web uses the visitor's OWN Gemini key (no cost to you), so these are higher than the app's (scan 5, import 3).
// The limit is only there to make Pro worth buying. Change the two numbers here and nothing else needs touching.
export const FREE_LIMITS = { [F_SCAN]: 10, [F_IMPORT]: 10 };
export const APP_LIMITS = { [F_SCAN]: 5, [F_IMPORT]: 3, ai_action: 5 };   // for the "Free vs Pro" table only; keep the same as FREE_LIMITS in TrakeyPro.kt

// ---------------------------------------------------------------- prices (keep the same as TrakeyPro.kt)
export const PRICE_MONTHLY = 19;     // rupees
export const PRICE_YEARLY = 179;     // rupees
export const PRICE_LIFETIME = 999;   // rupees, one time
const LIFETIME_COMPARE_YEARS = 10;

export const amountFor = (plan) => plan === "monthly" ? PRICE_MONTHLY : plan === "lifetime" ? PRICE_LIFETIME : PRICE_YEARLY;
export const planLabel = (plan) => plan === "monthly" ? "Monthly" : plan === "lifetime" ? "Lifetime" : "Yearly";
export const yearlySavePct = () => Math.round((1 - PRICE_YEARLY / (PRICE_MONTHLY * 12)) * 100);
export const yearlyPerMonth = () => PRICE_YEARLY / 12;
export const lifetimeSavePct = () => Math.round((1 - PRICE_LIFETIME / (PRICE_YEARLY * LIFETIME_COMPARE_YEARS)) * 100);

export const NOUN = { [F_SCAN]: "AI scan", [F_IMPORT]: "AI import" };
export const NOUN_PLURAL = { [F_SCAN]: "scans", [F_IMPORT]: "imports" };

const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
const ms = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();   // Firestore Timestamp
  return 0;
};

/** proStatus/{uid} data -> plain millisecond numbers. null / missing document = never had anything. */
export function fromDoc(data) {
  const d = data || {};
  return { trialStartedAt: ms(d.trialStartedAt), starRewardAt: ms(d.starRewardAt), proUntil: ms(d.proUntil), plan: String(d.plan || "") };
}

/** "FREE" | "TRIAL" | "PRO" (same order of checks as TrakeyPro.tier in the app). */
export function tierOf(raw, now = Date.now()) {
  const r = raw || {};
  if (num(r.proUntil) > now) return "PRO";
  if (num(r.trialStartedAt) > 0 && now < r.trialStartedAt + TRIAL_DAYS * DAY_MS) return "TRIAL";
  if (num(r.starRewardAt) > 0 && now < r.starRewardAt + REWARD_DAYS * DAY_MS) return "TRIAL";
  return "FREE";
}

export const isPro = (raw, now = Date.now()) => tierOf(raw, now) !== "FREE";

function endOf(raw, now) {
  const r = raw || {};
  const tier = tierOf(r, now);
  if (tier === "PRO") return r.proUntil;
  if (tier === "TRIAL") {
    const t = r.trialStartedAt > 0 ? r.trialStartedAt + TRIAL_DAYS * DAY_MS : 0;
    const w = r.starRewardAt > 0 ? r.starRewardAt + REWARD_DAYS * DAY_MS : 0;
    return Math.max(t, w);
  }
  return 0;
}

export function daysLeft(raw, now = Date.now()) {
  const end = endOf(raw, now);
  return end <= now ? 0 : Math.ceil((end - now) / DAY_MS);
}

/** "Pro · Active", "Trial · 3 days left", "Free" (the app's Settings row says the same). */
export function label(raw, now = Date.now()) {
  const tier = tierOf(raw, now);
  if (tier === "PRO") {
    if (raw.plan === "lifetime") return "Pro · Lifetime";
    return "Pro · Active until " + new Date(raw.proUntil).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  if (tier === "TRIAL") {
    const n = daysLeft(raw, now);
    const reward = num(raw.starRewardAt) > 0 && now < raw.starRewardAt + REWARD_DAYS * DAY_MS
      && raw.starRewardAt + REWARD_DAYS * DAY_MS >= (raw.trialStartedAt > 0 ? raw.trialStartedAt + TRIAL_DAYS * DAY_MS : 0);
    return (reward ? "Star reward" : "Trial") + ` · ${n} day${n === 1 ? "" : "s"} left`;
  }
  return "Free";
}

// ---------------------------------------------------------------- daily limits

/** Today as YYYY-MM-DD in the browser's own time zone (the app uses LocalDate.now() the same way). */
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const limit = (feature) => FREE_LIMITS[feature] ?? Infinity;

/** webUsage/{uid} = { day, scanCount, importCount }. A different day counts as zero. */
export function usageFromDoc(data, day = todayKey()) {
  const d = data || {};
  if (d.day !== day) return { scan: 0, import: 0 };
  return { scan: Math.max(0, Math.floor(num(d.scanCount))), import: Math.max(0, Math.floor(num(d.importCount))) };
}

export function usageToDoc(use, day = todayKey()) {
  return { day, scanCount: use.scan, importCount: use.import };
}

/** Uses left today. Infinity for Pro and trial. */
export function remaining(raw, used, feature, now = Date.now()) {
  if (isPro(raw, now)) return Infinity;
  return Math.max(0, limit(feature) - (used || 0));
}

export const canUse = (raw, used, feature, now = Date.now()) => remaining(raw, used, feature, now) > 0;

/** "3 of 5 left today" / "Pro · no daily limit" (same wording as TrakeyPro.limitText). */
export function limitText(raw, used, feature, now = Date.now()) {
  if (isPro(raw, now)) return "Pro · no daily limit";
  return `${remaining(raw, used, feature, now)} of ${limit(feature)} left today`;
}

/** Shown when the free limit is used up. The page offers a "Get Trakey Pro" button next to it. */
export function limitMessage(feature) {
  return `You've used today's ${limit(feature)} free ${NOUN_PLURAL[feature]}. Get Trakey Pro for unlimited ${NOUN_PLURAL[feature]}.`;
}

// ---------------------------------------------------------------- small browser caches (localStorage, all wrapped)

const cacheKey = (uid) => "trakey_web_pro_" + uid;
const useKey = (uid, feature, day) => `trakey_web_use_${uid}_${feature}_${day}`;

export function readCache(uid) {
  try { return fromDoc(JSON.parse(localStorage.getItem(cacheKey(uid)) || "null")); } catch { return fromDoc(null); }
}
export function writeCache(uid, raw) {
  try { localStorage.setItem(cacheKey(uid), JSON.stringify(raw)); } catch { /* private mode */ }
}

/** Uses counted in this browser today (the page also counts them in Firestore, and takes the larger of the two). */
export function localUsed(uid, feature, day = todayKey()) {
  try { return Math.max(0, parseInt(localStorage.getItem(useKey(uid, feature, day)) || "0", 10) || 0); } catch { return 0; }
}
export function localBump(uid, feature, day = todayKey()) {
  try {
    // drop earlier days of this account so storage stays tiny
    const prefix = "trakey_web_use_" + uid + "_";
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && !k.endsWith("_" + day)) localStorage.removeItem(k);
    }
    localStorage.setItem(useKey(uid, feature, day), String(localUsed(uid, feature, day) + 1));
  } catch { /* private mode: only Firestore counts then */ }
}

// ---------------------------------------------------------------- the PRO badge (same look as TrakeyProBadge in the app)

export const badgeHtml = (title) => `<button type="button" class="probadge" data-pro="badge" title="${String(title || "Trakey Pro").replace(/"/g, "&quot;")}">PRO</button>`;
