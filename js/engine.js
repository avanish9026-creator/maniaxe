/* ==========================================================================
   MANIAXE TYPING — CORE ENGINE
   A word-by-word typing test: type a word, press space to submit it, back-
   space to revisit the previous word. Works for any language/script because
   it compares against the hidden <input>'s value rather than raw keycodes.
   ========================================================================== */

class TypingEngine {
  /**
   * @param {Object} els - DOM references
   *   panel, inner, liveStats, resultsPanel, clickVeil, hiddenInput, testFooterHint
   * @param {Function} onFinish - called with the results object
   */
  constructor(els, onFinish) {
    this.els = els;
    this.onFinish = onFinish;
    this.reset();
    this._bindGlobalKeys();
  }

  reset() {
    this.words = [];
    this.wordEls = [];
    this.typed = [];
    this.currentIndex = 0;
    this.startTime = null;
    this.finished = false;
    this.timerId = null;
    this.elapsed = 0;
  }

  /**
   * @param {Object} cfg
   *   pool: string[] base vocabulary
   *   mode: 'time' | 'words'
   *   duration: seconds (null = infinite) — used when mode === 'time'
   *   wordCount: number — used when mode === 'words'
   *   punctuation: bool, numbers: bool
   *   fontFamily: css font-family string
   */
  start(cfg) {
    this.reset();
    this.cfg = cfg;
    this.els.panel.style.fontFamily = cfg.fontFamily || "";
    const initialCount = cfg.mode === "words" ? cfg.wordCount : 60;
    this.words = this._buildWords(cfg.pool, initialCount, cfg);
    this._render();
    this._resetLiveStats();
    this.els.resultsPanel.classList.remove("show");
    this.els.panel.style.display = "";
    this.els.clickVeil.classList.add("show");
    this.els.hiddenInput.value = "";
    this.els.hiddenInput.focus();
  }

  focusInput() {
    this.els.hiddenInput.focus();
    this.els.clickVeil.classList.remove("show");
  }

  /* -------------------- word generation -------------------- */

  _buildWords(pool, count, cfg) {
    const out = [];
    let sentenceStart = true;
    for (let i = 0; i < count; i++) {
      if (cfg.numbers && Math.random() < 0.11) {
        out.push(String(Math.floor(Math.random() * 899) + 1));
        sentenceStart = false;
        continue;
      }
      let w = pool[Math.floor(Math.random() * pool.length)];
      if (sentenceStart) {
        w = w.charAt(0).toUpperCase() + w.slice(1);
        sentenceStart = false;
      }
      if (cfg.punctuation && Math.random() < 0.16) {
        const marks = MANIAXE_PUNCTUATION;
        const mark = marks[Math.floor(Math.random() * marks.length)];
        w = w + mark;
        if (mark === "." || mark === "!" || mark === "?") sentenceStart = true;
      }
      out.push(w);
    }
    return out;
  }

  _extendWords(count) {
    const more = this._buildWords(this.cfg.pool, count, this.cfg);
    this.words = this.words.concat(more);
    more.forEach((w) => this._renderWord(w));
  }

  /* -------------------- rendering -------------------- */

  _render() {
    this.els.inner.innerHTML = "";
    this.els.inner.style.transform = "translateY(0px)";
    this.wordEls = [];
    this.words.forEach((w) => this._renderWord(w));
    this._placeCaret();
  }

  _renderWord(word) {
    const wordEl = document.createElement("span");
    wordEl.className = "word";
    const chars = [];
    for (const ch of word) {
      const cs = document.createElement("span");
      cs.className = "char";
      cs.textContent = ch;
      wordEl.appendChild(cs);
      chars.push(cs);
    }
    const caretSlot = document.createElement("span");
    caretSlot.className = "char caret-slot";
    wordEl.appendChild(caretSlot);
    this.els.inner.appendChild(wordEl);
    this.wordEls.push({ el: wordEl, chars, caretSlot, target: word });
  }

