// Trakey Web: Learn. Same structure as the Learn screen in the Trakey app:
//   Subject  ->  Topic  ->  Card (front / back)  ->  Practice
// Pure logic + HTML builders. No Firebase and no DOM access in here (index.html wires the events),
// so it can be tested on its own.
//
// Cards you create are stored exactly like the phone stores them (trakey_learn_v2 / "notes"):
//   { id, topic, front, back, sid, tid }
//   sid = subject id ("maths", "english", "gk", "science", "reasoning", "computer" or "notes" = My notes)
//   tid = built-in topic id when the card was added inside a built-in topic (topic is then empty)

import { LEARN_SPECS } from "./learn-data.js";

export const NOTES_ID = "notes";
export const SUBJECT_ORDER = ["maths", "english", "gk", "science", "reasoning", "computer"];
export const SUBJECT_META = {
  maths: ["Maths", "🧮"], english: ["English", "📖"], gk: ["GK", "🌍"], science: ["Science", "🔬"],
  reasoning: ["Reasoning", "🧠"], computer: ["Computer", "💻"], notes: ["My notes", "📝"],
};

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const distinct = (list) => [...new Set(list)];

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Key used for "the user's own topic called X" (case-insensitive), same idea as the app's lUserKey. */
export const userKey = (name) => "u:" + String(name || "").trim().toLowerCase();

/** One built-in "existing" card made from {front, back, question, answer, options, explanation}. */
function genItem(id, front, back, question, answer, options, expl) {
  const wrong = distinct(options.map(String).filter((o) => !same(o, answer)));
  return { id, f: front, b: back, qs: wrong.length ? [{ q: question, a: String(answer), w: wrong, e: expl }] : [] };
}

/** Tables 1-30, squares 1-100 and cubes 1-30 (generated, like the app does). */
function generated(kind) {
  const out = [];
  if (kind === "tables") {
    for (let t = 1; t <= 30; t++) for (let n = 1; n <= 10; n++) {
      const v = t * n;
      out.push(genItem(`table_${t}_${n}`, `${t} × ${n}`, `${t} × ${n} = ${v}`, `What is ${t} × ${n}?`, v,
        distinct([v, v + t, Math.max(v - t, 0), v + n]), `${t} multiplied by ${n} equals ${v}.`));
    }
  } else if (kind === "squares") {
    for (let n = 1; n <= 100; n++) {
      const v = n * n, lo = Math.max(n - 1, 1);
      out.push(genItem(`square_${n}`, `${n}²`, `${n}² = ${v}`, `What is ${n}²?`, v, distinct([v, (n + 1) * (n + 1), lo * lo, v + n]), `${n} × ${n} = ${v}.`));
    }
  } else if (kind === "cubes") {
    for (let n = 1; n <= 30; n++) {
      const v = n * n * n, lo = Math.max(n - 1, 1);
      out.push(genItem(`cube_${n}`, `${n}³`, `${n}³ = ${v}`, `What is ${n}³?`, v, distinct([v, (n + 1) ** 3, lo ** 3, v + n * n]), `${n} × ${n} × ${n} = ${v}.`));
    }
  }
  return out;
}

/** Normalize a raw card from the phone / backup. */
export function cleanNote(n) {
  return { id: String(n.id), topic: String(n.topic || ""), front: String(n.front || ""), back: String(n.back || ""),
    sid: String(n.sid || "").trim() || NOTES_ID, tid: String(n.tid || "") };
}

/**
 * Notes (the user's own cards) -> subjects, exactly like lBuild() in the app.
 * subject = { id, title, icon, topics: [topic] }
 * topic   = { id, subject, title, hint, items: [item], listView, isNotes, tid, topicName }
 * item    = { id, front, back, qs: [{ q, a, wrong, e }], mine }
 */
