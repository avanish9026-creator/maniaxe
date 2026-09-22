# Maniaxe Typing

A clean, fast typing website for Maniaxe with typing tests, practice drills,
learning material, keyboard shortcuts, account support and a dedicated Trakey
app showcase.

## What changed in this version

- Replaced the old Trakey-style Maniaxe site logo with the supplied Maniaxe
  Typing typewriter logo across the site branding, favicon assets and app
  chrome.
- Reworked `app.html` into a Play-Store-inspired Trakey page while keeping
  Maniaxe Typing's existing dark/light visual system.
- Added a Trakey app icon, one 16:9 showcase placeholder and two 9:16 showcase
  images. The three preview cards have equal-sized containers and remain in a
  horizontal rail on small screens instead of stacking vertically.
- Made the Trakey APK download control full width.
- Added a compact share popover on the Trakey page with two choices: share the
  Maniaxe Trakey app page or share the direct GitHub release APK link.
- Added keyboard shortcut content directly to the home page.
- Moved the FAQ accordion directly above the footer on the home page.
- Removed the standalone FAQ page from the main navigation and sitemap.
- Kept the existing Firebase authentication, Firestore ratings/feedback/download
  counter and EmailJS configuration intact.
- Trakey 1.1 APK downloads now use the published GitHub release instead of storing
  the 66 MB APK inside this website repository.

## Important files

```
index.html          Home typing test + shortcuts + inline FAQ
practice.html       Typing drills
learn.html          Learning material
shortcuts.html      Full shortcut reference
shot.html           Result image generator
app.html            Trakey Play-Store-style app page
contact.html        Contact page
login.html          Sign in
signup.html         Sign up
profile.html        Account/progress page
css/style.css       Shared Maniaxe design system and responsive layouts
js/                 Typing engine, auth, history and shared site chrome
assets/              Maniaxe branding + Trakey showcase assets
```

## Assets

The Maniaxe Typing logo is supplied as `assets/maniaxe-typing-logo.png` and is
also used to generate the standard `logo-192.png`, `logo-512.png`,
`apple-touch-icon.png` and favicon files.

The Trakey showcase uses only three promotional preview images:

- `assets/trakey-showcase-wide.png` — 16:9
- `assets/trakey-showcase-vertical-1.jpg` — 9:16
- `assets/trakey-showcase-vertical-2.jpg` — 9:16

Replace those three files later with real Trakey screenshots if desired; the
HTML/CSS layout does not need to change.

## Existing authentication/download behavior

The Trakey 1.1 download button records a download event in Firestore and then
opens the published GitHub release asset:
`https://github.com/avanish9026-creator/maniaxe/releases/latest/download/trakey.apk`

The Trakey feedback/rating form requires a signed-in Maniaxe account. If a visitor
tries to submit without signing in, the site opens the existing sign-in gate.
The EmailJS configuration is preserved for contact forms.


## Trakey ratings, feedback and download counter
The updated App page uses Firebase Firestore for live Trakey ratings, user feedback and download counts.

Create/verify these Firestore collections through the website:
- `trakey_ratings` — one rating document per authenticated user (document ID = Firebase UID).
- `trakey_feedback` — one feedback document per authenticated user (document ID = Firebase UID).
- `trakey_downloads` — one document for every authenticated Trakey APK download click.

A matching `firestore.rules` file is included in this ZIP. Publish those rules in the Firebase Console before production use.

## Firebase setup

The website is configured for the `maniaxe-typing` Firebase project. Email/Password and Google Authentication are used for account features. APK download counting uses a temporary Firebase Anonymous Authentication session when the visitor is not signed in; enable **Authentication → Sign-in method → Anonymous** in the Maniaxe Typing Firebase project before deploying this version. The included `firestore.rules` permits signed-in users to manage their own ratings/feedback and permits signed-in or anonymous Firebase users to create download records.
