// Trakey Web: Scan with AI (Learn). A port of the app's scan (TrakeyLearnScan.kt):
// photos / PDF / TXT -> Gemini reads the pages and writes front/back cards -> you review -> save into Learn.
// Pages are sent straight from this browser to Google's Gemini API with YOUR key. Nothing is stored by Trakey.

import { openPdf, pageLines, renderPageJpeg } from "./pdfread.js";

export const SCAN_MAX_PAGES = 12;
export const SCAN_MODEL = "gemini-3.1-flash-lite";   // keep the same as AI_MODEL in the app (MainActivity.kt)
const MAX_TEXT_CHARS = 60000;
const SUBJECTS = ["maths", "english", "gk", "science", "reasoning", "computer", "notes"];
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "_" + Math.random().toString(16).slice(2));
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  if (signal) signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Cancelled", "AbortError")); }, { once: true });
});

// ---------------------------------------------------------------- reading the source

/** A photo -> JPEG base64, longest side 1800 px, rotated upright. */
async function imageToJpeg(file, maxEdge = 1800) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close && bmp.close();
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/** Text PDFs are read for free; pages without a text layer (scans, photos) are drawn to images. */
async function readPdf(file) {
  const pdf = await openPdf(file);
  const total = Math.min(pdf.numPages, SCAN_MAX_PAGES);
  const pages = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const text = (await pageLines(page)).join("\n").trim();
    if (text.length >= 200) pages.push({ label: `Page ${i}`, text, image: null });
    else pages.push({ label: `Page ${i}`, text: null, image: await renderPageJpeg(page, 1800) });
  }
  return { pages, truncated: pdf.numPages > SCAN_MAX_PAGES };
}

async function readText(file) {
  const raw = (await file.text()).trim();
  if (!raw) throw new Error("This file has no text.");
  const truncated = raw.length > MAX_TEXT_CHARS;
  const text = raw.slice(0, MAX_TEXT_CHARS);
  const pages = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + 6000);
    if (end < text.length) { const nl = text.lastIndexOf("\n", end); if (nl > start + 2000) end = nl; }
    pages.push({ label: `Part ${pages.length + 1}`, text: text.slice(start, end).trim(), image: null });
    start = end;
  }
  return { pages, truncated };
}

/** Groups pages into requests: up to 3 images, or about 7000 characters of text, per request. */
function batchesOf(pages) {
  const out = [];
  let cur = [], chars = 0;
  for (const p of pages) {
    const isText = p.text != null;
    const curIsText = cur.length && cur[0].text != null;
    const full = isText ? chars + p.text.length > 7000 : cur.length >= 3;
    if (cur.length && (isText !== curIsText || full)) { out.push(cur); cur = []; chars = 0; }
    cur.push(p);
    if (isText) chars += p.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

// ---------------------------------------------------------------- asking Gemini

function promptFor(batch, detailed) {
  const coverage = detailed
    ? "Coverage: make a card for every distinct, testable fact (roughly 20 to 40 cards for a dense page)."
    : "Coverage: make cards only for the most important, exam-worthy facts (roughly 8 to 15 cards for a dense page).";
  const labels = batch.map((p) => p.label).join(", ");
  const isText = batch[0] && batch[0].text != null;
  const body = isText
    ? "SOURCE TEXT:\n" + batch.map((p) => `[${p.label}]\n${p.text}`).join("\n\n")
    : `The attached images are, in order: ${labels}.`;
  return `
You are the study-card writer inside the Trakey app. The material below is a student's study material. Turn it into flashcards: each card has a FRONT (a clear question or prompt) and a BACK (the answer).

Return ONLY valid JSON, no markdown, in exactly this shape:
{"subject":"<one of: maths, english, gk, science, reasoning, computer, notes>","cards":[{"topic":"<heading>","front":"...","back":"...","source":"<page label>","flag":""}]}

Rules:
1. If the source already has questions with answers, use them as they are. If it is plain notes, turn each important fact into a question (front) and a short answer (back).
2. Use ONLY facts written in the source. Never add facts from your own knowledge.
3. Every front must make sense on its own. Name what is being asked about; never write "What is it?".
4. Keep backs short: the answer first, plus at most one short detail from the source (a year, place, value) when it matters.
5. Keep the source language (English, Hindi or mixed). Do not translate.
6. "topic" is the nearest heading on the page, 2 to 5 words. Use the exact same topic text for all cards under the same heading.
7. Skip advertisements, page numbers, headers, footers, publisher names, and diagram labels that have no explanation.
8. Copy names, numbers, dates and formulas exactly. Write subscripts and superscripts as Unicode characters (H₂SO₄, Na₂ZnO₂, x²).
9. For a mnemonic or trick, make the mnemonic the front and what it stands for the back.
10. For tables, make one card per row or relationship when it can be asked clearly.
11. If a fact in the source looks wrong, still write the card exactly as the source says it and put a short note in "flag" (for example: "Source says silver; usually reported as bronze"). Otherwise "flag" is an empty string.
12. If a part of an image is unreadable or blurry, skip it. Do not guess.
13. "source" is the page label the card came from.
${coverage}

${body}
`.trim();
}

async function callGemini(key, prompt, images, signal) {
  if (!key) throw new Error("Add your Gemini API key first.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${SCAN_MODEL}:generateContent`;
  let lastError = new Error("The scan request failed.");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const parts = [{ text: prompt }, ...images.map((d) => ({ inline_data: { mime_type: "image/jpeg", data: d } }))];
      const res = await fetch(url, {
        method: "POST", signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "low" } },
        }),
      });
      const raw = await res.text();
      if (res.ok) {
        const json = JSON.parse(raw);
        const outParts = json?.candidates?.[0]?.content?.parts || [];
        const text = outParts.map((p) => p.text || "").join("").trim();
        if (text) return text;
        lastError = new Error("The AI could not read this page.");
      } else {
        let detail = "";
        try { detail = JSON.parse(raw)?.error?.message || ""; } catch { /* ignore */ }
        lastError = new Error(res.status === 429
          ? "Gemini is busy right now. Wait a minute and try again."
          : detail ? `AI error (${res.status}): ${detail.slice(0, 140)}` : `AI error (${res.status}).`);
        if (![429, 500, 502, 503, 504].includes(res.status)) throw lastError;
      }
    } catch (e) {
      if (e.name === "AbortError") throw e;
      if (e === lastError) throw e;
      lastError = new Error(e.message || "Connection failed.");
    }
    if (attempt < 2) await sleep(1500 * (attempt + 1), signal);
  }
  throw lastError;
}

