/**
 * Console Store — Reactive state for the new spatial console.
 *
 * Reuses the proven pub/sub pattern from the legacy store,
 * but with a state shape designed for the Japan-wide console.
 */

import type { ActiveFault, EarthquakeEvent, IntensityGrid, RailLineStatus } from '../types';
import type { ViewportState } from './viewportManager';
import type { OpsAssetExposure, OpsPriority } from '../ops/types';
import type { RealtimeStatus, ServiceReadModel } from '../ops/readModelTypes';
import { createEmptyServiceReadModel } from '../ops/serviceReadModel';
import type { Vessel } from '../data/aisManager';
import {
  createDefaultBundleSettings,
  createDefaultLayerVisibility,
  type BundleSettings,
  type OperatorViewId,
} from '../layers/bundleRegistry';
import type { BundleId, LayerId } from '../layers/layerRegistry';

// ── Data Freshness ────────────────────────────────────────────

export interface DataFreshness {
  usgs: number;    // timestamp of last USGS data
  ais: number;     // timestamp of last AIS update
  odpt: number;    // timestamp of last ODPT rail update
}

// ── Console State ──────────────────────────────────────────────

export type ConsoleMode = 'calm' | 'event';

export interface ConsoleState {
  mode: ConsoleMode;
  viewport: ViewportState;
  selectedEvent: EarthquakeEvent | null;
  events: EarthquakeEvent[];
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
  intensityGrid: IntensityGrid | null;
  vessels: Vessel[];
  faults: ActiveFault[];
  railStatuses: RailLineStatus[];
  scenarioMode: boolean;
  layerVisibility: Record<LayerId, boolean>;
  activeBundleId: BundleId;
  activeViewId: OperatorViewId;
  bundleSettings: BundleSettings;
  bundleDrawerOpen: boolean;
  panelsVisible: boolean;
  showCoordinates: boolean;
  highlightedAssetId: string | null;
  sequenceSWaveKm: number | null;
  dataFreshness: DataFreshness;
}

// ── Store Implementation ───────────────────────────────────────

type Listener<T> = (value: T, prev: T) => void;

class ConsoleStore {
  private state: ConsoleState;
  private listeners = new Map<keyof ConsoleState, Set<Listener<any>>>();
  private batching = false;
  private pending: Array<{ key: keyof ConsoleState; value: any; prev: any }> = [];

  constructor(initial: ConsoleState) {
    this.state = { ...initial };
  }

  get<K extends keyof ConsoleState>(key: K): ConsoleState[K] {
    return this.state[key];
  }

  getState(): ConsoleState {
    return { ...this.state };
  }

  set<K extends keyof ConsoleState>(key: K, value: ConsoleState[K]): void {
    const prev = this.state[key];
    if (prev === value) return;
    this.state[key] = value;

    if (this.batching) {
      // Deduplicate: keep only the latest value per key
      const existing = this.pending.findIndex((p) => p.key === key);
      if (existing >= 0) {
        this.pending[existing].value = value;
      } else {
        this.pending.push({ key, value, prev });
      }
      return;
    }

    this.notify(key, value, prev);
  }

  /**
   * Batch multiple set() calls — subscribers fire once per key after fn completes.
   * Prevents cascading re-renders when updating mode + selectedEvent + grid + exposures etc.
   */
  batch(fn: () => void): void {
    this.batching = true;
    try {
      fn();
    } finally {
      this.batching = false;
      const deferred = this.pending.splice(0);
      for (const { key, value, prev } of deferred) {
        this.notify(key, value, prev);
      }
    }
  }

  subscribe<K extends keyof ConsoleState>(key: K, fn: Listener<ConsoleState[K]>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(fn);
    return () => { this.listeners.get(key)?.delete(fn); };
  }

  private notify(key: keyof ConsoleState, value: any, prev: any): void {
    const subs = this.listeners.get(key);
    if (subs) {
      for (const fn of subs) {
        try { fn(value, prev); }
        catch (err) { console.error(`[ConsoleStore] Error on "${String(key)}":`, err); }
      }
    }
  }
}

// ── Default State ──────────────────────────────────────────────

const defaultViewport: ViewportState = {
  center: { lat: 35.68, lng: 139.69 },
  zoom: 5.5,
  bounds: [122, 24, 150, 46],
  tier: 'national',
  pitch: 0,
  bearing: 0,
};

const defaultRealtimeStatus: RealtimeStatus = {
  source: 'server',
  state: 'stale',
  updatedAt: 0,
  staleAfterMs: 60_000,
};

const initialState: ConsoleState = {
  mode: 'calm',
  viewport: defaultViewport,
  selectedEvent: null,
  events: [],
  exposures: [],
  priorities: [],
  readModel: createEmptyServiceReadModel(defaultRealtimeStatus),
  realtimeStatus: defaultRealtimeStatus,
  intensityGrid: null,
  vessels: [],
  faults: [],
  railStatuses: [],
  scenarioMode: false,
  layerVisibility: createDefaultLayerVisibility(),
  activeBundleId: 'seismic',
  activeViewId: 'national-impact',
  bundleSettings: createDefaultBundleSettings(),
  bundleDrawerOpen: false,
  panelsVisible: true,
  showCoordinates: true,
  highlightedAssetId: null,
  sequenceSWaveKm: null,
  dataFreshness: { usgs: 0, ais: 0, odpt: 0 },
};

export const consoleStore = new ConsoleStore(initialState);