export function buildLearn(rawNotes) {
  const notes = (rawNotes || []).map(cleanNote);

  const topics = LEARN_SPECS.map((spec) => {
    const rows = spec.rows;
    const used = new Set(rows.map((_, i) => `${spec.id}_${i}`));
    const items = [];
    const existing = [...spec.gen.flatMap(generated), ...spec.existing];
    for (const e of existing) {
      let id = e.id;
      while (!id || used.has(id)) id += "_x";
      used.add(id);
      items.push({ id, front: e.f, back: e.b, qs: e.qs.map((q) => ({ q: q.q, a: q.a, wrong: q.w, e: q.e })), mine: false });
    }
    const pool = distinct([...items.flatMap((i) => i.qs.map((q) => q.a)), ...rows.map((r) => r[1])]);
    rows.forEach((p, i) => {
      const wrong = p.slice(2).filter((x) => x.trim() !== "");
      if (wrong.length < 3) wrong.push(...shuffle(pool.filter((x) => x !== p[1] && !wrong.includes(x))).slice(0, 3 - wrong.length));
      items.push({ id: `${spec.id}_${i}`, front: p[0], back: p[1], qs: [{ q: spec.qfmt.replace("{}", p[0]), a: p[1], wrong, e: "" }], mine: false });
    });
    // cards the user added inside this built-in topic
    const mine = notes.filter((n) => n.tid === spec.id);
    const myBacks = distinct(mine.map((n) => n.back));
    for (const n of mine) {
      const wrong = shuffle(distinct([...pool, ...myBacks]).filter((x) => !same(x, n.back))).slice(0, 3);
      items.push({ id: n.id, front: n.front, back: n.back, qs: wrong.length ? [{ q: spec.qfmt.replace("{}", n.front), a: n.back, wrong, e: "" }] : [], mine: true });
    }
    const seen = new Set();
    return { id: spec.id, subject: spec.subject, title: spec.title, hint: spec.hint, items: items.filter((i) => !seen.has(i.id) && seen.add(i.id)),
      listView: spec.listView, isNotes: false, tid: spec.id, topicName: "" };
  }).filter((t) => t.items.length > 0);

  // topics the user created (inside any subject, or in My notes)
  const groups = new Map();
  for (const n of notes.filter((x) => !x.tid)) {
    const name = n.topic.trim() || "General";
    const key = n.sid + "\u0000" + name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { sid: n.sid, name, list: [] });
    groups.get(key).list.push(n);
  }
  const userTopics = [...groups.values()].map(({ sid, name, list }) => {
    const backs = distinct(list.map((n) => n.back));
    const seen = new Set();
    const items = list.map((n) => {
      const wrong = shuffle(backs.filter((b) => b !== n.back)).slice(0, 6);
      return { id: n.id, front: n.front, back: n.back, qs: wrong.length ? [{ q: n.front, a: n.back, wrong, e: "" }] : [], mine: true };
    }).filter((i) => !seen.has(i.id) && seen.add(i.id));
    return { id: "u:" + sid + ":" + name.toLowerCase(), subject: sid, title: name, hint: String(list.length), items, listView: false, isNotes: true, tid: "", topicName: name };
  });

  const builtIn = SUBJECT_ORDER.map((id) => ({
    id, title: SUBJECT_META[id][0], icon: SUBJECT_META[id][1],
    topics: [...topics.filter((t) => t.subject === id), ...userTopics.filter((t) => t.subject === id)],
  })).filter((s) => s.topics.length > 0);
  return [...builtIn, { id: NOTES_ID, title: SUBJECT_META.notes[0], icon: SUBJECT_META.notes[1], topics: userTopics.filter((t) => !SUBJECT_ORDER.includes(t.subject)) }];
}

export const practicable = (topic) => topic.items.some((i) => i.qs.length > 0);

/** The topics a card can be put in for one subject (the chips in the app's Add sheet). */
export function targetsFor(subject) {
  return (subject ? subject.topics : []).map((t) => ({ key: t.isNotes ? userKey(t.title) : t.id, label: t.title, tid: t.isNotes ? "" : t.id, topic: t.isNotes ? t.title : "" }));
}

/** Form values -> the note to save, same rules as the Save button in the app's sheet. */
export function noteFromForm({ id, sid, targets, selected, newTopic, front, back }) {
  const typed = String(newTopic || "").trim();
  const chosen = targets.find((t) => t.key === selected);
  const base = { id, front: String(front).trim(), back: String(back).trim(), sid };
  if (typed) return { ...base, topic: typed, tid: "" };
  if (chosen && chosen.tid) return { ...base, topic: "", tid: chosen.tid };
  return { ...base, topic: chosen ? chosen.topic : "General", tid: "" };
}

