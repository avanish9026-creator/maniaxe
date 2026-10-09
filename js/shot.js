/* ==========================================================================
   MANIAXE TYPING — RESULT SHOT PAGE
   ========================================================================== */

(function () {
  const canvas = document.getElementById("shotCanvas");
  const results = getRecentResults();

  if (!results.length) {
    canvas.style.display = "none";
    document.getElementById("shotActions").style.display = "none";
    document.getElementById("shotEmpty").style.display = "block";
    return;
  }

  const r = results[0];
  renderShotCanvas(r, canvas).catch(() => {});

  wireShotActions({
    result: r,
    downloadButton: document.getElementById("downloadShotBtn"),
    shareButton: document.getElementById("shareShotBtn"),
    shareMenu: document.getElementById("shareShotMenu"),
    shareLinkButton: document.getElementById("shareShotLinkBtn"),
    shareImageButton: document.getElementById("shareShotImageBtn")
  });
})();