function parseCards(text) {
  let clean = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let obj;
  try { obj = JSON.parse(clean); } catch {
    // The answer was cut off: keep every card that was completed.
    const cut = clean.lastIndexOf("}");
    if (cut < 0) return { subject: "notes", cards: [] };
    try { obj = JSON.parse(clean.slice(0, cut + 1) + "]}"); } catch { return { subject: "notes", cards: [] }; }
  }
  const s = String(obj.subject || "notes").trim().toLowerCase();
  const subject = SUBJECTS.includes(s) ? s : "notes";
  const cards = [];
  for (const o of Array.isArray(obj.cards) ? obj.cards : []) {
    const front = String(o?.front || "").trim().slice(0, 300);
    const back = String(o?.back || "").trim().slice(0, 600);
    if (!front || !back) continue;
    cards.push({
      id: "s_" + uid(), front, back,
      topic: String(o.topic || "").trim().slice(0, 60) || "Scanned notes",
      source: String(o.source || "").trim().slice(0, 30),
      flag: String(o.flag || "").trim().slice(0, 160),
    });
  }
  return { subject, cards };
}

// ---------------------------------------------------------------- the whole scan

/**
 * { images: File[], file: File|null, detailed, knownFronts: string[], key, signal, onProgress(percent, message, found) }
 * -> { cards, subject, failedBatches, totalBatches, duplicates, truncated, error }
 * Progress: 0-20 reading the pages, 20-97 AI reading, 97-100 finishing.
 */
export async function runScan({ images, file, detailed, knownFronts, key, signal, onProgress }) {
  onProgress(2, "Opening your pages…", 0);
  let pages = [], truncated = false;
  if (file) {
    onProgress(6, "Reading the file…", 0);
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
    const r = isPdf ? await readPdf(file) : await readText(file);
    pages = r.pages; truncated = r.truncated;
  } else {
    const list = images.slice(0, SCAN_MAX_PAGES);
    truncated = images.length > SCAN_MAX_PAGES;
    for (let i = 0; i < list.length; i++) {
      onProgress(3 + Math.floor((17 * i) / Math.max(1, list.length)), `Preparing page ${i + 1} of ${list.length}…`, 0);
      try { pages.push({ label: `Page ${i + 1}`, text: null, image: await imageToJpeg(list[i]) }); } catch { /* unreadable image: skipped */ }
    }
  }
  if (!pages.length) throw new Error("Nothing readable was found in these pages.");
  onProgress(20, "Starting AI…", 0);

  const batches = batchesOf(pages);
  const cards = [];
  const votes = {};
  const seen = new Set((knownFronts || []).map(norm));
  let duplicates = 0, failed = 0, lastError = "", pagesDone = 0;
  const span = 77;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const from = 20 + Math.floor((span * bi) / batches.length);
    const to = 20 + Math.floor((span * (bi + 1)) / batches.length) - 1;
    const stage = `Reading pages ${pagesDone + 1}–${pagesDone + batch.length} of ${pages.length}…`;
    onProgress(from, stage, cards.length);
    // creep the percentage up while the request runs, so the ring never looks frozen
    let p = from;
    const creeper = setInterval(() => { if (p < Math.max(from, to)) { p++; onProgress(p, stage, cards.length); } }, 900);
    try {
      const text = await callGemini(key, promptFor(batch, detailed), batch.filter((x) => x.image).map((x) => x.image), signal);
      const { subject, cards: parsed } = parseCards(text);
      if (!parsed.length) failed++;
      else {
        votes[subject] = (votes[subject] || 0) + parsed.length;
        for (const c of parsed) { if (seen.has(norm(c.front))) duplicates++; else { seen.add(norm(c.front)); cards.push(c); } }
      }
    } catch (e) {
      if (e.name === "AbortError") throw e;
      failed++; lastError = e.message || "";
      if (/API key|AI error \(40[013]\)/i.test(lastError)) break;   // a bad key will fail every batch
    } finally { clearInterval(creeper); }
    pagesDone += batch.length;
    onProgress(Math.min(97, to + 1), stage, cards.length);
  }
  onProgress(98, "Checking cards…", cards.length);
  const subject = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || "notes";
  return { cards, subject, failedBatches: failed, totalBatches: batches.length, duplicates, truncated, error: lastError };
}
