// Trakey Web: question importer (TXT / PDF / pasted text -> MCQ + True/False).
// A port of the importer in the Trakey app (Challenges > Questions > Import), so the same files give the same questions.
//  - answers are found from "Answer: B", "Ans. (b)", "Correct option is A", a bare answer line or an "Answer Key" list at the end
//  - options in any style: A. / A) / (a) / 1) / Option A, and several options on one line
//  - True/False as two lines, "A. True B. False" or "Answer: False"
//  - a question with options but no readable answer is kept as a DRAFT (blank answer) so you can tap the right option later
// (Coloured-answer detection from PDFs is app-only; those questions come in as drafts here.)

import { openPdf, pageLines } from "./pdfread.js";

const BOUNDARY = "\u0002";
const RE_ANS = /^(?:ans(?:wer)?|correct\s+(?:answer|option|ans)|right\s+answer|key)\s*(?:is\b)?\s*[:.\-–—=)]\s*(.+)$/i;
const RE_ANSW = /^(?:ans(?:wer)?|correct\s+(?:answer|option))\s+(?:is\s+)?(\(?[A-Ha-h1-9]\)?|true|false)\.?$/i;
const RE_TFLINE = /^(true|false)\.?$/i;
const RE_EXP = /^(?:explanation|expl|exp|solution|sol|reason|rationale)\b\s*[:.\-–—]\s*(.*)$/i;
const RE_QNUM = /^(?:Q(?:uestion)?\s*\.?\s*(\d{1,4})\s*[.):\-]?|(\d{1,4})\s*[.):\-])\s*(.+)$/i;
const RE_QWORD = /^(?:Question|Q)\s*[:.\-–—]\s*(.+)$/i;
const RE_LET = /^(?:\(\s*([A-Ha-h])\s*\)|([A-Ha-h])\s*[.):\-])\s*(.+)$/;
const RE_OPTWORD = /^option\s+([A-Ha-h]|\d)\s*[.):\-]?\s*(.+)$/i;
const RE_NUMOPT = /^(?:\(\s*(\d)\s*\)|(\d)\s*[.)])\s*(.+)$/;
const RE_INLINE = /(?:^|\s)(?:\(\s*([A-Ha-h])\s*\)|([A-Ha-h])\s*[.)])\s+/g;
const RE_MATCH = /\bmatch\s+the\s+column|\bmatching\s+column|\bcolumn\s*[-–]?\s*[iI1]\b/i;
const RE_PAGE = /^(?:page\s*\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?|\d{1,4}\s*(?:of|\/)\s*\d{1,4})$/i;
const RE_KEYHDR = /^(?:answer\s*key|answers?|solutions?|key)\s*[:\-–—]?\s*$/i;
const RE_KEYPAIR = /(?:Q\s*)?(\d{1,4})\s*[.\-:)–—]*\s*\(?([A-Ha-h]|true|false|t|f)\)?(?=\s|$|[,;.])/gi;
// Noise that coaching-site PDFs put between questions
const RE_NOISE = /^(?:test\s+(?:date|time)\b.*|test\s+cent(?:re|er)\s+name\b.*|\*\s*note\b.*|(?:in)?correct\s+answer\s+will\s+carry\b.*|\d\.\s*options\s+shown\s+in\s+green\b.*|\d\.\s*chosen\s+option\s+on\s+the\s+right\b.*|get\s+it\s+on(?:\s+google\s+play)?|download\s+(?:on\s+the\s+app\s+store|test\s+prime).*|adda\s*247.*|test\s*prime.*)$/i;
const RE_NOISE_SUBJECT = /^[Ss][Uu][Bb][Jj][Ee][Cc][Tt]\s+[A-Z]{2,6}\b.*$/;
// "...50°Q.53 The LCM..." : next question glued to the end of the previous line
const RE_GLUEQ = /(?<=\S)(?=Q\s*\.\s*\d{1,4}\s+\p{L})/u;
const RE_SECTION = /^section\s*:\s*.+$/i;
const RE_QBARE = /^Q(?:uestion)?\s*\.?\s*(\d{1,4})\s*[.):\-]?$/i;
const RE_RANGE = /^\d{1,4}\s*[-–]\s*\d/;
const RE_ANSPFX = /^ans(?:wer)?\s+(\(?[Aa][.)]\s*\S.*)$/i;
const RE_ANSTEXT = /^(?:ans(?:wer)?|correct\s+(?:answer|option|ans))\s+(?:is\s+)?(.{1,80})$/i;

