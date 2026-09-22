/* ==========================================================================
   MANIAXE TYPING — SHARED SITE CHROME
   Header, footer, mobile nav, theme toggle, auth-aware UI, footer contact form.
   Runs on every page.
   ========================================================================== */

const NAV_ITEMS = [
  { href: "index.html", label: "Test", page: "test" },
  { href: "practice.html", label: "Practice", page: "practice" },
  { href: "learn.html", label: "Learn", page: "learn" },
  { href: "shortcuts.html", label: "Shortcuts", page: "shortcuts" },
  { href: "shot.html", label: "Shot", page: "shot" },
  { href: "app.html", label: "App", page: "app" },
  { href: "contact.html", label: "Contact us", page: "contact" }
];

function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;
  const current = document.body.dataset.page || "";

  const navLinks = (cls) => NAV_ITEMS.map(item =>
    `<a href="${item.href}" class="${cls}${item.page === current ? " active" : ""}">${item.label}</a>`
  ).join("");

  mount.innerHTML = `
    <div class="header-inner">
      <a href="index.html" class="brand">
        <img src="assets/logo-192.png" alt="Maniaxe Typing logo">
        Maniaxe<span class="tag">typing</span>
      </a>

      <nav class="main-nav">${navLinks("nav-link")}</nav>

      <div class="header-actions">
        <button class="icon-btn" id="themeToggle" type="button" aria-label="Toggle theme">
          <svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>
        </button>

        <div class="auth-slot" id="authSlot">
          <a href="login.html" class="btn btn-ghost">Sign in</a>
        </div>

        <button class="mobile-toggle" id="mobileToggle" type="button" aria-label="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>
        </button>
      </div>
    </div>
    <nav class="mobile-nav" id="mobileNav">${navLinks("nav-link")}</nav>
  `;

  document.getElementById("mobileToggle").addEventListener("click", () => {
    document.getElementById("mobileNav").classList.toggle("open");
  });
}

function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;

  mount.innerHTML = `
    <div class="footer-top">
      <div class="footer-brand">
        <a href="index.html" class="brand">
          <img src="assets/logo-192.png" alt="Maniaxe Typing logo">
          Maniaxe<span class="tag">typing</span>
        </a>
        <p>A clean, fast typing test. Track your words per minute, practice with purpose and type in the language you choose.</p>
      </div>

      <div class="footer-col">
        <h4>Product</h4>
        <ul>
          <li><a href="index.html">Test</a></li>
          <li><a href="practice.html">Practice</a></li>
          <li><a href="learn.html">Learn</a></li>
          <li><a href="shortcuts.html">Shortcuts</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Connect</h4>
        <ul>
          <li>
            <a href="https://www.youtube.com/@maniaxe" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.6-.46-5.3a3 3 0 0 0-2.1-2.1C18.7 4 12 4 12 4s-6.7 0-8.44.6a3 3 0 0 0-2.1 2.1C1 8.4 1 12 1 12s0 3.6.46 5.3a3 3 0 0 0 2.1 2.1C5.3 20 12 20 12 20s6.7 0 8.44-.6a3 3 0 0 0 2.1-2.1C23 15.6 23 12 23 12z" stroke="none"/><path d="M10 9l6 3-6 3V9z" fill="var(--surface)" stroke="none"/></svg>
              YouTube
            </a>
          </li>
          <li>
            <a href="https://maniaxe.in" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.5 2.6 4 6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-6-4-9s1.5-6.4 4-9z"></path></svg>
              maniaxe.in
            </a>
          </li>
          <li>
            <a href="app.html#download-apk" id="footerApkLink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="M7 10l5 5 5-5"></path><path d="M4 21h16"></path></svg>
              Trakey APK
            </a>
          </li>
        </ul>
      </div>

      <div class="footer-contact">
        <h4>Contact us</h4>
        <p class="hint">Questions, feedback or bug reports — send them straight to the team.</p>
        <form id="footerContactForm">
          <input type="text" name="user_name" placeholder="Name" required>
          <input type="email" name="user_email" placeholder="Email" required>
          <textarea name="message" placeholder="Description" required></textarea>
          <button type="submit" class="btn btn-primary btn-block" id="footerContactBtn">Send message</button>
          <p class="footer-msg" id="footerContactMsg"></p>
        </form>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© <span id="year"></span> Maniaxe Typing</span>
      <span><a href="contact.html">Contact</a> · <a href="app.html">App</a></span>
    </div>
  `;

  document.getElementById("year").textContent = new Date().getFullYear();
  wireFooterContactForm();
}

