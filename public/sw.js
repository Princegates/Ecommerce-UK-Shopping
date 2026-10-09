// Deliberately does nothing but exist: some phones only offer "Install app" (and the Share menu entry that comes with it) for a site with a
// service worker. It stores nothing and never answers a request itself, so it cannot show out-of-date pages or prices.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
