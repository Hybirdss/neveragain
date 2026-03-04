/**
 * usgsRealtime.ts — Realtime event poller
 *
 * Primary source: Worker API (/api/events) populated by server-side ingestion.
 * Fallback source: USGS feed (only when API is unavailable).
 */

import type { EarthquakeEvent } from '../types';
import { classifyFaultType, toEarthquakeEvent } from './usgsApi';
import { store } from '../store/appState';

// ── Constants ────────────────────────────────────────────────────

const USGS_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const API_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.PROD ? 'https://api.namazue.dev' : '');
const SERVER_EVENTS_URL =
  `${API_URL}/api/events?mag_min=2.5&lat_min=24&lat_max=46&lng_min=122&lng_max=150&limit=200`;

const REQUEST_TIMEOUT_MS = 10_000;
const SEEN_CACHE_LIMIT = 5_000;

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

interface ServerEvent {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string | number;
  place: string | null;
  fault_type: string | null;
  tsunami: boolean | null;
}

interface ServerEventsResponse {
  events: ServerEvent[];
  count: number;
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

function toEarthquakeEventFromServer(ev: ServerEvent): EarthquakeEvent {
  const fallbackFaultType = classifyFaultType(ev.depth_km, ev.lat, ev.lng);
  const faultType = ev.fault_type === 'crustal' || ev.fault_type === 'interface' || ev.fault_type === 'intraslab'
    ? ev.fault_type
    : fallbackFaultType;
  const parsedTime = typeof ev.time === 'number' ? ev.time : Date.parse(ev.time);

  return {
    id: ev.id,
    lat: ev.lat,
    lng: ev.lng,
    depth_km: ev.depth_km,
    magnitude: ev.magnitude,
    time: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
    faultType,
    tsunami: false,
    place: { text: ev.place ?? 'Unknown location' },
  };
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status} for ${url}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromServer(): Promise<EarthquakeEvent[]> {
  const data = await fetchJsonWithTimeout<ServerEventsResponse>(SERVER_EVENTS_URL);
  if (!Array.isArray(data.events)) return [];
  return data.events.map(toEarthquakeEventFromServer);
}

async function fetchFromUSGS(): Promise<EarthquakeEvent[]> {
  const data = await fetchJsonWithTimeout<USGSResponse>(USGS_FEED_URL);
  if (!Array.isArray(data.features)) return [];
  return data.features
    .filter(isInJapanRegion)
    .map(toEarthquakeEvent);
}

function registerSeen(seen: Set<string>, queue: string[], id: string): void {
  if (seen.has(id)) return;
  seen.add(id);
  queue.push(id);
  if (queue.length > SEEN_CACHE_LIMIT) {
    const oldest = queue.shift();
    if (oldest) seen.delete(oldest);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isTimeoutError(error: unknown): boolean {
  if (isAbortError(error)) return true;
  if (!(error instanceof Error)) return false;
  return /aborted|timeout|timed out/i.test(error.message);
}

async function fetchPrimaryWithFallback(): Promise<EarthquakeEvent[]> {
  try {
    return await fetchFromServer();
  } catch (serverErr) {
    console.warn('[usgsRealtime] Server events API unavailable, falling back to USGS feed:', serverErr);
    return await fetchFromUSGS();
  }
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
  const seenQueue: string[] = [];
  let pollInFlight = false;
  let stopped = false;

  async function poll(): Promise<void> {
    if (stopped || pollInFlight) return;
    pollInFlight = true;

    try {
      // Primary: backend API fed by server-side ingestion.
      const events = await fetchPrimaryWithFallback();

      const newEvents: EarthquakeEvent[] = [];
      for (const event of events) {
        if (seen.has(event.id)) continue;
        registerSeen(seen, seenQueue, event.id);
        newEvents.push(event);
      }

      // Clear any previous network error on successful fetch
      store.set('networkError', null);

      if (newEvents.length > 0) {
        callback(newEvents);
      }
    } catch (error: unknown) {
      if (isTimeoutError(error)) {
        console.error(
          '[usgsRealtime] Request timed out after',
          REQUEST_TIMEOUT_MS,
          'ms',
        );
        store.set('networkError', 'Realtime feed request timed out');
      } else {
        console.error('[usgsRealtime] Polling error:', error);
        store.set('networkError', 'Failed to fetch realtime earthquake data');
      }
    } finally {
      pollInFlight = false;
    }
  }

  // Immediate first fetch
  poll();

  const intervalId = setInterval(poll, intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(intervalId);
    },
    resetSeen: () => {
      seen.clear();
      seenQueue.length = 0;
    },
  };
}
