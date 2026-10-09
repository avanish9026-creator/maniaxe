/* ==========================================================================
   MANIAXE TYPING — PRACTICE PAGE
   ========================================================================== */

(function () {
  function rowCombos(letters, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const len = 2 + Math.floor(Math.random() * 4);
      let w = "";
      for (let j = 0; j < len; j++) w += letters[Math.floor(Math.random() * letters.length)];
      out.push(w);
    }
    return out;
  }

  const DRILLS = {
    common: { label: "Common words", pool: MANIAXE_LANGUAGES.english.words, punctuation: false, numbers: false },
    home: { label: "Home row", pool: rowCombos("asdfjkl;", 120), punctuation: false, numbers: false },
    top: { label: "Top row", pool: rowCombos("qwertyuiop", 120), punctuation: false, numbers: false },
    bottom: { label: "Bottom row", pool: rowCombos("zxcvbnm", 120), punctuation: false, numbers: false },
    numbers: { label: "Numbers", pool: rowCombos("0123456789", 120), punctuation: false, numbers: false },
    punctuation: { label: "Punctuation", pool: MANIAXE_LANGUAGES.english.words, punctuation: true, numbers: false }
  };

  const state = { drill: "common", time: 15, infinite: false };

  const els = {
    panel: document.getElementById("wordsPanel"),
    inner: document.getElementById("wordsInner"),
    liveStats: document.getElementById("liveStats"),
    resultsPanel: document.getElementById("resultsPanel"),
    clickVeil: document.getElementById("clickVeil"),
    hiddenInput: document.getElementById("hiddenInput")
  };

  function currentConfig() {
    const d = DRILLS[state.drill];
    return {
      pool: d.pool,
      mode: "time",
      duration: state.infinite ? null : state.time,
      punctuation: d.punctuation,
      numbers: d.numbers,
      fontFamily: "'JetBrains Mono', monospace",
      drillLabel: d.label
    };
  }

  const engine = new TypingEngine(els, function (result) {
    result.language = "";
    saveTestResult(result);
    els.resultsPanel.innerHTML = renderResultsPanel(result);
    els.resultsPanel.classList.add("show");
    wireResultsActions(result);
    if (typeof window.updateTypingLeaderboard === "function") window.updateTypingLeaderboard(result);
    els.panel.style.display = "none";
    document.getElementById("nextTestBtn").addEventListener("click", () => engine.start(currentConfig()));
  });

  function restart() { engine.start(currentConfig()); }

  document.getElementById("drillGroup").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.drill = btn.dataset.drill;
    document.querySelectorAll("#drillGroup .chip").forEach((c) => c.classList.toggle("active", c === btn));
    restart();
  });

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

  els.hiddenInput.addEventListener("beforeinput", (e) => engine.handleBeforeInput(e));
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
