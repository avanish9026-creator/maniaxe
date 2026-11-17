// Trakey Web: the built-in question library that ships with the Trakey app (v5.0.1).
// Port of TrakeyFixedQuestions.kt. Read-only: it is never copied into the user's own folders or backup,
// it is only offered in Exam. Data files: library/trakey_questions.json (NTPC, RRB Group D, SSC),
// library/trakey_subjects.json (Maths, English, Reasoning, GS chapters), library/trakey_papers.json (Paper Set 1..20).
// To update: replace those three JSON files with the ones from the app's src/main/assets.

export const ID_PREFIX = "trakey_fx_";
const FILES = ["trakey_questions.json", "trakey_subjects.json", "trakey_papers.json"];
const BASE = new URL("./library/", import.meta.url);

const G_EXAM = 0, G_SUBJECT = 1, G_PAPER = 2;
const FREE_CHAPTERS = new Set([
  ID_PREFIX + "subj_maths_percentage", ID_PREFIX + "subj_english_synonyms",
  ID_PREFIX + "subj_reasoning_number_series", ID_PREFIX + "subj_gs_indian_states_and_capitals",
]);
const FREE_PAPER_SETS = new Set([1, 2]);

const pre = (id) => (String(id).startsWith(ID_PREFIX) ? String(id) : ID_PREFIX + id);

export function groupOf(folderId) {
  if (folderId.startsWith(ID_PREFIX + "subj_paper_set_")) return G_PAPER;
  if (folderId.startsWith(ID_PREFIX + "subj_")) return G_SUBJECT;
  return G_EXAM;
}

/** Same rule as the app: one free chapter per subject, Paper Set 1-2, NTPC and Group D stay free. */
export function isTopicFree(folderId, topicId) {
  switch (groupOf(folderId)) {
    case G_PAPER: return FREE_PAPER_SETS.has(parseInt(folderId.slice(folderId.lastIndexOf("_") + 1), 10) || 0);
    case G_SUBJECT: return FREE_CHAPTERS.has(topicId);
    default: return folderId.startsWith(ID_PREFIX + "ntpc_") || folderId.startsWith(ID_PREFIX + "group_d");
  }
}

/** Parsed into the same shape as the user's own folders in core.js, so Exam treats them alike. */
function parse(root) {
  return (root.folders || []).map((fo) => {
    const topics = [], questions = [];
    for (const to of fo.topics || []) {
      const tid = pre(to.id);
      topics.push({ id: tid, title: to.title || "" });
      (to.qs || []).forEach((row, i) => {
        const options = (row[1] || []).map(String);
        const answer = options[row[2]];
        if (answer === undefined) return;
        questions.push({ id: `${tid}_${i + 1}`, type: "MCQ", question: String(row[0] || ""), options, answer,
          explanation: "", marks: 1, topicId: tid });
      });
    }
    return { id: pre(fo.id), title: fo.title || "", createdAt: 0, topics, questions, library: true };
  });
}

let cache = null, pending = null;

/** Loads the three files once (about 3 MB, cached by the browser). Resolves to [] if they are missing. */
export function loadLibrary() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = Promise.all(FILES.map(async (name) => {
      try {
        const r = await fetch(new URL(name, BASE));
        if (!r.ok) throw new Error(String(r.status));
        return parse(await r.json());
      } catch (e) { console.error("library", name, e); return []; }
    })).then((parts) => (cache = parts.flat()));
  }
  return pending;
}

/** What this user may open: everything for Pro / trial, only the free part otherwise. */
export function forTier(all, pro) {
  if (pro) return all;
  return all.map((f) => {
    const topics = f.topics.filter((t) => isTopicFree(f.id, t.id));
    if (!topics.length) return null;
    const ids = new Set(topics.map((t) => t.id));
    return { ...f, topics, questions: f.questions.filter((q) => ids.has(q.topicId)) };
  }).filter(Boolean);
}

export const totalCount = (all) => all.reduce((n, f) => n + f.questions.length, 0);
