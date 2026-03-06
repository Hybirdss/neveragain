import type { OpsState, ViewportState } from './ops/types';
import type {
  RealtimeStatus,
  ReplayMilestone,
  ScenarioDelta,
  ServiceReadModel,
} from './ops/readModelTypes';

/**
 * Namazue — Shared Type Contracts
 *
 * 모든 에이전트(seismic-engine, globe-viz, dashboard-ui, data-pipeline)가
 * 이 파일의 인터페이스를 준수해야 한다.
 * 변경 시 전체 모듈 영향도를 반드시 확인할 것.
 */

// ============================================================
// Vs30 Grid (Feature 1: slope → Vs30 → GMPE precision)
// ============================================================

export interface Vs30Grid {
  data: Float32Array;  // Flat row-major array of Vs30 values (m/s)
  cols: number;
  rows: number;
  latMin: number;
  lngMin: number;
  step: number;        // Grid spacing in degrees (e.g. 0.1)
}

// ============================================================
// Slope Grid (Feature 5: landslide risk)
// ============================================================

export interface SlopeGrid {
  data: Float32Array;  // Flat row-major array of slope angles (degrees)
  cols: number;
  rows: number;
  latMin: number;
  lngMin: number;
  step: number;
}

// ============================================================
// Active Fault (Feature 2: fault click → scenario)
// ============================================================

export interface ActiveFault {
  id: string;
  name: string;         // Japanese name
  nameEn: string;       // English name
  segments: [number, number][];  // [lng, lat] polyline
  lengthKm: number;
  estimatedMw: number;  // Wells & Coppersmith (1994): log(L) → Mw
  depthKm: number;
  faultType: FaultType;
  interval: string;     // e.g. "1000-2000年"
  probability30yr: string; // e.g. "ほぼ0-5%"
  source?: string;      // HERP evaluation document reference
}

// ============================================================
// Prefecture (Feature 3: impact assessment)
// ============================================================

export interface Prefecture {
  id: string;
  name: string;         // Japanese name
  nameEn: string;       // English name
  centroid: { lat: number; lng: number };
  population: number;
}

export interface PrefectureImpact {
  id: string;
  name: string;
  nameEn: string;
  maxIntensity: number;
  jmaClass: JmaClass;
  population: number;
  exposedPopulation: number;  // Population in JMA 4+ zone
}

// ============================================================
// Hazard Comparison Grid (Feature 4: J-SHIS comparison)
// ============================================================

export interface HazardGrid {
  data: Float32Array;  // Expected JMA intensity (30yr exceedance)
  cols: number;
  rows: number;
  latMin: number;
  lngMin: number;
  step: number;
}

export interface ComparisonGrid {
  data: Float32Array;  // Difference: GMPE intensity - hazard expected
  cols: number;
  rows: number;
  center: { lat: number; lng: number };
  radiusDeg: number;
}

// ============================================================
// Landslide Risk Grid (Feature 5)
// ============================================================

export type LandslideRisk = 'low' | 'medium' | 'high';

export interface LandslideGrid {
  data: Float32Array;  // Newmark displacement (cm), row-major
  cols: number;
  rows: number;
  center: { lat: number; lng: number };
  radiusDeg: number;
}

// ============================================================
// Earthquake Event (data-pipeline → all modules)
// ============================================================

export type FaultType = 'crustal' | 'interface' | 'intraslab';

export interface EarthquakeEvent {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: number; // Unix timestamp (ms)
  faultType: FaultType;
  tsunami: boolean;
  place: {
    text: string;
    lang?: string;
    regionCode?: string;
  };
}

// ============================================================
// GMPE Engine (seismic-engine → globe-viz, dashboard-ui)
// ============================================================

export interface GmpeInput {
  Mw: number;          // Moment magnitude (capped at 8.3 in engine)
  depth_km: number;    // Focal depth D (km)
  distance_km: number; // Rupture distance X (km)
  faultType: FaultType;
}

