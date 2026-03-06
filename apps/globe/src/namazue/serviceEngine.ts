/**
 * Service Engine — Lightweight data pipeline for the live service page.
 *
 * Fetches earthquakes from the API (USGS fallback), computes asset exposure
 * and operational priorities using the GMPE engine. No CesiumJS dependency.
 */

import { computeGmpe, haversine } from '../engine/gmpe';
import { classifyFaultType } from '../data/usgsApi';
import { getMetroAssets } from '../ops/assetCatalog';
import { buildAssetExposures } from '../ops/exposure';
import { buildOpsPriorities } from '../ops/priorities';
import type {
  EarthquakeEvent,
  FaultType,
  IntensityGrid,
  TsunamiAssessment,
} from '../types';
import type { OpsAssetExposure, OpsPriority } from '../ops/types';

// ── Public Types ────────────────────────────────────────────────

export interface ServiceSnapshot {
  mode: 'calm' | 'event';
  headline: string;
  summary: string;
  meta: string[];
}

export interface ServiceState {
  status: 'loading' | 'ready' | 'error';
  snapshot: ServiceSnapshot;
  focusEvent: EarthquakeEvent | null;
  events: EarthquakeEvent[];
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  lastUpdated: number;
  error: string | null;
}

// ── Constants ───────────────────────────────────────────────────

const TOKYO_CENTER = { lat: 35.65, lng: 139.78 };
const GRID_RADIUS_LAT = 0.25;
const GRID_RADIUS_LNG = 0.35;
const GRID_SIZE = 15;

const SIGNIFICANT_MAG = 4.5;
const SIGNIFICANT_HOURS = 24;

const JAPAN_BBOX = { minLat: 24, maxLat: 46, minLng: 122, maxLng: 150 };

const FETCH_TIMEOUT_MS = 8_000;

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
  if (import.meta.env.PROD) return 'https://api.namazue.dev';
  return '';
})();

// ── Server API Types ────────────────────────────────────────────

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

interface USGSFeature {
  properties: { mag: number; place: string; time: number; tsunami: number };
  geometry: { coordinates: [number, number, number] };
  id: string;
}

interface USGSResponse {
  features: USGSFeature[];
}

export interface FetchEventsResult {
  events: EarthquakeEvent[];
  source: 'server' | 'usgs';
  updatedAt: number;
}

// ── Fetch Layer ─────────────────────────────────────────────────

async function fetchWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function serverEventToEq(ev: ServerEvent): EarthquakeEvent | null {
  if (!Number.isFinite(ev.lat) || !Number.isFinite(ev.lng) ||
      !Number.isFinite(ev.depth_km) || !Number.isFinite(ev.magnitude)) {
    return null;
  }
  const parsedTime = typeof ev.time === 'number' ? ev.time : Date.parse(ev.time);
  if (!Number.isFinite(parsedTime)) return null;

  const ft: FaultType =
    ev.fault_type === 'crustal' || ev.fault_type === 'interface' || ev.fault_type === 'intraslab'
      ? ev.fault_type
      : classifyFaultType(ev.depth_km, ev.lat, ev.lng);

  return {
    id: ev.id,
    lat: ev.lat,
    lng: ev.lng,
    depth_km: ev.depth_km,
    magnitude: ev.magnitude,
    time: parsedTime,
    faultType: ft,
    tsunami: ev.tsunami === true,
    place: { text: ev.place ?? 'Unknown location' },
  };
}

function usgsFeatureToEq(f: USGSFeature): EarthquakeEvent {
  const [lng, lat, depth] = f.geometry.coordinates;
  return {
    id: f.id,
    lat,
    lng,
    depth_km: Math.max(0, depth),
    magnitude: f.properties.mag,
    time: f.properties.time,
    faultType: classifyFaultType(depth, lat, lng),
    tsunami: f.properties.tsunami === 1,
    place: { text: f.properties.place ?? 'Unknown location' },
  };
}

async function fetchFromApi(): Promise<EarthquakeEvent[]> {
  const url = `${API_BASE}/api/events?mag_min=2.5&lat_min=${JAPAN_BBOX.minLat}&lat_max=${JAPAN_BBOX.maxLat}&lng_min=${JAPAN_BBOX.minLng}&lng_max=${JAPAN_BBOX.maxLng}&limit=50`;
  const data = await fetchWithTimeout<ServerEventsResponse>(url);
  if (!Array.isArray(data.events)) return [];
  return data.events
    .map(serverEventToEq)
    .filter((e): e is EarthquakeEvent => e !== null);
}

async function fetchFromUsgs(): Promise<EarthquakeEvent[]> {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
  const data = await fetchWithTimeout<USGSResponse>(url);
  if (!Array.isArray(data.features)) return [];
  return data.features
    .filter((f) => {
      const [lng, lat] = f.geometry.coordinates;
      return lat >= JAPAN_BBOX.minLat && lat <= JAPAN_BBOX.maxLat &&
             lng >= JAPAN_BBOX.minLng && lng <= JAPAN_BBOX.maxLng;
    })
    .map(usgsFeatureToEq);
}

export async function fetchEventsWithMeta(): Promise<FetchEventsResult> {
  const updatedAt = Date.now();
  if (!API_BASE) {
    return {
      events: await fetchFromUsgs(),
      source: 'usgs',
      updatedAt,
    };
  }
  try {
    return {
      events: await fetchFromApi(),
      source: 'server',
      updatedAt,
    };
  } catch {
    return {
      events: await fetchFromUsgs(),
      source: 'usgs',
      updatedAt,
    };
  }
}

