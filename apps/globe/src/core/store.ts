/**
 * Console Store — Reactive state for the new spatial console.
 *
 * Reuses the proven pub/sub pattern from the legacy store,
 * but with a state shape designed for the Japan-wide console.
 */

import type { ActiveFault, EarthquakeEvent, IntensityGrid } from '../types';
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

// ── Console State ──────────────────────────────────────────────

export type ConsoleMode = 'calm' | 'event';

export interface ConsoleState {
  mode: ConsoleMode;
  viewport: ViewportState;
  selectedEvent: EarthquakeEvent | null;
  events: EarthquakeEvent[];
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  readModel: ServiceReadModel | null;
  realtimeStatus: RealtimeStatus;
  intensityGrid: IntensityGrid | null;
  vessels: Vessel[];
  faults: ActiveFault[];
  scenarioMode: boolean;
  layerVisibility: Record<LayerId, boolean>;
  activeBundleId: BundleId;
  activeViewId: OperatorViewId;
  bundleSettings: BundleSettings;
  bundleDrawerOpen: boolean;
  panelsVisible: boolean;
}

// ── Store Implementation ───────────────────────────────────────

type Listener<T> = (value: T, prev: T) => void;

class ConsoleStore {
  private state: ConsoleState;
  private listeners = new Map<keyof ConsoleState, Set<Listener<any>>>();

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
    const subs = this.listeners.get(key);
    if (subs) {
      for (const fn of subs) {
        try { fn(value, prev); }
        catch (err) { console.error(`[ConsoleStore] Error on "${String(key)}":`, err); }
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
  scenarioMode: false,
  layerVisibility: createDefaultLayerVisibility(),
  activeBundleId: 'seismic',
  activeViewId: 'national-impact',
  bundleSettings: createDefaultBundleSettings(),
  bundleDrawerOpen: false,
  panelsVisible: true,
};

export const consoleStore = new ConsoleStore(initialState);