export interface GmpeResult {
  pgv600: number;       // PGV at Vs30=600 m/s (cm/s)
  pgv_surface: number;  // PGV at Vs30=400 m/s (cm/s), = pgv600 × 1.41
  jmaIntensity: number; // Continuous JMA instrumental intensity
  jmaClass: JmaClass;   // Discrete JMA display level
}

export type JmaClass = '0' | '1' | '2' | '3' | '4' | '5-' | '5+' | '6-' | '6+' | '7';

// ============================================================
// Rail Operation Status (ODPT/JR feeds → rail layer)
// ============================================================

export type RailOperationStatus = 'normal' | 'delayed' | 'suspended' | 'partial' | 'unknown';

export interface RailLineStatus {
  lineId: string;
  status: RailOperationStatus;
  cause?: string;
  statusText?: string;
  updatedAt: number;
}

// ============================================================
// Intensity Grid (seismic-engine → globe-viz)
// ============================================================

export interface IntensityGrid {
  data: Float32Array;  // Flat array of JMA intensities, row-major
  cols: number;        // Grid columns (longitude direction)
  rows: number;        // Grid rows (latitude direction)
  center: { lat: number; lng: number };
  radiusDeg: number;   // Half-span in degrees from center (latitude)
  radiusLngDeg?: number; // Half-span in lng degrees (defaults to radiusDeg if omitted)
}

// ============================================================
// Wave Propagation (seismic-engine → globe-viz)
// ============================================================

export interface WaveState {
  epicenter: { lat: number; lng: number };
  depth_km: number;
  pWaveRadiusDeg: number;  // Current P-wave front radius (degrees)
  sWaveRadiusDeg: number;  // Current S-wave front radius (degrees)
  elapsedSec: number;      // Seconds since earthquake origin time
}

export interface WaveConfig {
  vpKmPerSec: number;   // P-wave velocity (default: 6.0)
  vsKmPerSec: number;   // S-wave velocity (default: 3.5)
}

// ============================================================
// Timeline (dashboard-ui → globe-viz, seismic-engine)
// ============================================================

export interface TimelineState {
  events: EarthquakeEvent[];
  currentIndex: number;
  currentTime: number; // Simulated Unix timestamp (ms)
  isPlaying: boolean;
  speed: number;       // Multiplier: 1, 10, 100, 1000
  timeRange: [number, number]; // [start, end] Unix ms
}

// ============================================================
// App State (store → all modules)
// ============================================================

export type AppMode = 'realtime' | 'timeline' | 'scenario';

// ── PLATEAU 3D Buildings ─────────────────────────────────

export type PlateauCityId =
  | 'chiyoda' | 'chuo' | 'minato' | 'shinjuku' | 'shibuya'
  | 'yokohama' | 'kawasaki' | 'saitama' | 'chiba'
  | 'osaka' | 'nagoya' | 'kyoto'
  | 'sapporo' | 'sendai' | 'hiroshima' | 'fukuoka' | 'kitakyushu'
  | 'niigata' | 'shizuoka' | 'hamamatsu' | 'kumamoto' | 'naha'
  | 'kanazawa' | 'gifu' | 'okayama' | 'takamatsu'
  | 'utsunomiya' | 'maebashi' | 'kofu' | 'fukushima'
  | 'wakayama' | 'tottori' | 'tokushima' | 'matsuyama' | 'kochi';

export interface PlateauCityConfig {
  id: PlateauCityId;
  nameKey: string;
  tilesetUrl: string;
  center: { lat: number; lng: number };
}

// ── Navigation State ──────────────────────────────────────

export type PanelTab = 'map' | 'live' | 'detail';

// ── Tsunami Assessment (computed once per selection) ─────────

export interface TsunamiAssessment {
  risk: 'high' | 'moderate' | 'low' | 'none';
  confidence: 'high' | 'medium';
  factors: string[];
  locationType: 'offshore' | 'near_coast' | 'inland';
  coastDistanceKm: number | null;
  faultType: string;
}

// ── AI Analysis State ──────────────────────────────────────

export type AiTab = 'easy' | 'expert' | 'data';

export interface AiState {
  currentAnalysis: unknown | null;  // EarthquakeAnalysis from @namazue/db
  analysisLoading: boolean;
  analysisError: string | null;
  activeTab: AiTab;
  searchQuery: string;
  searchResults: unknown[] | null;
  searchLoading: boolean;
}

