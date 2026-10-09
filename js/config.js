/* ==========================================================================
   MANIAXE TYPING — SHARED CONFIG
   EmailJS credentials reused from the previous Maniaxe site so the contact
   forms deliver to the same inbox as before.
   ========================================================================== */

const EMAILJS_PUBLIC_KEY = "WZEM5PYoMJmw7VoZo";
const EMAILJS_SERVICE_ID = "service_hzq5qsl";
const EMAILJS_TEMPLATE_ID = "template_m6fg0y8";

/* ==========================================================================
   MANIAXE PRODUCT LINKS  — edit links here, they update across the whole site.
   ========================================================================== */
const MANIAXE_LINKS = {
  site:            "https://maniaxe.in",
  trakeyPage:      "https://maniaxe.in/app.html",
  trakeyApk:       "https://github.com/avanish9026-creator/maniaxe/releases/download/v2.1.1/Trakey.apk",
  trakeyUptodown:  "https://trakey.en.uptodown.com/android",
  ledraPage:       "https://maniaxe.in/ledra.html",
  ledraApk:        "https://github.com/avanish9026-creator/maniaxe/releases/download/v1.0.3/Ledra.apk"
};

if (typeof emailjs !== "undefined") {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}
