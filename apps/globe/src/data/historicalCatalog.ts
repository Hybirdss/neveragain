/**
 * historicalCatalog.ts — 30-year Japan M3+ earthquake catalog loader
 *
 * Fetches a pre-built static JSON file from R2 containing ~50K events.
 * HTTP cache handles repeat visits (max-age=86400).
 * No IndexedDB needed — data changes less than once per day.
 *
 * Build the JSON: tools/build-historical-catalog.ts (1-time)
 * Host: R2 or public/data/
 */

import type { EarthquakeEvent } from '../types';

const CATALOG_URL = '/data/historical-catalog.json';

let cachedCatalog: EarthquakeEvent[] | null = null;

/**
 * Load the 30-year historical earthquake catalog.
 * Returns cached data on repeat calls within the same session.
 */
export async function loadHistoricalCatalog(): Promise<EarthquakeEvent[]> {
  if (cachedCatalog) return cachedCatalog;

  try {
    const resp = await fetch(CATALOG_URL);
    if (!resp.ok) {
      console.warn(`[catalog] Failed to load historical catalog: ${resp.status}`);
      return [];
    }

    // Vite SPA fallback serves index.html for missing routes (200 OK but HTML)
    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      console.warn('[catalog] Historical catalog not available (data file not built yet)');
      return [];
    }

    const data: EarthquakeEvent[] = await resp.json();
    cachedCatalog = data;
    console.log(`[catalog] Loaded ${data.length} historical events`);
    return data;
  } catch (err) {
    console.warn('[catalog] Error loading historical catalog:', err);
    return [];
  }
}

/** Check if catalog is already loaded in memory. */
export function isCatalogLoaded(): boolean {
  return cachedCatalog !== null;
}

/** Get catalog without fetching (returns null if not loaded). */
export function getCatalog(): EarthquakeEvent[] | null {
  return cachedCatalog;
}