// ── Presentation View Models ────────────────────────────────────

export type PresentationLocale = 'en' | 'ko' | 'ja';

export interface PresentationTsunamiSummary {
  risk: TsunamiAssessment['risk'];
  label: string;
  detail: string;
}

export interface PresentationHeroSummary {
  state: 'empty' | 'loading' | 'ready';
  headline: string;
  message: string;
  place: string;
  relativeTime: string;
  magnitudeLabel: string;
  depthLabel: string;
  severity: JmaClass | 'none';
  tsunami: PresentationTsunamiSummary | null;
}

export interface PresentationLiveFeedSummary {
  place: string;
  relativeTime: string;
  magnitudeLabel: string;
  meaning: string;
  severity: JmaClass;
  tsunamiLabel: string | null;
}

export interface PresentationDetailSummary {
  headline: string;
  summary: string;
  place: string;
  relativeTime: string;
  magnitudeLabel: string;
  depthLabel: string;
  severity: JmaClass;
  intensityLabel: string;
  intensityMeaning: string;
  tsunami: PresentationTsunamiSummary | null;
  actionItems: string[];
  rawFacts: Array<{ label: string; value: string }>;
}

export interface PresentationEvidenceSummary {
  expertSummary: string | null;
  comparisonNarrative: string | null;
  similarities: string[];
  differences: string[];
}

export interface PresentationShareSummary {
  shortText: string;
  lines: string[];
}

// ── App State ──────────────────────────────────────────────

export interface AppState {
  mode: AppMode;
  viewState: ViewState;
  activePanel: PanelTab;
  selectedEvent: EarthquakeEvent | null;
  ops: OpsState;
  viewportState: ViewportState | null;
  serviceReadModel: ServiceReadModel | null;
  realtimeStatus: RealtimeStatus;
  replayMilestones: ReplayMilestone[];
  scenarioDelta: ScenarioDelta | null;
  tsunamiAssessment: TsunamiAssessment | null;
  intensityGrid: IntensityGrid | null;
  intensitySource: IntensitySource;
  waveState: WaveState | null;
  timeline: TimelineState;
  layers: LayerVisibility;
  viewPreset: ViewPreset;
  colorblind: boolean;
  plateauCity: PlateauCityId | null;
  selectedFault: ActiveFault | null;
  impactResults: PrefectureImpact[] | null;
  networkError: string | null;
  ai: AiState;
}

export interface LayerVisibility {
  tectonicPlates: boolean;
  seismicPoints: boolean;
  waveRings: boolean;
  isoseismalContours: boolean;
  labels: boolean;
  shakeMapContours: boolean;
  slab2Contours: boolean;
  crossSection: boolean;
  plateauBuildings: boolean;
  gsiFaults: boolean;
  gsiRelief: boolean;
  gsiSlope: boolean;
  gsiPale: boolean;
  adminBoundary: boolean;
  jshisHazard: boolean;
  activeFaults: boolean;
}

export type ViewPreset = 'default' | 'underground' | 'shakemap' | 'crossSection';
export type IntensitySource = 'none' | 'shakemap' | 'gmpe';

// ============================================================
// Worker Messages (seismic-engine internal)
// ============================================================

export type GmpeWorkerRequest =
  | {
    type: 'SET_VS30_GRID';
    vs30Grid: Vs30GridTransfer;
  }
  | {
    type: 'COMPUTE_GRID';
    requestId: string;
    epicenter: { lat: number; lng: number };
    Mw: number;
    depth_km: number;
    faultType: FaultType;
    gridSpacingDeg: number;
    radiusDeg: number;
  };

/** Serializable version of Vs30Grid for Worker transfer */
export interface Vs30GridTransfer {
  data: ArrayBuffer;
  cols: number;
  rows: number;
  latMin: number;
  lngMin: number;
  step: number;
}

export interface GmpeWorkerResponse {
  type: 'GRID_COMPLETE';
  requestId: string;
  grid: IntensityGrid;
}