const trimChars = (s, re) => s.replace(re, "");
const strip = (s) => s.replace(/^[. ]+|[. ]+$/g, "").toLowerCase();
const hasLetterOrDigit = (s) => /[\p{L}\p{N}]/u.test(s);

function tfOf(s) {
  const t = strip(String(s).trim());
  if (t === "t" || t === "true") return "True";
  if (t === "f" || t === "false") return "False";
  return null;
}

function splitInline(line, start) {
  const ms = [...line.matchAll(RE_INLINE)];
  if (ms.length < 2) return null;
  const res = [];
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const lab = (m[1] || m[2]).toUpperCase();
    if (lab !== String.fromCharCode(65 + start + i)) return null;
    const st = m.index + m[0].length;
    const en = i + 1 < ms.length ? ms[i + 1].index : line.length;
    const t = line.slice(st, en).trim();
    if (t) res.push(t);
  }
  return res.length === ms.length ? res : null;
}

function splitKey(lines) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) if (RE_KEYHDR.test(lines[i]) && i > lines.length * 0.3) idx = i;
  if (idx < 0) return [lines, {}];
  const key = {};
  for (const l of lines.slice(idx + 1)) for (const m of l.matchAll(RE_KEYPAIR)) key[Number(m[1])] = m[2];
  return Object.keys(key).length ? [lines.slice(0, idx), key] : [lines, {}];
}

/** "B", "(b)", "2", "Option C", "Delhi" (for "New Delhi") ... -> the matching option text, or null. */
function resolve(raw, opts) {
  const r = trimChars(raw.trim(), /^[.; ]+|[.; ]+$/g);
  const r2 = r.replace(/^option\s+/i, "").trim();
  let m = /^\(?([A-Ha-h])\)?$/.exec(r2);
  if (m) { const i = m[1].toUpperCase().charCodeAt(0) - 65; if (i >= 0 && i < opts.length) return opts[i]; }
  m = /^\(?(\d)\)?$/.exec(r2);
  if (m) { const i = Number(m[1]); if (i >= 1 && i <= opts.length) return opts[i - 1]; }
  m = /^\(?([A-Ha-h])[.)]\s*(.+)$/.exec(r2);
  if (m) { const i = m[1].toUpperCase().charCodeAt(0) - 65; if (i >= 0 && i < opts.length) return opts[i]; }
  m = /^\(?(\d)[.)]\s*(.+)$/.exec(r2);
  if (m) { const i = Number(m[1]); if (i >= 1 && i <= opts.length) return opts[i - 1]; }
  const norm = strip(r2);
  let hit = opts.find((o) => strip(o) === norm);
  if (hit !== undefined) return hit;
  const tf = tfOf(r2);
  if (tf) { hit = opts.find((o) => o.toLowerCase() === tf.toLowerCase()); if (hit !== undefined) return hit; }
  if (norm.length >= 2) {
    const cands = opts.filter((o) => { const x = strip(o); return x.startsWith(norm) || norm.startsWith(x) || x.includes(norm); });
    if (cands.length === 1) return cands[0];
  }
  return null;
}

