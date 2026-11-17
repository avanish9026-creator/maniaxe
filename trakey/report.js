// Trakey Web: Weekly / monthly report. Port of TrakeyReport.kt (same rules and wording), built from the
// activity log the phone backs up (trakey_report_log + trakey_habit_log). Pure logic + HTML, no Firebase.

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const dayDiff = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);

const stat = (rep, d) => {
  const k = iso(d), x = rep.days[k] || {};
  const o = { tasks: x.t || 0, goals: x.g || 0, focusMin: x.f || 0, sessions: x.s || 0, habits: rep.habits[k] || 0, study: x.st || 0, games: x.gm || 0 };
  o.actions = o.tasks + o.goals + o.sessions + o.habits + o.study + o.games;
  return o;
};
const sum = (days, k) => days.reduce((n, d) => n + d[k], 0);

/** rep = model.report, joinedAt = profile.joinedAt (ms, 0 if unknown). */
export function buildReport(rep, monthly, joinedAt = 0, today = new Date()) {
  const len = monthly ? 30 : 7;
  const start = addDays(today, -(len - 1));
  const days = Array.from({ length: len }, (_, i) => stat(rep, addDays(start, i)));
  const logged = [...Object.keys(rep.days), ...Object.keys(rep.habits)].filter((k) => stat(rep, new Date(k + "T00:00:00")).actions > 0).sort();
  let first = joinedAt > 0 ? new Date(joinedAt) : today;
  if (logged.length) { const e = new Date(logged[0] + "T00:00:00"); if (e < first) first = e; }
  const tenure = dayDiff(first, today) + 1;
  const active = days.filter((d) => d.actions > 0).length;
  const needActive = monthly ? 8 : 3, needActions = monthly ? 15 : 5;
  const ready = tenure >= len && active >= needActive && sum(days, "actions") >= needActions;
  const prev = tenure >= 2 * len ? Array.from({ length: len }, (_, i) => stat(rep, addDays(start, -(len - i)))) : null;
  return { monthly, start, end: today, days, prev, ready, active, needActive, daysUntilFull: Math.max(0, len - tenure), len,
    period: monthly ? "month" : "week" };
}

export const consistency = (r) => Math.round((r.active * 100) / r.len);
const prevConsistency = (r) => (r.prev ? Math.round((r.prev.filter((d) => d.actions > 0).length * 100) / r.len) : null);

export function headline(r) {
  const prev = prevConsistency(r);
  if (prev === null) return `You were active on ${r.active} of ${r.len} days this ${r.period}.`;
  const diff = consistency(r) - prev;
  if (diff > 0) return `You were ${diff}% more consistent than last ${r.period}.`;
  if (diff < 0) return `You were ${-diff}% less consistent than last ${r.period}. Small steps bring it back.`;
  return `You were just as consistent as last ${r.period}.`;
}

export function longestStreak(r) {
  let best = 0, cur = 0;
  for (const d of r.days) { if (d.actions > 0) { cur++; best = Math.max(best, cur); } else cur = 0; }
  return best;
}
const bestIndex = (r) => r.days.reduce((b, d, i) => (d.actions > r.days[b].actions ? i : b), 0);
export const focusText = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

function change(cur, prev) {
  if (prev === null || prev === undefined) return "";
  if (prev === 0 && cur === 0) return '<small class="rpflat">No change</small>';
  if (prev === 0) return '<small class="rpup">New this period</small>';
  if (cur === prev) return '<small class="rpflat">Same as before</small>';
  const p = Math.round(((cur - prev) * 100) / prev);
  return `<small class="${p > 0 ? "rpup" : "rpdown"}">${p > 0 ? "+" : ""}${p}% vs last period</small>`;
}

const fmtShort = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
const dayLabel = (r, i) => { const d = addDays(r.start, i); return r.monthly ? fmtShort(d) : d.toLocaleDateString(undefined, { weekday: "short" }); };

function chartSVG(r) {
  const W = 640, H = 220, L = 34, R = 10, T = 14, B = 30, n = r.len;
  const max = Math.max(1, ...r.days.map((d) => d.actions), ...(r.prev ? r.prev.map((d) => d.actions) : [0]));
  const px = (i) => L + ((W - L - R) * i) / (n - 1), py = (v) => H - B - ((H - B - T) * v) / max;
  const line = (arr) => arr.map((d, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(d.actions).toFixed(1)}`).join(" ");
  const grid = [0, 1, 2, 3].map((g) => { const y = H - B - ((H - B - T) * g) / 3, v = (max * g) / 3;
    return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--sub)">${Number.isInteger(v) ? v : v.toFixed(1)}</text>`; }).join("");
  const step = r.monthly ? 5 : 1;
  const labels = r.days.map((_, i) => (i % step === 0 || i === n - 1 ? `<text x="${px(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--sub)">${dayLabel(r, i)}</text>` : "")).join("");
  const area = `${line(r.days)} L${px(n - 1)} ${H - B} L${px(0)} ${H - B} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Daily activity">${grid}${labels}
    ${r.prev ? `<path d="${line(r.prev)}" fill="none" stroke="var(--sub)" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>` : ""}
    <path d="${area}" fill="var(--blue)" opacity=".15"/><path d="${line(r.days)}" fill="none" stroke="var(--blue)" stroke-width="3" stroke-linejoin="round"/>
    ${r.days.map((d, i) => `<circle cx="${px(i)}" cy="${py(d.actions)}" r="3.5" fill="var(--blue)"><title>${dayLabel(r, i)}: ${d.actions}</title></circle>`).join("")}</svg>`;
}