  _placeCaret() {
    this.wordEls.forEach((w) => {
      w.chars.forEach((c) => c.classList.remove("current"));
      w.caretSlot.classList.remove("current");
    });
    const active = this.wordEls[this.currentIndex];
    if (!active) return;
    const val = this.els.hiddenInput.value;
    if (val.length < active.target.length) {
      active.chars[val.length].classList.add("current");
    } else {
      active.caretSlot.classList.add("current");
    }
    this._scrollToActive();
  }

  _scrollToActive() {
    const active = this.wordEls[this.currentIndex];
    if (!active) return;
    const panel = this.els.panel;
    const lineHeight = parseFloat(getComputedStyle(panel).fontSize) * 2.05;
    const lineIndex = Math.round(active.el.offsetTop / lineHeight);
    const shift = lineIndex >= 1 ? (lineIndex - 1) * lineHeight : 0;
    this.els.inner.style.transform = `translateY(-${shift}px)`;
  }

  /* -------------------- input handling -------------------- */

  handleInput() {
    if (this.finished) return;
    if (!this.startTime) this._startTimer();

    const active = this.wordEls[this.currentIndex];
    if (!active) return;
    const val = this.els.hiddenInput.value;

    // clear old extra spans, rebuild between target chars and caret slot
    while (active.caretSlot.previousSibling && active.caretSlot.previousSibling.classList.contains("extra-live")) {
      active.el.removeChild(active.caretSlot.previousSibling);
    }

    for (let i = 0; i < active.target.length; i++) {
      const c = active.chars[i];
      c.classList.remove("correct", "incorrect");
      if (i < val.length) {
        c.classList.add(val[i] === active.target[i] ? "correct" : "incorrect");
      }
    }
    if (val.length > active.target.length) {
      const extraStr = val.slice(active.target.length);
      for (const ch of extraStr) {
        const es = document.createElement("span");
        es.className = "char incorrect extra extra-live";
        es.textContent = ch;
        active.el.insertBefore(es, active.caretSlot);
      }
    }

    this._placeCaret();
    this._updateLiveStats();

    if (this.cfg.mode !== "words" && this.currentIndex > this.words.length - 12) {
      this._extendWords(40);
    }
  }

  handleKeydown(e) {
    if (this.finished) return;

    if (e.key === "Escape") {
      e.preventDefault();
      this.start(this.cfg);
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      this._submitWord();
      return;
    }

    if (e.key === "Backspace") {
      const val = this.els.hiddenInput.value;
      if (val.length === 0 && this.currentIndex > 0) {
        e.preventDefault();
        this._backtrack();
      }
    }
  }

  _submitWord() {
    const active = this.wordEls[this.currentIndex];
    if (!active) return;
    const val = this.els.hiddenInput.value;
    if (val.length === 0) return; // ignore empty submits

    this.typed[this.currentIndex] = val;

    for (let i = 0; i < active.target.length; i++) {
      const c = active.chars[i];
      c.classList.remove("current", "correct", "incorrect");
      if (i < val.length) {
        c.classList.add(val[i] === active.target[i] ? "correct" : "incorrect");
      } else {
        c.classList.add("missed");
      }
    }
    active.caretSlot.classList.remove("current");

    this.currentIndex++;
    this.els.hiddenInput.value = "";

    if (this.cfg.mode === "words" && this.currentIndex >= this.words.length) {
      this._finish();
      return;
    }
    this._placeCaret();
    this._updateLiveStats();
  }

  _backtrack() {
    this.currentIndex--;
    const prev = this.wordEls[this.currentIndex];
    const prevVal = this.typed[this.currentIndex] || "";
    this.els.hiddenInput.value = prevVal;
    prev.chars.forEach((c) => c.classList.remove("missed"));
    this.handleInput();
  }

  /* -------------------- timing + stats -------------------- */

  _startTimer() {
    this.startTime = Date.now();
    this.timerId = setInterval(() => {
      this.elapsed = (Date.now() - this.startTime) / 1000;
      if (this.cfg.mode === "time" && this.cfg.duration) {
        const remaining = Math.max(0, Math.ceil(this.cfg.duration - this.elapsed));
        this._setLiveTime(remaining);
        if (remaining <= 0) { this._finish(); return; }
      } else {
        this._setLiveTime(Math.floor(this.elapsed));
      }
      this._updateLiveStats();
    }, 250);
  }

