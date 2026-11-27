// Trakey Admin service worker: keeps the installed app opening fast, but always prefers the network
// so a new deploy shows up on the next open (no more "old version still shows").
const CACHE_NAME = "trakey-admin-shell-v3";
const APP_SHELL = ["/trakey-admin/", "/trakey-admin/logo-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network first, fall back to the saved copy when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.pathname.startsWith("/trakey-admin/") && !url.pathname.endsWith(".pdf")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/trakey-admin/")))
  );
});
