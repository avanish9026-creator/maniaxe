/* ==========================================================================
   MANIAXE — GOOGLE SIGN-IN HANDOFF
   Maniaxe, Trakey Web and Ledra Web live on the same address (maniaxe.in),
   but Trakey/Ledra use their own Firebase project (trakey-b6002) because that
   is where the phone-app data lives. So we pass the Google sign-in across:

     1. Maniaxe signs the user in with Google and saves the Google ID token here.
     2. Trakey Web / Ledra Web find it and call signInWithCredential on their
        own project, so the user is already signed in when the page opens.

   The token is short-lived (about an hour). If it is missing, expired or
   rejected, the apps simply show their normal "Sign in with Google" button.
   No Firebase imports here: each app passes in its own SDK functions.
   ========================================================================== */

const KEY = "maniaxeGoogleHandoff";
const MAX_AGE_MS = 50 * 60 * 1000;

export function saveHandoff(credential) {
  try {
    if (!credential || !credential.idToken) return;
    localStorage.setItem(KEY, JSON.stringify({ idToken: credential.idToken, at: Date.now() }));
  } catch (_) {}
}

export function clearHandoff() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}

export function hasHandoff() {
  try {
    const h = JSON.parse(localStorage.getItem(KEY) || "null");
    return !!(h && h.idToken && Date.now() - h.at < MAX_AGE_MS);
  } catch (_) { return false; }
}

/** Returns true if the user was signed in with the Maniaxe Google account. */
export async function ssoSignIn(auth, GoogleAuthProvider, signInWithCredential) {
  if (!hasHandoff()) { clearHandoff(); return false; }
  try {
    const { idToken } = JSON.parse(localStorage.getItem(KEY));
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  } catch (err) {
    console.warn("Maniaxe single sign-on was not accepted:", err && err.code);
    clearHandoff();
    return false;
  }
}
