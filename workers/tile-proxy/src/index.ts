/**
 * Cloudflare Workers — Tile & Data Caching Proxy
 *
 * Routes:
 *   /satellite/{z}/{x}/{y}.jpg  → Satellite imagery (smart routing)
 *       z0-z3 anywhere          → MapTiler satellite-v2 (only 85 tiles, pre-cached)
 *       z4-z18 Japan only       → GSI seamlessphoto (国土地理院, free unlimited)
 *       z4+ outside Japan       → 204 (CesiumJS shows z3 upscaled)
 *   /terrain/*                  → MapTiler terrain quantized-mesh
 *   /plateau/*                  → PLATEAU 3D Tiles (国土交通省, 90-day cache)
 *   /warm                       → Pre-warm satellite tiles (manual/cron)
 *   /health                     → Health check
 *
 * Cache: CF edge, 30-day TTL (90d for PLATEAU).
 * Pre-warm: global z0-z3 = 85 tiles (nearly zero MapTiler quota usage).
 * Cron: daily 03:00 UTC.
 *
 * Credits: © MapTiler © OSM contributors | 航空写真: 国土地理院 | 3D都市: PLATEAU
 */

interface Env {
  MAPTILER_KEY: string;
  CACHE_TTL_SECONDS: string;
}

// ── Japan bounding box ──────────────────────────────────────────

const JAPAN = { minLon: 122, maxLon: 154, minLat: 20, maxLat: 46 };

function tileToLonLat(z: number, x: number, y: number): { lon: number; lat: number } {
  const n = 1 << z;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / n));
  const lat = (latRad * 180) / Math.PI;
  return { lon, lat };
}

function isJapan(lon: number, lat: number): boolean {
  return lon >= JAPAN.minLon && lon <= JAPAN.maxLon &&
         lat >= JAPAN.minLat && lat <= JAPAN.maxLat;
}

// ── Tile coordinate helpers ─────────────────────────────────────
// (bboxTiles / seismic zones removed — z0-z3 global warm only)

// ── Cache-first tile fetch ──────────────────────────────────────

async function fetchTileCached(
  cacheUrl: string,
  upstreamUrl: string,
  ttl: number,
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(cacheUrl);

  const cached = await cache.match(cacheKey);
  if (cached) {
    const resp = new Response(cached.body, cached);
    resp.headers.set('x-cache', 'HIT');
    return resp;
  }

  const upstream = await fetch(upstreamUrl);
  if (!upstream.ok) {
    return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
  }

  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
      'CDN-Cache-Control': `max-age=${ttl}`,
      'Access-Control-Allow-Origin': '*',
      'x-cache': 'MISS',
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}

function globalTiles(z: number): Array<{ z: number; x: number; y: number }> {
  const n = 1 << z;
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}

// ── Warming ─────────────────────────────────────────────────────

/**
 * Minimal warm list — only z0-z3 globally (MapTiler).
 * z4+ uses GSI (free unlimited) so no warming needed.
 *   z0: 1 tile, z1: 4, z2: 16, z3: 64 = 85 tiles total
 */
function buildWarmList(): Array<{ z: number; x: number; y: number }> {
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let z = 0; z <= 3; z++) {
    tiles.push(...globalTiles(z));
  }
  return tiles;
}

async function warmTiles(
  tiles: Array<{ z: number; x: number; y: number }>,
  baseUrl: string,
  key: string,
  ttl: number,
): Promise<{ total: number; warmed: number; skipped: number }> {
  const cache = caches.default;
  let warmed = 0;
  let skipped = 0;

  for (let i = 0; i < tiles.length; i += 10) {
    const batch = tiles.slice(i, i + 10);
    await Promise.allSettled(
      batch.map(async (tile) => {
        const proxyUrl = `${baseUrl}/satellite/${tile.z}/${tile.x}/${tile.y}.jpg`;
        const cacheKey = new Request(proxyUrl);

        if (await cache.match(cacheKey)) {
          skipped++;
          return;
        }

        // All warm tiles are z0-z3, always MapTiler
        const upstreamUrl = `https://api.maptiler.com/tiles/satellite-v2/${tile.z}/${tile.x}/${tile.y}.jpg?key=${key}`;
        const resp = await fetch(upstreamUrl);
        if (resp.ok) {
          await cache.put(
            cacheKey,
            new Response(resp.body, {
              status: 200,
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
                'CDN-Cache-Control': `max-age=${ttl}`,
                'Access-Control-Allow-Origin': '*',
                'x-cache': 'WARM',
              },
            }),
          );
          warmed++;
        }
      }),
    );
  }

  return { total: tiles.length, warmed, skipped };
}

