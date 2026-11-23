// Ready-made messages for Trakey Admin. Pick one, fill the blanks, press "Use this template", then edit if you like.
// Blanks are written as {version}, {feature}, {date}, {time}, {days}, {offer}, {link}, {name}.
// Prices below match the app (TrakeyPro.kt): Monthly 19, Yearly 149 (saves 35%), Lifetime 699 (one time).

export const APP_VERSION = "5.1.2"; // the version in the app source this file was written against; change it in the picker when you release a new one
export const SITE = "https://maniaxe.in/trakey";

export const BLANKS = {
  version: { label: "Version", placeholder: "5.1.3" },
  feature: { label: "Feature name", placeholder: "Library practice" },
  date: { label: "Date", type: "date" },
  time: { label: "Time", type: "time" },
  days: { label: "Days", type: "number", placeholder: "30" },
  offer: { label: "Offer", placeholder: "20% off" },
  link: { label: "Link", placeholder: "https://" },
};

const pad = (n) => String(n).padStart(2, "0");
function show(key, raw) {
  const v = String(raw ?? "").trim();
  if (!v) return "";
  if (key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  if (key === "time" && /^\d{2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(":").map(Number);
    return (h % 12 || 12) + ":" + pad(m) + " " + (h < 12 ? "AM" : "PM");
  }
  return v;
}

const FIELDS = ["t", "m", "d", "n", "btn"];
export const blanksIn = (tpl) => {
  const found = new Set();
  FIELDS.forEach((f) => String(tpl[f] || "").replace(/\{(\w+)\}/g, (_, k) => found.add(k)));
  return [...found].filter((k) => BLANKS[k]);
};

// Any blank left empty stays visible as [date], [version] ... so it cannot be sent by accident (see leftover()).
export function fillTemplate(tpl, vars) {
  const sub = (s) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => show(k, vars[k]) || "[" + k + "]");
  return {
    ...tpl,
    t: sub(tpl.t), m: sub(tpl.m), d: sub(tpl.d), n: sub(tpl.n), btn: sub(tpl.btn),
    version: String(vars.version || "").trim(), link: String(vars.link || "").trim(),
  };
}

export const leftover = (...texts) => {
  const m = texts.join("\n").match(/\[(version|feature|date|time|days|offer|link|name)\]/i);
  return m ? m[0] : "";
};

const SIGN = "\n\nRegards,\nTrakey Support";

export const TEMPLATES = {
  // ------------------------------------------------------------------ notification to everyone (title up to 100, message up to 1000)
  push: [
    { name: "New version", items: [
      { t: "Trakey {version} is here", m: "A new version of Trakey is ready. Update the app to get the latest fixes and improvements." },
      { t: "Please update Trakey", m: "Trakey {version} has important fixes. Update now so everything keeps running smoothly." },
      { t: "Faster and smoother", m: "Trakey {version} makes the app quicker and fixes a few bugs. Update the app to get it." },
      { t: "Update before {date}", m: "Please update Trakey to {version} before {date} so you do not miss anything." },
    ] },
    { name: "New feature", items: [
      { t: "New in Trakey: {feature}", m: "{feature} is now in Trakey. Open the app to try it. Update to {version} if you do not see it yet." },
      { t: "Have you tried {feature}?", m: "{feature} can save you time every day. Give it a go and tell us what you think from Rate & feedback." },
      { t: "Big update: {feature}", m: "We have been working on {feature} and it is live in Trakey {version}. Update and take a look." },
    ] },
    { name: "Promotion", items: [
      { t: "Trakey Pro from ₹19 a month", m: "Unlock everything in Trakey with Pro. Monthly ₹19, Yearly ₹149 or Lifetime ₹699. Open Pro in the app to see what you get." },
      { t: "Save 35% with Yearly Pro", m: "Yearly Pro is ₹149, which works out cheaper than paying every month. Open Pro in Trakey to switch." },
      { t: "Lifetime Pro: pay once, keep it forever", m: "Lifetime Pro is a one-time ₹699. No renewals, no reminders. Open Pro in Trakey to get it." },
      { t: "{offer} on Trakey Pro", m: "{offer} on Trakey Pro until {date}. Open Pro in the app to take it." },
      { t: "Try Trakey Pro free for {days} days", m: "Start your free {days}-day Pro trial from the Pro screen in Trakey. No payment needed to start." },
      { t: "Your Pro trial is ending soon", m: "Your free trial ends on {date}. Choose a plan in the Pro screen to keep every Pro feature." },
      { t: "Tell a friend about Trakey", m: "Enjoying Trakey? Use Share app in Account to send it to a friend. It means a lot to us." },
    ] },
    { name: "Daily habit", items: [
      { t: "Your goals are waiting", m: "A small step today keeps your streak alive. Open Trakey and tick off a goal." },
      { t: "Plan your day in 2 minutes", m: "Add your tasks in Trakey now and the day feels lighter." },
      { t: "Keep your habit streak going", m: "Do not break the chain. Check in your habits in Trakey today." },
      { t: "Test yourself today", m: "A quick Learn or Challenge round keeps your mind sharp. Try one now." },
      { t: "Good morning from Trakey", m: "Have a productive day. Your notes, goals and tasks are ready when you are." },
      { t: "Weekend planning", m: "Take five minutes to plan next week in Trakey so Monday starts easy." },
    ] },
    { name: "Backup and safety", items: [
      { t: "Back up your data", m: "Open Trakey, go to Account, then Backup & data and tap Back up now so your notes, goals and tasks are safe." },
      { t: "Switched phones? Restore your data", m: "Sign in to Trakey with the same account and choose Restore in Backup & data to get everything back." },
      { t: "Keep your account safe", m: "Never share your sign-in or your App lock PIN with anyone. Trakey will never ask for them." },
    ] },
    { name: "Maintenance", items: [
      { t: "Short maintenance on {date}", m: "Some features may pause on {date} at {time} while we make improvements. Your data stays safe." },
      { t: "We are back", m: "The maintenance is finished and everything in Trakey is working again. Thank you for waiting." },
      { t: "Known issue, fix on the way", m: "Some people are seeing a problem with {feature}. We are fixing it and will update you here." },
    ] },
    { name: "Thanks and feedback", items: [
      { t: "Thank you for using Trakey", m: "You make this app worth building. If you have a minute, share your feedback from Rate & feedback." },
      { t: "Enjoying Trakey? Rate us", m: "Your rating helps other people find Trakey. Thank you for the support." },
      { t: "Tell us what you want next", m: "Which feature should we build next? Send an idea from Contact us in Account. We read every message." },
    ] },
  ],

  // ------------------------------------------------------------------ in-app announcement (type is set for you; button is optional)
  announce: [
    { name: "Update", items: [
      { type: "Update", t: "Trakey {version} is available", m: "A new version of Trakey is ready with fixes and improvements. Update the app to get it.", btn: "Update now" },
      { type: "Update", t: "Please update to {version}", m: "This version includes important fixes. Please update before {date} for the best experience.", btn: "Update now" },
    ] },
    { name: "Feature", items: [
      { type: "Feature", t: "New: {feature}", m: "{feature} is now part of Trakey. Open the app and give it a try. Update to {version} if you do not see it yet." },
      { type: "Feature", t: "Now on Trakey Web too", m: "Your notes, goals and tasks also sync with Trakey Web, so you can continue on a bigger screen.", btn: "Open Trakey Web" },
      { type: "Feature", t: "Tip: {feature}", m: "Did you know about {feature}? It is a quick way to get more from Trakey every day." },
    ] },
    { name: "Promotion", items: [
      { type: "General", t: "Trakey Pro: from ₹19 a month", m: "Get every Pro feature with Monthly ₹19, Yearly ₹149 or Lifetime ₹699. Open the Pro screen to see the plans.", btn: "See Pro plans" },
      { type: "General", t: "Yearly Pro saves 35%", m: "Pay ₹149 once a year instead of ₹19 every month. Open the Pro screen to switch." },
      { type: "General", t: "{offer} on Pro until {date}", m: "A limited offer for Trakey users: {offer} on Pro until {date}.", btn: "Get the offer" },
      { type: "General", t: "Free Pro trial: {days} days", m: "Start your {days}-day free trial from the Pro screen and try everything." },
    ] },
    { name: "Maintenance", items: [
      { type: "Maintenance", t: "Planned maintenance on {date}", m: "Some features may be unavailable on {date} at {time}. Your data stays safe and everything returns afterwards." },
      { type: "Maintenance", t: "All fixed", m: "The issue with {feature} is fixed. Thank you for your patience." },
    ] },
    { name: "General", items: [
      { type: "General", t: "Thank you for using Trakey", m: "We are a small team and your support keeps us going. Tell us what you would like next from Contact us." },
      { type: "General", t: "Back up your data", m: "Open Account, then Backup & data and tap Back up now so your data is safe if you change phones." },
      { type: "General", t: "Rate Trakey", m: "If Trakey helps you, a rating helps others find it.", btn: "Rate now" },
      { type: "General", t: "Need help?", m: "Write to us from Contact us in Account. We read every message and reply by email." },
    ] },
  ],

  // ------------------------------------------------------------------ app update entry (version, title, short description, release notes)
  update: [
    { name: "Bug fixes", items: [
      { t: "Bug fixes and stability", d: "Trakey {version} fixes a few bugs and makes the app steadier.", n: "• Fixed issues reported by users\n• Better stability on more phones\n• Small speed improvements" },
      { t: "Quicker and lighter", d: "Trakey {version} opens faster and uses less battery.", n: "• Faster start\n• Smoother scrolling\n• Lower battery use" },
    ] },
    { name: "New feature", items: [
      { t: "New: {feature}", d: "Trakey {version} adds {feature}.", n: "• New: {feature}\n• Small fixes and polish" },
      { t: "{feature} and more", d: "A bigger update with {feature} and improvements across the app.", n: "• New: {feature}\n• Improvements to existing screens\n• Bug fixes" },
    ] },
    { name: "Design", items: [
      { t: "A fresher look", d: "Trakey {version} brings a cleaner, easier design.", n: "• Updated layout and colours\n• Easier to read and tap\n• Bug fixes" },
    ] },
    { name: "Pro and payments", items: [
      { t: "Trakey Pro improvements", d: "Trakey {version} makes Pro easier to understand and buy.", n: "• Clearer Pro screen\n• Smoother payment steps\n• Bug fixes" },
    ] },
    { name: "Safety", items: [
      { t: "Security and privacy update", d: "Trakey {version} improves how your data is protected.", n: "• Security improvements\n• Clearer backup and data options\n• Bug fixes" },
      { t: "Important update", d: "Please update to Trakey {version} before {date}.", n: "• Important fixes\n• Required for the latest features" },
    ] },
  ],

  // ------------------------------------------------------------------ quick replies in Inbox ({name} is the sender's name)
  reply: [
    { name: "Thanks", items: [
      { t: "Thank you for the feedback", m: "Hi {name},\n\nThank you for taking the time to write to us. Feedback like yours helps us make Trakey better, and we have passed it to the team." + SIGN },
      { t: "Thanks for the rating", m: "Hi {name},\n\nThank you for rating Trakey. We are glad it is useful to you. If there is anything you would like us to improve, just reply to this email." + SIGN },
    ] },
    { name: "Problem", items: [
      { t: "Need more details", m: "Hi {name},\n\nSorry for the trouble. To look into this, please reply with:\n• Your phone model and Android version\n• Your Trakey version (Account, then Version)\n• What you were doing when it happened\n• A screenshot, if you can" + SIGN },
      { t: "Please update the app", m: "Hi {name},\n\nThis was fixed in a newer version of Trakey. Please update the app, then check again. If the problem is still there, reply and we will look deeper." + SIGN },
      { t: "Fixed, please check", m: "Hi {name},\n\nThank you for reporting this. We have fixed it. Please update Trakey and tell us if it works for you now." + SIGN },
      { t: "Known issue", m: "Hi {name},\n\nThank you for letting us know. We are aware of this and are working on a fix. We will announce it in the app when it is ready." + SIGN },
    ] },
    { name: "Idea", items: [
      { t: "Feature idea received", m: "Hi {name},\n\nThank you for the idea. We have added it to our list. We cannot promise when, but every suggestion is read and considered." + SIGN },
      { t: "Not planned right now", m: "Hi {name},\n\nThank you for suggesting this. It is not in our plans for now, but we have noted it and will look at it again when we plan the next updates." + SIGN },
    ] },
    { name: "Pro and payment", items: [
      { t: "Payment received, Pro active", m: "Hi {name},\n\nWe received your payment and your Trakey Pro is now active. Close and reopen the app if you do not see it yet. Thank you for supporting Trakey!" + SIGN },
      { t: "Verifying your payment", m: "Hi {name},\n\nWe have your payment request and are checking it against our bank record. Pro turns on as soon as it is approved. You do not need to pay again." + SIGN },
      { t: "Please resend the UTR", m: "Hi {name},\n\nThe UTR we received did not match our bank record. Please check the 12-digit UTR in your payment app and send the correct one. We will approve it right after." + SIGN },
      { t: "Screenshot is missing", m: "Hi {name},\n\nYour payment request has no screenshot. Please reply with a clear screenshot of the payment so we can verify it." + SIGN },
      { t: "Payment rejected", m: "Hi {name},\n\nWe could not find this payment in our records, so the request was rejected. If you did pay, please reply with the UTR and a screenshot and we will check again." + SIGN },
    ] },
    { name: "Account and data", items: [
      { t: "How to back up and restore", m: "Hi {name},\n\nTo back up: open Account, then Backup & data and tap Back up now. To restore on a new phone: sign in with the same account and choose Restore in Backup & data." + SIGN },
      { t: "How to delete your data", m: "Hi {name},\n\nYou can delete your data yourself: open Account, then Backup & data and choose Delete all data. For anything else we hold about you, reply from the email linked to your account and we will help." + SIGN },
      { t: "Sign-in help", m: "Hi {name},\n\nPlease sign in with the same Google account you used before. If it still fails, reply with the email you used and a screenshot of the message you see." + SIGN },
    ] },
    { name: "Closing", items: [
      { t: "Closing this request", m: "Hi {name},\n\nWe are marking this as resolved. If you still need help, just reply to this email and we will reopen it." + SIGN },
    ] },
  ],
};
