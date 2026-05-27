/// @file public/sw.js
/// @author Shane
/// @date Created: 2025-05-27
/// @date Updated: 2025-05-27
/// @brief Minimal service worker for PWA install and share target support.

const CACHE_NAME = "house-tracker-v1";

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    // Pass through all requests - no offline caching needed
    event.respondWith(fetch(event.request));
});