// ── Worker entry point ──────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ttl = parseInt(env.CACHE_TTL_SECONDS || '2592000', 10);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // ── PLATEAU 3D Tiles proxy ─────────────────────────────────
    const plateauMatch = url.pathname.match(/^\/plateau\/(.+)$/);
    if (plateauMatch) {
      const plateauPath = plateauMatch[1];
      const originUrl = `https://plateau.geospatial.jp/main/data/3d-tiles/${plateauPath}`;
      const plateauTtl = 90 * 24 * 60 * 60; // 90 days — 3D tiles rarely change
      return fetchTileCached(request.url, originUrl, plateauTtl);
    }

    // ── Route: /satellite/{z}/{x}/{y}.jpg ──────────────────────
    const satMatch = url.pathname.match(/^\/satellite\/(\d+)\/(\d+)\/(\d+)\.jpg$/);
    if (satMatch) {
      const z = +satMatch[1];
      const x = +satMatch[2];
      const y = +satMatch[3];
      const { lon, lat } = tileToLonLat(z, x, y);
      const japan = isJapan(lon, lat);

      // z0-z3: MapTiler satellite globally (only 85 tiles, all pre-cached)
      // z4+: GSI seamlessphoto for Japan only, 204 for outside Japan
      let originUrl: string;
      if (z <= 3) {
        originUrl = `https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${env.MAPTILER_KEY}`;
      } else if (japan) {
        originUrl = `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${x}/${y}.jpg`;
      } else {
        return new Response(null, { status: 204 });
      }

      return fetchTileCached(request.url, originUrl, ttl);
    }

    // ── Route: /terrain/* ──────────────────────────────────────
    if (url.pathname.startsWith('/terrain/')) {
      const terrainPath = url.pathname.replace('/terrain/', '');
      const originUrl = `https://api.maptiler.com/tiles/terrain-quantized-mesh-v2/${terrainPath}?key=${env.MAPTILER_KEY}`;

      // Rewrite layer.json so Cesium fetches tiles through this proxy
      // (MapTiler's layer.json contains absolute tile URLs that bypass proxy)
      if (terrainPath === '' || terrainPath === 'layer.json') {
        const upstream = await fetch(originUrl);
        if (!upstream.ok) {
          return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
        }
        const json = await upstream.json() as Record<string, unknown>;
        const proxyBase = `${url.protocol}//${url.host}/terrain`;
        if (Array.isArray(json.tiles)) {
          json.tiles = [`${proxyBase}/{z}/{x}/{y}.terrain`];
        }
        return new Response(JSON.stringify(json), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return fetchTileCached(request.url, originUrl, ttl);
    }

    // ── Route: /warm ───────────────────────────────────────────
    if (url.pathname === '/warm') {
      const baseUrl = `${url.protocol}//${url.host}`;
      const tiles = buildWarmList();
      const result = await warmTiles(tiles, baseUrl, env.MAPTILER_KEY, ttl);
      return Response.json(
        { ...result, strategy: 'z0-z3 global MapTiler' },
        { headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    // ── Route: /health ─────────────────────────────────────────
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', cache_ttl: ttl });
    }

    return new Response('Not found', { status: 404 });
  },

  // Cron: daily pre-warm at 03:00 UTC
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const ttl = parseInt(env.CACHE_TTL_SECONDS || '2592000', 10);
    const baseUrl = 'https://tiles.seismicjapan.com';
    const tiles = buildWarmList();

    ctx.waitUntil(
      warmTiles(tiles, baseUrl, env.MAPTILER_KEY, ttl).then((result) => {
        console.log(
          `[cron] Warm: ${tiles.length} tiles — ${result.warmed} new, ${result.skipped} cached`,
        );
      }),
    );
  },
};
