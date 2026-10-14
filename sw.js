// Service worker: lets the app open offline and install to the home screen.
// App files: network first (so updates show up right away), falling back to the saved copy offline.
// Fonts and the Firebase library: saved copy first, since those versions never change.
// Live data from Firebase is never cached here; Firebase handles that itself.
const CACHE = "cashflow-v4";
const SHELL = ["./", "index.html", "app.js", "sync.js", "firebase-config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (/firebaseio\.com|googleapis\.com\/identitytoolkit|securetoken\.googleapis\.com|firebaseinstallations/.test(url.href)) return;

  const sameOrigin = url.origin === self.location.origin;
  const longLived = /gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com/.test(url.href);

  if (sameOrigin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
    );
  } else if (longLived) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
