// Trakey Web: turns a cloud backup (schema 4 gzip-json, or schema 3 plain map) into plain data.
// No DOM or Firebase in here, so it can be tested on its own.

export async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** { prefsName: { key: { t, v } } }  ->  { prefsName: { key: value } } */
export function decodePrefs(root) {
  const out = {};
  for (const [name, entries] of Object.entries(root || {})) {
    const p = {};
    for (const [key, enc] of Object.entries(entries || {})) {
      if (enc && typeof enc === "object" && "v" in enc) p[key] = enc.v;
    }
    out[name] = p;
  }
  return out;
}

function arr(prefs, file, key) {
  const raw = prefs?.[file]?.[key];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

function normalizeQuestionType(type) {
  const t = String(type || "MCQ").trim().toUpperCase().replace(/[ -]/g, "_");
  if (t === "TRUEFALSE" || t === "TRUE_FALSE" || t === "TRUEORFALSE" || t === "TRUE_OR_FALSE") return "TRUE_FALSE";
  return t === "MCQ" || t === "MULTIPLE_CHOICE" ? "MCQ" : t;
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Same period logic as the Android app (Daily / Weekly Mon-Sun / Monthly). */
export function habitPeriodKey(frequency, offset = 0, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (frequency === "Weekly") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * offset);
    return "W" + ymd(d);
  }
  if (frequency === "Monthly") {
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    return "M" + d.getFullYear() + "-" + pad(d.getMonth() + 1);
  }
  d.setDate(d.getDate() - offset);
  return ymd(d);
}

function habitLastKey(h) {
  const lc = h.lastCompleted || "";
  if (lc.length === 10 && lc[4] === "-") {
    if (h.frequency === "Monthly") return "M" + lc.slice(0, 7);
    if (h.frequency === "Weekly") {
      const [y, m, d] = lc.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      return "W" + ymd(dt);
    }
  }
  return lc;
}

export function habitState(h, now = new Date()) {
  const last = habitLastKey(h);
  const f = h.frequency || "Daily";
  const done = last === habitPeriodKey(f, 0, now);
  const alive = done || last === habitPeriodKey(f, 1, now);
  return { done, streak: alive ? h.streak || 0 : 0 };
}

