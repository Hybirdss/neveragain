/**
 * Rail Status Manager — Polls /api/rail for live Shinkansen operation status.
 *
 * Fetches ODPT-normalized rail status from the worker API every 60s.
 * Updates consoleStore.railStatuses so the rail layer can color by
 * live operation status (normal/delayed/suspended) rather than just
 * earthquake impact inference.
 */

import type { RailLineStatus } from '../types';

const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8_000;

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
  if (import.meta.env.PROD) return 'https://api.namazue.dev';
  return '';
})();

interface RailStatusResponse {
  lines: RailLineStatus[];
  source: string;
  updatedAt: number;
}

export interface RailStatusManager {
  start(): void;
  stop(): void;
}

export function createRailStatusManager(
  onUpdate: (statuses: RailLineStatus[]) => void,
): RailStatusManager {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function fetch_(): Promise<void> {
    if (!API_BASE) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(`${API_BASE}/api/rail`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;
      const data: RailStatusResponse = await res.json();
      if (Array.isArray(data.lines)) {
        onUpdate(data.lines);
      }
    } catch {
      // Non-critical — rail status is supplementary
    }
  }

  return {
    start() {
      fetch_();
      timer = setInterval(fetch_, POLL_INTERVAL_MS);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
