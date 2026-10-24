# Trakey Web: Pro, payment and limits (one-time setup)

Web now has the same Pro flow as the app: plans (Monthly / Yearly / Lifetime), UPI QR + UPI ID, UTR + screenshot, "under review",
approve / reject in Trakey Admin. Pro / trial / star reward = unlimited, PRO badge beside the name. One Pro works on web and in the app (same `proStatus/{uid}`).

## Files (upload all four into the same folder as before: maniaxe.in/trakey/)
- `pay.js`            NEW. The Trakey Pro page + payment. Port of TrakeyProScreen.kt + TrakeyPayment.kt.
- `trakey_pay_qr.png` NEW. The same QR image as the app (res/drawable-nodpi/trakey_pay_qr.png). If you ever change the UPI ID, change the PNG AND `UPI_ID` in pay.js.
- `pro.js`            Free limits, prices, tier rules.
- `index.html`        "Trakey Pro" in the sidebar, PRO badge opens the Pro page, "Get Trakey Pro" button when a free limit is used up.

## Where to change things
- Prices:  `PRICE_MONTHLY / PRICE_YEARLY / PRICE_LIFETIME` at the top of `pro.js` (keep the same as TrakeyPro.kt).
- Web free limits: `FREE_LIMITS` in `pro.js`. Now 10 AI scans + 10 AI imports a day (the app stays 5 + 3).
- UPI ID, name, approval text, support email: top of `pay.js`.

## Firestore: no new rules for payment
Web writes the SAME three documents in ONE batch as the app, with the SAME fields (`appVersion` is "web" instead of the app version):
`payments/{orderId}`, `paymentShots/{orderId}`, `paymentUtrs/{utr}`, and `contactMessages` for payment help.
Your live rules already allow this for the app, and the web user is the same Firebase account, so it should just work.
**Test once with a Rs 19 order from the web.** If submit says "This UTR can't be used" with a UTR you know is new, your payments rule
checks something the web does not send (most likely `appVersion` must look like an app version). Fix the rule or the `WEB_VERSION` value in pay.js.

Still needed (from the earlier web update, only if you have not added it yet): the `webUsage/{uid}` rule for the daily counter.
```
    match /webUsage/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['day', 'scanCount', 'importCount'])
        && request.resource.data.day is string
        && request.resource.data.scanCount is int
        && request.resource.data.importCount is int
        && request.resource.data.scanCount >= 0 && request.resource.data.scanCount <= 1000
        && request.resource.data.importCount >= 0 && request.resource.data.importCount <= 1000;
    }
```
Do not replace your whole rules file with an old copy; add only this block.

## Approving
Nothing changes in Trakey Admin: web orders appear in the same list (their app version column says "web"). Approve writes `proStatus/{uid}.proUntil`;
an open web page unlocks within a second or two, no refresh.

## Limits: what they can and cannot do
Web sends scans straight from the browser to Google with the user's OWN Gemini key, so the daily limit is soft and client-side
(someone technical can clear browser storage). It costs you no API money; it only makes Pro worth buying. A hard limit needs web to go through
your Cloudflare AI server like the app does. App and web counts are separate.
