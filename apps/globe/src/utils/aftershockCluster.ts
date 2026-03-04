/**
 * aftershockCluster.ts — Group earthquakes into mainshock + aftershock clusters
 *
 * Algorithm:
 * 1. Sort events by magnitude (descending)
 * 2. Largest unclaimed event becomes a "mainshock"
 * 3. Claim nearby events (within RADIUS_KM & TIME_WINDOW_MS) as aftershocks
 * 4. Aftershocks are events with smaller magnitude than their mainshock
 *
 * Returns a flat list of ClusteredEvent objects suitable for rendering.
 */

import type { EarthquakeEvent } from '../types';

// ── Constants ──

const CLUSTER_RADIUS_KM = 100;
const CLUSTER_TIME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Types ──

export interface ClusteredEvent {
  event: EarthquakeEvent;
  role: 'mainshock' | 'aftershock' | 'standalone';
  mainshockId: string | null;       // parent ID (null for mainshock/standalone)
  aftershockCount: number;           // number of aftershocks (only >0 for mainshocks)
  aftershocks: EarthquakeEvent[];    // child events (only for mainshocks)
}

// ── Haversine ──

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Public API ──

/**
 * Cluster earthquake events into mainshock/aftershock groups.
 *
 * Returns a Map from event ID to ClusteredEvent.
 */
export function clusterEvents(events: EarthquakeEvent[]): Map<string, ClusteredEvent> {
  const result = new Map<string, ClusteredEvent>();
  const claimed = new Set<string>();

  // Sort by magnitude descending, then by time ascending (earlier = mainshock on tie)
  const sorted = [...events].sort((a, b) => b.magnitude - a.magnitude || a.time - b.time);

  for (const ev of sorted) {
    if (claimed.has(ev.id)) continue;

    // This event is a potential mainshock — find its aftershocks
    const aftershocks: EarthquakeEvent[] = [];

    for (const candidate of sorted) {
      if (candidate.id === ev.id) continue;
      if (claimed.has(candidate.id)) continue;
      // Must be smaller, or same magnitude but later (tie-break by time)
      if (candidate.magnitude > ev.magnitude) continue;
      if (candidate.magnitude === ev.magnitude && candidate.time <= ev.time) continue;

      const dist = distanceKm(ev.lat, ev.lng, candidate.lat, candidate.lng);
      if (dist > CLUSTER_RADIUS_KM) continue;

      const timeDiff = Math.abs(candidate.time - ev.time);
      if (timeDiff > CLUSTER_TIME_WINDOW_MS) continue;

      aftershocks.push(candidate);
      claimed.add(candidate.id);
    }

    claimed.add(ev.id);

    if (aftershocks.length > 0) {
      // Sort aftershocks by time (newest first)
      aftershocks.sort((a, b) => b.time - a.time);

      result.set(ev.id, {
        event: ev,
        role: 'mainshock',
        mainshockId: null,
        aftershockCount: aftershocks.length,
        aftershocks,
      });

      for (const as of aftershocks) {
        result.set(as.id, {
          event: as,
          role: 'aftershock',
          mainshockId: ev.id,
          aftershockCount: 0,
          aftershocks: [],
        });
      }
    } else {
      result.set(ev.id, {
        event: ev,
        role: 'standalone',
        mainshockId: null,
        aftershockCount: 0,
        aftershocks: [],
      });
    }
  }

  return result;
}

/**
 * Build a display-ordered list from clustered events.
 * Mainshocks appear in their time-sorted position.
 * Aftershocks are grouped under their mainshock (not shown in the main list).
 */
export function getDisplayEvents(
  events: EarthquakeEvent[],
  clusters: Map<string, ClusteredEvent>,
): EarthquakeEvent[] {
  // Sort by time descending (newest first)
  const sorted = [...events].sort((a, b) => b.time - a.time);
  // Filter out aftershocks from the main list — they show under their mainshock
  return sorted.filter(ev => {
    const c = clusters.get(ev.id);
    return !c || c.role !== 'aftershock';
  });
}
