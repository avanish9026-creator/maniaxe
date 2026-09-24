/* ==========================================================================
   MANIAXE TYPING — PUBLIC LEADERBOARD
   Stores one best public score per signed-in user.
   ========================================================================== */

import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs, orderBy, limit, query
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

let db = null;
let currentUser = null;

function getDb() {
  if (!db && window.maniaxeFirebaseApp) db = getFirestore(window.maniaxeFirebaseApp);
  return db;
}

function cleanName(name) {
  const value = String(name || "Anonymous").trim();
  return value.slice(0, 40) || "Anonymous";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[ch]));
}

function sortRows(rows) {
  return rows
    .sort((a,b) => (Number(b.wpm)||0) - (Number(a.wpm)||0) || (Number(b.accuracy)||0) - (Number(a.accuracy)||0))
    .slice(0,10);
}

function renderFooter(rows) {
  const list = document.getElementById("leaderboardFooterList");
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = '<div class="leaderboard-empty">No public scores yet. Sign in and complete a typing test to claim the first spot.</div>';
    return;
  }
  list.innerHTML = rows.map((row, i) => `
    <div class="leaderboard-row">
      <span class="leaderboard-rank">#${i + 1}</span>
      <span class="leaderboard-name">${escapeHtml(row.displayName || "Typist")}</span>
      <span class="leaderboard-wpm">${Number(row.wpm)||0} WPM</span>
      <span class="leaderboard-accuracy">${Number(row.accuracy)||0}%</span>
    </div>
  `).join("");
}

function renderResultPreview(rows) {
  const el = document.getElementById("resultLeaderboardTop");
  if (!el) return;
  if (!rows.length) {
    el.textContent = "No public score yet — sign in to become the first leaderboard entry.";
    return;
  }
  const top = rows[0];
  el.textContent = `#1 ${top.displayName || "Typist"} · ${Number(top.wpm)||0} WPM · ${Number(top.accuracy)||0}% accuracy`;
}

async function loadLeaderboard() {
  if (!getDb()) return;
  try {
    const q = query(collection(getDb(), "typing_leaderboard"), orderBy("wpm", "desc"), limit(20));
    const snap = await getDocs(q);
    const rows = sortRows(snap.docs.map(d => d.data()));
    renderFooter(rows);
    renderResultPreview(rows);
    return rows;
  } catch (err) {
    console.warn("Leaderboard unavailable:", err);
    const list = document.getElementById("leaderboardFooterList");
    if (list) list.innerHTML = '<div class="leaderboard-empty">Leaderboard is temporarily unavailable.</div>';
    const preview = document.getElementById("resultLeaderboardTop");
    if (preview) preview.textContent = "Leaderboard is temporarily unavailable.";
    return [];
  }
}

window.refreshTypingLeaderboard = loadLeaderboard;

window.updateTypingLeaderboard = async function(result) {
  if (!currentUser || !getDb() || !result || result.custom) {
    await loadLeaderboard();
    return;
  }
  try {
    const ref = doc(getDb(), "typing_leaderboard", currentUser.uid);
    const existingSnap = await getDoc(ref);
    const existing = existingSnap.exists() ? existingSnap.data() : null;

    const score = {
      displayName: cleanName(currentUser.displayName || currentUser.email?.split("@")[0]),
      wpm: Number(result.wpm) || 0,
      accuracy: Number(result.accuracy) || 0,
      language: result.language || "",
      updatedAt: Date.now()
    };

    if (!existing || score.wpm > Number(existing.wpm || 0) ||
        (score.wpm === Number(existing.wpm || 0) && score.accuracy > Number(existing.accuracy || 0))) {
      await setDoc(ref, score, { merge: true });
    }
    await loadLeaderboard();
  } catch (err) {
    console.warn("Could not update leaderboard:", err);
    await loadLeaderboard();
  }
};

document.addEventListener("maniaxe-auth-ready", (e) => {
  currentUser = e.detail?.user || null;
  loadLeaderboard();
});

document.addEventListener("DOMContentLoaded", () => {
  loadLeaderboard();
});