  _resetLiveStats() {
    const t = this.cfg && this.cfg.mode === "time" && this.cfg.duration ? this.cfg.duration : 0;
    this._setLiveTime(t);
    this.els.liveStats.innerHTML = this._statsHTML(t, 0, 100);
  }

  _setLiveTime(v) {
    this._lastTimeVal = v;
  }

  _updateLiveStats() {
    const minutes = Math.max(this.elapsed, 0.001) / 60;
    let correct = 0, incorrect = 0, extra = 0;
    for (let i = 0; i < this.currentIndex; i++) {
      const target = this.wordEls[i].target;
      const val = this.typed[i] || "";
      for (let j = 0; j < Math.max(target.length, val.length); j++) {
        if (j >= val.length) continue;
        if (j >= target.length) extra++;
        else if (val[j] === target[j]) correct++;
        else incorrect++;
      }
    }
    const wpm = this.startTime ? Math.round((correct / 5) / minutes) : 0;
    const acc = (correct + incorrect + extra) ? Math.round((correct / (correct + incorrect + extra)) * 100) : 100;
    this.els.liveStats.innerHTML = this._statsHTML(this._lastTimeVal, wpm, acc);
  }

  _statsHTML(time, wpm, acc) {
    const timeLabel = this.cfg && this.cfg.mode === "time" && this.cfg.duration ? "time" : "elapsed";
    return `
      <div><span>${timeLabel}</span>${time}s</div>
      <div><span>wpm</span>${wpm}</div>
      <div><span>accuracy</span>${acc}%</div>
    `;
  }

  finishNow() { this._finish(); }

  _finish() {
    if (this.finished) return;
    this.finished = true;
    clearInterval(this.timerId);

    // capture in-progress word if any characters were typed
    const partial = this.els.hiddenInput.value;
    if (partial.length > 0 && !this.typed[this.currentIndex]) {
      this.typed[this.currentIndex] = partial;
    }
    const attempted = this.typed.length;

    let correct = 0, incorrect = 0, extra = 0, missed = 0;
    for (let i = 0; i < attempted; i++) {
      const target = this.wordEls[i] ? this.wordEls[i].target : "";
      const val = this.typed[i] || "";
      const len = Math.max(target.length, val.length);
      for (let j = 0; j < len; j++) {
        if (j >= val.length) missed++;
        else if (j >= target.length) extra++;
        else if (val[j] === target[j]) correct++;
        else incorrect++;
      }
    }

    const minutes = Math.max(this.elapsed, 1 / 60) / 60;
    const totalTyped = correct + incorrect + extra;
    const wpm = Math.round((correct / 5) / minutes) || 0;
    const rawWpm = Math.round((totalTyped / 5) / minutes) || 0;
    const accuracy = totalTyped ? Math.round((correct / totalTyped) * 100) : 100;

    this.els.clickVeil.classList.remove("show");

    const result = {
      wpm, rawWpm, accuracy,
      correct, incorrect, extra, missed,
      time: Math.round(this.elapsed),
      mode: this.cfg.mode,
      duration: this.cfg.duration,
      wordCount: this.cfg.wordCount,
      language: this.cfg.languageLabel || "",
      drill: this.cfg.drillLabel || "",
      timestamp: Date.now()
    };

    if (typeof this.onFinish === "function") this.onFinish(result);
  }

  _bindGlobalKeys() {
    // Tab+Enter convenience restart (in addition to Escape)
    let tabHeld = false;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab") { tabHeld = true; e.preventDefault(); }
      if (e.key === "Enter" && tabHeld && this.cfg) {
        e.preventDefault();
        this.start(this.cfg);
      }
    });
    document.addEventListener("keyup", (e) => { if (e.key === "Tab") tabHeld = false; });
  }
}
