/* ==========================================================================
   MANIAXE TYPING — RESULTS PANEL RENDERER
   ========================================================================== */

function renderResultsPanel(result) {
  const loggedIn = !!window.maniaxeCurrentUser;
  const timeLabel = result.mode === "time" && !result.duration ? result.time + "s" : result.time + "s";

  const guestNote = loggedIn
    ? `<div class="guest-note" style="border-style:solid;">
        <span>Saved to your progress history.</span>
        <a href="profile.html" class="btn btn-ghost">View progress</a>
      </div>`
    : `<div class="guest-note">
        <span>This result is saved on this device only.</span>
        <a href="login.html" class="btn btn-ghost">Sign in to track full progress</a>
      </div>`;

  return `
    <div class="results-grid">
      <div class="result-main">
        <div class="num">${result.wpm}</div>
        <div class="lbl">words per minute${result.language ? " · " + result.language : ""}${result.drill ? " · " + result.drill : ""}</div>
      </div>
      <div class="result-mini-grid">
        <div class="result-mini"><div class="num">${result.accuracy}%</div><div class="lbl">accuracy</div></div>
        <div class="result-mini"><div class="num">${result.rawWpm}</div><div class="lbl">raw wpm</div></div>
        <div class="result-mini"><div class="num">${timeLabel}</div><div class="lbl">time</div></div>
        <div class="result-mini"><div class="num">${result.correct}/${result.incorrect}/${result.extra}/${result.missed}</div><div class="lbl">correct/incorrect/extra/missed</div></div>
      </div>
    </div>
    ${guestNote}
    <div class="results-actions">
      <button class="btn btn-primary" id="nextTestBtn">Next test</button>
      <a class="btn btn-ghost" href="shot.html">Share as image</a>
    </div>
  `;
}
