// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Q&A Service Worker
// Scope: /agent/qa and /admin/qa
//
// V1 strategy: network-first for data (never stale); cache-first for app shell.
// Registered only when ENABLE_QA_SYSTEM flag reads true (see QaSwRegister.tsx).
// ─────────────────────────────────────────────────────────────────────────────

const SHELL_CACHE = "hr-qa-shell-v1";
const SHELL_URLS = ["/agent/qa", "/admin/qa"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls — network-only.
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for app shell routes.
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          }),
      ),
    );
  }
});
