# Maniaxe + Trakey + Ledra web integration

## What changed

- Maniaxe Typing remains the base site and keeps its existing typing/auth/features.
- The main navigation now has **Apps** instead of the old single **App** entry.
- `apps.html` is the product hub for Maniaxe Typing, Trakey and Ledra.
- The supplied Trakey Web app is available at `trakey-web/`.
- The supplied Ledra Web app is available at `ledra-web/`.
- Trakey Android keeps its existing page at `app.html`, now titled **Trakey | Maniaxe** and linked to Trakey Web.
- A new `ledra.html` product page is provided, titled **Ledra | Maniaxe**.
- The old hidden `/trakey-admin/` footer wording/link was removed.
- The footer now contains direct Trakey APK and temporary Ledra APK links.

## Shared Google login

Maniaxe's existing Google sign-in remains the first login. After a successful Google popup, the Google OAuth access token is kept for the current browser session. Trakey Web and Ledra Web can reuse that Google credential with their existing Firebase projects through `signInWithCredential`, so the user does not need to choose the Google account again.

Trakey and Ledra already use the same Firebase project (`trakey-b6002`), so their Firebase Auth identity is the same UID for the same Google account. Maniaxe Typing intentionally remains on its existing `maniaxe-typing` Firebase project so its existing accounts and data are not moved or broken.

The child apps still retain their original Google popup fallback if no reusable Maniaxe Google session is available.

## Firebase console requirement

In Firebase project **trakey-b6002** add the production site domain under:

Authentication → Settings → Authorized domains

Add:

- `maniaxe.in`
- `www.maniaxe.in` (only if you use the www hostname)

For local testing, add the exact hostname shown by your local server if it is not already present, for example `127.0.0.1` or `localhost`.

Google Sign-In must remain enabled in `trakey-b6002`.

## APK links

Trakey:

`https://github.com/avanish9026-creator/maniaxe/releases/latest/download/trakey.apk`

`https://trakey.en.uptodown.com/android`

Ledra currently uses the same GitHub APK URL as a temporary placeholder, exactly as requested. Replace that one URL later when the Ledra APK release is published.