/** Practice questions in the shape exam.js expects (same picking rules as lStartRun in the app). */
export function practiceQuestions(topic, count) {
  const picked = shuffle(topic.items.filter((i) => i.qs.length > 0)).slice(0, count);
  return picked.map((item) => {
    const q = item.qs[Math.floor(Math.random() * item.qs.length)];
    const options = shuffle([q.a, ...distinct(shuffle(q.wrong).filter((o) => !same(o, q.a))).slice(0, 3)]);
    return { id: item.id, type: "MCQ", question: q.q, options, answer: q.a, explanation: q.e || "", marks: 1, source: topic.title };
  });
}

// ---------------------------------------------------------------- HTML

const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function progressRow(attrs, icon, title, sub, got, total) {
  const p = pctOf(got, total), done = total > 0 && got === total;
  return `<button class="card lrow" ${attrs}>
    <span class="licon ${done ? "done" : ""}">${done ? "✓" : icon}</span>
    <span class="grow"><span class="lrowtop"><span class="t">${title}</span><b style="color:${done ? "var(--ok)" : "inherit"}">${p}%</b></span>
      ${sub ? `<span class="m">${sub}</span>` : ""}
      <span class="bar"><i style="width:${Math.max(2, p)}%;${done ? "background:var(--ok)" : ""}"></i></span></span></button>`;
}

/**
 * ctx = { esc, ln, subjects, learned:Set, sessions:[{correct,total}], query, searchBox }
 * ln  = { sid, tid, mode, idx, flipped, order, result }
 */
export function learnHTML(ctx) {
  const { esc, ln, subjects, learned, sessions, query, searchBox } = ctx;
  const subject = subjects.find((s) => s.id === ln.sid) || null;
  const topic = subject ? subject.topics.find((t) => t.id === ln.tid) || null : null;
  const allTopics = subjects.flatMap((s) => s.topics);

  if (ln.result) return resultHTML(ln.result, topic, esc);

  // ---- search across every card ----
  if (query) {
    const q = query.toLowerCase();
    const hits = [];
    for (const s of subjects) for (const t of s.topics) for (const i of t.items) {
      if ((i.front + " " + i.back + " " + t.title).toLowerCase().includes(q)) hits.push({ s, t, i });
      if (hits.length >= 80) break;
    }
    return head("Learn", `${hits.length}${hits.length >= 80 ? "+" : ""} matching cards`, `<div class="btnrow" style="margin:0"><button class="mini" data-ln="scan">✦ Scan with AI</button><button class="btn" data-ln="add">+ Add card</button></div>`) + searchBox +
      `<div class="list">${hits.map(({ s, t, i }) => `<button class="card" style="text-align:left;color:inherit" data-ln="open" data-sid="${esc(s.id)}" data-tid="${esc(t.id)}">
        <div class="t">${esc(i.front)}</div><div class="m" style="color:var(--blue)">${esc(i.back)}</div><div class="m">${esc(s.title)} › ${esc(t.title)}</div></button>`).join("") || '<div class="empty">No cards found.</div>'}</div>`;
  }

  // ---- topic ----
  if (subject && topic) return topicHTML(ctx, subject, topic);

  // ---- subject ----
  if (subject) {
    return `<button class="chip" data-ln="home">← Learn</button>` +
      head(`${esc(subject.icon)} ${esc(subject.title)}`, `${subject.topics.length} topics`,
        `<div class="btnrow" style="margin:0"><button class="mini" data-ln="scan">✦ Scan with AI</button><button class="mini" data-ln="newtopic">+ New topic</button><button class="btn" data-ln="add">+ Add card</button></div>`) +
      (subject.topics.length === 0
        ? `<div class="empty">Nothing here yet.<br><br><button class="btn" data-ln="add">+ Add your first card</button></div>`
        : `<div class="list">${subject.topics.map((t) => progressRow(`data-ln="open" data-sid="${esc(subject.id)}" data-tid="${esc(t.id)}"`, esc(subject.icon), esc(t.title), esc(t.hint), t.items.filter((i) => learned.has(i.id)).length, t.items.length)).join("")}</div>`);
  }

  // ---- home ----
  const total = allTopics.reduce((n, t) => n + t.items.length, 0);
  const got = allTopics.reduce((n, t) => n + t.items.filter((i) => learned.has(i.id)).length, 0);
  const answered = sessions.reduce((n, s) => n + s.total, 0), right = sessions.reduce((n, s) => n + s.correct, 0);
  const stat = (b, l) => `<div class="card stat"><b>${b}</b><span>${l}</span></div>`;
  return head("Learn", `${total} cards · ${got} marked learned · ${sessions.length} practice sessions${answered ? " · " + pctOf(right, answered) + "% correct overall" : ""}`,
    `<div class="btnrow" style="margin:0"><button class="mini" data-ln="scan">✦ Scan with AI</button><button class="btn" data-ln="add">+ Add card</button></div>`) + searchBox +
    `<div class="card" style="padding:22px;margin-bottom:14px"><div class="m">Learned</div><div style="font-size:52px;font-weight:800;line-height:1.1">${pctOf(got, total)}%</div>
      <div class="grid" style="margin-top:14px;grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">${stat(got, "Cards learned")}${stat(sessions.length, "Practice")}${stat(pctOf(right, answered) + "%", "Accuracy")}</div>
      <div class="m" style="margin-top:10px">Learned marks and practice scores come from your phone's last backup.</div></div>
    <div class="list">${subjects.map((s) => progressRow(`data-ln="open" data-sid="${esc(s.id)}"`, esc(s.icon), esc(s.title), `${s.topics.length} topics`,
      s.topics.reduce((n, t) => n + t.items.filter((i) => learned.has(i.id)).length, 0), s.topics.reduce((n, t) => n + t.items.length, 0))).join("")}</div>`;
}

