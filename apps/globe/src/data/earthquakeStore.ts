/**
 * Namazue — Normalized Earthquake Data Store
 *
 * Single source of truth for earthquake data from all sources (USGS, JMA).
 * Handles deduplication, normalization, and sorted retrieval.
 *
 * Design:
 *   - Map<id, EarthquakeEvent> for O(1) lookup
 *   - Sorted array cache invalidated on mutation
 *   - Listener-based change notification
 *   - 7-day retention window (auto-prune)
 *
 * Safety:
 *   - Timestamps are always validated
 *   - Duplicate IDs are resolved by latest update time
 *   - No data is silently dropped — conflicts are logged
 */

import type { EarthquakeEvent } from '../types';
import {
  buildCanonicalEventEnvelope,
  pickPreferredEventEnvelope,
  type CanonicalEventEnvelope,
  type CanonicalEventSource,
} from './eventEnvelope';

export type EarthquakeFilter = {
  minMagnitude?: number;
  maxDepth?: number;
  hoursAgo?: number;
  bounds?: { latMin: number; latMax: number; lngMin: number; lngMax: number };
};

type ChangeListener = (events: ReadonlyArray<EarthquakeEvent>) => void;

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface EarthquakeUpsertOptions {
  source?: CanonicalEventSource;
  issuedAt?: number;
  receivedAt?: number;
}

class EarthquakeStore {
  private byId = new Map<string, CanonicalEventEnvelope>();
  private sortedCache: EarthquakeEvent[] | null = null;
  private listeners = new Set<ChangeListener>();

  /** Insert or update earthquakes. Deduplicates by ID. */
  upsert(events: EarthquakeEvent[], options: EarthquakeUpsertOptions = {}): { added: number; updated: number } {
    let added = 0;
    let updated = 0;

    for (const event of events) {
      // Validate: must have valid timestamp
      if (!event.time || !event.id) {
        if (import.meta.env.DEV) {
          console.warn('[earthquakeStore] Skipping invalid event:', event);
        }
        continue;
      }

      const incoming = buildCanonicalEventEnvelope({
        event,
        source: options.source ?? 'server',
        issuedAt: options.issuedAt,
        receivedAt: options.receivedAt,
      });
      const existing = this.byId.get(event.id);
      if (existing) {
        const preferred = pickPreferredEventEnvelope(existing, incoming);
        if (preferred !== existing) {
          this.byId.set(event.id, {
            ...preferred,
            supersedes: existing.revision,
          });
          updated++;
        }
      } else {
        this.byId.set(event.id, incoming);
        added++;
      }
    }

    if (added > 0 || updated > 0) {
      this.invalidateCache();
      this.notify();
    }

    return { added, updated };
  }

  /** Get a single earthquake by ID. */
  get(id: string): EarthquakeEvent | undefined {
    return this.byId.get(id)?.event;
  }

  /** Get the canonical envelope for a single earthquake. */
  getEnvelope(id: string): CanonicalEventEnvelope | undefined {
    return this.byId.get(id);
  }

  /** Get all earthquakes, sorted by time descending (newest first). */
  getAll(): ReadonlyArray<EarthquakeEvent> {
    if (!this.sortedCache) {
      this.sortedCache = Array.from(this.byId.values())
        .sort((a, b) => b.event.time - a.event.time)
        .map((entry) => entry.event);
    }
    return this.sortedCache;
  }

  /** Get all canonical envelopes, sorted by observed time descending. */
  getAllEnvelopes(): ReadonlyArray<CanonicalEventEnvelope> {
    return Array.from(this.byId.values())
      .sort((a, b) => b.event.time - a.event.time);
  }

  /** Get earthquakes from the last N hours, sorted newest first. */
  getRecent(hours: number): ReadonlyArray<EarthquakeEvent> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.getAll().filter(e => e.time >= cutoff);
  }

  /** Get the largest earthquake in the last N hours. */
  getLargestRecent(hours: number): EarthquakeEvent | null {
    const recent = this.getRecent(hours);
    if (recent.length === 0) return null;
    return recent.reduce((max, e) => e.magnitude > max.magnitude ? e : max);
  }

  /** Filter earthquakes by criteria. */
  filter(criteria: EarthquakeFilter): ReadonlyArray<EarthquakeEvent> {
    let results = this.getAll();

    if (criteria.minMagnitude !== undefined) {
      results = results.filter(e => e.magnitude >= criteria.minMagnitude!);
    }
    if (criteria.maxDepth !== undefined) {
      results = results.filter(e => e.depth_km <= criteria.maxDepth!);
    }
    if (criteria.hoursAgo !== undefined) {
      const cutoff = Date.now() - criteria.hoursAgo * 60 * 60 * 1000;
      results = results.filter(e => e.time >= cutoff);
    }
    if (criteria.bounds) {
      const { latMin, latMax, lngMin, lngMax } = criteria.bounds;
      results = results.filter(e =>
        e.lat >= latMin && e.lat <= latMax &&
        e.lng >= lngMin && e.lng <= lngMax
      );
    }

    return results;
  }

  /** Find earthquakes near a location within a radius (degrees). */
  findNear(lat: number, lng: number, radiusDeg: number): ReadonlyArray<EarthquakeEvent> {
    return this.getAll().filter(e => {
      const dlat = e.lat - lat;
      const dlng = e.lng - lng;
      return (dlat * dlat + dlng * dlng) <= radiusDeg * radiusDeg;
    });
  }

  /** Prune events older than retention window. */
  prune(): number {
    const cutoff = Date.now() - RETENTION_MS;
    let pruned = 0;

    for (const [id, event] of this.byId) {
      if (event.event.time < cutoff) {
        this.byId.delete(id);
        pruned++;
      }
    }

    if (pruned > 0) {
      this.invalidateCache();
      this.notify();
    }

    return pruned;
  }

  /** Total number of earthquakes in store. */
  get size(): number {
    return this.byId.size;
  }

  /** Subscribe to changes. Returns unsubscribe function. */
  subscribe(fn: ChangeListener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Clear all data. */
  clear(): void {
    this.byId.clear();
    this.invalidateCache();
    this.notify();
  }

  // ── Internal ──────────────────────────────────

  private invalidateCache(): void {
    this.sortedCache = null;
  }

  private notify(): void {
    const events = this.getAll();
    for (const fn of this.listeners) {
      try {
        fn(events);
      } catch (err) {
        console.error('[earthquakeStore] Listener error:', err);
      }
    }
  }
}

// Singleton
export const earthquakeStore = new EarthquakeStore();