/** text -> { items: [{ type, question, options, answer, explanation }], leftover: [lines that were not understood] } */
export function parseQuestions(text) {
  const lines = [];
  for (const raw of String(text).replace(/\r\n?/g, "\n").split("\n")) {
    const clean = raw.replace(/[\u00A0\uFEFF\t]/g, " ").replace(/\s+/g, " ").trim();
    for (const seg of clean.split(RE_GLUEQ)) {
      const c = seg.trim();
      if (!c || RE_PAGE.test(c)) continue;
      if (RE_NOISE.test(c) || RE_NOISE_SUBJECT.test(c)) continue;
      if (RE_SECTION.test(c)) { lines.push(BOUNDARY); continue; }
      if (/^ans\.?$/i.test(c)) continue;
      if (c.length <= 2 && !hasLetterOrDigit(c)) continue;
      lines.push(c);
    }
  }
  const [body, key] = splitKey(lines);
  const items = [];
  const left = [];
  let blk = null;
  let lastQ = 0;

  const finish = () => {
    const b = blk;
    if (!b) return;
    blk = null;
    const q = b.q.trim().replace(/(?<=\?)\d{4,6}$/, "");
    if (q.length < 3) return;                       // question text is an image/formula - cannot be read
    if (RE_MATCH.test(q) || b.opts.some((o) => RE_MATCH.test(o))) { left.push(q); return; }
    const opts = b.opts.slice();
    if (opts.length >= 2) {
      let ans = null;
      if (b.ans.trim()) ans = resolve(b.ans, opts);
      if (ans === null && key[b.num] !== undefined) ans = resolve(key[b.num], opts);
      const isTf = opts.length === 2 && opts.map((o) => strip(o)).sort().join("|") === "false|true";
      if (ans === null) {
        // No usable answer: keep it as a DRAFT so the answer can be picked later.
        items.push(isTf ? { type: "TRUE_FALSE", question: q, options: ["True", "False"], answer: "", explanation: b.exp.trim() }
          : { type: "MCQ", question: q, options: opts, answer: "", explanation: b.exp.trim() });
        return;
      }
      items.push(isTf ? { type: "TRUE_FALSE", question: q, options: ["True", "False"], answer: tfOf(ans) || ans, explanation: b.exp.trim() }
        : { type: "MCQ", question: q, options: opts, answer: ans, explanation: b.exp.trim() });
    } else {
      const a = b.ans.trim() || key[b.num] || "";
      const tf = tfOf(a);
      if (tf) items.push({ type: "TRUE_FALSE", question: q, options: ["True", "False"], answer: tf, explanation: b.exp.trim() });
      else left.push(q);
    }
  };
  const startNew = (num, q) => { finish(); blk = { num, q, opts: [], ans: "", exp: "", sec: "q" }; if (num > 0) lastQ = num; };

  for (let i = 0; i < body.length; i++) {
    if (body[i] === BOUNDARY) { finish(); continue; }
    const cur = blk;
    // "Ans A. text" is the FIRST OPTION when no options were read yet; once options exist it is an answer line.
    const pfx = RE_ANSPFX.exec(body[i]);
    const l = (!cur || cur.opts.length === 0) ? (pfx ? pfx[1] : body[i]) : body[i];
    if (cur) {
      const mExp = RE_EXP.exec(l);
      if (mExp) { cur.exp = mExp[1]; cur.sec = "e"; continue; }
      const mAns = RE_ANS.exec(l) || RE_ANSW.exec(l);
      if (mAns && mAns[1].length <= 90) { cur.ans = mAns[1]; cur.sec = "a"; continue; }
      if (!mAns && cur.opts.length >= 2 && cur.sec === "o") {
        const mt = RE_ANSTEXT.exec(l);
        if (mt && resolve(mt[1], cur.opts) !== null) { cur.ans = mt[1]; cur.sec = "a"; continue; }
      }
      if (cur.sec === "q" || cur.sec === "o") {
        const inl = splitInline(l, cur.opts.length);
        if (inl) { cur.opts.push(...inl); cur.sec = "o"; continue; }
        let lab = -1, txt = "";
        let m = RE_LET.exec(l);
        if (m) { lab = (m[1] || m[2]).toUpperCase().charCodeAt(0) - 65; txt = m[3]; }
        if (lab < 0) {
          m = RE_OPTWORD.exec(l);
          if (m) { const s = m[1].toUpperCase(); lab = /\d/.test(s[0]) ? Number(s) - 1 : s.charCodeAt(0) - 65; txt = m[2]; }
        }
        if (lab >= 0 && lab === cur.opts.length) { cur.opts.push(txt); cur.sec = "o"; continue; }
        const mn = RE_NUMOPT.exec(l);
        if (mn) {
          const nn = Number(mn[1] || mn[2]);
          if (nn === cur.opts.length + 1 && !(nn === lastQ + 1 && l.trimEnd().endsWith("?"))) { cur.opts.push(mn[3]); cur.sec = "o"; continue; }
        }
        if (RE_TFLINE.test(l) && cur.opts.length < 2) {
          const t = l.replace(/\.$/, "").toLowerCase();
          cur.opts.push(t[0].toUpperCase() + t.slice(1)); cur.sec = "o"; continue;
        }
      }
    }
    // "Q.26" alone: the question text was an image. Start an empty block so its options are swallowed.
    const mb = RE_QBARE.exec(l);
    if (mb) { startNew(Number(mb[1]), ""); continue; }
    const mq = RE_QNUM.exec(l);
    if (mq && !RE_RANGE.test(l)) { startNew(Number(mq[1] || mq[2]), mq[3]); continue; }
    const mw = RE_QWORD.exec(l);
    if (mw && (!cur || cur.opts.length > 0 || cur.sec !== "q" || cur.q.trim() === "")) { startNew(0, mw[1]); continue; }
    if (!cur) {
      const nxt0 = body[i + 1] || "";
      const p2 = RE_ANSPFX.exec(nxt0);
      const nxt = p2 ? p2[1] : nxt0;
      if (l.endsWith("?") || RE_LET.test(nxt) || splitInline(nxt, 0) !== null || RE_NUMOPT.test(nxt)) { startNew(0, l); continue; }
      left.push(l);
    } else {
      const maybeNew = (cur.opts.length > 0 && cur.ans.trim()) || (cur.sec === "o" && l.endsWith("?")) || cur.sec === "a" || cur.sec === "e";
      if (maybeNew && (l.endsWith("?") || l.endsWith(":") || cur.sec === "a" || cur.sec === "e")) {
        if (cur.sec === "e" && !l.endsWith("?")) { cur.exp += " " + l; continue; }
        startNew(0, l); continue;
      }
      if (cur.sec === "q") cur.q += " " + l;
      else if (cur.sec === "o") { if (cur.opts.length) cur.opts[cur.opts.length - 1] += " " + l; }
      else if (cur.sec === "e") cur.exp += " " + l;
      else left.push(l);
    }
  }
  finish();
  const seen = new Set();
  const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return {
    items: items.filter((it) => { const k = norm(it.question); if (seen.has(k)) return false; seen.add(k); return true; }),
    leftover: left.filter((l) => hasLetterOrDigit(l) && !(l.length <= 12 && l.replace(/[A-Ha-h.\s]/g, "") === "")),
  };
}

/** All text of a PDF, one line per visual line. Scanned PDFs (no text layer) return "". */
export async function pdfToText(file, onProgress = () => {}) {
  const pdf = await openPdf(file);
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    out.push((await pageLines(await pdf.getPage(i))).join("\n"));
    onProgress(Math.round((i / pdf.numPages) * 100));
  }
  return out.join("\n");
}

/** File name without extension, used as the folder name. */
export const nameFromFile = (name) => String(name || "").replace(/\.[^.]+$/, "").replace(/_/g, " ").trim() || "Imported";

export const normQ = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