function head(title, sub, right = "") {
  return `<div class="top"><div><h2>${title}</h2><p class="sub">${sub}</p></div>${right}</div>`;
}

function topicHTML(ctx, subject, topic) {
  const { esc, ln, learned } = ctx;
  const items = topic.items;
  const order = ln.order && ln.order.length === items.length ? ln.order.map((i) => items[i]).filter(Boolean) : items;
  const idx = Math.min(Math.max(ln.idx, 0), Math.max(order.length - 1, 0));
  const cur = order[idx];
  const got = items.filter((i) => learned.has(i.id)).length;
  const actions = `<div class="btnrow" style="margin:0">${practicable(topic) ? `<button class="mini" data-ln="practice">▶ Practice</button>` : ""}<button class="mini" data-ln="scan">✦ Scan with AI</button><button class="btn" data-ln="add">+ Add card</button></div>`;
  let body;
  if (ln.mode === 1) {
    const twoCol = topic.listView || items.length > 40;
    body = `<div class="list">${items.map((i) => `<div class="card lcard ${learned.has(i.id) ? "got" : ""}">
      ${twoCol ? `<div class="row"><div class="t" style="flex:.42">${esc(i.front)}</div><div style="flex:.58;color:var(--blue);font-weight:600;overflow-wrap:anywhere">${esc(i.back)}</div>` : `<div class="row"><div class="grow"><div class="t">${esc(i.front)}</div><div class="m note">${esc(i.back)}</div></div>`}
      ${learned.has(i.id) ? '<span class="pill ok">✓</span>' : ""}
      ${i.mine ? `<button class="mini" data-ln="edit" data-id="${esc(i.id)}">Edit</button><button class="mini danger" data-ln="delete" data-id="${esc(i.id)}">Delete</button>` : ""}</div></div>`).join("") || '<div class="empty">No cards yet.</div>'}</div>`;
  } else if (!cur) {
    body = '<div class="empty">No cards yet.</div>';
  } else {
    body = `<div class="deck"><div class="deckbar"><div class="bar" style="flex:1;margin:0"><i style="width:${((idx + 1) / order.length) * 100}%"></i></div><span class="m">${idx + 1}/${order.length}</span></div>
      <button class="flash ${ln.flipped ? "flipped" : ""}" data-ln="flip" title="Click to flip (or press Space)">
        <span class="ffront">${esc(cur.front)}</span>${ln.flipped ? `<span class="fback">${esc(cur.back)}</span>` : '<span class="fhint">Click to show the answer</span>'}</button>
      <div class="btnrow" style="justify-content:center;margin-top:14px"><button class="mini" data-ln="prev" ${idx === 0 ? "disabled" : ""}>← Previous</button>
        <button class="mini" data-ln="shuffle">⇄ Shuffle</button>
        ${cur.mine ? `<button class="mini" data-ln="edit" data-id="${esc(cur.id)}">Edit</button><button class="mini danger" data-ln="delete" data-id="${esc(cur.id)}">Delete</button>` : ""}
        <button class="btn" style="padding:8px 22px" data-ln="next" ${idx >= order.length - 1 ? "disabled" : ""}>Next →</button></div></div>`;
  }
  return `<button class="chip" data-ln="subject" data-sid="${esc(subject.id)}">← ${esc(subject.title)}</button>` +
    head(esc(topic.title), `${items.length} cards · ${got} learned${topic.hint && !topic.isNotes ? " · " + esc(topic.hint) : ""}`, actions) +
    `<div class="btnrow" style="margin:0 0 14px"><button class="chip ${ln.mode === 0 ? "on" : ""}" data-ln="mode" data-mode="0">Cards</button><button class="chip ${ln.mode === 1 ? "on" : ""}" data-ln="mode" data-mode="1">List</button></div>` + body;
}

