// Trakey Web: Exam. Same rules as the Exam in the Trakey app (Challenges tab > Exam).
// Pure logic + HTML builders + the full-screen runner. No Firebase in here.

export const NEG_VALUES = [1, 0.5, 1 / 3, 0.25];
export const NEG_LABELS = ["1", "1/2", "1/3", "1/4"];

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

// ---------------------------------------------------------------- questions

export function usable(q) {
  const type = String(q.type || "MCQ").trim().toUpperCase().replace(/[ -]/g, "_");
  const isTF = type === "TRUE_FALSE" || type === "TRUEFALSE" || type === "TRUE_OR_FALSE";
  const isMCQ = type === "MCQ" || type === "MULTIPLE_CHOICE";
  return (isMCQ || isTF) && String(q.question || "").trim() !== "" &&
    String(q.answer || "").trim() !== "" && (isTF || (Array.isArray(q.options) && q.options.length >= 2));
}

/** The answer may be stored as the option text or as a letter like "B" or "(b)". */
export function fixAnswer(options, answer) {
  const a = String(answer).trim();
  const hit = options.find((o) => same(o, a));
  if (hit !== undefined) return hit;
  const m = /^\(?([A-Ha-h])\)?[.)]?$/.exec(a);
  if (m) { const o = options[m[1].toUpperCase().charCodeAt(0) - 65]; if (o !== undefined) return o; }
  return a;
}

export function toQ(q, source) {
  const opts = q.type === "TRUE_FALSE" ? ["True", "False"] : q.options;
  return { id: q.id, type: q.type, question: q.question.trim(), options: opts, answer: fixAnswer(opts, q.answer),
    explanation: q.explanation || "", marks: q.marks > 0 ? q.marks : 1, source };
}

/** topicSel: { folderId: [topicId or ""] }; a folder missing from it means "all topics". */
export function buildPool(folders, selectedIds, topicSel = {}) {
  const out = [];
  for (const f of folders) {
    if (!selectedIds.includes(f.id)) continue;
    const only = topicSel[f.id];
    for (const q of f.questions) {
      if (usable(q) && (!only || only.includes(q.topicId || ""))) out.push(toQ(q, f.title));
    }
  }
  return out;
}

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const topicIds = (f) => (f.questions.some((q) => !q.topicId) ? [""] : []).concat(f.topics.map((t) => t.id));

// ---------------------------------------------------------------- formatting

