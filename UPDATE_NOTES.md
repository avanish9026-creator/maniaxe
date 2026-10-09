# Maniaxe — Update 3: Trakey + Ledra join the site

## What is new
- **Apps launcher** (☰ Apps) in the header: Maniaxe Typing, Trakey and Ledra, each with a *Web app* and a *Get the app* link. On phones the same links sit in the ☰ menu under "Apps". The main nav stays short (the old "App" item moved into the launcher).
- **Trakey page** (`app.html`, title "Trakey | Maniaxe"): two download buttons (Uptodown + direct GitHub APK), share menu (Uptodown / page / GitHub APK), and an "Open Trakey Web" button.
- **Ledra page** (`ledra.html`, title "Ledra | Maniaxe"): one GitHub APK download button, share menu (page / GitHub APK), and an "Open Ledra Web" button.
- **Trakey Web** at `/trakey/` and **Ledra Web** at `/ledra/` (title "Trakey Web | Maniaxe" / "Ledra Web | Maniaxe"), each with a link back to its app page.
- **Footer**: the hidden "also work" admin link is gone from the sentence. Under *Connect* you now have Trakey APK, a separate Admin pill beside Trakey APK and Ledra APK, both APK links direct downloads.
- **One Google sign-in**: sign in with Google on Maniaxe and Trakey Web / Ledra Web sign you in automatically (see below).

## Change links in ONE place
`js/config.js` → `MANIAXE_LINKS`. Current APK links:
- Trakey: `.../releases/download/v2.1.1/Trakey.apk`
- Ledra: `.../releases/download/v1.0.3/Ledra.apk`

For a new version, change the link there (and the footer, both app pages and share menus update). The Trakey download counter reads the **latest GitHub release** and looks for an asset called `Trakey.apk` (not case sensitive).

## Google sign-in across Maniaxe, Trakey Web and Ledra Web
Each product has its own Firebase project: Maniaxe = `maniaxe-typing`, Trakey = `trakey-b6002`, Ledra = `ledra-f8331`. Their user data cannot be merged, so `js/sso.js` hands the Google sign-in over: after "Continue with Google" on Maniaxe, Trakey Web and Ledra Web sign in to their own project with it automatically.

**One-time Firebase setup (otherwise the web apps simply show their normal Google button):**
1. For **both** `trakey-b6002` and `ledra-f8331`: Authentication → Sign-in method → Google → *Safelist client IDs from external projects* → add the **Web client ID** of `maniaxe-typing` (Google Cloud console → APIs & Services → Credentials → "Web client (auto created by Google Service)").
2. For **both** projects: Authentication → Settings → **Authorized domains** → add `maniaxe.in`.
3. `maniaxe-typing`: make sure `maniaxe.in` is in Authorized domains (it already works if Maniaxe login works today).

Works for people who used **Continue with Google** on Maniaxe. The handoff token lasts about an hour, then each web app keeps its own session. Signing out clears it.

## Ledra Web
`ledra/firebase-config.js` uses project `ledra-f8331`. Ledra Web syncs `ledra_backups/{uid}/records`, so the Firestore rules of `ledra-f8331` must let a signed-in user read/write their own `ledra_backups/{uid}/...` (same idea as the Trakey backup rule).

## Trakey admin (`/trakey-admin/`)
Already restricted: sign-in is accepted only for `support.trakey@gmail.com`, and the real protection is the Firestore rule that allows admin actions only for that account's UID. See the summary message for details.

## Folder layout
```
trakey/        Trakey Web   (index.html, core.js, exam.js)
ledra/         Ledra Web
docs/          Firebase files + README from the two web projects (not used by the site)
assets/ledra-logo.svg   Ledra icon
js/sso.js      Google sign-in handoff
```