/** Practice result: res = { title, answers:[{ question, answer, selected, correct, skipped, explanation }], seconds } */
export function resultHTML(res, topic, esc) {
  const total = res.answers.length, right = res.answers.filter((a) => a.correct).length;
  const skipped = res.answers.filter((a) => a.skipped).length, wrong = total - right - skipped;
  const attempted = right + wrong, acc = attempted ? Math.floor((right * 100) / attempted) : 0;
  const mini = (b, l, c) => `<div class="card stat"><b style="font-size:26px;${c ? "color:" + c : ""}">${b}</b><span>${l}</span></div>`;
  return `<div class="top"><div><button class="chip" data-ln="closeresult">← Back to ${esc(res.title)}</button><h2 style="margin-top:8px">${esc(res.title)}</h2><p class="sub">Practice result</p></div>
      <div class="btnrow" style="margin:0"><button class="btn" data-ln="practice">Practice again</button></div></div>
    <div class="card" style="padding:24px"><div style="font-size:46px;font-weight:800;line-height:1.1">${right}/${total}</div><div style="color:var(--sub);font-size:20px">${total ? Math.round((right / total) * 100) : 0}%</div>
      <div style="display:flex;height:10px;border-radius:9px;overflow:hidden;background:var(--elev);margin-top:16px"><i style="width:${total ? (right / total) * 100 : 0}%;background:var(--ok)"></i><i style="width:${total ? (wrong / total) * 100 : 0}%;background:var(--bad)"></i></div></div>
    <div class="grid" style="margin-top:14px">${mini(acc + "%", "Accuracy")}${mini(right, "Right", "var(--ok)")}${mini(wrong, "Wrong", "var(--bad)")}${mini(skipped, "Skipped")}</div>
    <div class="list" style="margin-top:18px">${res.answers.map((a, i) => {
      const c = a.correct ? "var(--ok)" : a.skipped ? "var(--sub)" : "var(--bad)";
      return `<div class="card"><div class="row" style="align-items:flex-start"><div class="exmark" style="background:color-mix(in srgb,${c} 16%,transparent);color:${c}">${a.correct ? "✓" : a.skipped ? "–" : "✕"}</div>
        <div class="grow"><div class="t">${i + 1}. ${esc(a.question)}</div>${!a.correct && !a.skipped ? `<div style="color:var(--bad);margin-top:8px">${esc(a.selected)}</div>` : ""}
        <div style="color:var(--ok);margin-top:4px">${esc(a.answer)}</div>${a.explanation ? `<div class="m" style="margin-top:8px">${esc(a.explanation)}</div>` : ""}</div></div></div>`;
    }).join("")}</div>`;
}

/** Turn what exam.js's runner returns into the small result object above. */
export function toResult(title, answers, seconds) {
  return { title, seconds, answers: answers.map((a) => {
    const skipped = !String(a.selected).trim();
    return { question: a.q.question, answer: a.q.answer, selected: a.selected, skipped, correct: !skipped && same(a.selected, a.q.answer), explanation: a.q.explanation || "" };
  }) };
}
