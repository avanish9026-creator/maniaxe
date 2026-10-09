/* ==========================================================================
   MANIAXE TYPING — SHOT / SHARE UTILITIES
   ========================================================================== */

async function _loadShotLogo() {
  return new Promise((resolve) => {
    const logo = new Image();
    logo.onload = () => resolve(logo);
    logo.onerror = () => resolve(null);
    logo.src = "assets/logo-512.png";
  });
}

async function renderShotCanvas(result, canvas = null) {
  const target = canvas || document.createElement("canvas");
  target.width = 1200;
  target.height = 630;
  const ctx = target.getContext("2d");
  const W = target.width, H = target.height;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#19161a");
  grad.addColorStop(1, "#221e22");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#2e292e";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  const logo = await _loadShotLogo();
  if (logo && logo.width) ctx.drawImage(logo, 64, 56, 56, 56);

  ctx.fillStyle = "#eae6e5";
  ctx.font = "600 30px 'Space Grotesk', sans-serif";
  ctx.fillText("Maniaxe Typing", 134, 96);

  ctx.fillStyle = "#2b3ff2";
  ctx.font = "700 190px 'Space Grotesk', sans-serif";
  ctx.fillText(String(result.wpm), 64, 380);
  ctx.fillStyle = "#9a9296";
  ctx.font = "500 30px 'Inter', sans-serif";
  ctx.fillText("words per minute", 70, 420);

  const stats = [
    ["accuracy", result.accuracy + "%"],
    ["raw wpm", String(result.rawWpm)],
    ["time", result.time + "s"],
    ["mode", result.customLabel || result.language || result.drill || (result.mode === "words" ? "words" : "time")]
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

  if (result.pass === true || result.pass === false) {
    ctx.fillStyle = result.pass ? "#4caf7d" : "#c1443a";
    ctx.font = "700 28px 'Space Grotesk', sans-serif";
    ctx.fillText(result.pass ? "PASS" : "FAIL", W - 150, 92);
  }

  ctx.fillStyle = "#5d565a";
  ctx.font = "500 18px 'Inter', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("maniaxe.in", W - 48, H - 48);
  ctx.textAlign = "left";
  return target;
}

async function _shotBlob(result) {
  const canvas = await renderShotCanvas(result);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function _shareShot(result, includeLink) {
  const blob = await _shotBlob(result);
  if (!blob) throw new Error("Could not create result image");

  const file = new File([blob], "maniaxe-typing-result.png", { type: "image/png" });
  const shareText = includeLink
    ? "My Maniaxe Typing result — https://maniaxe.in/"
    : "My Maniaxe Typing result.";

  // On supported mobile browsers, share the actual PNG file. For the
  // link variant the URL is included in the share text so browsers that
  // reject files + a separate `url` field can still share both together.
  if (navigator.share) {
    const fileShareSupported = !navigator.canShare || navigator.canShare({ files: [file] });
    if (fileShareSupported) {
      await navigator.share({
        title: "My Maniaxe Typing result",
        text: shareText,
        files: [file]
      });
      return true;
    }
  }

  // Some browsers expose clipboard image support even when Web Share is
  // unavailable. This gives image-only sharing a useful fallback.
  if (!includeLink && navigator.clipboard && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast("Image copied to clipboard");
      return true;
    } catch (_) {}
  }

  if (includeLink && navigator.clipboard) {
    try {
      await downloadShotResult(result);
      await navigator.clipboard.writeText("https://maniaxe.in/");
      showToast("Image downloaded and website link copied");
      return false;
    } catch (_) {}
  }

  await downloadShotResult(result);
  showToast(includeLink ? "Image downloaded — share the copied website link" : "Image downloaded — sharing is not available here");
  return false;
}

async function downloadShotResult(result) {
  const canvas = await renderShotCanvas(result);
  const link = document.createElement("a");
  link.download = "maniaxe-typing-result.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function wireShotActions({ result, downloadButton, shareButton, shareMenu, shareLinkButton, shareImageButton }) {
  if (downloadButton) {
    downloadButton.addEventListener("click", async () => {
      try { await downloadShotResult(result); } catch (e) { showToast("Could not create the image"); }
    });
  }
  if (shareButton && shareMenu) {
    shareButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = shareMenu.classList.toggle("open");
      shareButton.setAttribute("aria-expanded", open ? "true" : "false");
    });
    const shareWrap = shareButton.closest(".result-share-wrap");
    shareWrap?.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", function closeResultShare(e) {
      if (!e.target.closest(".result-share-wrap")) {
        shareMenu.classList.remove("open");
        shareButton.setAttribute("aria-expanded", "false");
        document.removeEventListener("click", closeResultShare);
      }
    });
  }
  if (shareLinkButton) {
    shareLinkButton.addEventListener("click", async () => {
      shareMenu?.classList.remove("open");
      shareButton?.setAttribute("aria-expanded", "false");
      try { await _shareShot(result, true); } catch (e) { if (e.name !== "AbortError") showToast("Could not share the result"); }
    });
  }
  if (shareImageButton) {
    shareImageButton.addEventListener("click", async () => {
      shareMenu?.classList.remove("open");
      shareButton?.setAttribute("aria-expanded", "false");
      try { await _shareShot(result, false); } catch (e) { if (e.name !== "AbortError") showToast("Could not share the image"); }
    });
  }
}