/** Compact subfault format matching nankai-subfaults.json */
export interface SubfaultRaw {
  la: number;  // latitude
  lo: number;  // longitude
  d: number;   // depth km
  s: number;   // slip m
  st: number;  // strike deg
  di: number;  // dip deg
  ra: number;  // rake deg
}

export interface NankaiWorkerRequest {
  type: 'NANKAI_CHUNK';
  subfaults: SubfaultRaw[];
  sharedBuffer: SharedArrayBuffer;
  gridCols: number;
  gridRows: number;
  latMin: number;
  lngMin: number;
  step: number;
}

/** Full-name subfault type for documentation / display purposes */
export interface NankaiSubfault {
  lat: number;
  lng: number;
  depth_km: number;
  Mw: number;
  slip_m: number;
  strike: number;  // degrees
  dip: number;     // degrees
  rake: number;    // degrees
}

// ============================================================
// View State Machine (UI state transitions)
// ============================================================

export type ViewState =
  | { type: 'idle' }
  | { type: 'detail'; earthquakeId: string }
  | { type: 'analysis'; earthquakeId: string }
  | { type: 'search'; query: string }
  | { type: 'regionReport'; regionId: string; query: string }
  | { type: 'newQuake'; earthquakeId: string; magnitude: number }
  | { type: 'presentation'; earthquakeId: string | null };

export type ViewAction =
  | { type: 'SELECT_EARTHQUAKE'; id: string }
  | { type: 'DESELECT' }
  | { type: 'EXPAND_ANALYSIS' }
  | { type: 'COLLAPSE_ANALYSIS' }
  | { type: 'OPEN_SEARCH' }
  | { type: 'SEARCH'; query: string }
  | { type: 'SELECT_REGION'; regionId: string }
  | { type: 'CLOSE_OVERLAY' }
  | { type: 'NEW_EARTHQUAKE'; id: string; magnitude: number }
  | { type: 'ENTER_PRESENTATION' }
  | { type: 'EXIT_PRESENTATION' }
  | { type: 'BACK' };

// ============================================================
// Historical Presets
// ============================================================

export interface HistoricalPreset {
  id: string;
  name: string;
  epicenter: { lat: number; lng: number };
  Mw: number;
  depth_km: number;
  faultType: FaultType;
  usgsId: string | null;
  startTime: string | null; // ISO 8601
  description: string;
}

// ============================================================
// JMA Color Scale
// ============================================================

export const JMA_COLORS: Record<JmaClass, string> = {
  '0': '#9bbfd4',
  '1': '#6699cc',
  '2': '#3399cc',
  '3': '#33cc66',
  '4': '#ffff00',
  '5-': '#ff9900',
  '5+': '#ff6600',
  '6-': '#ff3300',
  '6+': '#cc0000',
  '7': '#990099',
};

/**
 * Colorblind-safe palette (CUD - Color Universal Design inspired)
 */
export const JMA_COLORS_ACCESSIBLE: Record<JmaClass, string> = {
  '0': '#eeeeee', // Light Grey
  '1': '#a0d8ef', // Sky Blue
  '2': '#00a0e9', // Blue
  '3': '#009944', // Green
  '4': '#fff100', // Yellow
  '5-': '#f39800', // Orange
  '5+': '#e95412', // Vermillion
  '6-': '#e60012', // Red
  '6+': '#a40000', // Dark Red
  '7': '#500050', // Dark Purple
};

export function getJmaColor(jmaClass: JmaClass, isColorblind: boolean = false): string {
  return isColorblind ? JMA_COLORS_ACCESSIBLE[jmaClass] : JMA_COLORS[jmaClass];
}

export const JMA_THRESHOLDS: { class: JmaClass; min: number }[] = [
  { class: '7', min: 6.5 },
  { class: '6+', min: 6.0 },
  { class: '6-', min: 5.5 },
  { class: '5+', min: 5.0 },
  { class: '5-', min: 4.5 },
  { class: '4', min: 3.5 },
  { class: '3', min: 2.5 },
  { class: '2', min: 1.5 },
  { class: '1', min: 0.5 },
  { class: '0', min: -Infinity },
];
