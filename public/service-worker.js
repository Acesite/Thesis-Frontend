/* public/service-worker.js */
/* Simple cache-first SW for CRA projects */
const CACHE_NAME = "agrigis-cache-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo192.png",
  "/logo512.png"
];

// Install: pre-cache core files
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin GET requests; skip API by default
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isAPI = sameOrigin && url.pathname.startsWith("/api");

  if (!sameOrigin || isAPI) return; // let network handle APIs/cross-origin (e.g., map tiles)

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => {
          // Fallback for navigation (offline)
          if (req.mode === "navigate") return caches.match("/index.html");
        });
    })
  );
});
