/**
 * Cloudflare Workers — Tile & Data Caching Proxy
 *
 * Routes:
 *   /satellite/{z}/{x}/{y}.jpg  → Satellite imagery (smart routing)
 *       z0-z13 anywhere         → MapTiler satellite-v2
 *       z14-z18 Japan only      → GSI seamlessphoto (国土地理院, free)
 *       z14+ outside Japan      → 204 (CesiumJS shows z13 upscaled)
 *   /terrain/*                  → MapTiler terrain quantized-mesh
 *   /plateau/*                  → PLATEAU 3D Tiles (国土交通省, 90-day cache)
 *   /warm                       → Pre-warm satellite tiles (manual/cron)
 *   /health                     → Health check
 *
 * Cache: CF edge, 30-day TTL (90d for PLATEAU).
 * Pre-warm: global z0-z5 + seismic zones z6-z8 ≈ 6,400 tiles (6% of free quota).
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

// ── Seismic zones for pre-warming z6-z8 ─────────────────────────

interface BBox {
  id: string;
  minLon: number; maxLon: number;
  minLat: number; maxLat: number;
}

const SEISMIC_ZONES: BBox[] = [
  // Pacific Ring of Fire
  { id: 'japan',       minLon: 122, maxLon: 154, minLat: 24,  maxLat: 46 },
  { id: 'philippines', minLon: 117, maxLon: 127, minLat: 5,   maxLat: 20 },
  { id: 'indonesia',   minLon: 95,  maxLon: 141, minLat: -11, maxLat: 6 },
  { id: 'nz',          minLon: 165, maxLon: 179, minLat: -48, maxLat: -34 },
  { id: 'alaska',      minLon: -170,maxLon: -140,minLat: 51,  maxLat: 65 },
  { id: 'cascadia',    minLon: -130,maxLon: -120,minLat: 40,  maxLat: 50 },
  { id: 'california',  minLon: -125,maxLon: -114,minLat: 32,  maxLat: 42 },
  { id: 'mexico',      minLon: -106,maxLon: -93, minLat: 14,  maxLat: 20 },
  { id: 'chile',       minLon: -76, maxLon: -66, minLat: -45, maxLat: -18 },
  { id: 'peru',        minLon: -82, maxLon: -68, minLat: -18, maxLat: 0 },
  // Alpine-Himalayan belt
  { id: 'turkey',      minLon: 26,  maxLon: 45,  minLat: 36,  maxLat: 42 },
  { id: 'iran',        minLon: 44,  maxLon: 63,  minLat: 25,  maxLat: 40 },
  { id: 'nepal',       minLon: 80,  maxLon: 89,  minLat: 26,  maxLat: 31 },
  { id: 'italy',       minLon: 6,   maxLon: 19,  minLat: 36,  maxLat: 47 },
  { id: 'greece',      minLon: 19,  maxLon: 30,  minLat: 34,  maxLat: 42 },
  // Other active
  { id: 'taiwan',      minLon: 119, maxLon: 123, minLat: 21,  maxLat: 26 },
  { id: 'iceland',     minLon: -25, maxLon: -13, minLat: 63,  maxLat: 67 },
  { id: 'caribbean',   minLon: -75, maxLon: -60, minLat: 10,  maxLat: 20 },
];

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

// ── Tile coordinate helpers ─────────────────────────────────────

function latLngToTile(lat: number, lng: number, z: number): [number, number] {
  const n = 1 << z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return [Math.min(x, n - 1), Math.min(y, n - 1)];
}

function bboxTiles(bbox: BBox, z: number): Array<{ z: number; x: number; y: number }> {
  const maxIdx = (1 << z) - 1;
  const [xMin, yMax] = latLngToTile(bbox.minLat, bbox.minLon, z);
  const [xMax, yMin] = latLngToTile(bbox.maxLat, bbox.maxLon, z);
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let x = Math.max(0, xMin); x <= Math.min(maxIdx, xMax); x++) {
    for (let y = Math.max(0, yMin); y <= Math.min(maxIdx, yMax); y++) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
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
 * Budget-friendly warm list:
 *   Global z0-z5       ≈ 1,365 tiles
 *   Seismic zones z6-z8 ≈ 5,000 tiles (deduplicated)
 *   Total              ≈ 6,400 tiles (6% of MapTiler Flex free quota)
 */
function buildWarmList(): Array<{ z: number; x: number; y: number }> {
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let z = 0; z <= 5; z++) {
    tiles.push(...globalTiles(z));
  }

  const seen = new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`));
  for (const zone of SEISMIC_ZONES) {
    for (let z = 6; z <= 8; z++) {
      for (const tile of bboxTiles(zone, z)) {
        const key = `${tile.z}/${tile.x}/${tile.y}`;
        if (!seen.has(key)) {
          seen.add(key);
          tiles.push(tile);
        }
      }
    }
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

        // All warm tiles are z0-z8, always MapTiler
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

      // z14+ outside Japan → blocked
      if (!japan && z > 13) {
        return new Response(null, { status: 204 });
      }

      // z14+ Japan → GSI seamlessphoto (free, no API key)
      let originUrl: string;
      if (z >= 14 && japan) {
        originUrl = `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${x}/${y}.jpg`;
      } else {
        originUrl = `https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${env.MAPTILER_KEY}`;
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
        { ...result, zones: SEISMIC_ZONES.map((z) => z.id) },
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
