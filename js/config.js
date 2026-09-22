/* ==========================================================================
   MANIAXE TYPING — SHARED CONFIG
   EmailJS credentials reused from the previous Maniaxe site so the contact
   forms deliver to the same inbox as before.
   ========================================================================== */

const EMAILJS_PUBLIC_KEY = "WZEM5PYoMJmw7VoZo";
const EMAILJS_SERVICE_ID = "service_hzq5qsl";
const EMAILJS_TEMPLATE_ID = "template_m6fg0y8";

if (typeof emailjs !== "undefined") {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}
