import type { RealtimeStatus, ServiceReadModel } from '../ops/readModelTypes';
import type { OpsAssetExposure, OpsPriority, ViewportState } from '../ops/types';
import type { EarthquakeEvent, IntensityGrid } from '../types';

const FETCH_TIMEOUT_MS = 8_000;

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
  if (import.meta.env.PROD) return 'https://api.namazue.dev';
  return '';
})();

interface SerializedIntensityGrid extends Omit<IntensityGrid, 'data'> {
  data: number[];
}

interface ConsoleSnapshotResponse {
  events: EarthquakeEvent[];
  mode: 'calm' | 'event';
  selectedEvent: EarthquakeEvent | null;
  intensityGrid: SerializedIntensityGrid | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
  sourceMeta: {
    source: RealtimeStatus['source'];
    updatedAt: number;
  };
}

export interface FetchConsoleSnapshotResult {
  events: EarthquakeEvent[];
  mode: 'calm' | 'event';
  selectedEvent: EarthquakeEvent | null;
  intensityGrid: IntensityGrid | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
  sourceMeta: {
    source: RealtimeStatus['source'];
    updatedAt: number;
  };
}

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

function deserializeGrid(grid: SerializedIntensityGrid | null): IntensityGrid | null {
  if (!grid) {
    return null;
  }

  return {
    ...grid,
    data: new Float32Array(grid.data),
  };
}

export async function fetchConsoleSnapshot(input: {
  viewport: ViewportState;
  selectedEventId?: string | null;
}): Promise<FetchConsoleSnapshotResult> {
  const params = new URLSearchParams({
    center_lat: String(input.viewport.center.lat),
    center_lng: String(input.viewport.center.lng),
    zoom: String(input.viewport.zoom),
    west: String(input.viewport.bounds[0]),
    south: String(input.viewport.bounds[1]),
    east: String(input.viewport.bounds[2]),
    north: String(input.viewport.bounds[3]),
  });

  if (input.selectedEventId) {
    params.set('selected_event_id', input.selectedEventId);
  }

  const base = API_BASE || '';
  const data = await fetchWithTimeout<ConsoleSnapshotResponse>(`${base}/api/ops/console?${params}`);

  return {
    ...data,
    intensityGrid: deserializeGrid(data.intensityGrid),
  };
}