export function reportHTML(r, name, esc) {
  const range = `${fmtShort(r.start)} – ${r.end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  const seg = `<div class="btnrow" style="margin:0 0 16px"><button class="chip ${r.monthly ? "" : "on"}" data-rp="week">This week</button><button class="chip ${r.monthly ? "on" : ""}" data-rp="month">This month</button>${r.ready ? '<button class="mini" data-rp="print">Print / Save as PDF</button>' : ""}</div>`;
  if (!r.ready) {
    const why = r.daysUntilFull > 0
      ? `Your first ${r.period}ly report unlocks in ${r.daysUntilFull} day${r.daysUntilFull === 1 ? "" : "s"}.`
      : `You were active on ${r.active} of ${r.len} days. A ${r.period}ly report needs ${r.needActive}+ active days.`;
    return seg + `<div class="card"><div class="t">Your ${r.period} with Trakey</div><div class="m" style="margin-top:6px">${why}<br>Open Trakey regularly, complete tasks, tick habits, finish goal steps and practise in Learn. The report fills in from your real activity.</div></div>`;
  }
  const p = r.prev, tile = (label, val, cur, key) => `<div class="card stat"><span>${label}</span><b>${val}</b>${change(cur, p ? sum(p, key) : null)}</div>`;
  const bi = bestIndex(r);
  return seg + `<div class="card report"><div class="m" style="letter-spacing:.2em;font-weight:700">TRAKEY · ${r.monthly ? "MONTHLY" : "WEEKLY"} REPORT</div>
    <div class="m">${esc(name)} · ${range}</div>
    <h3 style="margin:12px 0 4px;font-size:22px">${headline(r)}</h3>
    <div class="m">${r.active} of ${r.len} days active · ${sum(r.days, "actions")} actions completed</div></div>
    <div class="grid" style="margin-top:14px">${tile("Tasks completed", sum(r.days, "tasks"), sum(r.days, "tasks"), "tasks")}${tile("Habit check-ins", sum(r.days, "habits"), sum(r.days, "habits"), "habits")}${tile("Goal steps", sum(r.days, "goals"), sum(r.days, "goals"), "goals")}${tile("Focus time", focusText(sum(r.days, "focusMin")), sum(r.days, "focusMin"), "focusMin")}${tile("Study (Learn / Challenges)", sum(r.days, "study"), sum(r.days, "study"), "study")}${tile("Game rounds", sum(r.days, "games"), sum(r.days, "games"), "games")}</div>
    <div class="card" style="margin-top:14px"><div class="row"><div class="t grow">Daily activity</div><span class="m">${r.prev ? "Dashed: last " + r.period : ""}</span></div>${chartSVG(r)}</div>
    <div class="grid" style="margin-top:14px"><div class="card stat"><span>Best day</span><b>${r.days[bi].actions ? dayLabel(r, bi) : "–"}</b><small class="rpflat">${r.days[bi].actions} actions</small></div>
    <div class="card stat"><span>Longest streak</span><b>${longestStreak(r)} d</b><small class="rpflat">active days in a row</small></div>
    <div class="card stat"><span>Consistency</span><b>${consistency(r)}%</b>${prevConsistency(r) === null ? "" : `<small class="rpflat">last ${r.period}: ${prevConsistency(r)}%</small>`}</div></div>
    <div class="m" style="margin-top:14px">Made with Trakey</div>`;
}

/** Small Overview card: ready = "Your week with Trakey" + 7 bars + headline, else a short note. */
export function weekCardHTML(r) {
  if (!r.ready) {
    return `<a class="card" href="#report" style="display:block;text-decoration:none;color:inherit"><div class="t">Your week with Trakey</div><div class="m">${r.daysUntilFull > 0 ? `First report unlocks in ${r.daysUntilFull} day${r.daysUntilFull === 1 ? "" : "s"}.` : `Active on ${r.active} of 7 days so far. Keep going.`}</div></a>`;
  }
  const max = Math.max(1, ...r.days.map((d) => d.actions));
  return `<a class="card" href="#report" style="display:block;text-decoration:none;color:inherit"><div class="t">Your week with Trakey</div><div class="m" style="margin-bottom:10px">${headline(r)}</div>
    <div style="display:flex;gap:6px;align-items:flex-end;height:64px">${r.days.map((d, i) => `<div style="flex:1;text-align:center"><div title="${d.actions}" style="height:${Math.max(4, (d.actions / max) * 54)}px;background:var(--blue);border-radius:6px;opacity:${d.actions ? 1 : .25}"></div><div class="m" style="font-size:10px">${dayLabel(r, i)[0]}</div></div>`).join("")}</div></a>`;
}
