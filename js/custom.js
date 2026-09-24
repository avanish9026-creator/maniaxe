/* ==========================================================================
   MANIAXE TYPING — CUSTOM TEST
   ========================================================================== */

(function () {
  const els = {
    panel: document.getElementById("wordsPanel"),
    inner: document.getElementById("wordsInner"),
    liveStats: document.getElementById("liveStats"),
    resultsPanel: document.getElementById("resultsPanel"),
    clickVeil: document.getElementById("clickVeil"),
    hiddenInput: document.getElementById("hiddenInput")
  };

  const builder = document.querySelector(".custom-builder");
  const shell = document.getElementById("customTestShell");
  const textInput = document.getElementById("customText");
  const durationInput = document.getElementById("customDuration");
  const wordLimitInput = document.getElementById("customWordLimit");
  const disableBackspace = document.getElementById("disableBackspace");
  const enablePassFail = document.getElementById("enablePassFail");
  const passFailSettings = document.getElementById("passFailSettings");
  const minWpm = document.getElementById("minWpm");
  const minAccuracy = document.getElementById("minAccuracy");
  const message = document.getElementById("customMessage");

  let config = null;

  enablePassFail.addEventListener("change", () => {
    passFailSettings.classList.toggle("show", enablePassFail.checked);
  });

  function buildConfig() {
    const text = textInput.value.trim().replace(/\s+/g, " ");
    const duration = Math.max(0, parseInt(durationInput.value, 10) || 0);
    const requestedWords = Math.max(0, parseInt(wordLimitInput.value, 10) || 0);
    if (!text) throw new Error("Add some text before starting.");
    if (!duration && !requestedWords) throw new Error("Set a time limit, a word limit, or both.");

    const allWords = text.split(" ").filter(Boolean);
    const words = requestedWords ? allWords.slice(0, requestedWords) : allWords;
    if (!words.length) throw new Error("Your custom text does not contain any words.");

    const passCriteria = enablePassFail.checked ? {
      minWpm: Math.max(0, parseInt(minWpm.value, 10) || 0),
      minAccuracy: Math.min(100, Math.max(0, parseInt(minAccuracy.value, 10) || 0))
    } : null;

    return {
      custom: true,
      customLabel: "custom",
      customWords: words,
      mode: duration ? "time" : "words",
      duration: duration || null,
      wordCount: words.length,
      disableBackspace: disableBackspace.checked,
      passCriteria,
      fontFamily: "'JetBrains Mono', monospace",
      languageLabel: "Custom",
      languageCode: "en"
    };
  }

  const engine = new TypingEngine(els, function (result) {
    saveTestResult(result);
    els.resultsPanel.innerHTML = renderResultsPanel(result);
    els.resultsPanel.classList.add("show");
    els.panel.style.display = "none";
    wireResultsActions(result);
  });

  function startCustom() {
    try {
      config = buildConfig();
      message.textContent = "";
      builder.style.display = "none";
      shell.style.display = "";
      engine.start(config);
      window.scrollTo({ top: shell.offsetTop - 30, behavior: "smooth" });
    } catch (err) {
      message.textContent = err.message;
      message.style.color = "var(--error)";
    }
  }

  document.getElementById("startCustomBtn").addEventListener("click", startCustom);
  document.getElementById("clearCustomBtn").addEventListener("click", () => {
    textInput.value = "";
    durationInput.value = "0";
    wordLimitInput.value = "0";
    disableBackspace.checked = false;
    enablePassFail.checked = false;
    passFailSettings.classList.remove("show");
    message.textContent = "";
  });

  els.hiddenInput.addEventListener("beforeinput", (e) => engine.handleBeforeInput(e));
  els.hiddenInput.addEventListener("input", () => engine.handleInput());
  els.hiddenInput.addEventListener("keydown", (e) => engine.handleKeydown(e));
  els.panel.addEventListener("click", () => engine.focusInput());
  els.clickVeil.addEventListener("click", () => engine.focusInput());
  els.hiddenInput.addEventListener("blur", () => {
    if (!engine.finished) els.clickVeil.classList.add("show");
  });
  els.hiddenInput.addEventListener("focus", () => els.clickVeil.classList.remove("show"));
})();
