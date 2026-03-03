/**
 * tile-cache-sw.js — Browser-level tile cache (Layer 2)
 *
 * Caching hierarchy:
 *   1. This SW (browser, 30-day TTL) — instant, offline-capable
 *   2. CF Workers edge (30-day TTL) — shared across all users
 *   3. MapTiler / GSI origin — only on double cache miss
 *
 * Intercepts:
 *   - /satellite/* (CF Workers proxy)
 *   - /terrain/*   (CF Workers proxy)
 *   - /maptiler-proxy/* (Vite dev proxy)
 *   - server.arcgisonline.com (Esri fallback)
 *
 * Rules:
 *   - Cache-first: cached tiles serve instantly
 *   - Only cache HTTP 200 (never 204, 429, 5xx)
 *   - Stale cache returned on network errors
 */

const CACHE_NAME = 'tile-cache-v3';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && (n.startsWith('tile-cache-') || n.startsWith('maptiler-tiles-')))
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

function isTileRequest(url) {
  // CF Workers proxy
  if (url.pathname.startsWith('/satellite/') || url.pathname.startsWith('/terrain/')) return true;
  // PLATEAU 3D Tiles
  if (url.pathname.startsWith('/plateau/')) return true;
  if (url.hostname === 'plateau.geospatial.jp') return true;
  // Vite dev proxy
  if (url.pathname.startsWith('/maptiler-proxy/')) return true;
  // Direct MapTiler
  if (url.hostname === 'api.maptiler.com') return true;
  // Esri fallback
  if (url.hostname === 'server.arcgisonline.com') return true;
  // GSI (direct, unlikely but possible)
  if (url.hostname === 'cyberjapandata.gsi.go.jp') return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!isTileRequest(url)) return;
  // Cache API only supports GET — skip HEAD, POST, etc.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        const cachedAt = cached.headers.get('x-cached-at');
        if (cachedAt && (Date.now() - Number(cachedAt)) < MAX_AGE_MS) {
          return cached;
        }
      }

      try {
        const response = await fetch(event.request);

        // Only cache 200 OK (not 204 zoom-blocked, not errors)
        if (response.status === 200) {
          const headers = new Headers(response.headers);
          headers.set('x-cached-at', String(Date.now()));
          const timestamped = new Response(await response.clone().blob(), {
            status: 200,
            statusText: response.statusText,
            headers,
          });
          cache.put(event.request, timestamped);
        }

        // Return stale on error status
        if (!response.ok && cached) return cached;

        return response;
      } catch (_err) {
        if (cached) return cached;
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      }
    })
  );
});
