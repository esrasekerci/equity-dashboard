// Network-first service worker with zero stale-cache leaks on iOS/Android PWAs.
const CACHE = "eq-app-v51";
const SHELL = ["./", "./index.html", "./assets/app.css?v=51", "./assets/app.js?v=51", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? c.put(u, r) : null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin) return;

  // Normalize cache key for /data/* so cache-busting ?t=... never bloats storage or returns yesterday's JSON
  const isData = url.pathname.includes("/data/");
  const cleanUrl = new URL(e.request.url);
  if (isData) cleanUrl.search = "";
  const cacheKey = isData ? cleanUrl.toString() : e.request;

  const netReq = new Request(e.request, { cache: "no-store" });
  e.respondWith(
    fetch(netReq)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(cacheKey, copy));
        }
        return res;
      })
      .catch(() => caches.match(cacheKey, { ignoreSearch: isData }))
  );
});
