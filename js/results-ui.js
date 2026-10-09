/* ==========================================================================
   MANIAXE TYPING — RESULTS PANEL
   ========================================================================== */

function renderResultsPanel(result) {
  const loggedIn = !!window.maniaxeCurrentUser;
  const timeLabel = result.time + "s";
  const passFail = result.pass === true ? `<div class="custom-result-status pass">PASS</div>` :
                    result.pass === false ? `<div class="custom-result-status fail">FAIL</div>` : "";

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
    ${passFail}
    <div class="results-grid">
      <div class="result-main">
        <div class="num">${result.wpm}</div>
        <div class="lbl">words per minute${result.language ? " · " + result.language : ""}${result.drill ? " · " + result.drill : ""}${result.customLabel ? " · " + result.customLabel : ""}</div>
      </div>
      <div class="result-mini-grid">
        <div class="result-mini"><div class="num">${result.accuracy}%</div><div class="lbl">accuracy</div></div>
        <div class="result-mini"><div class="num">${result.rawWpm}</div><div class="lbl">raw wpm</div></div>
        <div class="result-mini"><div class="num">${timeLabel}</div><div class="lbl">time</div></div>
        <div class="result-mini"><div class="num">${result.correct}/${result.incorrect}/${result.extra}/${result.missed}</div><div class="lbl">correct/incorrect/extra/missed</div></div>
      </div>
    </div>
    ${guestNote}
    <div class="results-actions result-actions-enhanced">
      <button class="btn btn-primary" id="nextTestBtn">Next test</button>
      <button class="btn btn-ghost" id="downloadResultShotBtn" type="button">Download image</button>
      <div class="result-share-wrap">
        <button class="btn btn-ghost result-share-btn" id="shareResultBtn" type="button" aria-expanded="false" aria-haspopup="menu">
          <span aria-hidden="true">↗</span> Share
        </button>
        <div class="result-share-menu" id="shareResultMenu" role="menu">
          <div class="result-share-title">Share result</div>
          <button type="button" class="result-share-option" id="shareResultLinkBtn" role="menuitem">Share image + website link</button>
          <button type="button" class="result-share-option" id="shareResultImageBtn" role="menuitem">Share image only</button>
        </div>
      </div>
    </div>
    <div class="result-leaderboard-card" id="resultLeaderboardCard">
      <div class="result-leaderboard-copy">
        <span class="section-kicker">Public leaderboard</span>
        <strong>Who is typing fastest?</strong>
        <span id="resultLeaderboardTop">Loading the current #1 typist…</span>
      </div>
      <a class="btn btn-ghost" href="#leaderboardFooter">View leaderboard</a>
    </div>
  `;
}

function wireResultsActions(result) {
  if (typeof window.refreshTypingLeaderboard === "function") window.refreshTypingLeaderboard();
  if (typeof wireShotActions !== "function") return;

  wireShotActions({
    result,
    downloadButton: document.getElementById("downloadResultShotBtn"),
    shareButton: document.getElementById("shareResultBtn"),
    shareMenu: document.getElementById("shareResultMenu"),
    shareLinkButton: document.getElementById("shareResultLinkBtn"),
    shareImageButton: document.getElementById("shareResultImageBtn")
  });
}
