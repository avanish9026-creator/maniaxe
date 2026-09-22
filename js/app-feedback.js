import { getApps, getApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, setDoc,
  getDocs, query, orderBy, limit, onSnapshot, getCountFromServer,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseApp = getApps().length ? getApp() : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
const ratingsRef = db ? collection(db, "trakey_ratings") : null;
const feedbackRef = db ? collection(db, "trakey_feedback") : null;
const downloadsRef = db ? collection(db, "trakey_downloads") : null;

let selectedRating = 0;
let currentRatingDoc = null;

function starsText(value) {
  const rounded = Math.round(Number(value) || 0);
  return Array.from({ length: 5 }, (_, i) => i < rounded ? "★" : "☆").join(" ");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function setFormMessage(text, good = false) {
  const el = document.getElementById("feedbackFormMsg");
  if (!el) return;
  el.textContent = text;
  el.style.color = good ? "var(--correct)" : "var(--error)";
}

function updateRatingPicker() {
  document.querySelectorAll("#ratingPicker button").forEach(btn => {
    const n = Number(btn.dataset.rating);
    btn.classList.toggle("selected", n <= selectedRating);
  });
}

async function loadUserReview(user) {
  const note = document.getElementById("feedbackUserNote");
  const text = document.getElementById("feedbackText");
  if (!note || !text || !db) return;

  if (!user) {
    note.textContent = "Sign in to share your experience with Trakey.";
    selectedRating = 0;
    text.value = "";
    currentRatingDoc = null;
    updateRatingPicker();
    return;
  }

  note.textContent = `Signed in as ${user.displayName || user.email || "your Maniaxe account"}.`;
  const ratingSnap = await getDoc(doc(db, "trakey_ratings", user.uid));
  if (ratingSnap.exists()) {
    currentRatingDoc = ratingSnap.data();
    selectedRating = Number(currentRatingDoc.rating) || 0;
  } else {
    currentRatingDoc = null;
    selectedRating = 0;
  }
  const feedbackSnap = await getDoc(doc(db, "trakey_feedback", user.uid));
  text.value = feedbackSnap.exists() ? (feedbackSnap.data().text || "") : "";
  updateRatingPicker();
}

async function refreshRatingStats() {
  if (!ratingsRef) return;
  try {
    const snap = await getDocs(ratingsRef);
    let total = 0;
    snap.forEach(d => { total += Number(d.data().rating) || 0; });
    const count = snap.size;
    const avg = count ? total / count : 0;
    document.getElementById("appRatingValue").textContent = count ? avg.toFixed(1) : "0.0";
    const stars = document.getElementById("appRatingStars");
    stars.textContent = count ? starsText(avg) : "☆ ☆ ☆ ☆ ☆";
    stars.setAttribute("aria-label", count ? `${avg.toFixed(1)} out of 5 stars` : "No ratings yet");
    document.getElementById("appRatingCount").textContent = count;
  } catch (e) {
    console.warn("Could not load Trakey ratings", e);
  }
}

async function refreshDownloadCount() {
  if (!downloadsRef) return;
  try {
    const snap = await getCountFromServer(downloadsRef);
    document.getElementById("appDownloadCount").textContent = snap.data().count;
  } catch (e) {
    console.warn("Could not load Trakey download count", e);
  }
}

function listenForFeedback() {
  if (!feedbackRef) return;
  const list = document.getElementById("feedbackList");
  const countLabel = document.getElementById("feedbackCountLabel");
  const q = query(feedbackRef, orderBy("createdAt", "desc"), limit(12));
  onSnapshot(q, snap => {
    countLabel.textContent = snap.size;
    if (snap.empty) {
      list.innerHTML = '<div class="feedback-empty">No feedback yet. Be the first to share your experience.</div>';
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const item = d.data();
      const name = escapeHtml(item.displayName || "Maniaxe user");
      const text = escapeHtml(item.text || "");
      const rating = Number(item.rating) || 0;
      const ratingPart = rating ? `<span class="feedback-stars">${starsText(rating)}</span>` : "";
      return `<article class="feedback-item"><div class="feedback-item-top"><strong>${name}</strong>${ratingPart}</div><p>${text || "Rating submitted without written feedback."}</p></article>`;
    }).join("");
  }, err => {
    console.warn("Could not listen for Trakey feedback", err);
    list.innerHTML = '<div class="feedback-empty">Feedback is temporarily unavailable.</div>';
  });
}

async function submitReview() {
  const user = window.maniaxeCurrentUser;
  if (!user) {
    openAuthGateModal();
    return;
  }
  const textEl = document.getElementById("feedbackText");
  const button = document.getElementById("submitFeedbackBtn");
  const text = textEl.value.trim();
  if (!selectedRating && !text) {
    setFormMessage("Choose a star rating or write some feedback.");
    return;
  }
  if (text.length > 600) {
    setFormMessage("Feedback is limited to 600 characters.");
    return;
  }

  button.disabled = true;
  setFormMessage("Saving...", true);
  try {
    const profile = { uid: user.uid, displayName: user.displayName || user.email || "Maniaxe user" };
    if (selectedRating) {
      await setDoc(doc(db, "trakey_ratings", user.uid), {
        ...profile, rating: selectedRating, updatedAt: serverTimestamp()
      }, { merge: true });
    }
    if (text) {
      await setDoc(doc(db, "trakey_feedback", user.uid), {
        ...profile, text, rating: selectedRating || 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge: true });
    } else if (selectedRating) {
      const existing = await getDoc(doc(db, "trakey_feedback", user.uid));
      if (existing.exists()) await setDoc(doc(db, "trakey_feedback", user.uid), { rating: selectedRating, updatedAt: serverTimestamp() }, { merge: true });
    }
    setFormMessage("Thanks — your response has been saved.", true);
    await refreshRatingStats();
    await loadUserReview(user);
  } catch (e) {
    console.error(e);
    setFormMessage("Could not save right now. Check Firestore permissions and try again.");
  } finally {
    button.disabled = false;
  }
}

window.recordTrakeyDownload = async function () {
  if (!downloadsRef) return;
  let temporary = false;
  try {
    let user = window.maniaxeCurrentUser || null;
    if (!user) {
      if (typeof window.ensureDownloadAuth !== "function") throw new Error("Download authentication is unavailable.");
      const session = await window.ensureDownloadAuth();
      user = session.user;
      temporary = !!session.temporary;
    }

    // Store only an empty event document: the live counter needs the document count,
    // but there is no reason to expose a user's ID, email, or timestamp.
    await addDoc(downloadsRef, {});
    await refreshDownloadCount();
  } catch (e) {
    console.warn("Download count could not be recorded", e);
    showToast("Download started; count could not be updated");
  } finally {
    if (temporary && typeof window.endTemporaryDownloadAuth === "function") {
      try { await window.endTemporaryDownloadAuth(); } catch (e) { console.warn("Temporary download session cleanup failed", e); }
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#ratingPicker button").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!window.maniaxeCurrentUser) {
        openAuthGateModal();
        return;
      }
      selectedRating = Number(btn.dataset.rating);
      setFormMessage("");
      updateRatingPicker();
    });
  });

  const feedbackText = document.getElementById("feedbackText");
  feedbackText?.addEventListener("focus", () => {
    if (!window.maniaxeCurrentUser) {
      feedbackText.blur();
      openAuthGateModal();
    }
  });

  document.getElementById("submitFeedbackBtn")?.addEventListener("click", submitReview);

  document.addEventListener("maniaxe-auth-ready", e => loadUserReview(e.detail.user).catch(console.error));
  refreshRatingStats();
  refreshDownloadCount();
  listenForFeedback();
  if (window.maniaxeCurrentUser) loadUserReview(window.maniaxeCurrentUser).catch(console.error);
});