function wireFooterContactForm() {
  const form = document.getElementById("footerContactForm");
  if (!form || typeof emailjs === "undefined") return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const btn = document.getElementById("footerContactBtn");
    const msg = document.getElementById("footerContactMsg");
    btn.disabled = true;
    btn.textContent = "Sending...";
    msg.textContent = "";

    emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, form)
      .then(() => {
        msg.style.color = "var(--correct)";
        msg.textContent = "Message sent. Thanks!";
        form.reset();
      })
      .catch(() => {
        msg.style.color = "var(--error)";
        msg.textContent = "Could not send. Please try again.";
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = "Send message";
      });
  });
}

/* ---------- theme ---------- */

function initTheme() {
  const saved = localStorage.getItem("maniaxeTheme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("maniaxeTheme", next);
  });
}

/* ---------- auth-aware header ---------- */

function initials(name, email) {
  const src = (name || email || "?").trim();
  return src.slice(0, 1).toUpperCase();
}

function renderAuthUI(user) {
  const slot = document.getElementById("authSlot");
  if (!slot) return;

  if (!user) {
    slot.innerHTML = `<a href="login.html" class="btn btn-ghost">Sign in</a>`;
    return;
  }

  const name = user.displayName || user.email || "Account";
  slot.innerHTML = `
    <button class="profile-btn" id="profileBtn" type="button">
      <span class="profile-avatar">${initials(user.displayName, user.email)}</span>
      ${name.split(" ")[0]}
    </button>
    <div class="profile-menu" id="profileMenu">
      <a href="profile.html">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"></path><path d="M7 15l4-6 4 3 5-7"></path></svg>
        View progress
      </a>
      <hr>
      <button class="danger" id="logoutBtn" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path></svg>
        Log out
      </button>
    </div>
  `;

  document.getElementById("profileBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("profileMenu").classList.toggle("open");
  });
  document.addEventListener("click", () => {
    const m = document.getElementById("profileMenu");
    if (m) m.classList.remove("open");
  });
  document.getElementById("logoutBtn").addEventListener("click", () => {
    if (typeof logoutUser === "function") logoutUser();
  });
}

/* ---------- apk download guard for legacy download links ---------- */

function wireApkDownloadGuard(link) {
  if (!link) return;
  link.addEventListener("click", function (e) {
    if (!window.maniaxeCurrentUser) {
      e.preventDefault();
      openAuthGateModal();
    }
  });
}

function openAuthGateModal() {
  const modal = document.getElementById("authGateModal");
  if (modal) modal.classList.add("show");
}
function closeAuthGateModal() {
  const modal = document.getElementById("authGateModal");
  if (modal) modal.classList.remove("show");
}

function injectAuthGateModal() {
  if (document.getElementById("authGateModal")) return;
  const div = document.createElement("div");
  div.className = "modal-overlay";
  div.id = "authGateModal";
  div.innerHTML = `
    <div class="modal-box">
      <h3>Sign in to continue</h3>
      <p>Please sign in to use this account-only feature.</p>
      <div class="modal-actions">
        <a href="login.html" class="btn btn-primary">Sign in</a>
        <button class="btn btn-ghost" onclick="closeAuthGateModal()" type="button">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener("click", (e) => { if (e.target === div) closeAuthGateModal(); });
}

/* ---------- toast ---------- */

function showToast(text) {
  let t = document.getElementById("maniaxeToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "maniaxeToast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- accordion (FAQ) ---------- */

function initAccordions() {
  document.querySelectorAll(".accordion-item").forEach((item) => {
    const q = item.querySelector(".accordion-q");
    const a = item.querySelector(".accordion-a");
    if (!q || !a) return;
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".accordion-item.open").forEach((o) => {
        if (o !== item) { o.classList.remove("open"); o.querySelector(".accordion-a").style.maxHeight = null; }
      });
      item.classList.toggle("open", !isOpen);
      a.style.maxHeight = !isOpen ? a.scrollHeight + "px" : null;
    });
  });
}

/* ---------- boot ---------- */

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  initTheme();
  injectAuthGateModal();
  initAccordions();

  if (typeof watchAuthState === "function") {
    watchAuthState(function (user) {
      window.maniaxeCurrentUser = user;
      renderAuthUI(user);
      document.dispatchEvent(new CustomEvent("maniaxe-auth-ready", { detail: { user } }));
    });
  } else {
    renderAuthUI(null);
  }
});
