/* Offline support: app shell is network-first, illustrations are cache-first. */
const CORE = "v200-core-1", IMG = "v200-img-1";
const SHELL = ["./", "index.html", "icon.png", "manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k.startsWith("v200-") && k !== CORE && k !== IMG).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Only handle this app's own files; sibling apps in subfolders (n5-words, nihongo100) are left alone.
  const base = new URL("./", location).pathname;
  if (!url.pathname.startsWith(base)) return;
  const rel = url.pathname.slice(base.length);
  if (rel.includes("/") && !rel.startsWith("img/")) return;
  if (rel.startsWith("img/")) {
    e.respondWith(caches.open(IMG).then(c => c.match(req, { ignoreSearch: true }).then(hit =>
      hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; })
    )));
    return;
  }
  // App shell: try network so updates arrive, fall back to cache when offline.
  e.respondWith(fetch(req).then(r => {
    if (r.ok) caches.open(CORE).then(c => c.put(req, r.clone()));
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined))));
});
