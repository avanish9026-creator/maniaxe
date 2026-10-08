# Ledra web

Same data as the phone app, live in both directions, plus a grocery-style **Invoices** module (web only for now).

## 1. Connect it to Firebase (once, 2 minutes)
1. Firebase console > project **trakey-b6002** > gear > Project settings > General > *Your apps* > **Add app > Web (</>)**. Name it "Ledra web". Skip hosting for now.
2. Copy the `firebaseConfig` values into `firebase-config.js` (apiKey, messagingSenderId, appId).
3. Authentication > Sign-in method: **Google** must be on (it already is for the phone). Authentication > Settings > *Authorised domains*: `localhost` and `trakey-b6002.web.app` are there by default. Add any other address you use.
4. Firestore rules: nothing new. Sync lives under `ledra_backups/{uid}/records`, which the rule you already published for backup covers
   (`match /ledra_backups/{uid}/{document=**}`). If the phone's backup works, the web works.

## 2. Open it
- Quick test: in VS Code install **Live Server**, right-click `index.html` > Open with Live Server. Or run `npx serve .` in this folder.
- Put it online (free on Spark):
  ```
  npm i -g firebase-tools
  firebase login
  firebase deploy --only hosting
  ```
  If your default hosting site is already used by another app, run `firebase hosting:sites:create ledra-web`, then add `"site": "ledra-web"` inside `"hosting"` in `firebase.json` and deploy again. The address will be `https://ledra-web.web.app`.

## 3. Phone side
Replace the Kotlin files with the new ones, add **Sync.kt**, build, sign in with the same Google account. Settings > Backup shows **Live** when it is in step. The "Auto backup and live sync" switch controls both.

## How the sync behaves
- Every person, payment, fund, source, fund payment, employee, attendance and employee payment is its own record. Only the record you change is sent.
- A change shows on the other side in about a second. Offline? Both sides queue changes and send them when the connection returns.
- If the same record is edited on both sides at the same moment, the phone's version is kept (the later save wins).
- Settings that are about *money rules* (billing day, payment day, currency, fixed charges, defaults, form fields) are shared. Theme, PIN, reminders and the Collect/Pay switch stay on each device.

## Invoices
- **Items**: your price list (name, unit, price, GST %, optional barcode).
- **New bill**: tap items or type a name / scan a barcode and press Enter. Edit quantity, rate and per-line discount, add a bill discount, take cash / UPI / card, or mark **Credit** (udhaar). Amount received shows change or balance due.
- Prices are treated as GST-inclusive by default (shop MRP). Turn that off in Settings to add GST on top.
- Print as **A4 invoice** or **80 mm receipt**, share on WhatsApp, receive pending payments later, edit, copy as a new bill.
- Settings > Shop and invoices: shop name, address, phone, GSTIN, bill prefix, footer line, units.
