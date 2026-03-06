import type { ConsoleSnapshot } from '@namazue/contracts';
import type { IntensityGrid, ViewportState } from '@namazue/kernel';

const FETCH_TIMEOUT_MS = 8_000;

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
  if (import.meta.env.PROD) return 'https://api.namazue.dev';
  return '';
})();

export interface FetchConsoleSnapshotResult extends Omit<ConsoleSnapshot, 'intensityGrid'> {
  intensityGrid: IntensityGrid | null;
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

function deserializeGrid(grid: ConsoleSnapshot['intensityGrid']): IntensityGrid | null {
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
  const data = await fetchWithTimeout<ConsoleSnapshot>(`${base}/api/ops/console?${params}`);

  return {
    ...data,
    intensityGrid: deserializeGrid(data.intensityGrid),
  };
}
