// Small formatting helpers. All dates are shown in Indian time (IST), the same as the tax downloads.
// Reads any kind of time value: Firestore Timestamp, milliseconds, seconds, an ISO date text, or {seconds}.
export const tsMs = (t) => {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t === "number") return t > 0 && t < 1e11 ? t * 1000 : t;
  if (typeof t === "string") {
    if (/^\d+$/.test(t.trim())) return tsMs(Number(t));
    const d = Date.parse(t);
    return Number.isNaN(d) ? 0 : d;
  }
  if (typeof t === "object" && typeof t.seconds === "number") return t.seconds * 1000;
  return 0;
};

const TZ = "Asia/Kolkata";

export const fmtDay = (ms) =>
  ms ? new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }) : "";

export const fmtDateTime = (ms) =>
  ms
    ? new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ })
    : "";

export const fmtTime = (ms) =>
  ms ? new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "";

export function timeAgo(ms) {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " hr ago";
  const d = Math.floor(h / 24);
  if (d < 30) return d + (d === 1 ? " day ago" : " days ago");
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo + (mo === 1 ? " month ago" : " months ago");
  return Math.floor(d / 365) + " yr ago";
}

export function daysLeft(ms) {
  if (!ms) return 0;
  return Math.ceil((ms - Date.now()) / 86400000);
}

export const rupee = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

export const money = (n, currency = "INR") => {
  const c = String(currency || "INR").toUpperCase();
  const v = Number(n) || 0;
  if (c === "INR") return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return c + " " + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

export const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
export const monthKeyIst = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 7);

export const initialOf = (name, email) =>
  (String(name || "").trim() || String(email || "").trim() || "?").charAt(0).toUpperCase();

export const firstName = (name, email) => {
  const n = String(name || "").trim();
  if (n && n !== "Trakey User") return n.split(/\s+/)[0];
  const e = String(email || "").split("@")[0];
  return e || "there";
};

// "" or a bad number -> NaN. 0 is allowed (free gift).
export const parseMoney = (v) => {
  const s = String(v ?? "").trim();
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : NaN;
};

export const randomOrderId = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "TKM-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

// Turns any Firestore value into something readable / JSON safe.
export function plain(value) {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

export const pretty = (key) =>
  String(key).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