export const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const p = (n) => String(n).padStart(2, "0");
  return s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${Math.floor(s / 60)}:${p(s % 60)}`;
};
export const marksText = (v) => (Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(2)));
const letter = (i) => String.fromCharCode(65 + i);

// ---------------------------------------------------------------- records (same JSON as the app's history)

/** answers: [{ q, selected, seconds }]  ->  record */
export function buildRecord(run, answers, seconds, early) {
  let score = 0, max = 0;
  for (const a of answers) {
    max += a.q.marks;
    const skipped = !a.selected.trim();
    const correct = !skipped && same(a.selected, a.q.answer);
    if (correct) score += a.q.marks; else if (!skipped) score -= a.q.marks * run.negative;
  }
  const correct = answers.filter((a) => a.selected.trim() && same(a.selected, a.q.answer)).length;
  const pct = max <= 0 ? 0 : Math.round((score / max) * 100);
  const exp = Math.max(0, correct * 2 + Math.floor(Math.max(0, pct) / 10));
  return {
    id: "r_" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "_" + Math.random().toString(16).slice(2)),
    kind: "exam", title: run.title, at: Date.now(), level: "", mode: "", src: run.src, target: 0, outOf: run.questions.length,
    won: false, score, max, neg: run.negative, sec: seconds, exp, prev: run.prevPct, early,
    ans: answers.map((a) => ({
      q: { id: a.q.id, t: a.q.type, q: a.q.question, o: a.q.options, a: a.q.answer, e: a.q.explanation, m: a.q.marks, s: a.q.source },
      sel: a.selected, sec: a.seconds })),
  };
}

/** Derived numbers for a stored record. */
export function view(rec) {
  const answers = (rec.ans || []).map((x) => ({
    question: x.q?.q || "", options: x.q?.o || [], answer: x.q?.a || "", explanation: x.q?.e || "",
    marks: x.q?.m > 0 ? x.q.m : 1, selected: x.sel || "", seconds: x.sec || 0 }));
  for (const a of answers) {
    a.skipped = !a.selected.trim();
    a.correct = !a.skipped && same(a.selected, a.answer);
  }
  const total = answers.length, correct = answers.filter((a) => a.correct).length, skipped = answers.filter((a) => a.skipped).length;
  const wrong = total - correct - skipped, attempted = correct + wrong;
  const max = rec.max || 0, score = rec.score || 0;
  return { answers, total, correct, skipped, wrong, attempted,
    accuracy: attempted === 0 ? 0 : Math.floor((correct * 100) / attempted),
    scorePct: max <= 0 ? 0 : Math.max(-100, Math.min(100, Math.round((score / max) * 100))) };
}

export function stats(records) {
  const v = records.map(view);
  const correct = v.reduce((n, x) => n + x.correct, 0), attempted = v.reduce((n, x) => n + x.attempted, 0);
  return {
    attempts: records.length,
    avgScore: records.length ? Math.max(0, Math.round(v.reduce((n, x) => n + x.scorePct, 0) / records.length)) : 0,
    accuracy: attempted ? Math.floor((correct * 100) / attempted) : 0,
    seconds: records.reduce((n, r) => n + (r.sec || 0), 0),
    exp: Math.max(0, records.reduce((n, r) => n + (r.exp || 0), 0)),
  };
}

// ---------------------------------------------------------------- HTML builders

export function statsHTML(records) {
  const s = stats(records);
  const c = (b, l) => `<div class="card stat"><b>${b}</b><span>${l}</span></div>`;
  return `<div class="grid" style="margin-bottom:20px">${c(s.attempts, "exams taken")}${c(s.avgScore + "%", "average score")}${c(s.accuracy + "%", "accuracy")}${c(clock(s.seconds), "time spent")}${c(s.exp, "exp")}</div>`;
}

export function setupHTML(ex, folders, esc) {
  const usableCount = (f) => f.questions.filter(usable).length;
  const rows = folders.map((f) => {
    const n = usableCount(f), on = ex.sel.includes(f.id);
    const count = on ? buildPool(folders, [f.id], ex.topicSel).length : n;
    const ids = topicIds(f);
    const cur = ex.topicSel[f.id] || ids;
    const topics = on && ex.openTopics === f.id && f.topics.length
      ? `<div style="margin-top:10px">${ids.map((id) => `<button class="chip ${cur.includes(id) ? "on" : ""}" data-ex="topic" data-id="${esc(f.id)}" data-topic="${esc(id)}">${esc(id === "" ? "General" : f.topics.find((t) => t.id === id)?.title || "Topic")}</button>`).join("")}</div>` : "";
    return `<div class="card exfolder ${on ? "on" : ""} ${n === 0 ? "off" : ""}" data-ex="folder" data-id="${esc(f.id)}" role="button" tabindex="0" aria-pressed="${on}">
      <div class="row">
      <button type="button" class="exck ${on ? "on" : ""}" data-ex="folder" data-id="${esc(f.id)}">${on ? "✓" : "📁"}</button>
      <div class="grow"><div class="t">${esc(f.title)}</div><div class="m">${n} usable question${n === 1 ? "" : "s"}${n === 0 ? " · not exam-ready yet" : ""}</div></div>
      <b style="color:${on ? "var(--blue)" : "var(--sub)"}">${count}</b>
      ${on && f.topics.length ? `<button type="button" class="mini" data-ex="topics" data-id="${esc(f.id)}">Topics</button>` : ""}</div>${topics}</div>`;
  }).join("");

  const sw = (key, label, on) => `<label class="exsw"><span>${label}</span><input type="checkbox" data-ex="sw" data-key="${key}" ${on ? "checked" : ""}></label>`;
  const num = (key, val, min, max, unit) => `<div class="exnum"><input type="number" min="${min}" max="${max}" value="${val}" data-exn="${key}"> <span class="m">${unit}</span></div>`;
  const pool = buildPool(folders, ex.sel, ex.topicSel);
  const effective = ex.qLimit ? Math.min(ex.qCount, pool.length) : pool.length;

  return `${folders.some((f) => usableCount(f) > 0) ? "" : '<div class="empty">No exam-ready questions yet.<br>Add questions with answers in the app (Challenges > Questions) and open this page again after the phone has synced.</div>'}
    <div class="list">${rows}</div>
    <div class="card" style="margin-top:14px">
      ${sw("qLimit", "Limit questions", ex.qLimit)}${ex.qLimit ? num("qCount", ex.qCount, 1, 500, "questions") : ""}
      ${sw("tLimit", "Time limit", ex.tLimit)}${ex.tLimit ? num("minutes", ex.minutes, 1, 600, "min") : ""}
      ${sw("perQ", "Time per question", ex.perQ)}${ex.perQ ? num("perQSec", ex.perQSec, 5, 600, "sec") : ""}
      ${sw("neg", "Negative marking", ex.neg)}${ex.neg ? `<div class="seg" style="margin:8px 0 12px">${NEG_LABELS.map((l, i) => `<button class="segb ${ex.negIdx === i ? "on" : ""}" data-ex="neg" data-i="${i}">${l}</button>`).join("")}</div>` : ""}
      ${sw("shuffle", "Shuffle questions", ex.shuffle)}
    </div>
    <div style="margin-top:16px"><button class="btn" id="exstart" data-ex="start" ${pool.length ? "" : "disabled"} style="width:100%;padding:14px">Start · ${effective}</button></div>`;
}

export function historyHTML(records, esc, fmtDT) {
  if (!records.length) return "";
  const list = records.slice().sort((a, b) => b.at - a.at).slice(0, 30);
  return `<h3 style="margin:28px 0 10px">Recent exams</h3><div class="list">${list.map((r) => {
    const v = view(r);
    return `<button class="card row" style="text-align:left;color:inherit;width:100%" data-ex="open" data-id="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.title)}</div><div class="m">${esc(fmtDT(r.at))} · ${v.correct}/${v.total} right · ${clock(r.sec || 0)}${r.early ? " · ended early" : ""}</div></div><b style="color:${v.scorePct >= 50 ? "var(--ok)" : "var(--bad)"}">${Math.max(0, v.scorePct)}%</b></button>`;
  }).join("")}</div>`;
}

export function resultHTML(rec, filter, esc, fmtDT, canDelete) {
  const v = view(rec);
  const delta = rec.prev >= 0 ? v.scorePct - rec.prev : null;
  const penalty = v.answers.filter((a) => !a.correct && !a.skipped).reduce((n, a) => n + a.marks * (rec.neg || 0), 0);
  const shown = v.answers.map((a, i) => ({ a, i })).filter(({ a }) => filter === 1 ? !a.correct && !a.skipped : filter === 2 ? a.correct : filter === 3 ? a.skipped : true);
  const pctBar = (n) => (v.total ? (n / v.total) * 100 : 0);
  const mini = (b, l, c) => `<div class="card stat"><b style="font-size:26px;${c ? "color:" + c : ""}">${b}</b><span>${l}</span></div>`;
  return `<div class="top"><div><button class="chip" data-ex="back">← Back to Exam</button><h2 style="margin-top:8px">${esc(rec.title)}</h2><p class="sub">${esc(fmtDT(rec.at))}${rec.early ? " · ended early" : ""}</p></div>
      <div class="btnrow" style="margin:0"><button class="mini" data-ex="retake" data-id="${esc(rec.id)}">Retake</button><button class="mini" data-ex="print">Print</button>${canDelete ? `<button class="mini danger" data-ex="delete" data-id="${esc(rec.id)}">Delete</button>` : ""}</div></div>
    <div class="card" style="padding:24px">
      <div class="row" style="justify-content:space-between"><span class="m">Exam</span>${rec.exp > 0 ? `<b style="color:var(--blue)">+${rec.exp} EXP</b>` : ""}</div>
      <div style="font-size:46px;font-weight:800;line-height:1.1;margin-top:8px">${marksText(rec.score)}/${marksText(rec.max)}</div>
      <div class="row" style="margin-top:4px"><span style="font-size:20px;color:var(--sub)">${Math.max(0, v.scorePct)}%</span>${delta === null ? "" : `<span class="pill ${delta >= 0 ? "ok" : "bad"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}%</span>`}</div>
      <div style="display:flex;height:10px;border-radius:9px;overflow:hidden;background:var(--elev);margin-top:18px"><i style="width:${pctBar(v.correct)}%;background:var(--ok)"></i><i style="width:${pctBar(v.wrong)}%;background:var(--bad)"></i><i style="width:${pctBar(v.skipped)}%;background:var(--line)"></i></div>
    </div>
    <div class="grid" style="margin-top:14px">${mini(v.accuracy + "%", "Accuracy")}${mini(clock(rec.sec || 0), "Time")}${mini(v.correct, "Right", "var(--ok)")}${mini(v.wrong, "Wrong", "var(--bad)")}${mini(v.skipped, "Skipped")}${mini(Math.floor((rec.sec || 0) / Math.max(1, v.attempted)) + "s", "Per answer")}${rec.neg > 0 ? mini("−" + marksText(penalty), "Penalty", "var(--bad)") : mini(v.total, "Questions")}</div>
    <div style="margin:18px 0 10px">${[`All ${v.total}`, `Wrong ${v.wrong}`, `Right ${v.correct}`].concat(v.skipped ? [`Skipped ${v.skipped}`] : []).map((l, i) => `<button class="chip ${filter === i ? "on" : ""}" data-ex="filter" data-i="${i}">${l}</button>`).join("")}</div>
    <div class="list">${shown.map(({ a, i }) => {
      const c = a.correct ? "var(--ok)" : a.skipped ? "var(--sub)" : "var(--bad)";
      const m = a.correct ? a.marks : a.skipped ? 0 : -a.marks * (rec.neg || 0);
      return `<div class="card"><div class="row" style="align-items:flex-start"><div class="exmark" style="background:color-mix(in srgb,${c} 16%,transparent);color:${c}">${a.correct ? "✓" : a.skipped ? "–" : "✕"}</div>
        <div class="grow"><div class="t">${i + 1}. ${esc(a.question)}</div>
        ${!a.correct && !a.skipped ? `<div style="color:var(--bad);margin-top:8px">${esc(a.selected)}</div>` : ""}
        <div style="color:var(--ok);margin-top:4px">${esc(a.answer)}</div>
        ${a.explanation ? `<div class="m" style="margin-top:8px">${esc(a.explanation)}</div>` : ""}
        <div class="m" style="margin-top:8px">${a.seconds}s · <b style="color:${m > 0 ? "var(--ok)" : m < 0 ? "var(--bad)" : "var(--sub)"}">${m > 0 ? "+" : ""}${marksText(m)}</b></div></div></div></div>`;
    }).join("") || '<div class="empty">Nothing here.</div>'}</div>`;
}

// ---------------------------------------------------------------- runner (full screen)

/**
 * run = { title, questions, perQ, totalSec, negative, allowPause, allowBack, src, prevPct }
 * done(answers, seconds, endedEarly) is called once, when the exam ends.
 */
export function runExam(run, host, esc, done) {
  const n = run.questions.length;
  const sel = Array(n).fill(""), spent = Array(n).fill(0);
  let index = 0, elapsed = 0, paused = false, confirming = false, finished = false;
  const running = () => !paused && !confirming && !finished;

  function finish(early) {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("beforeunload", onUnload);
    host.classList.add("hide");
    host.innerHTML = "";
    done(run.questions.map((q, i) => ({ q, selected: sel[i], seconds: spent[i] })), elapsed, early);
  }
  function next() { if (index < n - 1) { index++; draw(); } else finish(false); }
  function prev() { if (run.allowBack && index > 0) { index--; draw(); } }

  const timeLabel = () => {
    if (run.perQ > 0 && run.totalSec > 0) return clock(run.perQ - spent[index]) + " · " + clock(run.totalSec - elapsed);
    if (run.perQ > 0) return clock(run.perQ - spent[index]);
    if (run.totalSec > 0) return clock(run.totalSec - elapsed);
    return clock(elapsed);
  };
  const urgent = () => (run.perQ > 0 && run.perQ - spent[index] <= 5) || (run.perQ === 0 && run.totalSec > 0 && run.totalSec - elapsed <= 30);
  function tick() {
    const el = host.querySelector("#rtime");
    if (el) { el.textContent = timeLabel(); el.classList.toggle("urgent", urgent()); }
  }

  const timer = setInterval(() => {
    if (!running()) return;
    elapsed++; spent[index]++;
    if (run.totalSec > 0 && elapsed >= run.totalSec) { finish(false); return; }
    if (run.perQ > 0 && spent[index] >= run.perQ) { next(); return; }
    tick();
  }, 1000);

  function draw() {
    const q = run.questions[index];
    const last = index === n - 1;
    host.innerHTML = `
      <div class="rtop"><button class="ricon" id="rx" title="Exit">✕</button><div class="rtime ${urgent() ? "urgent" : ""}" id="rtime">${timeLabel()}</div>
        ${run.allowPause ? '<button class="ricon" id="rpause" title="Pause">❚❚</button>' : '<span style="width:46px"></span>'}</div>
      <div class="rprog"><div class="bar" style="flex:1"><i style="width:${((index + 1) / n) * 100}%"></i></div><span class="m">${index + 1}/${n}</span></div>
      ${paused ? `<div class="rbody" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:24px">
          <button class="rplay" id="rresume" title="Resume">▶</button><button class="ricon bad" id="rend" title="End exam">⚑</button></div>`
      : `<div class="rbody"><div class="rq">${esc(q.question)}</div>
          <div class="ropts">${q.options.map((o, i) => `<button class="ropt ${sel[index] === o ? "on" : ""}" data-i="${i}"><b>${letter(i)}</b><span>${esc(o)}</span></button>`).join("")}</div></div>
         <div class="rfoot">${run.allowBack && index > 0 ? '<button class="ricon" id="rprev" title="Previous">←</button>' : ""}
          ${!sel[index] ? '<button class="ricon" id="rskip" title="Skip">⏭</button>' : ""}
          <button class="btn" id="rnext" style="flex:1;padding:14px" ${sel[index] ? "" : "disabled"}>${last ? "Finish ✓" : "Next →"}</button></div>`}
      ${confirming ? `<div class="rsheet"><div class="card" style="max-width:420px;width:100%"><h3 style="margin:0 0 6px">End exam?</h3><p class="m" style="margin:0 0 16px">Your answers so far will be scored.</p>
          <div class="btnrow" style="justify-content:flex-end;margin:0"><button class="mini" id="rkeep">Resume</button><button class="btn" id="rconfirm" style="padding:9px 24px;background:var(--bad);color:#fff">End</button></div></div></div>` : ""}`;
    const $ = (id) => host.querySelector(id);
    $("#rx").onclick = () => { confirming = true; draw(); };
    if ($("#rpause")) $("#rpause").onclick = () => { paused = true; draw(); };
    if ($("#rresume")) $("#rresume").onclick = () => { paused = false; draw(); };
    if ($("#rend")) $("#rend").onclick = () => { paused = false; confirming = true; draw(); };
    if ($("#rprev")) $("#rprev").onclick = prev;
    if ($("#rskip")) $("#rskip").onclick = next;
    if ($("#rnext")) $("#rnext").onclick = next;
    if ($("#rkeep")) $("#rkeep").onclick = () => { confirming = false; draw(); };
    if ($("#rconfirm")) $("#rconfirm").onclick = () => finish(true);
    host.querySelectorAll(".ropt").forEach((b) => b.onclick = () => choose(Number(b.dataset.i)));
  }

  function choose(i) {
    if (!running() || paused) return;
    const o = run.questions[index].options[i];
    if (o === undefined) return;
    sel[index] = sel[index] === o ? "" : o;
    draw();
  }

  function onKey(e) {
    if (!running()) return;
    const k = e.key.toLowerCase();
    if (/^[a-h]$/.test(k)) choose(k.charCodeAt(0) - 97);
    else if (/^[1-8]$/.test(k)) choose(Number(k) - 1);
    else if (k === "enter" && sel[index]) next();
    else if (k === "arrowleft") prev();
  }
  const onUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
  document.addEventListener("keydown", onKey);
  window.addEventListener("beforeunload", onUnload);

  host.classList.remove("hide");
  draw();
}
