/* ==========================================================================
   MANIAXE TYPING — RESULT SHOT
   ========================================================================== */

(function () {
  const canvas = document.getElementById("shotCanvas");
  const ctx = canvas.getContext("2d");
  const results = getRecentResults();

  if (!results.length) {
    canvas.style.display = "none";
    document.getElementById("shotActions").style.display = "none";
    document.getElementById("shotEmpty").style.display = "block";
    return;
  }

  const r = results[0];
  const logo = new Image();
  logo.src = "assets/logo-512.png";
  logo.onload = draw;
  logo.onerror = draw;

  function draw() {
    const W = canvas.width, H = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#19161a");
    grad.addColorStop(1, "#221e22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "#2e292e";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // logo + wordmark
    if (logo.width) ctx.drawImage(logo, 64, 56, 56, 56);
    ctx.fillStyle = "#eae6e5";
    ctx.font = "600 30px 'Space Grotesk', sans-serif";
    ctx.fillText("Maniaxe Typing", 134, 96);

    // big wpm
    ctx.fillStyle = "#2b3ff2";
    ctx.font = "700 190px 'Space Grotesk', sans-serif";
    ctx.fillText(String(r.wpm), 64, 380);
    ctx.fillStyle = "#9a9296";
    ctx.font = "500 30px 'Inter', sans-serif";
    ctx.fillText("words per minute", 70, 420);

    // mini stats
    const stats = [
      ["accuracy", r.accuracy + "%"],
      ["raw wpm", String(r.rawWpm)],
      ["time", r.time + "s"],
      ["mode", r.language || r.drill || (r.mode === "words" ? "words" : "time")]
    ];
    let x = 64;
    const y = 500;
    stats.forEach(([label, value]) => {
      ctx.fillStyle = "#eae6e5";
      ctx.font = "600 30px 'JetBrains Mono', monospace";
      ctx.fillText(value, x, y);
      ctx.fillStyle = "#5d565a";
      ctx.font = "500 16px 'Inter', sans-serif";
      ctx.fillText(label, x, y + 26);
      x += 220;
    });

    ctx.fillStyle = "#5d565a";
    ctx.font = "500 18px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("maniaxe.in", W - 48, H - 48);
    ctx.textAlign = "left";
  }

  document.getElementById("downloadShotBtn").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "maniaxe-typing-result.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
})();
