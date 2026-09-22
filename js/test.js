/* ==========================================================================
   MANIAXE TYPING — TEST PAGE
   ========================================================================== */

(function () {
  const state = {
    mode: "time",
    time: 15,
    infinite: false,
    wordCount: 10,
    punctuation: false,
    numbers: false,
    language: "english",
    font: MANIAXE_TYPING_FONTS[0].value
  };

  const els = {
    panel: document.getElementById("wordsPanel"),
    inner: document.getElementById("wordsInner"),
    liveStats: document.getElementById("liveStats"),
    resultsPanel: document.getElementById("resultsPanel"),
    clickVeil: document.getElementById("clickVeil"),
    hiddenInput: document.getElementById("hiddenInput")
  };

  const languageSelect = document.getElementById("languageSelect");
  const fontSelect = document.getElementById("fontSelect");

  Object.keys(MANIAXE_LANGUAGES).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = MANIAXE_LANGUAGES[key].label;
    languageSelect.appendChild(opt);
  });
  languageSelect.value = state.language;

  MANIAXE_TYPING_FONTS.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.value;
    opt.textContent = f.label;
    fontSelect.appendChild(opt);
  });
  fontSelect.value = state.font;

  function currentConfig() {
    const lang = MANIAXE_LANGUAGES[state.language];
    return {
      pool: lang.words,
      mode: state.mode,
      duration: state.mode === "time" ? (state.infinite ? null : state.time) : null,
      wordCount: state.wordCount,
      punctuation: state.punctuation,
      numbers: state.numbers,
      fontFamily: `${state.font}, ${lang.font}`,
      languageLabel: lang.label
    };
  }

  const engine = new TypingEngine(els, function (result) {
    saveTestResult(result);
    els.resultsPanel.innerHTML = renderResultsPanel(result);
    els.resultsPanel.classList.add("show");
    els.panel.style.display = "none";
    document.getElementById("nextTestBtn").addEventListener("click", () => engine.start(currentConfig()));
  });

  function restart() { engine.start(currentConfig()); }

  // mode chips
  document.getElementById("modeGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.mode = btn.dataset.mode;
    document.querySelectorAll("#modeGroup .chip").forEach((c) => c.classList.toggle("active", c === btn));
    document.getElementById("timeGroup").style.display = state.mode === "time" ? "flex" : "none";
    document.getElementById("wordsGroup").style.display = state.mode === "words" ? "flex" : "none";
    restart();
  });

  // time chips
  document.getElementById("timeGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    if (btn.id === "infinityChip") {
      state.infinite = true;
      document.querySelectorAll("#timeGroup .chip").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
    } else if (btn.dataset.time) {
      state.infinite = false;
      state.time = parseInt(btn.dataset.time, 10);
      document.getElementById("customTime").value = "";
      document.querySelectorAll("#timeGroup .chip").forEach((c) => c.classList.toggle("active", c === btn));
    }
    restart();
  });
  document.getElementById("customTime").addEventListener("change", function () {
    const v = parseInt(this.value, 10);
    if (!v || v < 1) return;
    state.time = v;
    state.infinite = false;
    document.querySelectorAll("#timeGroup .chip").forEach((c) => c.classList.remove("active"));
    restart();
  });

  // words chips
  document.getElementById("wordsGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn || !btn.dataset.words) return;
    state.wordCount = parseInt(btn.dataset.words, 10);
    document.getElementById("customWords").value = "";
    document.querySelectorAll("#wordsGroup .chip").forEach((c) => c.classList.toggle("active", c === btn));
    restart();
  });
  document.getElementById("customWords").addEventListener("change", function () {
    const v = parseInt(this.value, 10);
    if (!v || v < 1) return;
    state.wordCount = v;
    document.querySelectorAll("#wordsGroup .chip").forEach((c) => c.classList.remove("active"));
    restart();
  });

  // punctuation / numbers
  document.getElementById("punctuationChip").addEventListener("click", function () {
    state.punctuation = !state.punctuation;
    this.classList.toggle("active", state.punctuation);
    restart();
  });
  document.getElementById("numbersChip").addEventListener("click", function () {
    state.numbers = !state.numbers;
    this.classList.toggle("active", state.numbers);
    restart();
  });

  // language / font
  languageSelect.addEventListener("change", function () {
    state.language = this.value;
    restart();
  });
  fontSelect.addEventListener("change", function () {
    state.font = this.value;
    restart();
  });

  // input wiring
  els.hiddenInput.addEventListener("input", () => engine.handleInput());
  els.hiddenInput.addEventListener("keydown", (e) => engine.handleKeydown(e));
  els.panel.addEventListener("click", () => engine.focusInput());
  els.clickVeil.addEventListener("click", () => engine.focusInput());
  els.hiddenInput.addEventListener("blur", () => {
    if (!engine.finished) els.clickVeil.classList.add("show");
  });
  els.hiddenInput.addEventListener("focus", () => els.clickVeil.classList.remove("show"));

  engine.start(currentConfig());
})();
