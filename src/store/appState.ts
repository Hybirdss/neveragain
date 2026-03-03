/**
 * NeverAgain — Pub/Sub Reactive Store
 *
 * Framework-free reactive state management. Each key in the AppState can be
 * independently subscribed to; listeners fire only when the value reference
 * changes (strict equality check).
 *
 * Usage:
 *   store.subscribe('selectedEvent', (newVal, oldVal) => { ... });
 *   store.set('selectedEvent', someEvent);
 *   const current = store.get('selectedEvent');
 */

import type { AppState } from '../types';

// ============================================================
// Generic Store
// ============================================================

type Listener<T> = (value: T, prev: T) => void;

class Store<T extends Record<string, any>> {
  private state: T;
  private listeners: Map<keyof T, Set<Listener<any>>>;

  constructor(initial: T) {
    this.state = { ...initial };
    this.listeners = new Map();
  }

  /** Read the current value for a given state key. */
  get<K extends keyof T>(key: K): T[K] {
    return this.state[key];
  }

  /**
   * Update a state key. If the new value is referentially identical to the
   * current one the update is skipped (no-op) and no listeners fire.
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    const prev = this.state[key];
    if (prev === value) return;
    this.state[key] = value;
    const subs = this.listeners.get(key);
    if (subs) {
      subs.forEach((fn) => fn(value, prev));
    }
  }

  /**
   * Subscribe to changes on a specific state key.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe<K extends keyof T>(key: K, fn: Listener<T[K]>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(fn);
    return () => {
      this.listeners.get(key)?.delete(fn);
    };
  }
}

// ============================================================
// Initial State
// ============================================================

const now = Date.now();

const initialState: AppState = {
  mode: 'realtime',
  selectedEvent: null,
  intensityGrid: null,
  intensitySource: 'none',
  waveState: null,
  timeline: {
    events: [],
    currentIndex: -1,
    currentTime: now,
    isPlaying: false,
    speed: 1,
    timeRange: [now - 86_400_000, now], // past 24 hours
  },
  layers: {
    tectonicPlates: true,
    seismicPoints: true,
    waveRings: true,
    isoseismalContours: true,
    labels: true,
    shakeMapContours: false,
    slab2Contours: false,
    crossSection: false,
    plateauBuildings: false,
  },
  viewPreset: 'default',
  plateauCity: null,
};

// ============================================================
// Singleton Export
// ============================================================

export const store = new Store<AppState>(initialState);
export type { Store };
