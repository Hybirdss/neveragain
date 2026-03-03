/**
 * usgsRealtime.ts — USGS Real-time Feed poller
 *
 * Polls the USGS 2.5+ magnitude feed for the past hour, filters to
 * the Japan bounding box, deduplicates by event ID, and delivers
 * new events via a callback.
 */

import type { EarthquakeEvent } from '../types';
import { toEarthquakeEvent } from './usgsApi';

// ── Constants ────────────────────────────────────────────────────

const REALTIME_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

const REQUEST_TIMEOUT_MS = 10_000;

const JAPAN_BBOX = {
  minLat: 24,
  maxLat: 46,
  minLng: 122,
  maxLng: 150,
} as const;

// ── USGS GeoJSON shape (same as usgsApi but kept local to avoid
//    circular import of the full module) ──────────────────────────
interface USGSFeature {
  type: 'Feature';
  properties: {
    mag: number;
    place: string;
    time: number;
    url: string;
    tsunami: number;
    sig: number;
    magType: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number];
  };
  id: string;
}

interface USGSResponse {
  type: 'FeatureCollection';
  features: USGSFeature[];
}

// ── Helpers ──────────────────────────────────────────────────────

function isInJapanRegion(feature: USGSFeature): boolean {
  const [lng, lat] = feature.geometry.coordinates;
  return (
    lat >= JAPAN_BBOX.minLat &&
    lat <= JAPAN_BBOX.maxLat &&
    lng >= JAPAN_BBOX.minLng &&
    lng <= JAPAN_BBOX.maxLng
  );
}

// ── Public API ───────────────────────────────────────────────────

export interface RealtimePollerHandle {
  /** Stop polling entirely. */
  stop: () => void;
  /** Clear the seen-ID set so the next poll re-delivers all events from the feed. */
  resetSeen: () => void;
}

/**
 * Start polling the USGS real-time feed for earthquakes in Japan.
 *
 * - Performs an immediate first fetch on invocation.
 * - Subsequent fetches occur every `intervalMs` milliseconds (default 60 000).
 * - Duplicate events (by ID) are filtered via an internal Set.
 * - Returns a handle with `stop()` and `resetSeen()` methods.
 *
 * @param callback   - Called with an array of **new** (unseen) events each poll cycle.
 * @param intervalMs - Polling interval in milliseconds (default: 60 000).
 * @returns A RealtimePollerHandle.
 */
export function startRealtimePolling(
  callback: (events: EarthquakeEvent[]) => void,
  intervalMs: number = 60_000,
): RealtimePollerHandle {
  const seen = new Set<string>();

  async function poll(): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(REALTIME_FEED_URL, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `USGS realtime feed responded with status ${response.status}`,
        );
      }

      const data: USGSResponse = await response.json();

      const newEvents: EarthquakeEvent[] = [];

      for (const feature of data.features) {
        if (seen.has(feature.id)) continue;
        if (!isInJapanRegion(feature)) continue;

        seen.add(feature.id);
        newEvents.push(toEarthquakeEvent(feature));
      }

      if (newEvents.length > 0) {
        callback(newEvents);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error(
          '[usgsRealtime] Request timed out after',
          REQUEST_TIMEOUT_MS,
          'ms',
        );
      } else {
        console.error('[usgsRealtime] Polling error:', error);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  // Immediate first fetch
  poll();

  const intervalId = setInterval(poll, intervalMs);

  return {
    stop: () => {
      clearInterval(intervalId);
    },
    resetSeen: () => {
      seen.clear();
    },
  };
}
