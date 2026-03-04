/**
 * shakeMapApi.ts — USGS ShakeMap product fetcher
 *
 * For M5+ earthquakes, USGS automatically generates ShakeMap:
 * - MMI contour GeoJSON (cont_mmi.json)
 * - Fault rupture geometry (rupture.json)
 *
 * These are far more accurate than our single-GMPE approximation since
 * they incorporate station observations, finite-fault models, and
 * ensemble GMPE weighting.
 *
 * Includes request cancellation: rapid event clicks abort in-flight requests
 * so stale data never overwrites the current selection.
 */

export interface ShakeMapProducts {
  mmiContours: GeoJSON.FeatureCollection | null;
  faultRupture: GeoJSON.FeatureCollection | null;
  eventId: string;
}

const USGS_EVENT_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const FETCH_TIMEOUT = 10_000;

/** Active AbortController — aborted when a new request starts or explicitly. */
let activeController: AbortController | null = null;

export function abortShakeMapFetch(): void {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

/**
 * Fetch ShakeMap MMI contours and fault rupture for a USGS event.
 * Returns null if no ShakeMap is available (common for M<5 events).
 *
 * Automatically aborts any in-flight previous request to prevent
 * stale data from overwriting newer selections.
 */
export async function fetchShakeMap(usgsEventId: string): Promise<ShakeMapProducts | null> {
  // Cancel any previous in-flight request
  if (activeController) {
    activeController.abort();
  }
  const controller = new AbortController();
  activeController = controller;

  try {
    const detailUrl = `${USGS_EVENT_URL}?eventid=${encodeURIComponent(usgsEventId)}&format=geojson`;
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const resp = await fetch(detailUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) return null;

    const detail = await resp.json();
    const shakemap = detail?.properties?.products?.shakemap?.[0];
    if (!shakemap) return null;

    const contents = shakemap.contents ?? {};

    const mmiUrl = contents['download/cont_mmi.json']?.url
      ?? contents['download/cont_mi.json']?.url;

    // Fetch contours and fault rupture in parallel (supports old cont_mi naming)
    const [mmiContours, faultRupture] = await Promise.all([
      fetchProduct(mmiUrl, controller.signal),
      fetchProduct(contents['download/rupture.json']?.url, controller.signal),
    ]);

    // Check if this request was superseded while we were fetching
    if (controller.signal.aborted) return null;

    if (!mmiContours) return null;

    return { mmiContours, faultRupture, eventId: usgsEventId };
  } catch (err) {
    // AbortError is expected when user clicks another event
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null;
    }
    console.warn('[shakeMap] Failed to fetch ShakeMap:', err);
    return null;
  } finally {
    // Clear active controller if this is still the current request
    if (activeController === controller) {
      activeController = null;
    }
  }
}

async function fetchProduct(
  url: string | undefined,
  signal: AbortSignal,
): Promise<GeoJSON.FeatureCollection | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
