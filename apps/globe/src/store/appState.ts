/**
 * Namazue — Pub/Sub Reactive Store
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
  private isBatching = false;
  private pendingChanges = new Set<keyof T>();
  private prevStates = new Map<keyof T, any>();

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
   * If batching is active, listener execution is deferred.
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    const prev = this.state[key];
    if (prev === value) return;

    if (this.isBatching) {
      if (!this.pendingChanges.has(key)) {
        this.prevStates.set(key, prev);
        this.pendingChanges.add(key);
      }
      this.state[key] = value;
    } else {
      this.state[key] = value;
      const subs = this.listeners.get(key);
      if (subs) {
        subs.forEach((fn) => this.safeFire(fn, key, value, prev));
      }
    }
  }

  /** Fire a subscriber, catching errors so other subscribers keep running. */
  private safeFire<K extends keyof T>(fn: Listener<T[K]>, key: K, value: T[K], prev: T[K]): void {
    try {
      fn(value, prev);
    } catch (error) {
      console.error(`[Store] Subscriber error for "${String(key)}":`, error);
    }
  }

  /**
   * Run multiple updates and fire listeners only once at the end.
   */
  batch(fn: () => void): void {
    if (this.isBatching) {
      fn();
      return;
    }

    this.isBatching = true;
    try {
      fn();
    } finally {
      this.isBatching = false;
      const changes = Array.from(this.pendingChanges);
      this.pendingChanges.clear();

      changes.forEach((key) => {
        const value = this.state[key];
        const prev = this.prevStates.get(key);
        this.prevStates.delete(key);

        const subs = this.listeners.get(key);
        if (subs) {
          subs.forEach((fn) => this.safeFire(fn, key, value, prev));
        }
      });
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
  viewState: { type: 'idle' },
  activePanel: 'map',
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
    gsiFaults: false,
    gsiRelief: false,
    gsiSlope: false,
    gsiPale: false,
    adminBoundary: false,
    jshisHazard: false,
    activeFaults: false,
  },
  viewPreset: 'default',
  colorblind: false,
  plateauCity: null,
  selectedFault: null,
  impactResults: null,
  networkError: null,
  ai: {
    currentAnalysis: null,
    analysisLoading: false,
    analysisError: null,
    activeTab: 'easy',
    searchQuery: '',
    searchResults: null,
    searchLoading: false,
  },
};

// ============================================================
// Singleton Export
// ============================================================

export const store = new Store<AppState>(initialState);
export type { Store };