export function buildModel(prefs, now = new Date()) {
  const prof = prefs.trakey_profile || {};
  const profile = {
    name: prof.name || "Trakey User", email: prof.email || "", bio: prof.bio || "",
    location: prof.location || "", joinedAt: prof.joinedAt || 0,
  };

  const notes = arr(prefs, "trakey_notes", "notes_json").map((n) => ({
    id: n.id, title: n.title || "", content: n.content || "", createdAt: n.createdAt || n.id || 0,
    updatedAt: n.updatedAt || n.id || 0, pinned: !!n.pinned, folder: n.folder || "Personal",
  }));

  const tasks = arr(prefs, "trakey_tasks", "tasks_json").map((t) => ({
    id: t.id, title: t.title || "", description: t.description || "",
    dueAt: typeof t.dueAt === "number" && t.dueAt >= 0 ? t.dueAt : null,
    priority: t.priority || "Medium", category: t.category || "General", completed: !!t.completed,
  }));

  const goals = arr(prefs, "trakey_goals", "goals_json").map((g) => {
    const ms = (g.milestones || []).map((m) => ({ id: m.id, title: m.title || "", completed: !!m.completed }));
    return {
      id: g.id, title: g.title || "", description: g.description || "", target: g.target || "",
      deadline: typeof g.deadline === "number" ? g.deadline : null, status: g.status || "In Progress",
      favorite: !!g.favorite, milestones: ms,
      progress: ms.length ? ms.filter((m) => m.completed).length / ms.length : 0,
    };
  });

  const habits = arr(prefs, "trakey_habits", "habits_json").map((h) => {
    const base = { id: h.id, name: h.name || "", description: h.description || "",
      frequency: h.frequency || "Daily", streak: h.streak || 0, lastCompleted: h.lastCompleted || "" };
    return { ...base, ...habitState(base, now) };
  });

  const learn = prefs.trakey_learn_v2 || {};
  const learnNotes = arr(prefs, "trakey_learn_v2", "notes").map((n) => ({
    id: n.id, topic: n.topic || "", front: n.front || "", back: n.back || "" }));
  const learnSessions = arr(prefs, "trakey_learn_v2", "sessions").map((s) => ({
    topic: s.t || "", correct: s.c || 0, total: s.n || 0, at: s.at || 0 }));
  let learned = 0;
  if (Array.isArray(learn.learned)) learned = learn.learned.length;

  const challenges = arr(prefs, "trakey_challenge_v4", "history").map((r) => ({
    id: r.id, kind: r.kind || "challenge", title: r.title || "", at: r.at || 0, level: r.level || "",
    mode: r.mode || "", won: !!r.won, score: r.score || 0, max: r.max || 0, outOf: r.outOf || 0,
    seconds: r.sec || 0, exp: r.exp || 0, early: !!r.early,
    answers: (r.ans || []).map((a) => ({
      question: a.q?.q || "", options: a.q?.o || [], correct: a.q?.a || "", selected: a.sel || "",
      explanation: a.q?.e || "" })),
  })).sort((a, b) => b.at - a.at);

  const folders = arr(prefs, "trakey_questions_v2", "tests").map((t) => ({
    id: t.id, title: t.title || "", createdAt: t.createdAt || 0,
    topics: (t.topics || []).map((x) => ({ id: x.id, title: x.title || "" })),
    questions: (t.questions || []).map((q) => ({
      id: q.id,
      type: normalizeQuestionType(q.type),
      question: q.question || "",
      options: Array.isArray(q.options) ? q.options.map((o) => String(o ?? "")) : [],
      answer: q.answer || "", explanation: q.explanation || "",
      marks: q.marks > 0 ? q.marks : 1, topicId: q.topicId || null })),
  }));

  const game = {};
  for (const [k, v] of Object.entries(prefs.trakey_game || {})) {
    if (k.startsWith("best_") && typeof v === "number") game[k.slice(5)] = v;
  }

  const challengesRaw = arr(prefs, "trakey_challenge_v4", "history");

  return { profile, notes, tasks, goals, habits, learnNotes, learnSessions, learned,
    challenges, challengesRaw, folders, game };
}

// ---- Live sync documents written by the phone (TrakeySync): users/{uid}/backup/sync_{feature} ----
// Each document: { data: base64(gzip(JSON array)), updatedAt, by, count }

export const SYNC_SOURCES = {
  notes: ["trakey_notes", "notes_json", "notes"],
  goals: ["trakey_goals", "goals_json", "goals"],
  tasks: ["trakey_tasks", "tasks_json", "tasks"],
  questions: ["trakey_questions_v2", "tests", "folders"],
};

export function b64ToBytes(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export function bytesToB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/** base64(gzip(JSON array)) -> array */
export async function unpackSync(b64) {
  if (!b64) return [];
  const text = new TextDecoder().decode(await gunzip(b64ToBytes(b64)));
  try { const a = JSON.parse(text); return Array.isArray(a) ? a : []; } catch { return []; }
}

/** array -> base64(gzip(JSON)) */
export async function packSync(array) {
  const bytes = new TextEncoder().encode(JSON.stringify(array));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return bytesToB64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/** Raw array from the phone -> the normalized items the page shows. */
export function normalizeFeature(feature, rawArray) {
  const [file, key, out] = SYNC_SOURCES[feature];
  return buildModel({ [file]: { [key]: JSON.stringify(rawArray || []) } })[out];
}

/** Normalized backup items -> raw shape (used only when the phone has not synced that feature yet). */
export function toRaw(feature, items) {
  if (feature === "tasks") return items.map((t) => ({ ...t, dueAt: t.dueAt ?? -1 }));
  return items.map((x) => ({ ...x }));
}
