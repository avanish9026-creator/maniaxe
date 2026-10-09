/* ==========================================================================
   MANIAXE TYPING — RESULT HISTORY
   Everyone gets a short "recent" list (guest-friendly, no account needed).
   Signed-in users additionally get a full history used to power the
   progress dashboard on profile.html.
   ========================================================================== */

const RECENT_KEY = "maniaxeRecentResults";
const RECENT_CAP = 5;
const HISTORY_CAP = 300;

function saveTestResult(result) {
  // recent — always, guest-visible
  const recent = getRecentResults();
  recent.unshift(result);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, RECENT_CAP)));

  // full history — only while signed in
  const user = window.maniaxeCurrentUser;
  if (user) {
    const key = "maniaxeHistory_" + user.uid;
    const full = getUserHistory(user.uid);
    full.push(result);
    localStorage.setItem(key, JSON.stringify(full.slice(-HISTORY_CAP)));
  }
}

function getRecentResults() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch (e) { return []; }
}

function getUserHistory(uid) {
  try {
    return JSON.parse(localStorage.getItem("maniaxeHistory_" + uid)) || [];
  } catch (e) { return []; }
}
