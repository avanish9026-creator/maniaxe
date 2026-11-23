# Trakey Admin (new design)

Full-width admin portal. Same Firebase project, same data, same sign-in rules as before.

## Put it live
1. Replace the old `trakey-admin` source folder in your repo with this one (keep your own `.git`).
2. In this folder run:  `npm install`  then  `npm run build`
3. Copy everything inside the new `dist/` folder over the `trakey-admin/` folder that GitHub Pages serves
   (delete the old `assets/` files first), commit and push.
4. Notifications (to everyone or one person) and the list of signed-in accounts use your Cloudflare Worker
   `trakey-admin-api` (see `src/lib/adminApi.js`). No Cloud Functions are needed.

## Notes
- Push to one person goes through the Worker (`/send`, audience `user`). The people list also reads the Worker (`/users`).
- 69 ready-made messages live in `src/lib/templates.js`.
- Email opens your own Gmail / mail app with the message filled in, and keeps a note in `messageHistory`.
- Legal PDFs live in `public/legal/`. Replace them there when the Terms or Privacy Policy change.
- Theme (dark or light) is remembered per browser. Ctrl/Cmd + K searches people and pages.
