/* ==========================================================================
   MANIAXE TYPING — CORE ENGINE
   ========================================================================== */

class TypingEngine {
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
    this.lastInputValue = "";
    this.keystrokeCorrect = 0;
    this.keystrokeIncorrect = 0;
    this.keystrokeExtra = 0;
  }

  start(cfg) {
    this.reset();
    this.cfg = cfg;
    this.els.panel.style.fontFamily = cfg.fontFamily || "";
    this.words = this._buildInitialWords(cfg);
    this._render();
    this._resetLiveStats();
    this.els.resultsPanel.classList.remove("show");
    this.els.panel.style.display = "";
    this.els.clickVeil.classList.add("show");
    this.els.hiddenInput.value = "";
    this.els.hiddenInput.disabled = false;
    this.els.hiddenInput.setAttribute("inputmode", cfg.inputMode || "text");
    this.els.hiddenInput.setAttribute("lang", cfg.languageCode || "en");
    this.els.hiddenInput.focus();
  }

  focusInput() {
    if (this.finished) return;
    this.els.hiddenInput.focus();
    this.els.clickVeil.classList.remove("show");
  }

  _buildInitialWords(cfg) {
    if (Array.isArray(cfg.customWords)) return cfg.customWords.slice();
    const initialCount = cfg.mode === "words" ? cfg.wordCount : 60;
    return this._buildWords(cfg.pool || [], initialCount, cfg);
  }

  _buildWords(pool, count, cfg) {
    const out = [];
    let sentenceStart = true;
    if (!pool.length) return out;
    for (let i = 0; i < count; i++) {
      if (cfg.numbers && Math.random() < 0.11) {
        out.push(String(Math.floor(Math.random() * 899) + 1));
        sentenceStart = false;
        continue;
      }
      let w = pool[Math.floor(Math.random() * pool.length)] || "";
      if (sentenceStart && w) {
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
    if (this.cfg.customWords) return;
    const more = this._buildWords(this.cfg.pool, count, this.cfg);
    this.words = this.words.concat(more);
    more.forEach((w) => this._renderWord(w));
  }

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
      if (active.chars[val.length]) active.chars[val.length].classList.add("current");
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

  _recordNewInput(val) {
    const prev = this.lastInputValue || "";
    if (val.length <= prev.length) return;
    for (let i = prev.length; i < val.length; i++) {
      const ch = val[i];
      const target = this.wordEls[this.currentIndex]?.target || "";
      if (i >= target.length) this.keystrokeExtra++;
      else if (ch === target[i]) this.keystrokeCorrect++;
      else this.keystrokeIncorrect++;
    }
  }

  handleInput() {
    if (this.finished) return;
    if (!this.startTime) this._startTimer();

    const active = this.wordEls[this.currentIndex];
    if (!active) return;

    let val = this.els.hiddenInput.value;

    // Mobile virtual keyboards often do not emit a reliable keydown for Space.
    // Treat a trailing whitespace character as a word submission.
    if (/\s$/.test(val)) {
      val = val.replace(/\s+$/g, "");
      this.els.hiddenInput.value = val;
      this._recordNewInput(val);
      this.lastInputValue = val;
      if (val.length) {
        this._renderCurrentWord(val);
        this._submitWord();
        return;
      }
      this.lastInputValue = "";
      return;
    }

    this._recordNewInput(val);
    this.lastInputValue = val;
    this._renderCurrentWord(val);
    this._placeCaret();
    this._updateLiveStats();

    if ((this.cfg.mode === "words" || this.cfg.custom) && this.currentIndex === this.words.length - 1 && val.length >= active.target.length) {
      this._submitWord();
      return;
    }

    if (this.cfg.mode !== "words" && !this.cfg.customWords && this.currentIndex > this.words.length - 12) {
      this._extendWords(40);
    }
  }

  _renderCurrentWord(val) {
    const active = this.wordEls[this.currentIndex];
    if (!active) return;
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
  }

  handleBeforeInput(e) {
    if (this.finished || !e) return;
    if (e.inputType === "insertText" && typeof e.data === "string" && /\s/.test(e.data)) {
      e.preventDefault();
      this._submitWord();
    }
  }

  handleKeydown(e) {
    if (this.finished) return;

    if (e.key === " ") {
      e.preventDefault();
      this._submitWord();
      return;
    }

    if (e.key === "Backspace") {
      if (this.cfg.disableBackspace) {
        e.preventDefault();
        return;
      }
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
    if (val.length === 0) return;

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
    this.lastInputValue = "";

    if ((this.cfg.mode === "words" || this.cfg.custom) && this.currentIndex >= this.words.length) {
      this._finish();
      return;
    }
    this._placeCaret();
    this._updateLiveStats();
  }

  _backtrack() {
    if (this.cfg.disableBackspace) return;
    this.currentIndex--;
    const prev = this.wordEls[this.currentIndex];
    const prevVal = this.typed[this.currentIndex] || "";
    this.els.hiddenInput.value = prevVal;
    prev.chars.forEach((c) => c.classList.remove("missed"));
    this.lastInputValue = prevVal;
    this._renderCurrentWord(prevVal);
    this._placeCaret();
    this._updateLiveStats();
  }

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

  _setLiveTime(v) { this._lastTimeVal = v; }

  _updateLiveStats() {
    const minutes = Math.max(this.elapsed, 0.001) / 60;
    let finalCorrect = 0;
    for (let i = 0; i < this.currentIndex; i++) {
      const target = this.wordEls[i].target;
      const val = this.typed[i] || "";
      for (let j = 0; j < Math.max(target.length, val.length); j++) {
        if (j < val.length && j < target.length && val[j] === target[j]) finalCorrect++;
      }
    }
    const active = this.wordEls[this.currentIndex];
    if (active) {
      const val = this.els.hiddenInput.value;
      for (let j = 0; j < Math.min(active.target.length, val.length); j++) {
        if (val[j] === active.target[j]) finalCorrect++;
      }
    }
    const wpm = this.startTime ? Math.round((finalCorrect / 5) / minutes) : 0;
    const totalStrokes = this.keystrokeCorrect + this.keystrokeIncorrect + this.keystrokeExtra;
    const acc = totalStrokes ? Math.round((this.keystrokeCorrect / totalStrokes) * 100) : 100;
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
    if (this.startTime) this.elapsed = (Date.now() - this.startTime) / 1000;

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
    const accuracyStrokes = this.keystrokeCorrect + this.keystrokeIncorrect + this.keystrokeExtra;
    const accuracy = accuracyStrokes ? Math.round((this.keystrokeCorrect / accuracyStrokes) * 100) : 100;

    this.els.clickVeil.classList.remove("show");

    const result = {
      wpm, rawWpm, accuracy,
      correct, incorrect, extra, missed,
      time: Math.round(this.elapsed),
      mode: this.cfg.mode,
      duration: this.cfg.duration,
      wordCount: this.cfg.wordCount,
      language: this.cfg.languageLabel || "",
      languageCode: this.cfg.languageCode || "",
      drill: this.cfg.drillLabel || "",
      custom: !!this.cfg.custom,
      pass: typeof this.cfg.passCriteria === "object" ? (
        (!this.cfg.passCriteria.minWpm || wpm >= this.cfg.passCriteria.minWpm) &&
        (!this.cfg.passCriteria.minAccuracy || accuracy >= this.cfg.passCriteria.minAccuracy)
      ) : null,
      timestamp: Date.now()
    };

    if (this.cfg.custom && this.cfg.customLabel) result.customLabel = this.cfg.customLabel;
    if (this.cfg.passCriteria) result.passCriteria = this.cfg.passCriteria;
    if (typeof this.onFinish === "function") this.onFinish(result);
  }

  _bindGlobalKeys() {
    let tabHeld = false;
    document.addEventListener("keydown", (e) => {
      if (!this.cfg) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.start(this.cfg);
        return;
      }
      if (e.key === "Tab") {
        tabHeld = true;
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" && tabHeld) {
        e.preventDefault();
        this.start(this.cfg);
      }
    }, true);
    document.addEventListener("keyup", (e) => {
      if (e.key === "Tab") tabHeld = false;
    }, true);
  }
}