export async function fetchEvents(): Promise<EarthquakeEvent[]> {
  return (await fetchEventsWithMeta()).events;
}

// ── Compute Layer ───────────────────────────────────────────────

function selectFocusEvent(events: EarthquakeEvent[]): EarthquakeEvent | null {
  const cutoff = Date.now() - SIGNIFICANT_HOURS * 3600_000;
  const recent = events.filter((e) => e.time >= cutoff && e.magnitude >= SIGNIFICANT_MAG);
  if (recent.length === 0) return null;
  return recent.reduce((best, e) => (e.magnitude > best.magnitude ? e : best));
}

function buildLightGrid(event: EarthquakeEvent): IntensityGrid {
  const rows = GRID_SIZE;
  const cols = GRID_SIZE;
  const data = new Float32Array(rows * cols);

  const latMin = TOKYO_CENTER.lat - GRID_RADIUS_LAT;
  const lngMin = TOKYO_CENTER.lng - GRID_RADIUS_LNG;
  const latStep = (2 * GRID_RADIUS_LAT) / (rows - 1);
  const lngStep = (2 * GRID_RADIUS_LNG) / (cols - 1);

  for (let r = 0; r < rows; r++) {
    const lat = latMin + r * latStep;
    for (let c = 0; c < cols; c++) {
      const lng = lngMin + c * lngStep;
      const dist = haversine(event.lat, event.lng, lat, lng);
      const hypo = Math.sqrt(dist * dist + event.depth_km * event.depth_km);
      const result = computeGmpe({
        Mw: event.magnitude,
        depth_km: event.depth_km,
        distance_km: Math.max(hypo, 3),
        faultType: event.faultType,
      });
      data[r * cols + c] = Math.max(0, result.jmaIntensity);
    }
  }

  return {
    data,
    cols,
    rows,
    center: TOKYO_CENTER,
    radiusDeg: GRID_RADIUS_LAT,
    radiusLngDeg: GRID_RADIUS_LNG,
  };
}

function quickTsunami(event: EarthquakeEvent): TsunamiAssessment | null {
  if (!event.tsunami && event.magnitude < 6.5) return null;

  const risk: TsunamiAssessment['risk'] = event.tsunami
    ? (event.magnitude >= 7.5 ? 'high' : event.magnitude >= 6.5 ? 'moderate' : 'low')
    : 'low';

  return {
    risk,
    confidence: event.tsunami ? 'high' : 'medium',
    factors: event.tsunami ? ['USGS tsunami flag'] : ['magnitude-based estimate'],
    locationType: 'offshore',
    coastDistanceKm: null,
    faultType: event.faultType,
  };
}

// ── Time Formatting ─────────────────────────────────────────────

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} hr ago`;
  const days = Math.floor(diff / 86400_000);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function formatUtcTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ── State Builder ───────────────────────────────────────────────

export function computeServiceState(
  events: EarthquakeEvent[],
): Omit<ServiceState, 'status' | 'lastUpdated' | 'error'> {
  const sorted = [...events].sort((a, b) => b.time - a.time);
  const focus = selectFocusEvent(sorted);
  const assets = getMetroAssets('tokyo');

  if (!focus) {
    const latest = sorted[0];
    return {
      snapshot: {
        mode: 'calm',
        headline: 'No critical operational earthquake event',
        summary: 'Tokyo metro remains in calm monitoring posture. All launch assets are in nominal operating condition.',
        meta: latest
          ? ['System calm', `Latest: M${latest.magnitude.toFixed(1)}`, formatTimeAgo(latest.time)]
          : ['System calm', 'Monitoring active'],
      },
      focusEvent: null,
      events: sorted.slice(0, 12),
      exposures: assets.map((a) => ({
        assetId: a.id,
        severity: 'clear' as const,
        score: 0,
        summary: `${a.name} is in clear posture.`,
        reasons: ['no significant shaking'],
      })),
      priorities: [],
    };
  }

  const grid = buildLightGrid(focus);
  const tsunami = quickTsunami(focus);
  const exposures = buildAssetExposures({ grid, assets, tsunamiAssessment: tsunami });
  const priorities = buildOpsPriorities({ assets, exposures });

  const mag = `M${focus.magnitude.toFixed(1)}`;
  const depth = `${Math.round(focus.depth_km)} km depth`;
  const meta = [mag, depth, formatTimeAgo(focus.time), focus.place.text];

  return {
    snapshot: {
      mode: 'event',
      headline: `Operational impact forming near ${focus.place.text}`,
      summary: `Tokyo metro requires focused infrastructure review following a ${mag} event.`,
      meta,
    },
    focusEvent: focus,
    events: sorted.slice(0, 12),
    exposures,
    priorities,
  };
}

// ── Initial State ───────────────────────────────────────────────

export function createInitialState(): ServiceState {
  return {
    status: 'loading',
    snapshot: {
      mode: 'calm',
      headline: 'Initializing operations console',
      summary: 'Connecting to earthquake data feeds...',
      meta: ['Loading'],
    },
    focusEvent: null,
    events: [],
    exposures: [],
    priorities: [],
    lastUpdated: 0,
    error: null,
  };
}
